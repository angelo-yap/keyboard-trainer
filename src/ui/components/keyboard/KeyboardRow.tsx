import { memo } from "react";
import type { KeyDef } from "./keyboardLayouts";
import { KeyboardKey } from "./KeyboardKey";
import { FINGER_MAP, FINGER_COLORS_SOFT, SPECIAL_FINGER_MAP } from "../../../core/keyboard/fingerMap";

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
  onKeyClick?: (key: string) => void;
};

function getCharForKey(def: KeyDef): string | null {
  const k = def.key.toLowerCase();
  if (k.length === 1 && k !== " ") return k;
  if (def.key === " ") return " ";
  return null;
}

function keyMatchesToken(def: KeyDef, token: string): boolean {
  const normalized = token.toLowerCase();
  const ch = getCharForKey(def);

  if (ch === normalized) return true;
  if (def.key === " " && normalized === "space") return true;
  if (def.key.toLowerCase() === normalized) return true;
  if (def.code?.toLowerCase() === normalized) return true;
  if (def.key.toLowerCase() === "shift" && normalized.startsWith("shift")) return true;

  return false;
}

function getFingerColor(def: KeyDef): string | null {
  const specialIdx = SPECIAL_FINGER_MAP[def.code ?? def.key];
  if (specialIdx != null) return FINGER_COLORS_SOFT[specialIdx] ?? null;

  const ch = getCharForKey(def);
  if (!ch) return null;
  const idx = FINGER_MAP[ch];
  if (idx == null) return null;
  return FINGER_COLORS_SOFT[idx] ?? null;
}

export const KeyboardRow = memo(function KeyboardRow({
  keys,
  indent,
  unitSize,
  gap,
  highlightKey,
  highlightKeys,
  pressedKey,
  showFingerHints,
  mode,
  onKeyClick,
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
          (!!hl && keyMatchesToken(def, hl)) ||
          (highlightKeys ? Array.from(highlightKeys).some((key) => keyMatchesToken(def, key)) : false);
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
            onClick={onKeyClick ? () => onKeyClick(def.key) : undefined}
          />
        );
      })}
    </div>
  );
});
