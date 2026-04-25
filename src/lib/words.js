const BASE = [
  "tin","titter","letter","tan","alter","tall","talent","train","internal","eternal","elite",
  "neat","eat","trail","nineteen","rattle","rental","tell","attire",
  "tone","total","treat","tire","tender","tablet","title","tilt","until","unite","linear"
];

export const KEY_ORDER = [
  "e","n","i","a","r","l","t","o","s","u","d","y","c","h","m","p","g","b","f","k","w","v","z","x","q","j"
];

export function makePracticeText(targetKey, count = 18) {
  const adapt = (w) => {
    if (targetKey === "t") return w;
    return w.replace(/t/g, targetKey);
  };

  const out = [];
  while (out.length < count) {
    const w = BASE[Math.floor(Math.random() * BASE.length)];
    out.push(adapt(w));
  }
  return out.join(" ");
}

export function makeRandomWords(count = 40) {
  const out = [];
  while (out.length < count) {
    out.push(BASE[Math.floor(Math.random() * BASE.length)]);
  }
  return out.join(" ");
}

export function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

export function calcWPM(charsTyped, elapsedMs) {
  const minutes = elapsedMs / 60000;
  if (minutes <= 0) return 0;
  return (charsTyped / 5) / minutes;
}