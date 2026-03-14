/* ─── src/ui/components/TypingDisplay.tsx ────────────────────────────────────
   Renders the text-to-type with per-character state coloring.
   Words are kept on single lines (no mid-word breaks).
   ──────────────────────────────────────────────────────────────────────── */

import React, { useEffect, useRef } from "react";
import "./TypingDisplay.css";

export type CharState = "done" | "correct" | "error" | "cursor" | "ahead";

interface TypingDisplayProps {
  /** The full string the user needs to type */
  target: string;
  /** How many characters the user has typed so far */
  typed: string;
  /** Optional: show a blinking cursor at the current position */
  showCursor?: boolean;
  /** Optional: additional class */
  className?: string;
  /** Optional: click to focus (e.g. for hidden input capture) */
  onClick?: () => void;
}

function getCharState(
  charIndex: number,
  typed: string,
  target: string
): CharState {
  if (charIndex < typed.length) {
    return typed[charIndex] === target[charIndex] ? "correct" : "error";
  }
  if (charIndex === typed.length) return "cursor";
  return "ahead";
}

/** Split target into segments (word+space or space-only) so words never break across lines */
function getWordSegments(target: string): { text: string; startIndex: number }[] {
  const segments: { text: string; startIndex: number }[] = [];
  const regex = /\S+\s*|\s+/g;
  let m;
  while ((m = regex.exec(target)) !== null) {
    segments.push({ text: m[0], startIndex: m.index });
  }
  return segments;
}

export const TypingDisplay: React.FC<TypingDisplayProps> = ({
  target,
  typed,
  showCursor = true,
  className = "",
  onClick,
}) => {
  const cursorRef = useRef<HTMLSpanElement>(null);

  /* Keep cursor in view with smooth scroll */
  useEffect(() => {
    cursorRef.current?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
      behavior: "smooth",
    });
  }, [typed.length]);

  const segments = getWordSegments(target);

  return (
    <div
      className={`typing-display ${className}`}
      aria-live="off"
      onClick={onClick}
      style={onClick ? { cursor: "text" } : undefined}
    >
      {segments.map((seg, segIdx) => {
        const chars = seg.text.split("");
        return (
          <span
            key={segIdx}
            className="typing-display__word"
          >
            {chars.map((ch, j) => {
              const charIndex = seg.startIndex + j;
              const state = getCharState(charIndex, typed, target);
              const isCursorPos = showCursor && state === "cursor";

              return (
                <span
                  key={charIndex}
                  ref={isCursorPos ? cursorRef : undefined}
                  className={[
                    "typing-display__char",
                    `typing-display__char--${state}`,
                    ch === " " ? "typing-display__char--space" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {ch === " " ? "\u00A0" : ch}
                </span>
              );
            })}
          </span>
        );
      })}
    </div>
  );
};

export default TypingDisplay;
