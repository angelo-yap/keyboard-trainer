import cv2
import mediapipe as mp
import numpy as np
import time
import json
import os
import sys
import threading
from urllib import error as urllib_error
from urllib import request as urllib_request

# ── Thread-safe frame buffer ──────────────────────────────────────────────────
_frame_lock = threading.Lock()
_latest_frame: bytes | None = None

# ── Thread-safe state ─────────────────────────────────────────────────────────
_state_lock = threading.Lock()
_current_state: dict = {
    "verdict": "IDLE",
    "wrong_fingers": [],
    "finger_positions": [],
    "timestamp": 0.0,
}

# ── Calibrator reference (set when run() is active) ───────────────────────────
_calib_lock = threading.Lock()
_calibrator_ref: "KeyboardCalibrator | None" = None

# ── Camera source selection ───────────────────────────────────────────────────
CAMERA_CONFIG_FILE = "camera_config.json"
DEFAULT_CAMERA_SOURCE = 0
DEFAULT_FLIP_HANDEDNESS = False
_camera_source_lock = threading.Lock()

MODEL_ENV_VAR = "MP_HAND_LANDMARKER_MODEL"
DEFAULT_TASK_MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/"
    "hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"
)
DEFAULT_TASK_MODEL_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "models",
    "hand_landmarker.task",
)


def _read_tracker_config_from_disk() -> dict:
    config = {
        "source": DEFAULT_CAMERA_SOURCE,
        "flip_handedness": DEFAULT_FLIP_HANDEDNESS,
    }

    if not os.path.exists(CAMERA_CONFIG_FILE):
        return config
    try:
        with open(CAMERA_CONFIG_FILE, "r") as f:
            payload = json.load(f)

        source = payload.get("source", DEFAULT_CAMERA_SOURCE)
        if isinstance(source, int) and source >= 0:
            config["source"] = source

        flip_handedness = payload.get("flip_handedness", DEFAULT_FLIP_HANDEDNESS)
        if isinstance(flip_handedness, bool):
            config["flip_handedness"] = flip_handedness
    except (OSError, json.JSONDecodeError):
        pass
    return config


def _write_tracker_config_to_disk(source: int, flip_handedness: bool):
    try:
        tmp = CAMERA_CONFIG_FILE + ".tmp"
        with open(tmp, "w") as f:
            json.dump({
                "source": source,
                "flip_handedness": flip_handedness,
            }, f)
        os.replace(tmp, CAMERA_CONFIG_FILE)
    except OSError as e:
        print(f"[WARN] Could not persist camera source: {e}")


_tracker_config = _read_tracker_config_from_disk()
_requested_camera_source = int(_tracker_config.get("source", DEFAULT_CAMERA_SOURCE))
_flip_handedness = bool(_tracker_config.get("flip_handedness", DEFAULT_FLIP_HANDEDNESS))
_active_camera_source: int | None = None

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
        _calibrator_ref.reset()


def get_camera_source() -> int:
    with _camera_source_lock:
        return _requested_camera_source


def set_camera_source(source: int) -> bool:
    if not isinstance(source, int) or source < 0:
        return False
    with _camera_source_lock:
        global _requested_camera_source, _flip_handedness
        _requested_camera_source = source
        _write_tracker_config_to_disk(_requested_camera_source, _flip_handedness)
    return True


def get_flip_handedness() -> bool:
    with _camera_source_lock:
        return _flip_handedness


def set_flip_handedness(flip_handedness: bool) -> bool:
    if not isinstance(flip_handedness, bool):
        return False
    with _camera_source_lock:
        global _requested_camera_source, _flip_handedness
        _flip_handedness = flip_handedness
        _write_tracker_config_to_disk(_requested_camera_source, _flip_handedness)
    return True


def get_camera_status() -> dict:
    with _camera_source_lock:
        return {
            "requested_source": _requested_camera_source,
            "active_source": _active_camera_source,
            "flip_handedness": _flip_handedness,
        }


def _ensure_task_hand_model() -> str | None:
    explicit_path = os.environ.get(MODEL_ENV_VAR)
    if explicit_path:
        if os.path.exists(explicit_path):
            return explicit_path
        print(f"[ERR] {MODEL_ENV_VAR} points to missing file: {explicit_path}")
        return None

    if os.path.exists(DEFAULT_TASK_MODEL_PATH):
        return DEFAULT_TASK_MODEL_PATH

    os.makedirs(os.path.dirname(DEFAULT_TASK_MODEL_PATH), exist_ok=True)
    print(f"[INFO] Downloading hand landmarker model to {DEFAULT_TASK_MODEL_PATH}...")
    try:
        urllib_request.urlretrieve(DEFAULT_TASK_MODEL_URL, DEFAULT_TASK_MODEL_PATH)
        print("[OK] Hand landmarker model downloaded.")
        return DEFAULT_TASK_MODEL_PATH
    except urllib_error.URLError as e:
        print(f"[ERR] Could not download hand landmarker model: {e}")
        return None


def _create_hand_tracker():
    if hasattr(mp, "solutions") and hasattr(mp.solutions, "hands"):
        hands_module = mp.solutions.hands
        detector = hands_module.Hands(
            static_image_mode=False,
            max_num_hands=2,
            min_detection_confidence=0.6,
            min_tracking_confidence=0.5,
        )
        return {
            "kind": "legacy",
            "detector": detector,
            "hands_module": hands_module,
            "drawer": mp.solutions.drawing_utils,
        }

    try:
        from mediapipe.tasks.python import BaseOptions
        from mediapipe.tasks.python.vision import hand_landmarker
        from mediapipe.tasks.python.vision.core.vision_task_running_mode import VisionTaskRunningMode
    except Exception as exc:
        raise RuntimeError(
            "This MediaPipe build does not expose the legacy solutions API and "
            "the tasks API could not be imported."
        ) from exc

    model_path = _ensure_task_hand_model()
    if not model_path:
        raise RuntimeError(
            "No hand-landmarker model available. Set MP_HAND_LANDMARKER_MODEL or allow model download."
        )

    options = hand_landmarker.HandLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=model_path),
        running_mode=VisionTaskRunningMode.VIDEO,
        num_hands=2,
        min_hand_detection_confidence=0.6,
        min_hand_presence_confidence=0.5,
        min_tracking_confidence=0.5,
    )
    detector = hand_landmarker.HandLandmarker.create_from_options(options)

    return {
        "kind": "tasks",
        "detector": detector,
    }


# ── Shared state file (used when run standalone) ──────────────────────────────

SHARED_STATE_FILE = "typing_state.json"

def write_state(verdict: str, wrong_fingers: list, finger_positions: list | None = None):
    state = {
        "verdict": verdict,
        "wrong_fingers": wrong_fingers,
        "finger_positions": finger_positions or [],
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

ZONE_ORDER = [
    ("L_PINKY_ZONE", {"L_PINKY"}),
    ("L_RING_ZONE", {"L_RING"}),
    ("L_MIDDLE_ZONE", {"L_MIDDLE"}),
    ("L_INDEX_ZONE", {"L_INDEX"}),
    ("R_INDEX_ZONE", {"R_INDEX"}),
    ("R_MIDDLE_ZONE", {"R_MIDDLE"}),
    ("R_RING_ZONE", {"R_RING"}),
    ("R_PINKY_ZONE", {"R_PINKY"}),
]

ZONE_BY_NAME = {zone_name: correct for zone_name, correct in ZONE_ORDER}

SPACEBAR_Y_FRAC = 0.78
ZONE_OVERLAP_FRAC = 0.010

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

KEYBOARD_ROWS = [
    {
        "y0": 0.00,
        "y1": 0.20,
        "segments": [
            (0.000, 0.155, "L_PINKY_ZONE"),
            (0.162, 0.242, "L_RING_ZONE"),
            (0.242, 0.318, "L_MIDDLE_ZONE"),
            (0.318, 0.406, "L_INDEX_ZONE"),
            (0.406, 0.565, "R_INDEX_ZONE"),
            (0.565, 0.638, "R_MIDDLE_ZONE"),
            (0.638, 0.728, "R_RING_ZONE"),
            (0.728, 1.000, "R_PINKY_ZONE"),
        ],
    },
    {
        "y0": 0.20,
        "y1": 0.42,
        "segments": [
            (0.000, 0.150, "L_PINKY_ZONE"),
            (0.158, 0.240, "L_RING_ZONE"),
            (0.240, 0.318, "L_MIDDLE_ZONE"),
            (0.318, 0.413, "L_INDEX_ZONE"),
            (0.413, 0.575, "R_INDEX_ZONE"),
            (0.575, 0.643, "R_MIDDLE_ZONE"),
            (0.643, 0.733, "R_RING_ZONE"),
            (0.733, 1.000, "R_PINKY_ZONE"),
        ],
    },
    {
        "y0": 0.42,
        "y1": 0.61,
        "segments": [
            (0.000, 0.165, "L_PINKY_ZONE"),
            (0.165, 0.250, "L_RING_ZONE"),
            (0.250, 0.330, "L_MIDDLE_ZONE"),
            (0.330, 0.428, "L_INDEX_ZONE"),
            (0.428, 0.575, "R_INDEX_ZONE"),
            (0.575, 0.645, "R_MIDDLE_ZONE"),
            (0.645, 0.735, "R_RING_ZONE"),
            (0.735, 1.000, "R_PINKY_ZONE"),
        ],
    },
    {
        "y0": 0.61,
        "y1": SPACEBAR_Y_FRAC,
        "segments": [
            (0.000, 0.185, "L_PINKY_ZONE"),
            (0.185, 0.270, "L_RING_ZONE"),
            (0.270, 0.360, "L_MIDDLE_ZONE"),
            (0.360, 0.463, "L_INDEX_ZONE"),
            (0.463, 0.610, "R_INDEX_ZONE"),
            (0.610, 0.675, "R_MIDDLE_ZONE"),
            (0.675, 0.765, "R_RING_ZONE"),
            (0.765, 1.000, "R_PINKY_ZONE"),
        ],
    },
]


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
        if self.transform is None:
            raise ValueError("Keyboard transform is not available. Calibrate first.")
        pt = np.float32([[[x, y]]])
        result = cv2.perspectiveTransform(pt, self.transform)
        return float(result[0][0][0]), float(result[0][0][1])

    def is_ready(self) -> bool:
        return self.calibrated and self.transform is not None and self.inv_transform is not None

    def reset(self):
        self.corners = []
        self.calibrated = False
        self.transform = None
        self.inv_transform = None

    def draw_overlay(self, frame):
        if self.is_ready():
            try:
                self._draw_zones(frame)
            except cv2.error:
                return
        elif len(self.corners) >= 2:
            for i in range(len(self.corners) - 1):
                cv2.line(frame, self.corners[i], self.corners[i + 1], (0, 255, 255), 2)

    def _draw_zones(self, frame):
        if self.inv_transform is None:
            return
        overlay = frame.copy()

        def kb_to_img(fx, fy):
            pt = np.float32([[[fx, fy]]])
            res = cv2.perspectiveTransform(pt, self.inv_transform)
            return int(res[0][0][0]), int(res[0][0][1])

        for row in KEYBOARD_ROWS:
            y0 = row["y0"]
            y1 = row["y1"]
            for x0, x1, zone_name in row["segments"]:
                color = ZONE_COLORS.get(zone_name, (128, 128, 128))
                pts = np.array([
                    kb_to_img(x0, y0),
                    kb_to_img(x1, y0),
                    kb_to_img(x1, y1),
                    kb_to_img(x0, y1),
                ], dtype=np.int32)
                cv2.fillPoly(overlay, [pts], color)

        label_row = KEYBOARD_ROWS[2]
        for x0, x1, zone_name in label_row["segments"]:
            cx, cy = kb_to_img((x0 + x1) / 2, (label_row["y0"] + label_row["y1"]) / 2)
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

def get_zone_for_keyboard_point(fx, fy):
    if fy > SPACEBAR_Y_FRAC:
        return "SPACEBAR", {"L_THUMB", "R_THUMB"}
    for row in KEYBOARD_ROWS:
        if row["y0"] <= fy <= row["y1"]:
            segments = row["segments"]
            for i, (x0, x1, zone_name) in enumerate(segments):
                if x0 <= fx <= x1:
                    correct = set(ZONE_BY_NAME[zone_name])
                    if i > 0 and fx - x0 <= ZONE_OVERLAP_FRAC:
                        correct.update(ZONE_BY_NAME[segments[i - 1][2]])
                    if i < len(segments) - 1 and x1 - fx <= ZONE_OVERLAP_FRAC:
                        correct.update(ZONE_BY_NAME[segments[i + 1][2]])
                    return zone_name, correct
    return None, set()


def classify_typing(active_touches):
    if not active_touches:
        return "IDLE", []
    wrong = [fl for (fl, _, correct) in active_touches if fl not in correct]
    return ("BAD", wrong) if wrong else ("GOOD", [])


def _open_capture(source: int, allow_auth_prompt: bool = False):
    previous_skip_auth = os.environ.get("OPENCV_AVFOUNDATION_SKIP_AUTH")
    should_restore_skip_auth = False
    if sys.platform == "darwin":
        if allow_auth_prompt:
            os.environ.pop("OPENCV_AVFOUNDATION_SKIP_AUTH", None)
            should_restore_skip_auth = True
        else:
            os.environ.setdefault("OPENCV_AVFOUNDATION_SKIP_AUTH", "1")

    backend_candidates: list[tuple[int | None, str]] = []

    if sys.platform == "darwin" and hasattr(cv2, "CAP_AVFOUNDATION"):
        backend_candidates.append((cv2.CAP_AVFOUNDATION, "AVFOUNDATION"))
    elif os.name == "nt":
        if hasattr(cv2, "CAP_DSHOW"):
            backend_candidates.append((cv2.CAP_DSHOW, "DSHOW"))
        if hasattr(cv2, "CAP_MSMF"):
            backend_candidates.append((cv2.CAP_MSMF, "MSMF"))
    elif hasattr(cv2, "CAP_V4L2"):
        backend_candidates.append((cv2.CAP_V4L2, "V4L2"))

    backend_candidates.append((None, "DEFAULT"))

    try:
        for backend, backend_name in backend_candidates:
            cap = cv2.VideoCapture(source) if backend is None else cv2.VideoCapture(source, backend)
            if not cap.isOpened():
                cap.release()
                continue

            if os.name == "nt":
                cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*"MJPG"))
            cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
            return cap, backend_name

        return None, None
    finally:
        if sys.platform == "darwin" and should_restore_skip_auth:
            if previous_skip_auth is None:
                os.environ.pop("OPENCV_AVFOUNDATION_SKIP_AUTH", None)
            else:
                os.environ["OPENCV_AVFOUNDATION_SKIP_AUTH"] = previous_skip_auth


def prime_camera_access() -> bool:
    if sys.platform != "darwin":
        return True

    source = get_camera_source()
    cap, backend_name = _open_capture(source, allow_auth_prompt=True)
    if cap is None:
        print(
            "[WARN] Could not prime macOS camera permission on the main thread. "
            "Grant camera access to the current Python host in System Settings > Privacy & Security > Camera."
        )
        return False

    # Read one frame so macOS finalizes permission flow before worker thread starts.
    cap.read()
    cap.release()
    print(f"[OK] Camera permission preflight completed ({backend_name}).")
    return True


# ── Main tracking loop ────────────────────────────────────────────────────────

def run(headless: bool = False):
    global _calibrator_ref, _latest_frame, _current_state, _active_camera_source

    cap = None
    open_failed_for_source = None

    try:
        tracker = _create_hand_tracker()
    except Exception as exc:
        print(f"[ERR] Hand tracker initialization failed: {exc}")
        write_state("IDLE", [])
        return

    tracker_kind = tracker["kind"]
    detector = tracker["detector"]
    legacy_hands_module = tracker.get("hands_module")
    legacy_drawer = tracker.get("drawer")
    print(f"[OK] MediaPipe tracker initialized ({tracker_kind}).")

    if tracker_kind == "tasks" and (
        not hasattr(mp, "Image") or not hasattr(mp, "ImageFormat")
    ):
        print("[ERR] MediaPipe tasks runtime is missing Image/ImageFormat APIs.")
        write_state("IDLE", [])
        return

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
        requested_source = get_camera_source()

        if cap is None or _active_camera_source != requested_source:
            if cap is not None:
                cap.release()
            cap, backend_name = _open_capture(requested_source)

            if cap is None:
                if open_failed_for_source != requested_source:
                    print(f"[ERR] Cannot open webcam source {requested_source}.")
                    open_failed_for_source = requested_source
                with _camera_source_lock:
                    _active_camera_source = None
                time.sleep(0.4)
                continue

            with _camera_source_lock:
                _active_camera_source = requested_source
            open_failed_for_source = None
            print(f"[OK] Opened webcam source {requested_source} via {backend_name}.")

        ret, frame = cap.read()
        if not ret:
            cap.release()
            cap = None
            with _camera_source_lock:
                _active_camera_source = None
            time.sleep(0.2)
            continue

        frame = cv2.flip(frame, -1)
        h, w = frame.shape[:2]
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        calibrator.draw_overlay(frame)

        active_touches = []
        finger_positions = []
        flip_handedness = get_flip_handedness()

        if calibrator.is_ready():
            if tracker_kind == "legacy":
                results = detector.process(rgb)
                if results.multi_hand_landmarks:
                    handedness = results.multi_handedness or []
                    for hand_landmarks, hand_info in zip(results.multi_hand_landmarks, handedness):
                        # MediaPipe flips handedness labels for mirrored video
                        raw_label = "Unknown"
                        if hand_info.classification:
                            raw_label = hand_info.classification[0].label
                        hand_label = raw_label
                        if flip_handedness and raw_label in ("Left", "Right"):
                            hand_label = "Right" if raw_label == "Left" else "Left"

                        if legacy_drawer is not None and legacy_hands_module is not None:
                            legacy_drawer.draw_landmarks(
                                frame,
                                hand_landmarks,
                                legacy_hands_module.HAND_CONNECTIONS,
                                legacy_drawer.DrawingSpec(color=(255, 255, 255), thickness=1, circle_radius=2),
                                legacy_drawer.DrawingSpec(color=(180, 180, 180), thickness=1),
                            )

                        for finger_name, tip_idx in [
                            ("THUMB", 4), ("INDEX", 8), ("MIDDLE", 12),
                            ("RING", 16), ("PINKY", 20),
                        ]:
                            lm = hand_landmarks.landmark[tip_idx]
                            px, py = int(lm.x * w), int(lm.y * h)
                            try:
                                fx, fy = calibrator.image_to_keyboard(px, py)
                            except (ValueError, cv2.error):
                                continue
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
                                    finger_positions.append({
                                        "label": finger_label,
                                        "x": fx,
                                        "y": fy,
                                        "px": px,
                                        "py": py,
                                        "correct": correct,
                                        "zone": zone_name,
                                    })
            else:
                mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
                timestamp_ms = int(time.time() * 1000)
                results = detector.detect_for_video(mp_image, timestamp_ms)
                hand_landmarks_list = results.hand_landmarks or []
                handedness_list = results.handedness or []

                for hand_idx, hand_landmarks in enumerate(hand_landmarks_list):
                    categories = handedness_list[hand_idx] if hand_idx < len(handedness_list) else []
                    raw_label = "Unknown"
                    if categories:
                        category = categories[0]
                        raw_label = (
                            getattr(category, "category_name", "")
                            or getattr(category, "display_name", "")
                            or "Unknown"
                        )

                    hand_label = raw_label
                    if flip_handedness and raw_label in ("Left", "Right"):
                        hand_label = "Right" if raw_label == "Left" else "Left"

                    for finger_name, tip_idx in [
                        ("THUMB", 4), ("INDEX", 8), ("MIDDLE", 12),
                        ("RING", 16), ("PINKY", 20),
                    ]:
                        if tip_idx >= len(hand_landmarks):
                            continue
                        lm = hand_landmarks[tip_idx]
                        px, py = int(lm.x * w), int(lm.y * h)
                        try:
                            fx, fy = calibrator.image_to_keyboard(px, py)
                        except (ValueError, cv2.error):
                            continue
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
                                finger_positions.append({
                                    "label": finger_label,
                                    "x": fx,
                                    "y": fy,
                                    "px": px,
                                    "py": py,
                                    "correct": correct,
                                    "zone": zone_name,
                                })

        for finger in finger_positions:
            finger_label = finger["label"]
            px = finger["px"]
            py = finger["py"]
            correct = finger["correct"]
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
        state_fingers = [
            {
                "label": finger["label"],
                "x": round(float(finger["x"]), 4),
                "y": round(float(finger["y"]), 4),
                "correct": bool(finger["correct"]),
                "zone": finger["zone"],
            }
            for finger in finger_positions
            if finger["label"] != "UNKNOWN"
        ]
        state_timestamp = time.time()
        with _state_lock:
            _current_state = {
                "verdict": smoothed,
                "wrong_fingers": sorted_wrong,
                "finger_positions": state_fingers,
                "timestamp": state_timestamp,
            }
        if smoothed != last_written_verdict or sorted_wrong != last_written_wrong:
            write_state(smoothed, sorted_wrong, state_fingers)
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

    write_state("IDLE", [], [])
    with _state_lock:
        _current_state = {
            "verdict": "IDLE",
            "wrong_fingers": [],
            "finger_positions": [],
            "timestamp": time.time(),
        }
    if cap is not None:
        cap.release()
    with _camera_source_lock:
        _active_camera_source = None
    if not headless:
        cv2.destroyAllWindows()
    if hasattr(detector, "close"):
        detector.close()
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
