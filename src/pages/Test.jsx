import { useEffect, useMemo, useRef, useState } from "react";
import TypingLine from "../components/TypingLine";
import { calcWPM, clamp, makeRandomWords } from "../lib/words";
import { loadState, updateState, sameDayISO } from "../lib/storage";

export default function Test() {
  const [duration, setDuration] = useState(30); // seconds
  const [text, setText] = useState(() => makeRandomWords(60));
  const [cursor, setCursor] = useState(0);
  const [typed, setTyped] = useState("");
  const [errors, setErrors] = useState(0);
  const [keystrokes, setKeystrokes] = useState(0);

  const [running, setRunning] = useState(false);
  const startRef = useRef(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  const secsLeft = useMemo(() => {
    if (!running) return duration;
    const s = duration - Math.floor(elapsedMs / 1000);
    return Math.max(0, s);
  }, [running, duration, elapsedMs]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setElapsedMs(Date.now() - startRef.current), 100);
    return () => clearInterval(id);
  }, [running]);

  const wpm = useMemo(() => {
    if (!running && elapsedMs === 0) return 0;
    const ms = running ? elapsedMs : duration * 1000;
    return Math.round(calcWPM(cursor, ms));
  }, [cursor, elapsedMs, duration, running]);

  const accuracy = useMemo(() => {
    if (keystrokes === 0) return 100;
    return clamp(((keystrokes - errors) / keystrokes) * 100, 0, 100);
  }, [keystrokes, errors]);

  const reset = () => {
    setText(makeRandomWords(60));
    setCursor(0);
    setTyped("");
    setErrors(0);
    setKeystrokes(0);
    setRunning(false);
    startRef.current = null;
    setElapsedMs(0);
  };

  const finish = () => {
    setRunning(false);

    const now = new Date().toISOString();

    const next = updateState((s) => {
      const bestWpm = Math.max(s.bestWpm ?? 0, wpm);

      // streak (simple daily)
      const today = now.slice(0, 10);
      const last = s.lastActiveDay;
      let streak = s.streak ?? 0;
      if (!sameDayISO(last, today)) streak = streak + 1;

      const testHistory = [
        { ts: now, wpm, acc: Number(accuracy.toFixed(2)), secs: duration },
        ...(s.testHistory ?? []),
      ].slice(0, 50);

      return { ...s, bestWpm, streak, lastActiveDay: today, testHistory };
    });

    // show quick toast-ish
    // (we’re not building a toast system yet)
    console.log("Saved test:", next);
  };

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (!running) return;

      const key = e.key;

      if (key === "Backspace") {
        e.preventDefault();
        if (cursor > 0) {
          setCursor((c) => c - 1);
          setTyped((t) => t.slice(0, -1));
        }
        return;
      }

      if (key.length !== 1 && key !== " ") return;
      e.preventDefault();

      const expected = text[cursor] ?? "";

      setKeystrokes((k) => k + 1);
      if (key !== expected) setErrors((x) => x + 1);

      setTyped((t) => t + key);
      setCursor((c) => c + 1);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [running, cursor, text]);

  useEffect(() => {
    if (!running) return;
    if (secsLeft === 0) finish();
  }, [secsLeft, running]);

  const start = () => {
    reset();
    startRef.current = Date.now();
    setRunning(true);
  };

  const st = loadState();

  return (
    <div className="testWrap">
      <div className="testTop">
        <div className="testTitle">Typing Test</div>
        <div className="testControls">
          <select
            className="select"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            disabled={running}
          >
            <option value={15}>15s</option>
            <option value={30}>30s</option>
            <option value={60}>60s</option>
          </select>

          {!running ? (
            <button className="btn btnAccent" onClick={start}>
              Start
            </button>
          ) : (
            <button className="btn" onClick={finish}>
              Finish
            </button>
          )}

          <button className="btn" onClick={reset} disabled={running}>
            Reset
          </button>
        </div>

        <div className="testStats">
          <div className="chip">Time: {secsLeft}s</div>
          <div className="chip">WPM: {wpm}</div>
          <div className="chip">Accuracy: {accuracy.toFixed(2)}%</div>
          <div className="chip">Best: {st.bestWpm}</div>
        </div>
      </div>

      <TypingLine text={text} typed={typed} cursor={cursor} />

      <div className="testHint">
        Click <b>Start</b>, then type anywhere. No textbox.
      </div>
    </div>
  );
}