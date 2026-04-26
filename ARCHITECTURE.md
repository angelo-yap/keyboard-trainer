# UI Architecture (from Typr.jsx)

## Structure

The app uses a **sidebar + content** layout with tab-based navigation (no router).

- **Splash** — Intro screen, "Get Started" enters the app
- **Dashboard** — Sidebar (Home, Learn, WPM Test, Analytics, Settings) + content area
- **Home** — Hero with stats, mode cards (Learn, WPM Test), recent tests, inline practice
- **Learn** — 10-step guided intro to touch typing with keyboard highlights
- **Practice** — 12 progressive lessons with live finger highlighting
- **Test** — WPM test with configurable duration (15/30/60/120s)
- **Analytics** — Overview, history, key stats, practice progress
- **Settings** — Test duration, display options, clear data

## Folder Structure

```
src/
├── main.tsx
├── App.tsx
├── index.css
├── theme.css
├── data/
│   └── topWords.ts          # Top 500 words for WPM tests
├── core/
│   ├── keyboard/
│   │   ├── fingerMap.ts     # FINGER_MAP, FINGER_NAMES, FINGER_COLORS
│   │   └── keyboardLayout.ts # KEYBOARD_ROWS
│   ├── lesson/
│   │   ├── learnSteps.ts    # LEARN_STEPS (10 steps)
│   │   └── lessons/
│   │       └── practiceLessons.ts # 12 practice lessons
│   └── storage/
│       ├── localStorage.ts
│       ├── settingsStore.ts
│       ├── progressStore.ts
│       ├── testHistoryStore.ts
│       ├── streakStore.ts
│       ├── keyStatsStore.ts
│       └── clearData.ts
├── hooks/
│   └── useTyping.ts
├── lib/
│   └── shuffle.ts
├── routes/
│   ├── Home.tsx
│   ├── Learn.tsx
│   ├── Test.tsx
│   ├── Analytics.tsx
│   └── Settings.tsx
└── ui/
    ├── Layout/
    │   ├── AppLayout.tsx
    │   ├── LessonShell.tsx
    │   └── Sidebar.tsx
    └── components/
        ├── TypingDisplay.tsx    # Character-by-character typing view
        ├── SessionReport.tsx    # Post-session report card
        ├── Splash.tsx
        ├── Button.tsx
        ├── keyboard/
        │   ├── Keyboard.tsx
        │   ├── KeyboardKey.tsx
        │   ├── KeyboardRow.tsx
        │   └── keyboardLayouts.ts
        ├── CameraPanel.tsx
        ├── FeedbackBanner.tsx
        ├── KeyboardView.tsx
        ├── TrackingStatus.tsx
        └── settings/
            ├── Toggle.tsx
            ├── SegmentControl.tsx
            ├── SettingsSection.tsx
            └── SettingRow.tsx
```

## Adding New Content

- **New lesson**: Add to `PRACTICE_LESSONS` in `practiceLessons.ts`
- **New learn step**: Add to `LEARN_STEPS` in `learnSteps.ts`
- **New tab**: Add to `TABS` in `Sidebar.tsx`, add case in `App.tsx` renderPage
- **New setting**: Add to `Settings` type in `settingsStore.ts`, add UI in `Settings.tsx`

## Legacy / Future

- `LessonShell`, `KeyboardView`, `CameraPanel`, `FeedbackBanner`, `TrackingStatus` — Placeholders for future camera + hand-tracking integration
