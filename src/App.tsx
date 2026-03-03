import { useState } from "react";
import { Splash } from "./ui/components/Splash";
import { Sidebar } from "./ui/layout/Sidebar";
import { Home } from "./routes/Home";
import { Learn } from "./routes/Learn";
import { Practice } from "./routes/Practice";
import { Test } from "./routes/Test";
import { Analytics } from "./routes/Analytics";
import { Settings } from "./routes/Settings";
import { getSettings } from "./core/storage/settingsStore";
import "./App.css";

function Dashboard() {
  const [tab, setTab] = useState("home");
  const settings = getSettings();

  const renderPage = () => {
    switch (tab) {
      case "home":
        return <Home setTab={setTab} />;
      case "learn":
        return <Learn onBack={() => setTab("home")} />;
      case "practice":
        return <Practice onBack={() => setTab("home")} settings={settings} />;
      case "test":
        return <Test onBack={() => setTab("home")} settings={settings} />;
      case "analytics":
        return <Analytics onBack={() => setTab("home")} />;
      case "settings":
        return <Settings onBack={() => setTab("home")} />;
      default:
        return null;
    }
  };

  return (
    <div className="app-dashboard">
      <Sidebar tab={tab} setTab={setTab} />

      <main className="app-main">
        <header className="app-header">
          <div className="app-header-title">
            {tab === "test" ? "WPM Test" : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </div>
          <div className="app-header-status">
            <div className="app-header-dot" />
            <span>Local storage active</span>
          </div>
        </header>

        <div className="app-content">{renderPage()}</div>
      </main>
    </div>
  );
}

export function App() {
  const [stage, setStage] = useState<"splash" | "app">("splash");

  return stage === "splash" ? (
    <Splash onDone={() => setStage("app")} />
  ) : (
    <Dashboard />
  );
}
