/* ─── src/ui/components/TypingDisplay.tsx ────────────────────────────────────
   Renders the text-to-type with per-character state coloring.
   Plugs directly into useTyping — pass the typed string and target string.
   ──────────────────────────────────────────────────────────────────────── */

import React, { useEffect, useRef } from 'react';
import './TypingDisplay.css';

export type CharState = 'done' | 'correct' | 'error' | 'cursor' | 'ahead';

interface TypingDisplayProps {
  /** The full string the user needs to type */
  target: string;
  /** How many characters the user has typed so far */
  typed: string;
  /** Optional: show a blinking cursor at the current position */
  showCursor?: boolean;
  /** Optional: additional class */
  className?: string;
}

function getCharState(
  charIndex: number,
  typed: string,
  target: string,
): CharState {
  if (charIndex < typed.length) {
    return typed[charIndex] === target[charIndex] ? 'correct' : 'error';
  }
  if (charIndex === typed.length) return 'cursor';
  return 'ahead';
}

export const TypingDisplay: React.FC<TypingDisplayProps> = ({
  target,
  typed,
  showCursor = true,
  className = '',
}) => {
  const cursorRef = useRef<HTMLSpanElement>(null);

  /* Keep cursor in view as user types */
  useEffect(() => {
    cursorRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [typed.length]);

  const chars = target.split('');

  return (
    <div className={`typing-display ${className}`} aria-live="off">
      {chars.map((ch, i) => {
        const state = getCharState(i, typed, target);
        const isCursorPos = showCursor && state === 'cursor';

        return (
          <span
            key={i}
            ref={isCursorPos ? cursorRef : undefined}
            className={[
              'typing-display__char',
              `typing-display__char--${state}`,
              ch === ' ' ? 'typing-display__char--space' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {ch === ' ' ? '\u00A0' : ch}
          </span>
        );
      })}
    </div>
  );
};

export default TypingDisplay;
