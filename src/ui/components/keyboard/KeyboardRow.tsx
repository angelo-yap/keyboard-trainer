import type { KeyDef } from "./keyboardLayouts";
import { KeyboardKey } from "./KeyboardKey";
import { FINGER_MAP, FINGER_COLORS_SOFT } from "../../../core/keyboard/fingerMap";

type KeyboardRowProps = {
  keys: KeyDef[];
  indent: number;
  unitSize: number;
  gap: number;
  highlightKey?: string;
  highlightKeys?: Set<string> | null;
  pressedKey?: string;
  showFingerHints?: boolean;
  mode: "lesson" | "test";
};

function getCharForKey(def: KeyDef): string | null {
  const k = def.key.toLowerCase();
  if (k.length === 1 && k !== " ") return k;
  if (def.key === " ") return " ";
  return null;
}

function getFingerColor(def: KeyDef): string | null {
  const ch = getCharForKey(def);
  if (!ch) return null;
  const idx = FINGER_MAP[ch];
  if (idx == null) return null;
  return FINGER_COLORS_SOFT[idx] ?? null;
}

export function KeyboardRow({
  keys,
  indent,
  unitSize,
  gap,
  highlightKey,
  highlightKeys,
  pressedKey,
  showFingerHints,
  mode,
}: KeyboardRowProps) {
  const hl = highlightKey?.toLowerCase();

  return (
    <div
      className="kb-row"
      style={{ marginLeft: indent > 0 ? `${indent * unitSize}px` : 0 }}
    >
      {keys.map((def, i) => {
        const ch = getCharForKey(def);
        const pk = pressedKey?.toLowerCase();
        const isHighlighted =
          !!ch && (ch === hl || (highlightKeys && highlightKeys.has(ch)));
        const isPressed =
          (!!ch && ch === pk) ||
          (def.key === " " && pressedKey === " ") ||
          (def.key !== " " && def.key.toLowerCase() === pk);
        const fingerColor = showFingerHints ? getFingerColor(def) : null;

        return (
          <KeyboardKey
            key={`${def.key}-${i}`}
            def={def}
            unitSize={unitSize}
            gap={gap}
            isHighlighted={isHighlighted}
            isPressed={isPressed}
            isHome={def.home}
            showFingerHint={!!fingerColor}
            fingerColor={fingerColor ?? undefined}
            mode={mode}
          />
        );
      })}
    </div>
  );
}
