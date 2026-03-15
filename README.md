# keyboard-trainer

## UI Architecture

The app uses a **sidebar + content** layout (from `KeyboardTrainer.jsx`):

- **Splash** → **Dashboard** with sidebar (Home, Learn, Practice, WPM Test, Analytics, Settings)
- **Home** — Hero stats, mode cards, recent tests
- **Learn** — 10-step touch typing intro
- **Practice** — 12 progressive lessons with finger highlighting
- **Test** — WPM test (15/30/60/120s)
- **Analytics** — Progress, history, key stats
- **Settings** — Display options, clear data

See `ARCHITECTURE.md` for folder structure and how to add lessons/settings.

---

## Our Goal:
A hardware-software integrated typing trainer that tracks hand and finger placement in real time, verifies correct finger usage for each key, guides the user with dynamic per-key LED indicators, provides a structured typing-learning experience.

# Built with:
- **Electron** (Desktop UI & control layer)
- **Custom QMK Firmware** (LED Control)
- **OpenCV and MediaPipe** (Computer vision for finger detection)

To run the program:

```bash
npm run electron:dev
