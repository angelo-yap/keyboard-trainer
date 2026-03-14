# Keyboard Trainer — Design Brief for Claude.ai

**Use this prompt to have Claude reimagine the entire design from scratch. Do not describe the current implementation.**

---

## The Prompt (copy everything below)

---

Imagine you are designing a desktop application called **Keyboard Trainer.** You have complete creative freedom. Design it from scratch.

**What the app is for:**
- It teaches people to touch type — using all 10 fingers without looking at the keyboard.
- It uses a structured curriculum: beginners learn the home row first, then expand to other keys.
- It gives real-time feedback during typing: which finger to use, which key to press next.
- It measures progress: words per minute (WPM), accuracy, and which keys are weak.
- It will eventually support a camera (hand tracking) and a custom keyboard with per-key LEDs that light up to guide the user — but for now, the app is software-only.

**Who it's for:**
- People learning to touch type for the first time.
- People who hunt-and-peck and want to improve.
- Anyone who wants to track and improve their typing speed and accuracy.

**Core capabilities the app must support:**
1. Guided learning — explain the concept of touch typing, home row, finger placement, posture.
2. Structured practice — lessons that progress from simple (a few keys) to complex (full alphabet).
3. Live feedback during typing — show which finger to use, highlight the next key, maybe show a keyboard visual.
4. Timed WPM tests — type random words against the clock.
5. Progress tracking — history, streaks, weak keys, lesson completion.
6. Settings — things like test duration, whether to show the keyboard, font size. All data stored locally (no account, no backend).

**Constraints:**
- Desktop app (Electron). Not a website. Not mobile.
- No backend. Everything local.

**Your task:**
Reimagine the entire design. What does the first screen look like? How does the user navigate? What's the information architecture? What's the visual language — colors, typography, layout, feel? How does it differ from existing typing sites like Monkeytype or keybr? What would make it distinctive, delightful, and effective for learning?

Don't describe what already exists. Invent it.
