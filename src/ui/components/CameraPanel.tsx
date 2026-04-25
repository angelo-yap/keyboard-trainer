import { useState, useRef, useCallback, useEffect } from "react";

const CAMERA_W = 1280;
const CAMERA_H = 720;
const CORNER_LABELS = ["Top-Left", "Top-Right", "Bottom-Right", "Bottom-Left"];

type CalibMode = "idle" | "collecting" | "done";

type CameraPanelProps = {
  active: boolean;
};

export function CameraPanel({ active }: CameraPanelProps) {
  const [calibMode, setCalibMode] = useState<CalibMode>("idle");
  const [corners, setCorners] = useState<[number, number][]>([]);
  const [calibrated, setCalibrated] = useState(false);
  const [connected, setConnected] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!active) return;
    fetch("http://localhost:8000/info")
      .then((r) => r.json())
      .then((d) => setCalibrated(d.calibrated ?? false))
      .catch(() => {});
  }, [active]);

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
    setCalibMode("idle");
    setCorners([]);
  }, []);

  const handleImageClick = useCallback(
    (e: React.MouseEvent<HTMLImageElement>) => {
      if (calibMode !== "collecting") return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = Math.round((e.clientX - rect.left) * (CAMERA_W / rect.width));
      const y = Math.round((e.clientY - rect.top) * (CAMERA_H / rect.height));

      setCorners((prev) => {
        const next: [number, number][] = [...prev, [x, y]];
        if (next.length === 4) {
          fetch("http://localhost:8000/calibrate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ corners: next }),
          })
            .then(() => {
              setCalibrated(true);
              setCalibMode("done");
            })
            .catch(() => setCalibMode("idle"));
        }
        return next;
      });
    },
    [calibMode],
  );

  const hintText =
    calibMode === "collecting"
      ? `Click ${CORNER_LABELS[corners.length]} (${corners.length + 1} / 4)`
      : calibrated
      ? "Calibrated"
      : "Not calibrated";

  return (
    <div className="camera-panel">
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
              src="http://localhost:8000/video"
              className="camera-panel-img"
              alt="Hand tracking feed"
              draggable={false}
              onLoad={() => setConnected(true)}
              onError={() => setConnected(false)}
              onClick={handleImageClick}
            />
            {calibMode === "collecting" &&
              corners.map(([x, y], i) => (
                <div
                  key={i}
                  className="camera-panel-corner-dot"
                  style={{
                    left: `${(x / CAMERA_W) * 100}%`,
                    top: `${(y / CAMERA_H) * 100}%`,
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
