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
  pressedKey?: string;
  showFingerHints?: boolean;
  mode?: KeyboardMode;
  className?: string;
};

export function Keyboard({
  layoutType = "mac",
  highlightKey = "",
  highlightKeys,
  pressedKey = "",
  showFingerHints = true,
  mode = "test",
  className = "",
}: KeyboardProps) {
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
