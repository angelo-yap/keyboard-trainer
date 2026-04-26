import { useState, useRef, useCallback, useEffect } from "react";
import "./CameraPanel.css";

const CAMERA_W = 1280;
const CAMERA_H = 720;
const CORNER_LABELS = ["Top-Left", "Top-Right", "Bottom-Right", "Bottom-Left"];

type CalibMode = "idle" | "collecting" | "done";

type CameraPanelProps = {
  active?: boolean;
  reloadSignal?: number;
  showCalibrationControls?: boolean;
  variant?: "floating" | "embedded";
  onCalibrationChange?: (calibrated: boolean) => void;
};

export function CameraPanel({
  active = true,
  reloadSignal = 0,
  showCalibrationControls = false,
  variant = "floating",
  onCalibrationChange,
}: CameraPanelProps) {
  const [calibMode, setCalibMode] = useState<CalibMode>("idle");
  const [corners, setCorners] = useState<[number, number][]>([]);
  const [calibrated, setCalibrated] = useState(false);
  const [connected, setConnected] = useState(false);
  const [videoNonce, setVideoNonce] = useState(0);
  const [frameSize, setFrameSize] = useState({ width: CAMERA_W, height: CAMERA_H });
  const retryTimeoutRef = useRef<number | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!active) return;
    fetch("http://localhost:8000/info")
      .then((r) => r.json())
      .then((d) => {
        const nextCalibrated = d.calibrated ?? false;
        setCalibrated(nextCalibrated);
        onCalibrationChange?.(nextCalibrated);
        if (Number.isFinite(d.frame_width) && Number.isFinite(d.frame_height)) {
          setFrameSize({ width: d.frame_width, height: d.frame_height });
        }
      })
      .catch(() => {});
  }, [active, onCalibrationChange]);

  useEffect(() => {
    if (!active) {
      setConnected(false);
      return;
    }
    setVideoNonce((value) => value + 1);
  }, [active, reloadSignal]);

  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current !== null) {
        window.clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  const startCalib = useCallback(() => {
    if (calibMode === "collecting") {
      setCalibMode("idle");
      setCorners([]);
      return;
    }
    setCorners([]);
    setCalibMode("collecting");
    fetch("http://localhost:8000/calibrate/reset", { method: "POST" }).catch(() => {});
  }, [calibMode]);

  const handleReset = useCallback(() => {
    fetch("http://localhost:8000/calibrate/reset", { method: "POST" }).catch(() => {});
    setCalibrated(false);
    onCalibrationChange?.(false);
    setCalibMode("idle");
    setCorners([]);
  }, [onCalibrationChange]);

  const handleImageClick = useCallback(
    (e: React.MouseEvent<HTMLImageElement>) => {
      if (calibMode !== "collecting") return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = Math.round((e.clientX - rect.left) * (frameSize.width / rect.width));
      const y = Math.round((e.clientY - rect.top) * (frameSize.height / rect.height));

      setCorners((prev) => {
        const next: [number, number][] = [...prev, [x, y]];
        if (next.length === 4) {
          fetch("http://localhost:8000/calibrate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ corners: next }),
          })
            .then(async (response) => {
              const payload = (await response.json()) as { ok?: boolean; error?: string };
              if (!response.ok || !payload.ok) {
                throw new Error(payload.error || "Calibration failed.");
              }
              setCalibrated(true);
              onCalibrationChange?.(true);
              setCalibMode("done");
            })
            .catch(() => setCalibMode("idle"));
        }
        return next;
      });
    },
    [calibMode, frameSize.height, frameSize.width, onCalibrationChange],
  );

  const handleImageError = useCallback(() => {
    setConnected(false);
    if (!active || retryTimeoutRef.current !== null) {
      return;
    }
    retryTimeoutRef.current = window.setTimeout(() => {
      retryTimeoutRef.current = null;
      setVideoNonce((value) => value + 1);
    }, 1500);
  }, [active]);

  const handleImageLoad = useCallback(() => {
    setConnected(true);
    if (retryTimeoutRef.current !== null) {
      window.clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  }, []);

  const hintText =
    calibMode === "collecting"
      ? `Click ${CORNER_LABELS[corners.length]} (${corners.length + 1} / 4)`
      : calibrated
      ? "Calibrated"
      : "Not calibrated";

  return (
    <div className={`camera-panel camera-panel--${variant}`}>
      <div className="camera-panel-header">
        <span className="camera-panel-title">
          <span
            className={`camera-panel-dot ${
              connected ? "camera-panel-dot--on" : "camera-panel-dot--off"
            }`}
          />
          Hand Camera
        </span>
        <span className="camera-panel-hint">{hintText}</span>
        {showCalibrationControls && (
          <div className="camera-panel-actions">
            <button
              type="button"
              className={`camera-panel-btn ${
                calibMode === "collecting" ? "camera-panel-btn--cancel" : ""
              }`}
              onClick={startCalib}
            >
              {calibMode === "collecting" ? "Cancel" : "Calibrate"}
            </button>
            {calibrated && calibMode !== "collecting" && (
              <button
                type="button"
                className="camera-panel-btn camera-panel-btn--reset"
                onClick={handleReset}
              >
                Reset
              </button>
            )}
          </div>
        )}
      </div>

      <div
        className={`camera-panel-view${
          calibMode === "collecting" ? " camera-panel-view--calibrating" : ""
        }`}
      >
        {active ? (
          <>
            <img
              ref={imgRef}
              src={`http://localhost:8000/video?stream=${videoNonce}`}
              className="camera-panel-img"
              alt="Hand tracking feed"
              draggable={false}
              onLoad={handleImageLoad}
              onError={handleImageError}
              onClick={handleImageClick}
            />
            {calibMode === "collecting" &&
              corners.map(([x, y], i) => (
                <div
                  key={i}
                  className="camera-panel-corner-dot"
                  style={{
                    left: `${(x / frameSize.width) * 100}%`,
                    top: `${(y / frameSize.height) * 100}%`,
                  }}
                />
              ))}
          </>
        ) : (
          <div className="camera-panel-offline">Camera inactive</div>
        )}
      </div>
    </div>
  );
}
