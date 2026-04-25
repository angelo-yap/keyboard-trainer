import { useEffect, useMemo, useRef, useState } from "react";
import KeyboardHeatmap from "../components/KeyboardHeatmap";
import TypingLine from "../components/TypingLine";
import { KEY_ORDER, clamp, calcWPM, makePracticeText } from "../lib/words";
import { loadState, updateState } from "../lib/storage";

function buildOpacityFromStats(practiceKeyStats) {
  // turn samples/errors into opacity (green-ish feel via opacity only)
  const out = {};
  for (const k of KEY_ORDER) {
    const st = practiceKeyStats[k];
    if (!st || st.samples < 10) out[k] = 0.35;
    else {
      const acc = (st.samples - st.errors) / st.samples;
      out[k] = 0.35 + clamp(acc, 0, 1) * 0.65;
    }
  }
  return out;
}

export default function Practice() {
  const [targetKey, setTargetKey] = useState("t");

  const [text, setText] = useState(() => makePracticeText(targetKey));
  const [pressedKey, setPressedKey] = useState("");
  const [cursor, setCursor] = useState(0);
  const [typed, setTyped] = useState("");
  const [errors, setErrors] = useState(0);
  const [keystrokes, setKeystrokes] = useState(0);

  const startRef = useRef(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  const [store, setStore] = useState(loadState());

  const keyOpacity = useMemo(
    () => buildOpacityFromStats(store.practiceKeyStats),
    [store.practiceKeyStats]
  );

  useEffect(() => {
    setText(makePracticeText(targetKey));
    setCursor(0);
    setTyped("");
    setErrors(0);
    setKeystrokes(0);
    startRef.current = null;
    setElapsedMs(0);
  }, [targetKey]);

  useEffect(() => {
    const id = setInterval(() => {
      if (startRef.current) setElapsedMs(Date.now() - startRef.current);
    }, 200);
    return () => clearInterval(id);
  }, []);

  const wpm = useMemo(() => {
    if (!startRef.current) return 0;
    return Math.round(calcWPM(cursor, elapsedMs));
  }, [cursor, elapsedMs]);

  const accuracy = useMemo(() => {
    if (keystrokes === 0) return 100;
    return clamp(((keystrokes - errors) / keystrokes) * 100, 0, 100);
  }, [keystrokes, errors]);

  const score = useMemo(() => Math.round(wpm * (accuracy / 100) * 10), [wpm, accuracy]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const key = e.key;
      setPressedKey(key);
      setTimeout(() => setPressedKey(""), 80);

      // cycle target key
      if (key === "`") {
        e.preventDefault();
        const idx = KEY_ORDER.indexOf(targetKey);
        setTargetKey(KEY_ORDER[(idx + 1) % KEY_ORDER.length]);
        return;
      }

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

      if (!startRef.current) startRef.current = Date.now();

      const expected = text[cursor] ?? "";
      setKeystrokes((k) => k + 1);

      const wrong = key !== expected;
      if (wrong) setErrors((x) => x + 1);

      // update per-key stats for letters only
      const isLetter = /^[a-z]$/i.test(expected);
      if (isLetter) {
        const lower = expected.toLowerCase();
        const next = updateState((s) => {
          const practiceKeyStats = { ...s.practiceKeyStats };
          const prev = practiceKeyStats[lower] ?? { samples: 0, errors: 0 };
          practiceKeyStats[lower] = {
            samples: prev.samples + 1,
            errors: prev.errors + (wrong ? 1 : 0),
          };
          return { ...s, practiceKeyStats };
        });
        setStore(next);
      }

      setTyped((t) => t + key);
      setCursor((c) => c + 1);

      // finished -> new text
      if (cursor + 1 >= text.length) {
        setText(makePracticeText(targetKey));
        setCursor(0);
        setTyped("");
        setErrors(0);
        setKeystrokes(0);
        startRef.current = null;
        setElapsedMs(0);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cursor, text, targetKey]);

  return (
    <div className="kbr">
      <div className="kbrCenter">
        <div className="kbrTop">
          <div className="kbrMetrics">
            <div className="kbrMetric">
              <span className="kbrLabel">Speed</span>
              <span className="kbrValue">{wpm} wpm</span>
            </div>
            <div className="kbrMetric">
              <span className="kbrLabel">Accuracy</span>
              <span className="kbrValue">{accuracy.toFixed(2)}%</span>
            </div>
            <div className="kbrMetric">
              <span className="kbrLabel">Score</span>
              <span className="kbrValue">{score}</span>
            </div>
          </div>

          <div className="kbrStripRow">
            <div className="kbrStripLabel">All keys:</div>
            <div className="kbrStrip">
              {KEY_ORDER.map((k) => (
                <button
                  key={k}
                  className={`kbrKeyBox ${k === targetKey ? "active" : ""}`}
                  onClick={() => setTargetKey(k)}
                  title={`Train ${k.toUpperCase()}`}
                  style={{ opacity: keyOpacity[k] ?? 0.5 }}
                >
                  {k.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="kbrInfoRow">
            <div className="kbrInfo">
              <span className="kbrInfoLabel">Current key:</span>{" "}
              <span className="kbrInfoVal">{targetKey.toUpperCase()}</span>
              <span className="kbrMuted"> — type anywhere (no textbox)</span>
            </div>

            <div className="kbrGoal">
              <span className="kbrMuted">Tip:</span>{" "}
              <span className="kbrMuted">Backspace works • press ` to cycle</span>
            </div>
          </div>
        </div>

        <TypingLine text={text} typed={typed} cursor={cursor} />
        <KeyboardHeatmap targetKey={targetKey} pressedKey={pressedKey} keyOpacity={keyOpacity} />
      </div>
    </div>
  );
}