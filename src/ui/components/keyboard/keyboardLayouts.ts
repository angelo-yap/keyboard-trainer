/**
 * Configuration-based keyboard layouts.
 * Uses standard keyboard unit widths (1u = base key).
 */

export type KeyDef = {
  key: string;
  label: string;
  width: number;
  home?: boolean;
  code?: string;
};

export type KeyboardLayout = {
  rows: KeyDef[][];
};

const ROW_1: KeyDef[] = [
  { key: "`", label: "`", width: 1, code: "Backquote" },
  { key: "1", label: "1", width: 1 },
  { key: "2", label: "2", width: 1 },
  { key: "3", label: "3", width: 1 },
  { key: "4", label: "4", width: 1 },
  { key: "5", label: "5", width: 1 },
  { key: "6", label: "6", width: 1 },
  { key: "7", label: "7", width: 1 },
  { key: "8", label: "8", width: 1 },
  { key: "9", label: "9", width: 1 },
  { key: "0", label: "0", width: 1 },
  { key: "-", label: "-", width: 1 },
  { key: "=", label: "=", width: 1 },
  { key: "Backspace", label: "⌫", width: 2.5, code: "Backspace" },
];

const ROW_2: KeyDef[] = [
  { key: "Tab", label: "Tab", width: 2, code: "Tab" },
  { key: "q", label: "Q", width: 1 },
  { key: "w", label: "W", width: 1 },
  { key: "e", label: "E", width: 1 },
  { key: "r", label: "R", width: 1 },
  { key: "t", label: "T", width: 1 },
  { key: "y", label: "Y", width: 1 },
  { key: "u", label: "U", width: 1 },
  { key: "i", label: "I", width: 1 },
  { key: "o", label: "O", width: 1 },
  { key: "p", label: "P", width: 1 },
  { key: "[", label: "[", width: 1 },
  { key: "]", label: "]", width: 1 },
  { key: "\\", label: "\\", width: 1.5 },
];

const ROW_3: KeyDef[] = [
  { key: "CapsLock", label: "Caps", width: 2.25, code: "CapsLock" },
  { key: "a", label: "A", width: 1 },
  { key: "s", label: "S", width: 1 },
  { key: "d", label: "D", width: 1 },
  { key: "f", label: "F", width: 1, home: true },
  { key: "g", label: "G", width: 1 },
  { key: "h", label: "H", width: 1 },
  { key: "j", label: "J", width: 1, home: true },
  { key: "k", label: "K", width: 1 },
  { key: "l", label: "L", width: 1 },
  { key: ";", label: ";", width: 1 },
  { key: "'", label: "'", width: 1 },
  { key: "Enter", label: "↵", width: 2.25, code: "Enter" },
];

const ROW_4: KeyDef[] = [
  { key: "Shift", label: "⇧", width: 2.75, code: "ShiftLeft" },
  { key: "z", label: "Z", width: 1 },
  { key: "x", label: "X", width: 1 },
  { key: "c", label: "C", width: 1 },
  { key: "v", label: "V", width: 1 },
  { key: "b", label: "B", width: 1 },
  { key: "n", label: "N", width: 1 },
  { key: "m", label: "M", width: 1 },
  { key: ",", label: ",", width: 1 },
  { key: ".", label: ".", width: 1 },
  { key: "/", label: "/", width: 1 },
  { key: "Shift", label: "⇧", width: 2.75, code: "ShiftRight" },
];

const ROW_5_MAC: KeyDef[] = [
  { key: "Control", label: "control", width: 1.25, code: "ControlLeft" },
  { key: "Alt", label: "⌥", width: 1.25, code: "AltLeft" },
  { key: "Meta", label: "⌘", width: 1.25, code: "MetaLeft" },
  { key: " ", label: "space", width: 6, code: "Space" },
  { key: "Meta", label: "⌘", width: 1.25, code: "MetaRight" },
  { key: "Alt", label: "⌥", width: 1.25, code: "AltRight" },
  { key: "Control", label: "control", width: 1.25, code: "ControlRight" },
];

const ROW_5_WIN: KeyDef[] = [
  { key: "Control", label: "ctrl", width: 1.25, code: "ControlLeft" },
  { key: "Meta", label: "⊞", width: 1.25, code: "MetaLeft" },
  { key: "Alt", label: "alt", width: 1.25, code: "AltLeft" },
  { key: " ", label: "space", width: 6, code: "Space" },
  { key: "Alt", label: "alt", width: 1.25, code: "AltRight" },
  { key: "Meta", label: "⊞", width: 1.25, code: "MetaRight" },
  { key: "ContextMenu", label: "▤", width: 1, code: "ContextMenu" },
  { key: "Control", label: "ctrl", width: 1.25, code: "ControlRight" },
];

const ROW_INDENTS = [0, 0, 0, 0, 0];

export const keyboardLayouts = {
  mac: {
    rows: [
      ROW_1,
      ROW_2,
      ROW_3,
      ROW_4,
      ROW_5_MAC,
    ],
    indents: ROW_INDENTS,
  } as KeyboardLayout & { indents: number[] },
  windows: {
    rows: [
      ROW_1,
      ROW_2,
      ROW_3,
      ROW_4,
      ROW_5_WIN,
    ],
    indents: ROW_INDENTS,
  } as KeyboardLayout & { indents: number[] },
};

export type LayoutType = keyof typeof keyboardLayouts;
