type Verdict = "GOOD" | "BAD" | "IDLE" | "";

type FeedbackBannerProps = {
  verdict: Verdict;
  wrongFingers: string[];
};

function formatFinger(f: string): string {
  const [hand, ...rest] = f.split("_");
  const finger = rest.join(" ");
  const handLabel = hand === "L" ? "Left" : "Right";
  const fingerLabel = finger.charAt(0) + finger.slice(1).toLowerCase();
  return `${handLabel} ${fingerLabel}`;
}

export function FeedbackBanner({ verdict, wrongFingers }: FeedbackBannerProps) {
  if (!verdict || verdict === "IDLE") {
    return (
      <div className="feedback-banner feedback-banner--idle">
        <span className="feedback-banner-dot" />
        <span className="feedback-banner-text">Waiting for hand detection…</span>
      </div>
    );
  }

  if (verdict === "GOOD") {
    return (
      <div className="feedback-banner feedback-banner--good">
        <span className="feedback-banner-dot" />
        <span className="feedback-banner-text">Good form</span>
      </div>
    );
  }

  // BAD
  const fingerList = wrongFingers.map(formatFinger).join(", ");
  return (
    <div className="feedback-banner feedback-banner--bad">
      <span className="feedback-banner-dot" />
      <span className="feedback-banner-text">
        Fix {wrongFingers.length > 1 ? "fingers" : "finger"}:{" "}
        <strong>{fingerList}</strong>
      </span>
    </div>
  );
}
