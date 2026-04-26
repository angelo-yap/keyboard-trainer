import { useState, useEffect } from "react";
import { keyboardLayouts, type LayoutType } from "./keyboardLayouts";
import { KeyboardRow } from "./KeyboardRow";
import "./Keyboard.css";

const UNIT_SIZE = 42;
const GAP = 5;
const MAX_WIDTH = 860;
const FINGER_MARKER_X_OFFSET = 0;

export type KeyboardMode = "lesson" | "test";

export type KeyboardFingerMarker = {
  label: string;
  x: number;
  y: number;
  correct?: boolean;
  zone?: string;
};

type KeyboardProps = {
  layoutType?: LayoutType;
  highlightKey?: string;
  highlightKeys?: string[];
  pressedKey?: string;       // still accepted so callers don't break, but ignored internally
  showFingerHints?: boolean;
  mode?: KeyboardMode;
  className?: string;
  fingerMarkers?: KeyboardFingerMarker[];
  onKeyClick?: (key: string) => void;
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function getShortFingerLabel(label: string): string {
  return label
    .replace("L_", "L.")
    .replace("R_", "R.")
    .replace("INDEX", "I")
    .replace("MIDDLE", "M")
    .replace("RING", "R")
    .replace("PINKY", "P")
    .replace("THUMB", "T");
}

export function Keyboard({
  layoutType = "mac",
  highlightKey = "",
  highlightKeys,
  showFingerHints = true,
  mode = "test",
  className = "",
  fingerMarkers = [],
  onKeyClick,
}: KeyboardProps) {
  // Own internal pressedKey state — updated by window keydown/keyup.
  // This means the parent (Test) never re-renders when a key is pressed.
  // Only the Keyboard itself re-renders, and only the one changed key thanks to memo.
  const [pressedKey, setPressedKey] = useState("");

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const onDown = (e: KeyboardEvent) => {
      clearTimeout(timer);
      const k = e.key === " " ? " " : e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase();
      setPressedKey(k);
      // Auto-clear after 150ms in case keyup is missed
      timer = setTimeout(() => setPressedKey(""), 150);
    };

    const onUp = () => {
      clearTimeout(timer);
      setPressedKey("");
    };

    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      clearTimeout(timer);
    };
  }, []);

  const hlKey = highlightKey || (highlightKeys && highlightKeys[0]) || "";
  const hlSet = highlightKeys ? new Set(highlightKeys.map((k) => k.toLowerCase())) : null;
  const layout = keyboardLayouts[layoutType];
  if (!layout) return null;

  const { rows, indents } = layout;
  const intrinsicWidth = rows.reduce((max, row, index) => {
    const units = row.reduce((sum, key) => sum + key.width, indents?.[index] ?? 0);
    return Math.max(max, units * UNIT_SIZE + Math.max(0, units - 1) * GAP);
  }, 0);
  const scale = Math.min(1, MAX_WIDTH / intrinsicWidth);

  return (
    <div
      className={`kb-root ${className}`.trim()}
      data-mode={mode}
      style={{
        transform: scale < 1 ? `scale(${scale})` : undefined,
        transformOrigin: "center top",
      }}
    >
      <div className="kb-inner">
        {rows.map((row, ri) => (
          <KeyboardRow
            key={ri}
            keys={row}
            indent={indents?.[ri] ?? 0}
            unitSize={UNIT_SIZE}
            gap={GAP}
            highlightKey={hlKey}
            highlightKeys={hlSet}
            pressedKey={pressedKey}
            showFingerHints={showFingerHints}
            mode={mode}
            onKeyClick={onKeyClick}
          />
        ))}
        {fingerMarkers.length > 0 && (
          <div className="kb-finger-overlay" aria-hidden="true">
            {fingerMarkers.map((finger, index) => {
              const x = clamp01(finger.x + FINGER_MARKER_X_OFFSET);
              const y = clamp01(finger.y);
              const label = getShortFingerLabel(finger.label);

              return (
                <div
                  key={`${finger.label}-${index}`}
                  className={`kb-finger-marker${
                    finger.correct === false ? " kb-finger-marker--wrong" : ""
                  }`}
                  style={{
                    left: `${x * 100}%`,
                    top: `${y * 100}%`,
                  }}
                  title={`${finger.label}${finger.zone ? ` · ${finger.zone}` : ""}`}
                >
                  <span className="kb-finger-marker__label">{label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
