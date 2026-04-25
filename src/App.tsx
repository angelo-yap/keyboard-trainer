import { useState, useMemo, useEffect } from "react";
import { AppLayout } from "./ui/layout/AppLayout";
import { Welcome } from "./ui/components/Welcome";
import { Home } from "./routes/Home";
import { Learn } from "./routes/Learn";
import { Test } from "./routes/Test";
import { Analytics } from "./routes/Analytics";
import { Settings } from "./routes/Settings";
import { getSettings, saveSettings } from "./core/storage/settingsStore";
import { syncKeyboardBacklightPreference } from "./core/keyboard/keyboardLedBridge";
import { getPersonalBest } from "./core/storage/testHistoryStore";
import {
  isFirstLaunch,
  markOnboardingCompleted,
  markOnboardingSkipped,
} from "./core/storage/onboardingStore";
import "./App.css";

type Tab = "home" | "learn" | "test" | "analytics" | "settings";
type TestEntryMode = "standard" | "adaptive";

type OnboardingView = "welcome" | "learn" | null;

export function App() {
  const [tab, setTab] = useState<Tab>("home");
  const [testEntryMode, setTestEntryMode] = useState<TestEntryMode>("standard");
  const [onboardingView, setOnboardingView] = useState<OnboardingView>(() =>
    isFirstLaunch() ? "welcome" : null,
  );
  const [settingsVersion, setSettingsVersion] = useState(0);

  const settings = useMemo(() => getSettings(), [settingsVersion]);
  const personalBest = getPersonalBest();

  useEffect(() => {
    void syncKeyboardBacklightPreference();
  }, [settings.keyboardBacklightColor]);

  /* Ctrl+K / Cmd+K toggles keyboard visibility */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const s = getSettings();
        saveSettings({ ...s, showKeyboard: !s.showKeyboard });
        setSettingsVersion((v) => v + 1);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const exitOnboarding = useMemo(
    () => ({
      skip: () => {
        markOnboardingSkipped();
        setOnboardingView(null);
        setTab("home");
      },
      complete: () => {
        markOnboardingCompleted();
        setOnboardingView(null);
        setTab("home");
      },
    }),
    [],
  );

  const renderPage = () => {
    switch (tab) {
      case "home":
        return (
          <Home
            onTabChange={setTab}
            onStartAdaptiveTest={() => {
              setTestEntryMode("adaptive");
              setTab("test");
            }}
            settings={settings}
          />
        );
      case "learn":
        return (
          <Learn
            onBack={() => setTab("home")}
            onCurriculumComplete={
              onboardingView === "learn" ? exitOnboarding.complete : undefined
            }
            settings={settings}
          />
        );
      case "test":
        return (
          <Test
            onBack={() => setTab("home")}
            settings={settings}
            initialMode={testEntryMode}
            onStatsChange={() => setSettingsVersion((v) => v + 1)}
          />
        );
      case "analytics":
        return <Analytics onBack={() => setTab("home")} />;
      case "settings":
        return (
          <Settings
            onBack={() => setTab("home")}
            onSettingsChange={() => setSettingsVersion((v) => v + 1)}
            onResetOnboarding={() => {
              setSettingsVersion((v) => v + 1);
              setOnboardingView("welcome");
              setTab("home");
            }}
          />
        );
      default:
        return null;
    }
  };

  /* ── First-time onboarding flow ────────────────────────────────────── */
  if (onboardingView === "welcome") {
    return (
      <div className="app-onboarding-shell">
        <Welcome
          onStart={() => setOnboardingView("learn")}
          onSkip={exitOnboarding.skip}
        />
      </div>
    );
  }

  if (onboardingView === "learn") {
    return (
      <AppLayout
        activeTab="learn"
        onTabChange={(t) => {
          if (t !== "learn") {
            markOnboardingSkipped();
            setOnboardingView(null);
            setTab(t);
          }
        }}
        personalBest={personalBest ?? undefined}
      >
        <div key="learn" className="app-page-transition">
          <Learn
            onBack={exitOnboarding.skip}
            onCurriculumComplete={exitOnboarding.complete}
            settings={settings}
          />
        </div>
      </AppLayout>
    );
  }

  /* ── Normal app flow (returning users) ──────────────────────────────── */
  return (
    <AppLayout
      activeTab={tab}
      onTabChange={setTab}
      personalBest={personalBest ?? undefined}
    >
      <div key={tab} className="app-page-transition">
        {renderPage()}
      </div>
    </AppLayout>
  );
}
