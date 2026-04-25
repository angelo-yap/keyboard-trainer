export default function TypingLine({ text, typed, cursor }) {
  return (
    <div className="kbrTextWrap">
      <div className="kbrText" aria-label="Typing text">
        {text.split("").map((ch, i) => {
          const typedCh = typed[i];
          const isCursor = i === cursor;
          const isTyped = i < typed.length;
          const isWrong = isTyped && typedCh !== ch;

          return (
            <span
              key={i}
              className={[
                "kbrChar",
                isCursor ? "cursor" : "",
                isTyped ? "typed" : "",
                isWrong ? "wrong" : "",
              ].join(" ")}
            >
              {ch === " " ? "\u00A0" : ch}
            </span>
          );
        })}
      </div>
    </div>
  );
}