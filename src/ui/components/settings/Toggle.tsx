import "./Toggle.css";

type ToggleProps = {
  value: boolean;
  onChange: (v: boolean) => void;
};

export function Toggle({ value, onChange }: ToggleProps) {
  return (
    <div
      className={`toggle ${value ? "toggle-on" : ""}`}
      onClick={() => onChange(!value)}
      role="switch"
      aria-checked={value}
    >
      <div className="toggle-thumb" />
    </div>
  );
}
