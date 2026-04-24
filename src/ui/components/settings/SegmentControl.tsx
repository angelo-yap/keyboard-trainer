import "./SegmentControl.css";

type SegmentControlProps<T> = {
  options: [T, string][];
  value: T;
  onChange: (v: T) => void;
};

export function SegmentControl<T>({
  options,
  value,
  onChange,
}: SegmentControlProps<T>) {
  return (
    <div className="segment-control">
      {options.map(([val, label]) => (
        <button
          key={String(val)}
          onClick={() => onChange(val)}
          className={`segment-control-btn ${value === val ? "active" : ""}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
