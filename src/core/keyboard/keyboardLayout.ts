export type KeyDef = {
  label: string;
  w?: number;
  key?: string;
  home?: boolean;
  isSpace?: boolean;
};

export const KEYBOARD_ROWS: KeyDef[][] = [
  [
    { label: "~`", w: 1 }, { label: "1", w: 1 }, { label: "2", w: 1 }, { label: "3", w: 1 }, { label: "4", w: 1 },
    { label: "5", w: 1 }, { label: "6", w: 1 }, { label: "7", w: 1 }, { label: "8", w: 1 }, { label: "9", w: 1 },
    { label: "0", w: 1 }, { label: "-", w: 1 }, { label: "=", w: 1 }, { label: "⌫", w: 2, key: "Backspace" },
  ],
  [
    { label: "Tab", w: 1.5, key: "Tab" }, { label: "Q", w: 1 }, { label: "W", w: 1 }, { label: "E", w: 1 },
    { label: "R", w: 1 }, { label: "T", w: 1 }, { label: "Y", w: 1 }, { label: "U", w: 1 }, { label: "I", w: 1 },
    { label: "O", w: 1 }, { label: "P", w: 1 }, { label: "[", w: 1 }, { label: "]", w: 1 }, { label: "\\", w: 1.5 },
  ],
  [
    { label: "Caps", w: 1.75, key: "CapsLock" }, { label: "A", w: 1 }, { label: "S", w: 1 }, { label: "D", w: 1 },
    { label: "F", w: 1, home: true }, { label: "G", w: 1 }, { label: "H", w: 1 }, { label: "J", w: 1, home: true },
    { label: "K", w: 1 }, { label: "L", w: 1 }, { label: ";", w: 1 }, { label: "'", w: 1 }, { label: "Enter", w: 2.25, key: "Enter" },
  ],
  [
    { label: "Shift", w: 2.25, key: "Shift" }, { label: "Z", w: 1 }, { label: "X", w: 1 }, { label: "C", w: 1 },
    { label: "V", w: 1 }, { label: "B", w: 1 }, { label: "N", w: 1 }, { label: "M", w: 1 }, { label: ",", w: 1 },
    { label: ".", w: 1 }, { label: "/", w: 1 }, { label: "Shift", w: 2.75, key: "Shift" },
  ],
  [
    { label: "Ctrl", w: 1.25 }, { label: "Alt", w: 1.25 }, { label: "", w: 6.25, key: "Space", isSpace: true },
    { label: "Alt", w: 1.25 }, { label: "Ctrl", w: 1.25 },
  ],
];
