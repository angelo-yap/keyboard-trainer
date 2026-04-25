import cv2
import mediapipe as mp
import numpy as np
import time
import json
import os
import sys
import threading

# ── Thread-safe frame buffer ──────────────────────────────────────────────────
_frame_lock = threading.Lock()
_latest_frame: bytes | None = None

# ── Thread-safe state ─────────────────────────────────────────────────────────
_state_lock = threading.Lock()
_current_state: dict = {"verdict": "IDLE", "wrong_fingers": [], "timestamp": 0.0}

# ── Calibrator reference (set when run() is active) ───────────────────────────
_calib_lock = threading.Lock()
_calibrator_ref: "KeyboardCalibrator | None" = None

# ── Public API ────────────────────────────────────────────────────────────────

def get_latest_frame() -> bytes | None:
    with _frame_lock:
        return _latest_frame

def get_state() -> dict:
    with _state_lock:
        return dict(_current_state)

def is_calibrated() -> bool:
    with _calib_lock:
        return _calibrator_ref is not None and _calibrator_ref.calibrated

def set_calibration_corners(corners: list) -> bool:
    """Set all four calibration corners at once (TL, TR, BR, BL). Returns True on success."""
    with _calib_lock:
        if _calibrator_ref is None:
            return False
        _calibrator_ref.corners = [tuple(c) for c in corners]
        _calibrator_ref._compute_transform()
        return True

def reset_calibration():
    with _calib_lock:
        if _calibrator_ref is None:
            return
        _calibrator_ref.corners = []
        _calibrator_ref.calibrated = False
        _calibrator_ref.transform = None
        _calibrator_ref.inv_transform = None


# ── Shared state file (used when run standalone) ──────────────────────────────

SHARED_STATE_FILE = "typing_state.json"

def write_state(verdict: str, wrong_fingers: list):
    state = {
        "verdict": verdict,
        "wrong_fingers": wrong_fingers,
        "timestamp": time.time(),
    }
    try:
        tmp = SHARED_STATE_FILE + ".tmp"
        with open(tmp, "w") as f:
            json.dump(state, f)
        os.replace(tmp, SHARED_STATE_FILE)
    except IOError as e:
        print(f"Warning: Could not write state file: {e}")


# ── Finger / zone constants ───────────────────────────────────────────────────

FINGER_TIPS = {"THUMB": 4, "INDEX": 8, "MIDDLE": 12, "RING": 16, "PINKY": 20}

KEYBOARD_ZONES = [
    (0.00, 0.11, "L_PINKY_ZONE",  {"L_PINKY"}),
    (0.11, 0.18, "L_RING_ZONE",   {"L_RING"}),
    (0.18, 0.25, "L_MIDDLE_ZONE", {"L_MIDDLE"}),
    (0.25, 0.38, "L_INDEX_ZONE",  {"L_INDEX"}),
    (0.38, 0.54, "R_INDEX_ZONE",  {"R_INDEX"}),
    (0.54, 0.62, "R_MIDDLE_ZONE", {"R_MIDDLE"}),
    (0.62, 0.70, "R_RING_ZONE",   {"R_RING"}),
    (0.70, 1.00, "R_PINKY_ZONE",  {"R_PINKY"}),
]

SPACEBAR_Y_FRAC = 0.85

ZONE_COLORS = {
    "L_PINKY_ZONE":  (200, 100, 255),
    "L_RING_ZONE":   (255, 140,  80),
    "L_MIDDLE_ZONE": (80,  200, 255),
    "L_INDEX_ZONE":  (100, 255, 120),
    "R_INDEX_ZONE":  (100, 220, 120),
    "R_MIDDLE_ZONE": (80,  180, 255),
    "R_RING_ZONE":   (255, 160,  60),
    "R_PINKY_ZONE":  (180,  80, 255),
    "SPACEBAR":      (200, 200, 200),
}

FINGER_LABEL_MAP = {
    ("Left",  "PINKY"):  "L_PINKY",
    ("Left",  "RING"):   "L_RING",
    ("Left",  "MIDDLE"): "L_MIDDLE",
    ("Left",  "INDEX"):  "L_INDEX",
    ("Left",  "THUMB"):  "L_THUMB",
    ("Right", "THUMB"):  "R_THUMB",
    ("Right", "INDEX"):  "R_INDEX",
    ("Right", "MIDDLE"): "R_MIDDLE",
    ("Right", "RING"):   "R_RING",
    ("Right", "PINKY"):  "R_PINKY",
}

ROW_STAGGER = [
    -0.02,  # Number row (top)
    0.01,   # QWERTY row
    0.02,   # ASDF row (home row)
    0.05,   # ZXCV row
    0.10,   # Spacebar row (heavily centered)
]
ROW_Y = [0.0, 0.20, 0.42, 0.63, SPACEBAR_Y_FRAC, 1.0]


# ── Keyboard calibrator ───────────────────────────────────────────────────────

class KeyboardCalibrator:
    def __init__(self):
        self.corners = []
        self.calibrated = False
        self.transform = None
        self.inv_transform = None

    def mouse_callback(self, event, x, y, flags, param):
        if event == cv2.EVENT_LBUTTONDOWN and len(self.corners) < 4:
            self.corners.append((x, y))
            print(f"Corner {len(self.corners)} set: ({x}, {y})")
            if len(self.corners) == 4:
                self._compute_transform()

    def _compute_transform(self):
        src = np.float32(self.corners)
        dst = np.float32([[0, 0], [1, 0], [1, 1], [0, 1]])
        self.transform = cv2.getPerspectiveTransform(src, dst)
        self.inv_transform = cv2.getPerspectiveTransform(dst, src)
        self.calibrated = True
        print("[OK] Keyboard calibrated!")

    def image_to_keyboard(self, x, y):
        pt = np.float32([[[x, y]]])
        result = cv2.perspectiveTransform(pt, self.transform)
        return float(result[0][0][0]), float(result[0][0][1])

    def draw_overlay(self, frame):
        if self.calibrated:
            self._draw_zones(frame)
        elif len(self.corners) >= 2:
            for i in range(len(self.corners) - 1):
                cv2.line(frame, self.corners[i], self.corners[i + 1], (0, 255, 255), 2)

    def _draw_zones(self, frame):
        overlay = frame.copy()

        def kb_to_img(fx, fy):
            pt = np.float32([[[fx, fy]]])
            res = cv2.perspectiveTransform(pt, self.inv_transform)
            return int(res[0][0][0]), int(res[0][0][1])

        for (x0, x1, zone_name, _) in KEYBOARD_ZONES:
            color = ZONE_COLORS.get(zone_name, (128, 128, 128))
            left_pts = [
                kb_to_img(x0 + ROW_STAGGER[0], ROW_Y[0]),
                kb_to_img(x0 + ROW_STAGGER[1], ROW_Y[1]),
                kb_to_img(x0 + ROW_STAGGER[2], ROW_Y[2]),
                kb_to_img(x0 + ROW_STAGGER[3], ROW_Y[3]),
                kb_to_img(x0 + ROW_STAGGER[4], ROW_Y[4]),
            ]
            right_pts = [
                kb_to_img(x1 + ROW_STAGGER[4], ROW_Y[4]),
                kb_to_img(x1 + ROW_STAGGER[3], ROW_Y[3]),
                kb_to_img(x1 + ROW_STAGGER[2], ROW_Y[2]),
                kb_to_img(x1 + ROW_STAGGER[1], ROW_Y[1]),
                kb_to_img(x1 + ROW_STAGGER[0], ROW_Y[0]),
            ]
            pts = np.array(left_pts + right_pts, dtype=np.int32)
            cv2.fillPoly(overlay, [pts], color)

            cx, cy = kb_to_img((x0 + x1) / 2 + ROW_STAGGER[2], ROW_Y[2] + 0.05)
            label = zone_name.replace("_ZONE", "").replace("_", "\n")
            for i, line in enumerate(label.split("\n")):
                cv2.putText(overlay, line, (cx - 25, cy + i * 16),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1)

        space_pts = np.array([
            kb_to_img(0.0, SPACEBAR_Y_FRAC), kb_to_img(1.0, SPACEBAR_Y_FRAC),
            kb_to_img(1.0, 1.0),             kb_to_img(0.0, 1.0),
        ], dtype=np.int32)
        cv2.fillPoly(overlay, [space_pts], ZONE_COLORS["SPACEBAR"])
        cx, cy = kb_to_img(0.5, 0.90)
        cv2.putText(overlay, "SPACE (Thumbs)", (cx - 60, cy),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.45, (50, 50, 50), 1)

        cv2.addWeighted(overlay, 0.3, frame, 0.7, 0, frame)


# ── Zone helpers ──────────────────────────────────────────────────────────────

def get_stagger_for_y(fy):
    for i in range(len(ROW_Y) - 1):
        if ROW_Y[i] <= fy <= ROW_Y[i + 1]:
            t = (fy - ROW_Y[i]) / (ROW_Y[i + 1] - ROW_Y[i])
            top = ROW_STAGGER[i] if i < len(ROW_STAGGER) else ROW_STAGGER[-1]
            bot = ROW_STAGGER[i + 1] if i + 1 < len(ROW_STAGGER) else ROW_STAGGER[-1]
            return top + t * (bot - top)
    return 0.0


def get_zone_for_keyboard_point(fx, fy):
    if fy > SPACEBAR_Y_FRAC:
        return "SPACEBAR", {"L_THUMB", "R_THUMB"}
    adjusted_fx = fx - get_stagger_for_y(fy)
    for (x0, x1, zone_name, correct) in KEYBOARD_ZONES:
        if x0 <= adjusted_fx <= x1:
            return zone_name, correct
    return None, set()


def classify_typing(active_touches):
    if not active_touches:
        return "IDLE", []
    wrong = [fl for (fl, _, correct) in active_touches if fl not in correct]
    return ("BAD", wrong) if wrong else ("GOOD", [])


# ── Main tracking loop ────────────────────────────────────────────────────────

def run(headless: bool = False):
    global _calibrator_ref, _latest_frame, _current_state

    if sys.platform == "win32":
        cap = cv2.VideoCapture(0, cv2.CAP_MSMF)
    else:
        cap = cv2.VideoCapture(0)
    cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*'MJPG'))
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
    if not cap.isOpened():
        print("[ERR] Cannot open webcam.")
        return

    mp_hands = mp.solutions.hands
    hands = mp_hands.Hands(
        static_image_mode=False,
        max_num_hands=2,
        min_detection_confidence=0.6,
        min_tracking_confidence=0.5,
    )
    mp_draw = mp.solutions.drawing_utils

    calibrator = KeyboardCalibrator()
    with _calib_lock:
        _calibrator_ref = calibrator

    calibrating = False
    verdict_history = []
    HISTORY_LEN = 8
    PRESS_ZONE_Y_MAX = 1.10
    PRESS_ZONE_X_MARGIN = 0.05
    last_written_verdict = None
    last_written_wrong = None

    if not headless:
        def on_mouse(event, x, y, flags, param):
            if calibrating:
                calibrator.mouse_callback(event, x, y, flags, param)
        cv2.namedWindow("Typing Checker", cv2.WINDOW_NORMAL)
        cv2.resizeWindow("Typing Checker", 1280, 720)
        cv2.setMouseCallback("Typing Checker", on_mouse)

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        frame = cv2.flip(frame, -1)
        h, w = frame.shape[:2]
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = hands.process(rgb)

        calibrator.draw_overlay(frame)

        active_touches = []
        finger_positions = []

        if results.multi_hand_landmarks and calibrator.calibrated:
            for hand_landmarks, hand_info in zip(
                results.multi_hand_landmarks, results.multi_handedness
            ):
                # MediaPipe flips handedness labels for mirrored video
                raw_label = hand_info.classification[0].label
                hand_label = "Right" if raw_label == "Left" else "Left"
                mp_draw.draw_landmarks(
                    frame, hand_landmarks, mp_hands.HAND_CONNECTIONS,
                    mp_draw.DrawingSpec(color=(255, 255, 255), thickness=1, circle_radius=2),
                    mp_draw.DrawingSpec(color=(180, 180, 180), thickness=1),
                )

                for finger_name, tip_idx in [
                    ("THUMB", 4), ("INDEX", 8), ("MIDDLE", 12),
                    ("RING", 16), ("PINKY", 20),
                ]:
                    lm = hand_landmarks.landmark[tip_idx]
                    px, py = int(lm.x * w), int(lm.y * h)
                    fx, fy = calibrator.image_to_keyboard(px, py)
                    in_bounds = (
                        -PRESS_ZONE_X_MARGIN <= fx <= 1 + PRESS_ZONE_X_MARGIN
                        and 0 <= fy <= PRESS_ZONE_Y_MAX
                    )
                    finger_label = FINGER_LABEL_MAP.get((hand_label, finger_name), "UNKNOWN")
                    if in_bounds:
                        zone_name, correct_fingers = get_zone_for_keyboard_point(fx, fy)
                        if zone_name:
                            active_touches.append((finger_label, zone_name, correct_fingers))
                            correct = finger_label in correct_fingers
                            finger_positions.append((finger_label, px, py, correct))

        for (finger_label, px, py, correct) in finger_positions:
            color = (0, 255, 80) if correct else (0, 60, 255)
            cv2.circle(frame, (px, py), 14, color, -1)
            cv2.circle(frame, (px, py), 14, (255, 255, 255), 2)
            short = finger_label.replace("L_", "L.").replace("R_", "R.")
            cv2.putText(frame, short, (px - 18, py + 5),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.38, (255, 255, 255), 1)

        verdict, wrong_fingers = classify_typing(active_touches)
        verdict_history.append(verdict)
        if len(verdict_history) > HISTORY_LEN:
            verdict_history.pop(0)

        smoothed = (
            "BAD"  if "BAD"  in verdict_history else
            "GOOD" if "GOOD" in verdict_history else
            "IDLE"
        )

        sorted_wrong = sorted(wrong_fingers)
        if smoothed != last_written_verdict or sorted_wrong != last_written_wrong:
            write_state(smoothed, sorted_wrong)
            with _state_lock:
                _current_state = {
                    "verdict": smoothed,
                    "wrong_fingers": sorted_wrong,
                    "timestamp": time.time(),
                }
            last_written_verdict = smoothed
            last_written_wrong = sorted_wrong

        # Encode frame to JPEG for the /video stream (before adding any text banners)
        ok, buf = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 75])
        if ok:
            with _frame_lock:
                _latest_frame = buf.tobytes()

        if not headless:
            banner_h = 70
            if smoothed == "GOOD":
                banner_color, text_color = (30, 160, 30),   (220, 255, 220)
                verdict_text = "✓  GOOD  – Correct finger technique!"
            elif smoothed == "BAD":
                banner_color, text_color = (20, 20, 200),   (255, 200, 200)
                verdict_text = "✗  BAD  – Wrong finger on that key!"
            else:
                banner_color, text_color = (40, 40, 40),    (160, 160, 160)
                verdict_text = "—  Place fingers on keyboard  —"

            cv2.rectangle(frame, (0, 0), (w, banner_h), banner_color, -1)
            font, fs, th = cv2.FONT_HERSHEY_DUPLEX, 1.1, 2
            (tw, _th), _ = cv2.getTextSize(verdict_text, font, fs, th)
            cv2.putText(frame, verdict_text, ((w - tw) // 2, (banner_h + _th) // 2 - 4),
                        font, fs, text_color, th)

            if calibrating and not calibrator.calibrated:
                msg = f"Click corner {len(calibrator.corners)+1}/4  (TL → TR → BR → BL)"
                cv2.putText(frame, msg, (10, h - 20),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)
            elif not calibrator.calibrated:
                cv2.putText(frame, "Press 'c' to calibrate keyboard corners",
                            (10, h - 20), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (200, 200, 50), 2)

            cv2.imshow("Typing Checker", frame)

            key = cv2.waitKey(1) & 0xFF
            if key == ord('q'):
                break
            elif key == ord('c'):
                calibrating = True
                calibrator.corners = []
                calibrator.calibrated = False
                print("Calibration mode ON – click 4 corners (TL→TR→BR→BL)")
            elif key == ord('r'):
                calibrator.corners = []
                calibrator.calibrated = False
                calibrating = False
                verdict_history.clear()
                print("Calibration reset.")

    write_state("IDLE", [])
    cap.release()
    if not headless:
        cv2.destroyAllWindows()
    hands.close()
    with _calib_lock:
        _calibrator_ref = None


def main():
    print("=== Typing Technique Checker ===")
    print("1. Position your keyboard in the camera frame.")
    print("2. Press 'c' to calibrate – click four corners: TL → TR → BR → BL")
    print("3. Press 'r' to reset calibration.  Press 'q' to quit.\n")
    run(headless=False)


if __name__ == "__main__":
    main()
