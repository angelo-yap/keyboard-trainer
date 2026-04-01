/* ─── src/core/lesson/learnSteps.ts ──────────────────────────────────────────
   Interactive learn curriculum.

   Design principles:
   - Every step either teaches a concept AND drills it, or drills what was
     just taught. No passive-reading-only steps.
   - Posture / setup comes first, before hands touch the keyboard.
   - Both hands are introduced together, not split across steps.
   - The learner presses keys *during* the lesson — the step only unlocks
     "Continue" once the mini-drill is satisfied.
   - No sales pitch (step 0 "why touch type") — they're already here.
   - Finger extension (G/H reach, top row, bottom row) is introduced
     incrementally, one extension at a time.
   - "Accuracy first" is demonstrated, not stated — via the error-flash drill.
   ──────────────────────────────────────────────────────────────────────── */

/* ── Drill types ──────────────────────────────────────────────────────────
   "keys"     — press each listed key once in any order. Completion = all hit.
   "sequence" — type the exact string shown. Completion = full string typed
                correctly (errors allowed but must be corrected/backspaced).
   "hold"     — rest fingers on the listed keys without pressing. The UI reads
                a keydown-without-keypress pattern (or just a timed hold with
                a "I'm ready" confirm). Use for posture / placement steps.
   "none"     — no drill, just a confirm button. Reserve for concept-only
                interludes (used sparingly — max 1–2 in the whole curriculum).
   ─────────────────────────────────────────────────────────────────────── */

export type DrillType = 'keys' | 'sequence' | 'hold' | 'none';

export interface LearnDrill {
  type: DrillType;

  /** For 'keys': the set of keys the user must each press at least once */
  keys?: string[];

  /** For 'sequence': the exact string to type (shown in TypingDisplay) */
  sequence?: string;

  /**
   * Minimum correct presses before Continue unlocks.
   * For 'keys' this means each key in `keys` must be pressed this many times.
   * For 'sequence' this means the sequence must be completed this many times.
   * Defaults to 1.
   */
  requiredReps?: number;

  /** Hint shown below the drill area */
  hint?: string;
}

export interface LearnStep {
  id: string;

  /** Short chapter-style heading — 3 words max */
  title: string;

  /** One-line framing shown above the body, in the eyebrow position */
  eyebrow: string;

  /**
   * The teaching content. Keep to 2–3 short paragraphs.
   * No bullet lists — the UI renders this as prose.
   * Use **bold** markers for key terms; the renderer will style them.
   */
  body: string;

  /**
   * Keys to highlight on the keyboard visual during this step.
   * Empty = no highlights.
   */
  highlight: string[];

  /**
   * Which finger(s) to illuminate on the hand diagram.
   * Format: "L2" | "R5" etc. (L = left, R = right, 2–5 = index–pinky)
   * Empty = no highlights.
   */
  highlightFingers: string[];

  /** The interactive drill for this step */
  drill: LearnDrill;

  /**
   * If true, this step shows a split "concept left / drill right" layout.
   * If false (default), concept fills the width and drill appears below.
   */
  splitLayout?: boolean;
}

/* ────────────────────────────────────────────────────────────────────────── */

export const LEARN_STEPS: LearnStep[] = [

  /* ── 0. Before you place your hands ──────────────────────────────────── */
  {
    id: 'posture',
    title: 'Before you begin',
    eyebrow: 'Step 1 of 12 — setup',
    body: `Sit up straight with your feet flat on the floor. Your elbows should sit at roughly 90° — not reaching forward, not pulled back. Screen at eye level if possible.

**Wrists should float.** Not resting on the desk, not bent up or down — hovering just above the keyboard. This is the single most important thing for both comfort and speed. Wrists that rest while typing restrict your fingers' range of motion.

Once you're set up, confirm below to continue.`,
    highlight: [],
    highlightFingers: [],
    drill: {
      type: 'none',
      hint: 'Take a moment to actually adjust your position before continuing.',
    },
  },

  /* ── 1. The bumps — finding home without looking ──────────────────────── */
  {
    id: 'home-bumps',
    title: 'Find the bumps',
    eyebrow: 'Step 2 of 12 — orientation',
    body: `Run your index fingers along the keyboard until you feel two small raised bumps — one on **F**, one on **J**. Every keyboard has them. They exist for one reason: so you can find home row without looking down.

Pick your hands up, close your eyes, and place your index fingers back on those bumps. That's your anchor. Everything else in touch typing flows from here.`,
    highlight: ['f', 'j'],
    highlightFingers: ['L2', 'R2'],
    drill: {
      type: 'keys',
      keys: ['f', 'j'],
      requiredReps: 3,
      hint: 'Press F and J three times each. Eyes on the screen, not the keyboard.',
    },
    splitLayout: true,
  },

  /* ── 2. Home row — both hands together ───────────────────────────────── */
  {
    id: 'home-row',
    title: 'Home row',
    eyebrow: 'Step 3 of 12 — placement',
    body: `Place all eight fingers now. **Left hand:** pinky on A, ring on S, middle on D, index on F. **Right hand:** index on J, middle on K, ring on L, pinky on semicolon.

Fingers slightly curved — imagine you're cupping something small and fragile. Not flat, not clawed. Every key you'll ever type starts from this position and your fingers return here after every single keystroke.`,
    highlight: ['a', 's', 'd', 'f', 'j', 'k', 'l', ';'],
    highlightFingers: ['L5', 'L4', 'L3', 'L2', 'R2', 'R3', 'R4', 'R5'],
    drill: {
      type: 'sequence',
      sequence: 'asdf jkl; asdf jkl;',
      requiredReps: 2,
      hint: 'Type the sequence. Don\'t look down — the bumps on F and J are your guide.',
    },
    splitLayout: true,
  },

  /* ── 3. Left index reach: G ───────────────────────────────────────────── */
  {
    id: 'left-index-g',
    title: 'Left index: G',
    eyebrow: 'Step 4 of 12 — first reach',
    body: `Your left index finger covers two keys: **F** and **G**. To press G, your index stretches one step right — but the rest of your hand stays on home row. Don't let your wrist drift.

Press G, then snap back to F. That snap-back is the whole technique.`,
    highlight: ['f', 'g'],
    highlightFingers: ['L2'],
    drill: {
      type: 'sequence',
      sequence: 'fgfg ffgg fgfg',
      hint: 'Feel the stretch. Return to F after every G.',
    },
    splitLayout: true,
  },

  /* ── 4. Right index reach: H ─────────────────────────────────────────── */
  {
    id: 'right-index-h',
    title: 'Right index: H',
    eyebrow: 'Step 5 of 12 — first reach',
    body: `Mirror it on the right. Your right index covers **J** and **H**. H sits just to the left of J — a short reach inward.

This is the most common beginner mistake: reaching for H by moving the whole hand left. Don't. Keep your other fingers on home row, stretch the index.`,
    highlight: ['j', 'h'],
    highlightFingers: ['R2'],
    drill: {
      type: 'sequence',
      sequence: 'jhjh jjhh jhjh',
      hint: 'Keep K, L, and ; anchored while your index stretches left.',
    },
    splitLayout: true,
  },

  /* ── 5. Home row + G/H combined ──────────────────────────────────────── */
  {
    id: 'home-row-full',
    title: 'Home row — full range',
    eyebrow: 'Step 6 of 12 — consolidation',
    body: `Now combine everything. Home row plus the G/H stretch. This is already enough to spell hundreds of common words — "glad", "flash", "dash", "half", "flags".

Type the drill below. It uses only keys you know.`,
    highlight: ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';'],
    highlightFingers: ['L5', 'L4', 'L3', 'L2', 'R2', 'R3', 'R4', 'R5'],
    drill: {
      type: 'sequence',
      sequence: 'glad flash dash half flags',
      hint: 'Real words — only home row keys. Slow is fine. Accuracy matters more.',
    },
    splitLayout: false,
  },

  /* ── 6. Top row — index fingers first ───────────────────────────────── */
  {
    id: 'top-row-index',
    title: 'Top row: R T U Y',
    eyebrow: 'Step 7 of 12 — top row begins',
    body: `The top row is reached by stretching **upward** — not by lifting your wrist. Left index covers **R** and **T**. Right index covers **U** and **Y**.

These four keys alone appear in the most common words in English. Get them right and your speed will jump noticeably.`,
    highlight: ['r', 't', 'y', 'u'],
    highlightFingers: ['L2', 'R2'],
    drill: {
      type: 'sequence',
      sequence: 'frf ftf juj jyj frtj',
      hint: 'Each sequence: home key → top row key → home key. Return every time.',
    },
    splitLayout: true,
  },

  /* ── 7. Top row — middle and ring fingers ────────────────────────────── */
  {
    id: 'top-row-mid',
    title: 'Top row: E W I O',
    eyebrow: 'Step 8 of 12 — top row continues',
    body: `Middle fingers reach for **E** (left middle → D → E) and **I** (right middle → K → I). Ring fingers reach for **W** (left ring → S → W) and **O** (right ring → L → O).

Four of the five most common letters in English are now in reach: E, A, R, I, O.`,
    highlight: ['e', 'w', 'i', 'o'],
    highlightFingers: ['L4', 'L3', 'R3', 'R4'],
    drill: {
      type: 'sequence',
      sequence: 'ded sws kik lol desi woke',
      hint: 'Anchor → reach → anchor. The pattern is always the same.',
    },
    splitLayout: true,
  },

  /* ── 8. Top row — pinky fingers ─────────────────────────────────────── */
  {
    id: 'top-row-pinky',
    title: 'Top row: Q P',
    eyebrow: 'Step 9 of 12 — pinky reach',
    body: `Your weakest fingers handle the outermost keys. Left pinky stretches up to **Q**, right pinky up to **P**.

The pinky reach feels unfamiliar. The instinct is to move the whole hand — resist it. Left pinky anchors on A while stretching to Q. Right pinky anchors on semicolon while stretching to P.`,
    highlight: ['q', 'p'],
    highlightFingers: ['L5', 'R5'],
    drill: {
      type: 'sequence',
      sequence: 'aqa ;p; aqa ;p; aqp;',
      hint: 'The furthest reach in touch typing. Take it slow.',
    },
    splitLayout: true,
  },

  /* ── 9. Bottom row ───────────────────────────────────────────────────── */
  {
    id: 'bottom-row',
    title: 'Bottom row',
    eyebrow: 'Step 10 of 12 — below home',
    body: `Reach **downward** for the bottom row. Left hand: pinky Z, ring X, middle C, index V and B. Right hand: index N and M, middle comma, ring period.

Bottom row keys are used less often, but C, V, N, M, and B appear constantly. Same rule: anchor on home, reach, snap back.`,
    highlight: ['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.'],
    highlightFingers: ['L5', 'L4', 'L3', 'L2', 'R2', 'R3', 'R4'],
    drill: {
      type: 'sequence',
      sequence: 'fvf fcf dcd sxs aza jnj jmj k,k l.l',
      hint: 'Anchor → reach down → anchor. Same pattern as top row.',
    },
    splitLayout: true,
  },

  /* ── 10. Space bar and rhythm ────────────────────────────────────────── */
  {
    id: 'spacebar',
    title: 'Space and rhythm',
    eyebrow: 'Step 11 of 12 — flow',
    body: `The space bar is hit with your **right thumb** — or left if you strongly prefer, but pick one and stay with it. Use the flat side of the thumb, not the tip. It should feel like a quick flick, not a press.

Rhythm matters more than you think. Even typing has a tempo — the best typists don't type in bursts, they flow at a consistent pace. Slow and steady beats fast and choppy.`,
    highlight: [' '],
    highlightFingers: [],
    drill: {
      type: 'sequence',
      sequence: 'the cat sat on a flat mat',
      hint: 'Common words, home row heavy. Feel the rhythm of the spaces.',
    },
    splitLayout: false,
  },

  /* ── 11. Accuracy rule — demonstrated, not stated ────────────────────── */
  {
    id: 'accuracy',
    title: 'Accuracy over speed',
    eyebrow: 'Step 12 of 12 — the principle',
    body: `Speed is accuracy compounding over time. Every error you make costs two keystrokes — the wrong one and the correction. At 80 WPM, a 95% accuracy rate produces more actual output than 100 WPM at 85% accuracy.

**Never chase speed.** When you notice yourself making the same mistake, that's the app telling you to slow down. The speed comes automatically once the movements are correct.

Complete the drill below without a single error to unlock practice mode.`,
    highlight: [],
    highlightFingers: [],
    drill: {
      type: 'sequence',
      sequence: 'slow is fast fast is slow',
      requiredReps: 1,
      hint: 'Type it once, perfectly. Backspace and correct any mistakes.',
    },
    splitLayout: false,
  },

];

/* ── Derived helpers ──────────────────────────────────────────────────────
   These are used by the Learn route to drive step logic.               */

/** Returns the step after the given id, or null if it's the last */
export function getNextStep(currentId: string): LearnStep | null {
  const idx = LEARN_STEPS.findIndex(s => s.id === currentId);
  if (idx === -1 || idx === LEARN_STEPS.length - 1) return null;
  return LEARN_STEPS[idx + 1];
}

/** Returns true if the given step is the last one */
export function isLastStep(stepId: string): boolean {
  return LEARN_STEPS[LEARN_STEPS.length - 1].id === stepId;
}

/** Total step count — use for progress display */
export const TOTAL_STEPS = LEARN_STEPS.length;
