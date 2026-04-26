import { useCallback, useEffect, useState } from "react";
import { CameraPanel } from "./CameraPanel";
import { Keyboard, type KeyboardFingerMarker } from "./keyboard";
import { FeedbackBanner } from "./FeedbackBanner";
import { resetKeyboardLed, sendKeyboardLedForKeys } from "../../core/keyboard/keyboardLedBridge";
import type { Settings } from "../../core/storage/settingsStore";
import "./OnboardingTools.css";

type OnboardingCalibrationProps = {
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
};

type OnboardingFingerMarkersProps = {
  settings: Settings;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
};

const DEMO_FINGER_MARKERS: KeyboardFingerMarker[] = [
  { label: "L_INDEX", x: 0.33, y: 0.56, correct: true },
  { label: "L_MIDDLE", x: 0.27, y: 0.54, correct: true },
  { label: "R_INDEX", x: 0.64, y: 0.56, correct: true },
  { label: "R_MIDDLE", x: 0.7, y: 0.54, correct: true },
];

export function OnboardingCalibration({
  onBack,
  onNext,
  onSkip,
}: OnboardingCalibrationProps) {
  const [calibrated, setCalibrated] = useState(false);

  return (
    <div className="onboarding-tool-root">
      <div className="onboarding-tool-panel onboarding-tool-panel--wide">
        <div className="onboarding-tool-copy">
          <div className="onboarding-tool-kicker mono-label">camera setup</div>
          <h1>Calibrate your hand camera</h1>
          <p>
            Set the four corners of your keyboard area so finger tracking lines
            up with the on-screen keyboard.
          </p>
          <p className="onboarding-tool-muted">
            Click Calibrate, then tap the top-left, top-right, bottom-right, and
            bottom-left corners in the camera view.
          </p>
        </div>

        <div className="onboarding-tool-camera">
          <CameraPanel
            active={true}
            showCalibrationControls={true}
            variant="embedded"
            onCalibrationChange={setCalibrated}
          />
        </div>

        <div className="onboarding-tool-actions">
          <button type="button" className="onboarding-tool-btn" onClick={onBack}>
            Back
          </button>
          <button type="button" className="onboarding-tool-btn" onClick={onSkip}>
            Skip setup
          </button>
          <button
            type="button"
            className="onboarding-tool-btn onboarding-tool-btn--primary"
            onClick={onNext}
          >
            {calibrated ? "Looks good" : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function OnboardingFingerMarkers({
  settings,
  onBack,
  onNext,
  onSkip,
}: OnboardingFingerMarkersProps) {
  const [fingerMarkers, setFingerMarkers] = useState<KeyboardFingerMarker[]>([]);
  const [verdict, setVerdict] = useState<"GOOD" | "BAD" | "IDLE" | "">("");
  const [wrongFingers, setWrongFingers] = useState<string[]>([]);
  const visibleMarkers = fingerMarkers.length > 0 ? fingerMarkers : DEMO_FINGER_MARKERS;

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:8000/ws");

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data) as {
        verdict?: "GOOD" | "BAD" | "IDLE";
        wrong_fingers?: string[];
        finger_positions?: KeyboardFingerMarker[];
      };
      setVerdict(data.verdict ?? "IDLE");
      setWrongFingers(data.wrong_fingers ?? []);
      setFingerMarkers(
        (data.finger_positions ?? []).filter(
          (finger) =>
            typeof finger.label === "string" &&
            Number.isFinite(finger.x) &&
            Number.isFinite(finger.y),
        ),
      );
    };

    ws.onerror = () => {
      setVerdict("");
      setWrongFingers([]);
      setFingerMarkers([]);
    };
    return () => ws.close();
  }, []);

  const previewLights = useCallback(() => {
    void sendKeyboardLedForKeys(["f", "j"]);
  }, []);

  useEffect(() => {
    previewLights();
    return () => {
      void resetKeyboardLed();
    };
  }, [previewLights]);

  return (
    <div className="onboarding-tool-root">
      <div className="onboarding-tool-panel onboarding-tool-panel--wide">
        <div className="onboarding-tool-copy">
          <div className="onboarding-tool-kicker mono-label">typing tools</div>
          <h1>Wave hello</h1>
          <p>
            The dots on the keyboard show where your fingers are. They help you
            notice when a finger drifts before it becomes a habit. 
          </p>
          <p className="onboarding-tool-muted">
            While you type, the form bar will say Good form when your fingers
            look right, or Fix fingers when something needs attention.
          </p>
          <p className="onboarding-tool-muted">
            You can turn finger hints off later in Settings.
          </p>
        </div>

        <div className="onboarding-tool-keyboard-wrap">
          <Keyboard
            layoutType={settings.keyboardLayout ?? "mac"}
            highlightKeys={["f", "j"]}
            showFingerHints={settings.showFingerHints !== false}
            mode="lesson"
            fingerMarkers={visibleMarkers}
          />
        </div>

        <div className="onboarding-tool-formbar">
          <FeedbackBanner verdict={verdict} wrongFingers={wrongFingers} />
        </div>

        <div className="onboarding-tool-actions">
          <button type="button" className="onboarding-tool-btn" onClick={onBack}>
            Back
          </button>
          <button type="button" className="onboarding-tool-btn" onClick={onSkip}>
            Skip setup
          </button>
          <button
            type="button"
            className="onboarding-tool-btn onboarding-tool-btn--primary"
            onClick={onNext}
          >
            Start learning
          </button>
        </div>
      </div>
    </div>
  );
}
