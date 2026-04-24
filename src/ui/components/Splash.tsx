import "./Splash.css";

type SplashProps = {
  onDone: () => void;
};

export function Splash({ onDone }: SplashProps) {
  return (
    <div className="splash">
      <div className="splash-glow" />

      <div className="splash-content">
        <div className="splash-keyboard">
          {Array.from({ length: 48 }).map((_, i) => (
            <div key={i} className="splash-key" />
          ))}
          <div className="splash-scan" />
        </div>

        <h1 className="splash-title">
          Keyboard<span className="splash-accent">Trainer</span>
        </h1>

        <p className="splash-subtitle">Learn · Practice · Test · Local analytics</p>

        <button className="splash-cta" onClick={onDone}>
          Get Started
        </button>
      </div>

      <style>{`
        @keyframes splashScan {
          0%   { left: -35%; opacity: 0; }
          15%  { opacity: 1; }
          60%  { left: 60%; opacity: 1; }
          100% { left: 120%; opacity: 0; }
        }
      `}</style>
    </div>
  );
}
