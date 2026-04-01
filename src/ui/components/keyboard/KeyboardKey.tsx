import { memo } from "react";
import type { KeyDef } from "./keyboardLayouts";
import "./Keyboard.css";

type KeyboardKeyProps = {
  def: KeyDef;
  unitSize: number;
  gap: number;
  isHighlighted?: boolean;
  isPressed?: boolean;
  isHome?: boolean;
  showFingerHint?: boolean;
  fingerColor?: string;
  mode: "lesson" | "test";
  onClick?: () => void;
};

export const KeyboardKey = memo(function KeyboardKey({
  def,
  unitSize,
  gap,
  isHighlighted,
  isPressed,
  isHome,
  showFingerHint,
  fingerColor,
  mode,
  onClick,
}: KeyboardKeyProps) {
  const width = def.key === " "
    ? unitSize * def.width + gap * (def.width - 1)
    : unitSize * def.width + gap * Math.max(0, def.width - 1);

  const displayLabel = def.key === " " ? "" : def.label;

  let className = "kb-key";
  if (def.key === " ") className += " kb-key--space";
  if (def.label.length > 2) className += " kb-key--wide";
  if (isHighlighted) className += " kb-key--highlighted";
  if (isPressed) className += " kb-key--pressed";
  if (isHome) className += " kb-key--home";
  if (onClick) className += " kb-key--clickable";

  const style: React.CSSProperties = {
    width: `${width}px`,
    height: `${unitSize}px`,
    minWidth: `${width}px`,
  };

  if (showFingerHint && fingerColor && !isHighlighted && !isPressed) {
    style.background = fingerColor;
    style.borderColor = fingerColor;
  }

  return (
    <div
      className={className}
      style={style}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      {displayLabel}
      {isHome && !isHighlighted && !isPressed && <span className="kb-key__home-dot" />}
    </div>
  );
});
