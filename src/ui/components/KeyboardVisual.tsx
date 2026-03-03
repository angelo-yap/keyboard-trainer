import { KEYBOARD_ROWS } from "../../core/keyboard/keyboardLayout";
import { FINGER_MAP, FINGER_COLORS } from "../../core/keyboard/fingerMap";
import "./KeyboardVisual.css";

const UNIT = 44;
const GAP = 5;

function getKeyChar(label: string): string | null {
  if (label.length === 1) return label.toLowerCase();
  return null;
}

function getFingerForKey(label: string): number | null {
  const ch = getKeyChar(label);
  if (!ch) return null;
  return FINGER_MAP[ch] ?? null;
}

type KeyboardVisualProps = {
  highlightChar?: string;
  pressedKey?: string;
  size?: "full" | "mini" | "micro";
  showFingerColors?: boolean;
};

export function KeyboardVisual({
  highlightChar = "",
  pressedKey = "",
  size = "full",
  showFingerColors = true,
}: KeyboardVisualProps) {
  const scale = size === "mini" ? 0.72 : size === "micro" ? 0.5 : 1;

  return (
    <div
      className="keyboard-visual"
      style={{
        transform: `scale(${scale})`,
        transformOrigin: "top center",
        marginBottom: size !== "full" ? `-${(1 - scale) * 250}px` : 0,
      }}
    >
      <div className="keyboard-visual-inner">
        {KEYBOARD_ROWS.map((row, ri) => {
          const indent = [0, 0.5 * UNIT, 0.75 * UNIT, 0, 0][ri];
          return (
            <div key={ri} className="keyboard-row" style={{ marginLeft: indent }}>
              {row.map((k, ki) => {
                const ch = getKeyChar(k.label);
                const fingerIdx = getFingerForKey(k.label);
                const fingerColor =
                  showFingerColors && fingerIdx !== null ? FINGER_COLORS[fingerIdx] : null;

                const isHighlight = ch && ch === highlightChar?.toLowerCase();
                const isPressed = ch && ch === pressedKey?.toLowerCase();
                const isHome = k.home;
                const isSpace = k.isSpace;

                let bg = "rgba(255,255,255,0.04)";
                let border = "rgba(255,255,255,0.10)";
                let color = "rgba(255,255,255,0.55)";
                let shadow = "none";
                let textColor = color;

                if (fingerColor && showFingerColors) {
                  bg = `${fingerColor}18`;
                  border = `${fingerColor}45`;
                }
                if (isHome) {
                  border = "rgba(255,255,255,0.25)";
                }
                if (isHighlight) {
                  bg = "rgba(255,140,50,0.3)";
                  border = "rgba(255,140,50,0.8)";
                  textColor = "#ff8c32";
                  shadow = "0 0 16px rgba(255,140,50,0.4)";
                }
                if (isPressed) {
                  bg = "rgba(255,140,50,0.85)";
                  border = "rgba(255,140,50,1)";
                  textColor = "#111";
                  shadow = "0 0 24px rgba(255,140,50,0.6)";
                }

                const width = isSpace
                  ? 6.25 * UNIT + 5 * GAP
                  : (k.w || 1) * UNIT + ((k.w || 1) - 1) * GAP;

                return (
                  <div
                    key={ki}
                    className={`keyboard-key ${k.label.length > 5 ? "key-long" : k.label.length > 1 ? "key-medium" : ""}`}
                    style={{
                      width,
                      height: UNIT,
                      background: bg,
                      borderColor: border,
                      color: textColor,
                      boxShadow: shadow,
                      fontWeight: isHighlight || isPressed ? 800 : 600,
                    }}
                  >
                    {isSpace ? null : k.label.length > 5 ? k.label.slice(0, 4) : k.label}
                    {isHome && !isHighlight && !isPressed && <div className="keyboard-key-home" />}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
