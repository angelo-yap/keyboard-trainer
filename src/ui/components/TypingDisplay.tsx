import React, { useEffect, useRef, memo, useMemo } from "react";
import "./TypingDisplay.css";

export type CharState = "done" | "correct" | "error" | "cursor" | "ahead";

interface TypingDisplayProps {
  target: string;
  typed: string;
  showCursor?: boolean;
  className?: string;
  onClick?: () => void;
  mode?: "viewport" | "full";
}

function getCharState(i: number, typed: string, target: string): CharState {
  if (i < typed.length) return typed[i] === target[i] ? "correct" : "error";
  if (i === typed.length) return "cursor";
  return "ahead";
}

function getWordSegments(target: string): { text: string; startIndex: number }[] {
  const segments: { text: string; startIndex: number }[] = [];
  const regex = /\S+\s*|\s+/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(target)) !== null) {
    segments.push({ text: m[0], startIndex: m.index });
  }
  return segments;
}

const Char = memo(function Char({
  ch,
  state,
  isCursor,
  cursorRef,
}: {
  ch: string;
  state: CharState;
  isCursor?: boolean;
  cursorRef?: React.RefObject<HTMLSpanElement | null>;
}) {
  return (
    <span
      ref={isCursor ? cursorRef : undefined}
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
});

/**
 * Word segment that only re-renders when the cursor enters or leaves it.
 * Words the cursor has already passed stay frozen (memo'd as "correct"/"error").
 * Words the cursor hasn't reached yet stay frozen as "ahead".
 * Only the 1–2 words around the cursor ever re-render per keystroke.
 */
const WordSegment = memo(
  function WordSegment({
    text,
    startIndex,
    typed,
    target,
    cursorRef,
  }: {
    text: string;
    startIndex: number;
    typed: string;
    target: string;
    cursorRef: React.RefObject<HTMLSpanElement | null>;
  }) {
    return (
      <span className="typing-display__word">
        {text.split("").map((ch, j) => {
          const i = startIndex + j;
          const state = getCharState(i, typed, target);
          const isCursor = state === "cursor";
          return (
            <Char
              key={i}
              ch={ch}
              state={state}
              isCursor={isCursor}
              cursorRef={cursorRef}
            />
          );
        })}
      </span>
    );
  },
  // Only re-render when the cursor moves into or out of this word
  (prev, next) => {
    if (prev.text !== next.text || prev.startIndex !== next.startIndex) return false;

    // Backward movement (backspace/reset/new rep) can invalidate previously
    // frozen char states across many words, so force a rerender.
    if (next.typed.length < prev.typed.length) return false;

    const wordEnd = prev.startIndex + prev.text.length;
    const wordStart = prev.startIndex;
    const prevCursorHere =
      prev.typed.length >= wordStart && prev.typed.length <= wordEnd;
    const nextCursorHere =
      next.typed.length >= wordStart && next.typed.length <= wordEnd;
    if (!prevCursorHere && !nextCursorHere) return true; // skip re-render
    return false; // re-render
  }
);

function TypingDisplayInner({
  target,
  typed,
  className,
  onClick,
  cursorRef,
}: {
  target: string;
  typed: string;
  className: string;
  onClick?: () => void;
  cursorRef: React.RefObject<HTMLSpanElement | null>;
}) {
  const segments = useMemo(() => getWordSegments(target), [target]);

  return (
    <div
      className={`typing-display ${className}`}
      aria-live="off"
      onClick={onClick}
      style={onClick ? { cursor: "text" } : undefined}
    >
      {segments.map((seg) => (
        <WordSegment
          key={seg.startIndex}
          text={seg.text}
          startIndex={seg.startIndex}
          typed={typed}
          target={target}
          cursorRef={cursorRef}
        />
      ))}
    </div>
  );
}

function FullTypingDisplay({
  target,
  typed,
  className = "",
  onClick,
}: TypingDisplayProps) {
  const cursorRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    cursorRef.current?.scrollIntoView({ block: "nearest" });
  }, [typed.length]);

  return (
    <TypingDisplayInner
      target={target}
      typed={typed}
      className={className}
      onClick={onClick}
      cursorRef={cursorRef}
    />
  );
}

function ViewportTypingDisplay({
  target,
  typed,
  className = "",
  onClick,
}: TypingDisplayProps) {
  const cursorRef = useRef<HTMLSpanElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  // Only scroll when the line actually changes — avoids a forced layout reflow every keystroke
  const lastLineRef = useRef(-1);

  useEffect(() => {
    const cursor = cursorRef.current;
    const wrap = wrapRef.current;
    if (!cursor || !wrap) return;

    const lineH = 32;
    const currentLine = Math.floor(cursor.offsetTop / lineH);
    if (currentLine === lastLineRef.current) return;
    lastLineRef.current = currentLine;

    wrap.scrollTop = Math.max(0, cursor.offsetTop - lineH);
  }, [typed.length]);

  return (
    <div ref={wrapRef} className="typing-display--viewport-wrap">
      <TypingDisplayInner
        target={target}
        typed={typed}
        className={className}
        onClick={onClick}
        cursorRef={cursorRef}
      />
    </div>
  );
}

export const TypingDisplay: React.FC<TypingDisplayProps> = (props) => {
  if (props.mode === "viewport") return <ViewportTypingDisplay {...props} />;
  return <FullTypingDisplay {...props} />;
};

export default TypingDisplay;
