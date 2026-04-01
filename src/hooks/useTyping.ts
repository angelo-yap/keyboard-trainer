import { useState, useEffect, useRef, useCallback } from "react";
 
export type TypingStats = {
  wpm: number;
  rawWpm: number;
  accuracy: number;
  errors: number;
  chars: number;
  elapsed: number;
};
 
export type TypingProgress = {
  nextChar: string;
  typedLength: number;
  totalLength: number;
};
 
export type KeystrokeEvent = {
  startedAt: number;
  time: number; // ms since session start
  expectedChar: string;
  typedChar: string;
  correct: boolean;
  index: number;
};
 
export type UseTypingOptions = {
  text: string;
  enabled?: boolean;
  onComplete?: (stats: TypingStats) => void;
  onProgress?: (progress: TypingProgress) => void;
  onKeystroke?: (event: KeystrokeEvent) => void;
};
 
export function useTyping({
  text,
  enabled = true,
  onComplete,
  onProgress,
  onKeystroke,
}: UseTypingOptions) {
  const [typed, setTyped] = useState("");
  const [errors, setErrors] = useState<Set<number>>(new Set());
  const [startTime, setStartTime] = useState<number | null>(null);
  const [endTime, setEndTime] = useState<number | null>(null);
  const [pressedKey, setPressedKey] = useState("");
  const [combo, setCombo] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const startTimeRef = useRef<number | null>(null);
 
  // Keep latest text in a ref so handleKeyDown always sees the current value,
  // even if setText (from dynamic refill) hasn't re-rendered the component yet.
  const textRef = useRef(text);
  textRef.current = text;
 
  // Keep errors in a ref so handleKeyDown never goes stale
  const errorsRef = useRef<Set<number>>(new Set());
 
  useEffect(() => {
    setTyped("");
    errorsRef.current = new Set();
    setErrors(new Set());
    setStartTime(null);
    setEndTime(null);
    setCombo(0);
    startTimeRef.current = null;
  }, [text]);
 
  useEffect(() => {
    if (enabled) inputRef.current?.focus();
  }, [enabled, text]);
 
  // Standard WPM: (correct chars / 5) / minutes — same formula as Monkeytype/Typeracer.
  // The old formula used literal word count which inflates WPM for short words.
  const getStats = useCallback(
    (typedStr: string, errSet: Set<number>, start: number, end: number): TypingStats => {
      const elapsedMinutes = ((end || Date.now()) - start) / 1000 / 60;
      const correctChars = typedStr.length - errSet.size;
      const wpm = elapsedMinutes > 0 ? Math.round(correctChars / 5 / elapsedMinutes) : 0;
      const rawWpm = elapsedMinutes > 0 ? Math.round(typedStr.length / 5 / elapsedMinutes) : 0;
      const accuracy =
        typedStr.length > 0
          ? Math.round((correctChars / typedStr.length) * 100)
          : 100;
      return {
        wpm,
        rawWpm,
        accuracy,
        errors: errSet.size,
        chars: typedStr.length,
        elapsed: elapsedMinutes * 60,
      };
    },
    []
  );
 
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!enabled) return;
      if (e.key === "Tab") {
        e.preventDefault();
        return;
      }
 
      clearTimeout(pressTimer.current);
      setPressedKey(e.key.toLowerCase());
      pressTimer.current = setTimeout(() => setPressedKey(""), 120);
 
      if (e.key === "Backspace") {
        setTyped((t) => {
          if (!t.length) return t;
          const removedIndex = t.length - 1;
          if (errorsRef.current.has(removedIndex)) {
            const nextErrors = new Set(errorsRef.current);
            nextErrors.delete(removedIndex);
            errorsRef.current = nextErrors;
            setErrors(nextErrors);
          }
          return t.slice(0, -1);
        });
        return;
      }
 
      if (e.key.length !== 1) return;
 
      setTyped((prev) => {
        // Always read from the ref — never the stale closure value.
        // This is critical for dynamic refill: setText() updates textRef.current
        // synchronously via the ref assignment above, so we always see the latest
        // text even before React has re-rendered with the new value.
        const currentText = textRef.current;
 
        if (prev.length >= currentText.length) return prev;
 
        const idx = prev.length;
        const expected = currentText[idx];
        const isCorrect = e.key === expected;
 
        if (prev.length === 0) {
          const t = Date.now();
          startTimeRef.current = t;
          setStartTime(t);
        }
 
        const startedAt = startTimeRef.current ?? Date.now();
        const timeMs = Date.now() - startedAt;
        onKeystroke?.({
          startedAt,
          time: timeMs,
          expectedChar: expected,
          typedChar: e.key,
          correct: isCorrect,
          index: idx,
        });
 
        if (!isCorrect) {
          errorsRef.current = new Set([...errorsRef.current, idx]);
          setErrors(errorsRef.current);
          setCombo(0);
        } else {
          setCombo((c) => c + 1);
        }
 
        const next = prev + e.key;
 
        onProgress?.({
          nextChar: currentText[next.length],
          typedLength: next.length,
          totalLength: currentText.length,
        });
 
        if (next.length >= currentText.length) {
          const now = Date.now();
          setEndTime(now);
          const finalErrors = isCorrect
            ? errorsRef.current
            : new Set([...errorsRef.current, idx]);
          const finalStart = startTimeRef.current ?? now;
          setTimeout(() => {
            onComplete?.(getStats(next, finalErrors, finalStart, now));
          }, 0);
        }
 
        return next;
      });
    },
    // textRef, errorsRef, startTimeRef are refs — safe to omit from deps
    [enabled, onComplete, onProgress, onKeystroke, getStats]
  );
 
  const liveStats: TypingStats =
    startTime && typed.length > 0
      ? getStats(typed, errors, startTime, endTime || Date.now())
      : { wpm: 0, rawWpm: 0, accuracy: 100, errors: 0, chars: 0, elapsed: 0 };
 
  const reset = useCallback(() => {
    setTyped("");
    errorsRef.current = new Set();
    setErrors(new Set());
    setStartTime(null);
    setEndTime(null);
    setCombo(0);
    startTimeRef.current = null;
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);
 
  const focus = useCallback(() => inputRef.current?.focus(), []);
 
  return {
    typed,
    errors,
    pressedKey,
    combo,
    startTime,
    endTime,
    liveStats,
    inputRef,
    handleKeyDown,
    reset,
    focus,
    currentChar: textRef.current[typed.length] || "",
    progress: textRef.current.length > 0 ? typed.length / textRef.current.length : 0,
    isComplete: typed.length >= textRef.current.length,
  };
}