import { useEffect, useRef } from "react";
import "./TypingDisplay.css";

const FONT_SIZES = { sm: 18, md: 22, lg: 28 };

type TypingDisplayProps = {
  text: string;
  typed: string;
  errors: Set<number>;
  fontSize?: "sm" | "md" | "lg";
  caretStyle?: "block" | "line" | "underline";
  onClick?: () => void;
  maxVisible?: number;
};

export function TypingDisplay({
  text,
  typed,
  errors,
  fontSize = "md",
  caretStyle = "block",
  onClick,
  maxVisible = 300,
}: TypingDisplayProps) {
  const caretRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    caretRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [typed.length]);

  const fSize = FONT_SIZES[fontSize] || 22;
  const cursorIdx = typed.length;

  const startIdx = Math.max(0, cursorIdx - 80);
  const displayText = text.slice(startIdx, startIdx + maxVisible);
  const displayOffset = startIdx;

  return (
    <div
      className="typing-display"
      onClick={onClick}
      style={{ fontSize: fSize, cursor: onClick ? "text" : "default" }}
    >
      {displayText.split("").map((char, di) => {
        const i = di + displayOffset;
        const isCursor = i === cursorIdx;
        const isTyped = i < cursorIdx;
        const isError = errors.has(i);

        let color: string;
        let bg: string;
        if (isTyped) {
          color = isError ? "rgba(255, 90, 90, 0.9)" : "rgba(255,255,255,0.35)";
          bg = isError ? "rgba(255,60,60,0.12)" : "transparent";
        } else if (isCursor) {
          color = "rgba(255,255,255,0.95)";
          bg = caretStyle === "block" ? "rgba(255,140,50,0.5)" : "transparent";
        } else {
          color = "rgba(255,255,255,0.2)";
          bg = "transparent";
        }

        const displayChar = char === " " ? "\u00A0" : char;

        return (
          <span
            key={i}
            ref={isCursor ? caretRef : null}
            className={`typing-char ${isCursor ? "typing-cursor" : ""} ${caretStyle === "block" && isCursor ? "caret-block" : ""} ${caretStyle === "underline" && isCursor ? "caret-underline" : ""} ${caretStyle === "line" && isCursor ? "caret-line" : ""}`}
            style={{ color, background: bg }}
          >
            {displayChar}
          </span>
        );
      })}
    </div>
  );
}
