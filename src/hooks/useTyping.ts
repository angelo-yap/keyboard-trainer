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

export type UseTypingOptions = {
  text: string;
  enabled?: boolean;
  onComplete?: (stats: TypingStats) => void;
  onProgress?: (progress: TypingProgress) => void;
};

export function useTyping({
  text,
  enabled = true,
  onComplete,
  onProgress,
}: UseTypingOptions) {
  const [typed, setTyped] = useState("");
  const [errors, setErrors] = useState<Set<number>>(new Set());
  const [startTime, setStartTime] = useState<number | null>(null);
  const [endTime, setEndTime] = useState<number | null>(null);
  const [pressedKey, setPressedKey] = useState("");
  const [combo, setCombo] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout>>();
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    setTyped("");
    setErrors(new Set());
    setStartTime(null);
    setEndTime(null);
    setCombo(0);
    startTimeRef.current = null;
  }, [text]);

  useEffect(() => {
    if (enabled) inputRef.current?.focus();
  }, [enabled, text]);

  const getStats = useCallback(
    (typedStr: string, errSet: Set<number>, start: number, end: number): TypingStats => {
      const elapsed = ((end || Date.now()) - start) / 1000 / 60;
      const wordCount = typedStr.trim().split(/\s+/).filter(Boolean).length;
      const wpm = elapsed > 0 ? Math.round(wordCount / elapsed) : 0;
      const accuracy =
        typedStr.length > 0
          ? Math.round(((typedStr.length - errSet.size) / typedStr.length) * 100)
          : 100;
      const rawWpm = elapsed > 0 ? Math.round(typedStr.length / 5 / elapsed) : 0;
      return {
        wpm,
        rawWpm,
        accuracy,
        errors: errSet.size,
        chars: typedStr.length,
        elapsed: elapsed * 60,
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
        setTyped((t) => t.slice(0, -1));
        return;
      }

      if (e.key.length !== 1) return;

      setTyped((prev) => {
        if (prev.length >= text.length) return prev;

        const idx = prev.length;
        const expected = text[idx];
        const isCorrect = e.key === expected;

        if (prev.length === 0) {
          const t = Date.now();
          startTimeRef.current = t;
          setStartTime(t);
        }

        if (!isCorrect) {
          setErrors((err) => new Set([...err, idx]));
          setCombo(0);
        } else {
          setCombo((c) => c + 1);
        }

        const next = prev + e.key;

        onProgress?.({
          nextChar: text[next.length],
          typedLength: next.length,
          totalLength: text.length,
        });

        if (next.length >= text.length) {
          const now = Date.now();
          setEndTime(now);
          const finalErrors = isCorrect ? errors : new Set([...errors, idx]);
          const finalStart = startTimeRef.current ?? now;
          setTimeout(() => {
            onComplete?.(getStats(next, finalErrors, finalStart, now));
          }, 0);
        }

        return next;
      });
    },
    [enabled, text, errors, startTime, onComplete, onProgress, getStats]
  );

  const liveStats: TypingStats =
    startTime && typed.length > 0
      ? getStats(typed, errors, startTime, endTime || Date.now())
      : { wpm: 0, rawWpm: 0, accuracy: 100, errors: 0, chars: 0, elapsed: 0 };

  const reset = useCallback(() => {
    setTyped("");
    setErrors(new Set());
    setStartTime(null);
    setEndTime(null);
    setCombo(0);
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
    currentChar: text[typed.length] || "",
    progress: text.length > 0 ? typed.length / text.length : 0,
    isComplete: typed.length >= text.length,
  };
}
