# Integration guide

Drop each file into its matching path and follow the steps below.
No logic changes are needed — all your existing stores and hooks stay as-is.

---

## File map

```
theme.css                → src/theme.css              (replace)
index.css                → src/index.css               (replace)
AppLayout.tsx            → src/ui/layout/AppLayout.tsx (replace)
AppLayout.css            → src/ui/layout/AppLayout.css (replace)
Home.tsx                 → src/routes/Home.tsx         (replace)
Home.css                 → src/routes/Home.css         (replace)
Practice.tsx             → src/routes/Practice.tsx     (replace)
Practice.css             → src/routes/Practice.css     (replace)
TypingDisplay.tsx        → src/ui/components/TypingDisplay.tsx (replace)
TypingDisplay.css        → src/ui/components/TypingDisplay.css (replace)
```

---

## 1. App.tsx — wrap everything in AppLayout

```tsx
// src/App.tsx
import { useState } from 'react';
import { AppLayout } from './ui/layout/AppLayout';
import { Home }       from './routes/Home';
import { Practice }   from './routes/Practice';
// ... other imports

type Tab = 'home' | 'learn' | 'practice' | 'test' | 'analytics' | 'settings';

export default function App() {
  const [tab, setTab] = useState<Tab>('home');

  // Pull personal best from your testHistoryStore
  const personalBest = testHistoryStore.getPersonalBest(); // adapt as needed

  return (
    <AppLayout
      activeTab={tab}
      onTabChange={setTab}
      personalBest={personalBest}
    >
      {tab === 'home'      && <HomeRoute      onTabChange={setTab} />}
      {tab === 'practice'  && <PracticeRoute  onTabChange={setTab} />}
      {/* ... other tabs */}
    </AppLayout>
  );
}
```

---

## 2. Wiring Home.tsx

`Home.tsx` accepts these props — all sourced from your existing stores:

| Prop | Source |
|------|--------|
| `lessons` | `practiceLessons` from `src/core/lesson/practiceLessons.ts` + `progressStore` for status/bestWpm |
| `weakKeys` | `keyStatsStore.getWeakKeys()` — returns `{ key, accuracy }[]` sorted by accuracy asc |
| `fingerMastery` | Derived from `progressStore` — see helper below |
| `avgWpm` | `testHistoryStore.getAverageWpm()` |
| `accuracy` | `testHistoryStore.getAverageAccuracy()` |
| `wpmDelta` | `testHistoryStore.getWpmDeltaThisWeek()` |
| `accuracyDelta` | same pattern |
| `dayLabel` | Build from `streakStore.currentStreak` + `new Date().toLocaleDateString('en', { weekday: 'long' }).toLowerCase()` |
| `coachMessage` | Generate from `progressStore` + `keyStatsStore` (see helper below) |
| `onTabChange` | Pass `setTab` from App.tsx |

### Finger mastery helper

Add this to a new file `src/core/lesson/fingerMastery.ts`:

```ts
import type { FingerMastery, FingerState } from '../../routes/Home';
import { keyStatsStore }  from '../storage/keyStatsStore';
import { progressStore }  from '../storage/progressStore';

// Maps each finger to the keys it owns
const FINGER_KEYS: Record<keyof FingerMastery, string[]> = {
  L5: ['a', 'z', 'q'],
  L4: ['s', 'x', 'w'],
  L3: ['d', 'c', 'e'],
  L2: ['f', 'v', 'r', 'g', 't'],
  R2: ['j', 'm', 'u', 'y', 'h'],
  R3: ['k', ',', 'i', ','],
  R4: ['l', '.', 'o'],
  R5: [';', '/', 'p', "'"],
};

function fingerState(keys: string[]): FingerState {
  const stats = keys.map(k => keyStatsStore.getAccuracy(k)).filter(v => v != null);
  if (stats.length === 0) return 'unlocked';
  const avg = stats.reduce((a, b) => a + b, 0) / stats.length;
  if (avg >= 92) return 'mastered';
  if (avg >= 75) return 'learning';
  return 'weak';
}

export function getFingerMastery(): FingerMastery {
  return Object.fromEntries(
    Object.entries(FINGER_KEYS).map(([finger, keys]) => [finger, fingerState(keys)])
  ) as FingerMastery;
}
```

### Coach message helper

```ts
// src/core/lesson/coachMessage.ts
import { keyStatsStore } from '../storage/keyStatsStore';

export function getCoachMessage(): { message: string; detail: string } {
  const weakKeys = keyStatsStore.getWeakKeys().slice(0, 3);

  if (weakKeys.length === 0) {
    return {
      message: "Your accuracy is looking solid across the board.",
      detail:  "Push for speed now — try a timed test when you feel ready.",
    };
  }

  const keyList = weakKeys.map(w => `"${w.key}"`).join(', ');
  return {
    message: `You've been building a real habit. Keep an eye on ${keyList} — consistency there will unlock the next level.`,
    detail:  "Try not to look down. Trust the callout and let the muscle memory form.",
  };
}
```

---

## 3. Wiring Practice.tsx

`Practice.tsx` needs these additional derivations on top of `useTyping`:

### Callout (which finger to show)

Add to `src/core/keyboard/fingerMap.ts` or inline in Practice route:

```ts
import { fingerMap } from '../core/keyboard/fingerMap'; // your existing map

export function getCallout(key: string): FingerCallout | null {
  if (!key || key === ' ') return null;

  const mapping = fingerMap[key.toLowerCase()];
  if (!mapping) return null;

  // fingerMap should return { hand, fingerIndex, fingerName }
  // Adapt field names to match yours.

  const tips: Record<string, string> = {
    p: "Keep your index finger resting on J as your anchor. Let the pinky extend — the reach is small but unfamiliar.",
    q: "Your left pinky needs to stretch up and left. Keep the other fingers hovering over home row.",
    b: "Both index fingers reach for B — use whichever hand feels natural but be consistent.",
    // Add more as needed, or return a generic tip:
  };

  return {
    key,
    hand:        mapping.hand,
    fingerIndex: mapping.fingerIndex,
    fingerName:  mapping.fingerName,
    tip: tips[key.toLowerCase()] ??
      `Keep your other fingers on home row and let your ${mapping.fingerName} do the reaching.`,
  };
}
```

### Accuracy history strip

In your Practice route wrapper, maintain a rolling window:

```ts
const [accuracyHistory, setAccuracyHistory] = useState<(boolean | null)[]>(
  Array(32).fill(null)
);

// Call this every time useTyping registers a keypress:
function recordKeystroke(correct: boolean) {
  setAccuracyHistory(prev => {
    const next = [...prev];
    const firstNull = next.indexOf(null);
    if (firstNull !== -1) {
      next[firstNull] = correct;
    } else {
      next.shift();
      next.push(correct);
    }
    return next;
  });
}
```

---

## 4. CSS variable rename mapping

If your existing components use the old variable names, here's the mapping
so you can do a project-wide find-and-replace:

| Old variable | New variable |
|---|---|
| `--color-bg` | `--color-bg` *(same)* |
| `--color-accent` | `--color-accent` *(same)* |
| `--color-text` | `--color-text` *(same)* |
| `--space-4` | `--space-4` *(same)* |

The new theme preserves your existing variable names where possible.
The main additions are `--color-surface`, `--color-surface-2`, `--color-surface-3`,
`--color-line`, `--color-line-2`, `--color-line-3`, `--font-mono`, `--font-serif`,
`--color-correct`, `--color-error` and their `-dim` / `-border` variants.

---

## 5. Font loading in Electron

The `@import` in `theme.css` fetches Google Fonts over the network.
In production Electron you'll want to bundle the fonts locally.
For development this works fine — Electron has network access.

For production, download the four font files from Google Fonts and add:

```css
/* In theme.css, replace the @import with: */
@font-face {
  font-family: 'Instrument Serif';
  src: url('../assets/fonts/InstrumentSerif-Regular.ttf') format('truetype');
  font-style: normal;
}
@font-face {
  font-family: 'Instrument Serif';
  src: url('../assets/fonts/InstrumentSerif-Italic.ttf') format('truetype');
  font-style: italic;
}
@font-face {
  font-family: 'IBM Plex Mono';
  src: url('../assets/fonts/IBMPlexMono-Light.ttf')   format('truetype');
  font-weight: 300;
}
@font-face {
  font-family: 'IBM Plex Mono';
  src: url('../assets/fonts/IBMPlexMono-Regular.ttf') format('truetype');
  font-weight: 400;
}
@font-face {
  font-family: 'IBM Plex Mono';
  src: url('../assets/fonts/IBMPlexMono-Medium.ttf')  format('truetype');
  font-weight: 500;
}
@font-face {
  font-family: 'IBM Plex Sans';
  src: url('../assets/fonts/IBMPlexSans-Light.ttf')   format('truetype');
  font-weight: 300;
}
@font-face {
  font-family: 'IBM Plex Sans';
  src: url('../assets/fonts/IBMPlexSans-Regular.ttf') format('truetype');
  font-weight: 400;
}
@font-face {
  font-family: 'IBM Plex Sans';
  src: url('../assets/fonts/IBMPlexSans-Medium.ttf')  format('truetype');
  font-weight: 500;
}
```

All four font families are open-source (SIL OFL license).
