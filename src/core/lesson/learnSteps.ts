export type LearnStep = {
  title: string;
  icon: string;
  body: string;
  highlight: string[];
};

export const LEARN_STEPS: LearnStep[] = [
  { title: "Why Touch Typing?", icon: "🎯", body: "Touch typing means using all 10 fingers without looking at the keyboard. Average hunt-and-peck: 30 WPM. Average touch typist: 60-80 WPM. Expert: 100+. The difference is technique, not talent.", highlight: [] },
  { title: "The Home Row", icon: "🏠", body: "Your fingers live here. Left hand: A S D F. Right hand: J K L ;. Notice the bumps on F and J — that's how you find home without looking. Every keystroke starts and ends at home row.", highlight: ["a", "s", "d", "f", "j", "k", "l", ";"] },
  { title: "Left Hand Placement", icon: "👈", body: "Pinky on A, Ring on S, Middle on D, Index on F. Keep fingers slightly curved — like holding a tennis ball. Your left index also covers G and B by stretching right.", highlight: ["a", "s", "d", "f", "g", "b"] },
  { title: "Right Hand Placement", icon: "👉", body: "Pinky on ;, Ring on L, Middle on K, Index on J. Mirror your left hand exactly. Right index also covers H, Y, N, U — it's your most versatile finger.", highlight: ["j", "k", "l", ";", "h", "y", "n", "u"] },
  { title: "The Upper Row", icon: "⬆️", body: "Reach up without moving your wrist. Left hand covers Q W E R T, right covers Y U I O P. Your fingers should snap back to home row after every key — don't let them wander.", highlight: ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"] },
  { title: "The Bottom Row", icon: "⬇️", body: "Reach down — Z X C V for left hand, B N M , . for right. These keys are used less frequently but the same rule applies: anchor on home, reach, return.", highlight: ["z", "x", "c", "v", "b", "n", "m", ",", "."] },
  { title: "The Space Bar", icon: "👍", body: "The space bar is pressed with your right thumb (or left, whichever feels natural — pick one and be consistent). It should feel like a natural flick — don't press with the tip, use the side.", highlight: [" "] },
  { title: "Posture & Setup", icon: "🧘", body: "Sit up straight. Elbows at roughly 90°. Screen at eye level. Wrists should float slightly above the keyboard — not resting on the desk while typing. This prevents strain and gives your fingers range.", highlight: [] },
  { title: "The Golden Rule", icon: "✨", body: "Accuracy first. Always. Speed is just accuracy over time — the faster you type correctly, the higher your WPM. Never sacrifice accuracy for speed. If you're making mistakes, slow down.", highlight: [] },
  { title: "You're Ready", icon: "🚀", body: "Head to Practice to drill each key group with live feedback. The keyboard will light up showing correct finger placement. When you feel confident, take a WPM Test to measure your progress.", highlight: [] },
];
