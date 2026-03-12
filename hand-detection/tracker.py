"""
Typing Technique Checker
========================
Uses your webcam + MediaPipe to detect hands, track fingers,
and tell you if you're using the correct finger for each key.

Requirements:
    pip install opencv-python mediapipe numpy

How it works:
  1. You position your keyboard in the camera view.
  2. Press 'c' to calibrate — click the four corners of the keyboard.
  3. The keyboard is divided into finger zones (touch-typing layout).
  4. When a fingertip enters a zone, the program checks whether that
     finger is the CORRECT finger for that zone.
  5. GOOD / BAD is shown at the top of the window.

Touch-typing finger assignment (standard QWERTY):
  Left Pinky  : 1, !, Q, A, Z, Tab, CapsLock, Shift-L, ~, `
  Left Ring   : 2, @, W, S, X
  Left Middle : 3, #, E, D, C
  Left Index  : 4, $, R, F, V, 5, %, T, G, B
  Right Index : 6, ^, Y, H, N, 7, &, U, J, M
  Right Middle: 8, *, I, K, ,
  Right Ring  : 9, (, O, L, .
  Right Pinky : 0, ), P, ;, /, -, _, =, +, [, ], \, '

Thumbs are used for Space bar only.
"""

import cv2
import mediapipe as mp
import numpy as np
import time

# ──────────────────────────────────────────────────────────────
# FINGER INDEX REFERENCE (MediaPipe hand landmark indices)
# ──────────────────────────────────────────────────────────────
# Each hand: 0=WRIST, 1-4=THUMB, 5-8=INDEX, 9-12=MIDDLE,
#            13-16=RING, 17-20=PINKY
# Tip landmarks: THUMB=4, INDEX=8, MIDDLE=12, RING=16, PINKY=20

FINGER_TIPS = {
    "THUMB":  4,
    "INDEX":  8,
    "MIDDLE": 12,
    "RING":   16,
    "PINKY":  20,
}

# ──────────────────────────────────────────────────────────────
# KEYBOARD ZONE DEFINITIONS
# Keyboard is split into columns (x-ratio 0→1 across keyboard width)
# Each zone maps to the correct finger(s) that should press those keys.
#
# We define zones as x-ranges (fraction of keyboard width).
# Typical QWERTY column layout (approx):
#   |  ~  |  1  |  2  |  3  |  4  |  5  |  6  |  7  |  8  |  9  |  0  |  -  |  =  |
#   zone:  LP    LP   LR   LM   LI   LI   RI   RI   RM   RR   RP   RP   RP
#
# We define 8 column zones + 1 bottom space bar zone.
# ──────────────────────────────────────────────────────────────

# Zone definitions: (x_start_frac, x_end_frac, correct_finger_label)
# Fingers labeled as: "L_PINKY", "L_RING", "L_MIDDLE", "L_INDEX",
#                     "R_INDEX", "R_MIDDLE", "R_RING", "R_PINKY", "THUMB"
KEYBOARD_ZONES = [
    # (x_start, x_end, zone_name, correct_fingers_set)
    (0.00, 0.11, "L_PINKY_ZONE",  {"L_PINKY"}),
    (0.11, 0.18, "L_RING_ZONE",   {"L_RING"}),
    (0.18, 0.25, "L_MIDDLE_ZONE", {"L_MIDDLE"}),
    (0.25, 0.38, "L_INDEX_ZONE",  {"L_INDEX"}),
    (0.38, 0.54, "R_INDEX_ZONE",  {"R_INDEX"}),
    (0.54, 0.62, "R_MIDDLE_ZONE", {"R_MIDDLE"}),
    (0.62, 0.70, "R_RING_ZONE",   {"R_RING"}),
    (0.70, 1.00, "R_PINKY_ZONE",  {"R_PINKY"}),
]

# Space bar: bottom 20% of keyboard height → thumbs only
SPACEBAR_Y_FRAC = 0.85  # below this y-fraction = spacebar row

# ──────────────────────────────────────────────────────────────
# ZONE COLORS (BGR) for visualization
# ──────────────────────────────────────────────────────────────
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
    # (hand_label, finger_name) -> zone finger label
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

# Row stagger offsets (fraction of keyboard width)
# Each row is offset to the right as you go down (standard QWERTY stagger)
ROW_STAGGER = [
    -0.02,  # Number row (top)
    0.01,  # QWERTY row
    0.02,   # ASDF row (home row)
    0.05,   # ZXCV row
    0.10,   # Spacebar row (heavily centered)
]

# Y positions of each row boundary (fraction of keyboard height)
ROW_Y = [0.0, 0.20, 0.42, 0.63, SPACEBAR_Y_FRAC, 1.0]

# ──────────────────────────────────────────────────────────────
# KEYBOARD CALIBRATION
# ──────────────────────────────────────────────────────────────

class KeyboardCalibrator:
    """Click four corners of keyboard (TL, TR, BR, BL) to calibrate."""

    def __init__(self):
        self.corners = []       # list of (x, y) image points
        self.calibrated = False
        self.transform = None   # perspective transform matrix
        self.inv_transform = None

    def mouse_callback(self, event, x, y, flags, param):
        if event == cv2.EVENT_LBUTTONDOWN and len(self.corners) < 4:
            self.corners.append((x, y))
            print(f"Corner {len(self.corners)} set: ({x}, {y})")
            if len(self.corners) == 4:
                self._compute_transform()

    def _compute_transform(self):
        """Compute perspective warp from keyboard quad → unit square."""
        src = np.float32(self.corners)
        dst = np.float32([[0, 0], [1, 0], [1, 1], [0, 1]])
        self.transform = cv2.getPerspectiveTransform(src, dst)
        self.inv_transform = cv2.getPerspectiveTransform(dst, src)
        self.calibrated = True
        print("✅ Keyboard calibrated!")

    def image_to_keyboard(self, x, y):
        """Convert image pixel (x,y) to keyboard-relative (fx, fy) in [0,1]."""
        pt = np.float32([[[x, y]]])
        result = cv2.perspectiveTransform(pt, self.transform)
        return float(result[0][0][0]), float(result[0][0][1])

    def draw_overlay(self, frame):
        """Draw the calibration corners and keyboard zone overlays."""
        if self.calibrated:
            self._draw_zones(frame)
        elif len(self.corners) >= 2:
            for i in range(len(self.corners) - 1):
                cv2.line(frame, self.corners[i], self.corners[i+1], (0, 255, 255), 2)

    def _draw_zones(self, frame):
        """Draw keyboard finger zones as staggered colored overlays on the frame."""
        overlay = frame.copy()

        def kb_to_img(fx, fy):
            pt = np.float32([[[fx, fy]]])
            res = cv2.perspectiveTransform(pt, self.inv_transform)
            return int(res[0][0][0]), int(res[0][0][1])

        # Draw finger zones as staggered parallelograms
        for (x0, x1, zone_name, _) in KEYBOARD_ZONES:
            color = ZONE_COLORS.get(zone_name, (128, 128, 128))

            # Build a polygon spanning all keyboard rows with stagger applied
            # Left edge points going top to bottom
            left_pts = [
                kb_to_img(x0 + ROW_STAGGER[0], ROW_Y[0]),
                kb_to_img(x0 + ROW_STAGGER[1], ROW_Y[1]),
                kb_to_img(x0 + ROW_STAGGER[2], ROW_Y[2]),
                kb_to_img(x0 + ROW_STAGGER[3], ROW_Y[3]),
                kb_to_img(x0 + ROW_STAGGER[4], ROW_Y[4]),
            ]
            # Right edge points going bottom to top
            right_pts = [
                kb_to_img(x1 + ROW_STAGGER[4], ROW_Y[4]),
                kb_to_img(x1 + ROW_STAGGER[3], ROW_Y[3]),
                kb_to_img(x1 + ROW_STAGGER[2], ROW_Y[2]),
                kb_to_img(x1 + ROW_STAGGER[1], ROW_Y[1]),
                kb_to_img(x1 + ROW_STAGGER[0], ROW_Y[0]),
            ]

            pts = np.array(left_pts + right_pts, dtype=np.int32)
            cv2.fillPoly(overlay, [pts], color)

            # Zone label at home row height
            cx, cy = kb_to_img((x0 + x1) / 2 + ROW_STAGGER[2], ROW_Y[2] + 0.05)
            label = zone_name.replace("_ZONE", "").replace("_", "\n")
            for i, line in enumerate(label.split("\n")):
                cv2.putText(overlay, line, (cx - 25, cy + i * 16),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1)

        # Draw spacebar zone (flat, no stagger)
        space_pts = np.array([
            kb_to_img(0.0, SPACEBAR_Y_FRAC),
            kb_to_img(1.0, SPACEBAR_Y_FRAC),
            kb_to_img(1.0, 1.0),
            kb_to_img(0.0, 1.0),
        ], dtype=np.int32)
        cv2.fillPoly(overlay, [space_pts], ZONE_COLORS["SPACEBAR"])
        cx, cy = kb_to_img(0.5, 0.90)
        cv2.putText(overlay, "SPACE (Thumbs)", (cx - 60, cy),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.45, (50, 50, 50), 1)

        cv2.addWeighted(overlay, 0.3, frame, 0.7, 0, frame)


# ──────────────────────────────────────────────────────────────
# TYPING CHECKER
# ──────────────────────────────────────────────────────────────

def get_stagger_for_y(fy):
    """Return the stagger offset for a given y position."""
    for i in range(len(ROW_Y) - 1):
        if ROW_Y[i] <= fy <= ROW_Y[i + 1]:
            # Interpolate stagger between the two row boundaries
            t = (fy - ROW_Y[i]) / (ROW_Y[i + 1] - ROW_Y[i])
            top_stagger = ROW_STAGGER[i] if i < len(ROW_STAGGER) else ROW_STAGGER[-1]
            bot_stagger = ROW_STAGGER[i + 1] if i + 1 < len(ROW_STAGGER) else ROW_STAGGER[-1]
            return top_stagger + t * (bot_stagger - top_stagger)
    return 0.0

def get_zone_for_keyboard_point(fx, fy):
    """Return (zone_name, correct_fingers_set) for a point in keyboard space."""
    if fy > SPACEBAR_Y_FRAC:
        return "SPACEBAR", {"L_THUMB", "R_THUMB"}
    # Subtract the stagger offset so detection matches the visual zones
    stagger = get_stagger_for_y(fy)
    adjusted_fx = fx - stagger
    for (x0, x1, zone_name, correct) in KEYBOARD_ZONES:
        if x0 <= adjusted_fx <= x1:
            return zone_name, correct
    return None, set()


def classify_typing(active_touches):
    """
    active_touches: list of (finger_label, zone_name, correct_fingers_set)
    Returns: "GOOD", "BAD", or "IDLE"
    """
    if not active_touches:
        return "IDLE"
    for (finger_label, zone_name, correct_fingers) in active_touches:
        if finger_label not in correct_fingers:
            return "BAD"
    return "GOOD"


# ──────────────────────────────────────────────────────────────
# MAIN PROGRAM
# ──────────────────────────────────────────────────────────────

def main():
    print("=== Typing Technique Checker ===")
    print("1. Position your keyboard in the camera frame.")
    print("2. Press 'c' to enter calibration mode.")
    print("   Then click the FOUR CORNERS of your keyboard:")
    print("   Top-Left → Top-Right → Bottom-Right → Bottom-Left")
    print("3. Press 'r' to reset calibration.")
    print("4. Press 'q' to quit.\n")

    # 2 is the index of the UVC Camera
    cap = cv2.VideoCapture(0, cv2.CAP_MSMF)
    cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*'MJPG'))
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
    if not cap.isOpened():
        print("❌ Cannot open webcam. Check your camera index.")
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
    calibrating = False

    # Feedback smoothing: keep last N verdicts
    verdict_history = []
    HISTORY_LEN = 8

    # "Pressing" detection: fingertip must be within keyboard bounds
    # and close to the keyboard plane (we use y-proximity heuristic)
    PRESS_ZONE_Y_MAX = 1.10   # allow slight overshoot below keyboard
    PRESS_ZONE_X_MARGIN = 0.05

    # Feedback display
    verdict_display = "IDLE"
    verdict_timer = 0.0

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

        frame = cv2.flip(frame, -1)  # Mirror for intuitive use
        h, w = frame.shape[:2]
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = hands.process(rgb)

        # ── Draw keyboard zones ──
        calibrator.draw_overlay(frame)

        # ── Process hands ──
        active_touches = []
        finger_positions = []   # (finger_label, px, py, in_zone)

        if results.multi_hand_landmarks and calibrator.calibrated:
            for hand_landmarks, hand_info in zip(
                results.multi_hand_landmarks, results.multi_handedness
            ):
                hand_label = hand_info.classification[0].label  # "Left" or "Right"
                hand_label = "Right" if hand_label == "Left" else "Left"
                mp_draw.draw_landmarks(
                    frame, hand_landmarks, mp_hands.HAND_CONNECTIONS,
                    mp_draw.DrawingSpec(color=(255, 255, 255), thickness=1, circle_radius=2),
                    mp_draw.DrawingSpec(color=(180, 180, 180), thickness=1),
                )

                for finger_name, tip_idx in [
                    ("THUMB", 4), ("INDEX", 8), ("MIDDLE", 12),
                    ("RING", 16), ("PINKY", 20)
                ]:
                    lm = hand_landmarks.landmark[tip_idx]
                    px, py = int(lm.x * w), int(lm.y * h)

                    # Convert to keyboard space
                    fx, fy = calibrator.image_to_keyboard(px, py)

                    # Check if fingertip is over the keyboard
                    in_bounds = (
                        -PRESS_ZONE_X_MARGIN <= fx <= 1 + PRESS_ZONE_X_MARGIN
                        and 0 <= fy <= PRESS_ZONE_Y_MAX
                    )

                    finger_key = (hand_label, finger_name)
                    finger_label = FINGER_LABEL_MAP.get(finger_key, "UNKNOWN")

                    if in_bounds:
                        zone_name, correct_fingers = get_zone_for_keyboard_point(fx, fy)
                        if zone_name:
                            active_touches.append((finger_label, zone_name, correct_fingers))
                            correct = finger_label in correct_fingers
                            finger_positions.append((finger_label, px, py, correct))

        # ── Draw fingertip indicators ──
        for (finger_label, px, py, correct) in finger_positions:
            color = (0, 255, 80) if correct else (0, 60, 255)
            cv2.circle(frame, (px, py), 14, color, -1)
            cv2.circle(frame, (px, py), 14, (255, 255, 255), 2)
            short = finger_label.replace("L_", "L.").replace("R_", "R.")
            cv2.putText(frame, short, (px - 18, py + 5),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.38, (255, 255, 255), 1)

        # ── Compute verdict ──
        verdict = classify_typing(active_touches)
        verdict_history.append(verdict)
        if len(verdict_history) > HISTORY_LEN:
            verdict_history.pop(0)

        # Smooth: show BAD if any recent BAD, else GOOD if any recent GOOD
        if "BAD" in verdict_history:
            smoothed = "BAD"
        elif "GOOD" in verdict_history:
            smoothed = "GOOD"
        else:
            smoothed = "IDLE"

        # ── Draw verdict banner ──
        banner_h = 70
        if smoothed == "GOOD":
            banner_color = (30, 160, 30)
            text_color = (220, 255, 220)
            verdict_text = "✓  GOOD  – Correct finger technique!"
        elif smoothed == "BAD":
            banner_color = (20, 20, 200)
            text_color = (255, 200, 200)
            verdict_text = "✗  BAD  – Wrong finger on that key!"
        else:
            banner_color = (40, 40, 40)
            text_color = (160, 160, 160)
            verdict_text = "—  Place fingers on keyboard  —"

        cv2.rectangle(frame, (0, 0), (w, banner_h), banner_color, -1)

        # Center the text
        font = cv2.FONT_HERSHEY_DUPLEX
        font_scale = 1.1
        thickness = 2
        (tw, th), _ = cv2.getTextSize(verdict_text, font, font_scale, thickness)
        tx = (w - tw) // 2
        ty = (banner_h + th) // 2 - 4
        cv2.putText(frame, verdict_text, (tx, ty), font, font_scale, text_color, thickness)

        # ── Calibration instructions ──
        if calibrating and not calibrator.calibrated:
            msg = f"Click corner {len(calibrator.corners)+1}/4  (TL → TR → BR → BL)"
            cv2.putText(frame, msg, (10, h - 20),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)
        elif not calibrator.calibrated:
            cv2.putText(frame, "Press 'c' to calibrate keyboard corners",
                        (10, h - 20), cv2.FONT_HERSHEY_SIMPLEX,
                        0.7, (200, 200, 50), 2)

        # ── Legend ──
        legend_items = [
            ("Left Hand", ""),
            ("L.PINKY",  ZONE_COLORS["L_PINKY_ZONE"]),
            ("L.RING",   ZONE_COLORS["L_RING_ZONE"]),
            ("L.MIDDLE", ZONE_COLORS["L_MIDDLE_ZONE"]),
            ("L.INDEX",  ZONE_COLORS["L_INDEX_ZONE"]),
            ("Right Hand", ""),
            ("R.INDEX",  ZONE_COLORS["R_INDEX_ZONE"]),
            ("R.MIDDLE", ZONE_COLORS["R_MIDDLE_ZONE"]),
            ("R.RING",   ZONE_COLORS["R_RING_ZONE"]),
            ("R.PINKY",  ZONE_COLORS["R_PINKY_ZONE"]),
        ]
        lx, ly = 10, banner_h + 15
        for label, color in legend_items:
            if color == "":
                cv2.putText(frame, label, (lx, ly + 14),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.45, (220, 220, 220), 1)
            else:
                cv2.rectangle(frame, (lx, ly), (lx + 14, ly + 14), color, -1)
                cv2.putText(frame, label, (lx + 18, ly + 12),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.4, (220, 220, 220), 1)
            ly += 20

        cv2.imshow("Typing Checker", frame)

        key = cv2.waitKey(1) & 0xFF
        if key == ord('q'):
            break
        elif key == ord('c'):
            calibrating = True
            calibrator.corners = []
            calibrator.calibrated = False
            print("Calibration mode ON – click 4 corners of keyboard (TL→TR→BR→BL)")
        elif key == ord('r'):
            calibrator.corners = []
            calibrator.calibrated = False
            calibrating = False
            verdict_history.clear()
            print("Calibration reset.")

    cap.release()
    cv2.destroyAllWindows()
    hands.close()


if __name__ == "__main__":
    main()