import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import "./App.css";

import Splash from "./components/Splash";
import Sidebar from "./components/Sidebar";

import Home from "./pages/Home";
import Learn from "./pages/Learn";
import Practice from "./pages/Practice";
import Test from "./pages/Test";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";

const TABS = [
  { id: "home", label: "Home", icon: "🏠" },
  { id: "learn", label: "Learn", icon: "📘" },
  { id: "practice", label: "Practice", icon: "🎯" },
  { id: "test", label: "Test", icon: "⌨️" },
  { id: "analytics", label: "Analytics", icon: "📊" },
  { id: "settings", label: "Settings", icon: "⚙️" },
];

export default function App() {
  const [stage, setStage] = useState("splash"); // "splash" | "app"
  const [tab, setTab] = useState("home");

  const pageTitle = useMemo(
    () => TABS.find((t) => t.id === tab)?.label ?? "Home",
    [tab]
  );

  return (
    <AnimatePresence mode="wait">
      {stage === "splash" ? (
        <Splash key="splash" onDone={() => setStage("app")} />
      ) : (
        <motion.div
          key="app"
          className="shell"
          initial={{ opacity: 0, y: 10, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <div className="bgGlow" aria-hidden="true" />

          <Sidebar tabs={TABS} activeTab={tab} onTab={setTab} />

          <main className="main">
            <header className="topbar">
              <div className="pageTitle">{pageTitle}</div>
              <div className="topbarRight">
                <div className="chip">Local Storage • No login</div>
              </div>
            </header>

            {tab === "home" && <Home onGo={setTab} />}
            {tab === "learn" && <Learn />}
            {tab === "practice" && <Practice />}
            {tab === "test" && <Test />}
            {tab === "analytics" && <Analytics />}
            {tab === "settings" && <Settings />}
          </main>
        </motion.div>
      )}
    </AnimatePresence>
  );
}