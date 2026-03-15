import { useState, useEffect } from "react";
import { keyboardLayouts, type LayoutType } from "./keyboardLayouts";
import { KeyboardRow } from "./KeyboardRow";
import "./Keyboard.css";

const UNIT_SIZE = 36;
const GAP = 4;
const MAX_WIDTH = 720;

export type KeyboardMode = "lesson" | "test";

type KeyboardProps = {
  layoutType?: LayoutType;
  highlightKey?: string;
  highlightKeys?: string[];
  pressedKey?: string;       // still accepted so callers don't break, but ignored internally
  showFingerHints?: boolean;
  mode?: KeyboardMode;
  className?: string;
};

export function Keyboard({
  layoutType = "mac",
  highlightKey = "",
  highlightKeys,
  showFingerHints = true,
  mode = "test",
  className = "",
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
  const totalUnits = 15.25;
  const scale = Math.min(1, MAX_WIDTH / (totalUnits * UNIT_SIZE + (totalUnits - 1) * GAP));

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
          />
        ))}
      </div>
    </div>
  );
}
