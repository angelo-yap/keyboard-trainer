
const ROWS = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["z", "x", "c", "v", "b", "n", "m"],
];

// Finger colors (same mapping you pasted)
const FINGER_COLORS = {
  q: "#e07b54", a: "#e07b54", z: "#e07b54",
  w: "#e07b54", s: "#e07b54", x: "#e07b54",
  e: "#e07b54", d: "#e07b54", c: "#e07b54",
  r: "#e07b54", f: "#e07b54", v: "#e07b54", t: "#e07b54", g: "#e07b54", b: "#e07b54",
  y: "#e07b54", h: "#e07b54", n: "#e07b54", u: "#e07b54", j: "#e07b54",
  i: "#e07b54", k: "#e07b54", m: "#e07b54",
  o: "#e07b54", l: "#e07b54",
  p: "#e07b54",
};

export default function KeyboardHeatmap({
  targetKey,
  pressedKey,   // <-- optional, only used if you pass it
  keyOpacity,   // <-- keep your old prop so nothing breaks
}) {
  const t = (targetKey ?? "").toLowerCase();
  const p = (pressedKey ?? "").toLowerCase();

  const outerStyle = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
    padding: "20px",
    background: "rgba(255,255,255,0.02)",
    borderRadius: "16px",
    border: "1px solid rgba(255,255,255,0.06)",
    width: "fit-content",
    margin: "0 auto",
  };

  return (
    <div style={outerStyle} aria-hidden="true">
      {ROWS.map((row, rowIndex) => (
        <div
          key={rowIndex}
          style={{
            display: "flex",
            gap: "6px",
            marginLeft: rowIndex === 1 ? "20px" : rowIndex === 2 ? "45px" : "0",
          }}
        >
          {row.map((key) => {
            const isTarget = key === t;
            const isPressed = key === p;
            const fingerColor = FINGER_COLORS[key] || "rgba(255,255,255,0.2)";

            // base
            let bg = "rgba(255,255,255,0.03)";
            let border = "1px solid rgba(255,255,255,0.08)";
            let shadow = "none";
            let color = "rgba(255,255,255,0.4)";

            // target highlight
            if (isTarget) {
              border = `1px solid ${fingerColor}`;
              color = fingerColor;
              bg = `${fingerColor}15`;
            }

            // pressed highlight
            if (isPressed) {
              bg = fingerColor;
              color = "#111";
              shadow = `0 0 20px ${fingerColor}80`;
              border = `1px solid ${fingerColor}`;
            }

            // your old opacity heatmap (optional)
            const opacity = keyOpacity?.[key];
            const finalOpacity = opacity == null ? 1 : opacity;

            return (
              <div
                key={key}
                style={{
                  width: "42px",
                  height: "42px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: "700",
                  textTransform: "uppercase",
                  transition: "all 0.05s ease-out",
                  background: bg,
                  border,
                  boxShadow: shadow,
                  color,
                  opacity: finalOpacity,
                }}
              >
                {key}
              </div>
            );
          })}
        </div>
      ))}

      {/* Spacebar */}
      <div
        style={{
          width: "240px",
          height: "42px",
          marginTop: "4px",
          borderRadius: "8px",
          background: p === " " ? "#7ec87e" : "rgba(255,255,255,0.03)",
          border: t === " " ? "1px solid #7ec87e" : "1px solid rgba(255,255,255,0.08)",
          boxShadow: p === " " ? "0 0 20px #7ec87e80" : "none",
          transition: "all 0.05s ease-out",
        }}
      />
    </div>
  );
}