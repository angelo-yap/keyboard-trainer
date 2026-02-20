import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import "./App.css";

function Splash({ onDone }) {
  // auto-advance after 2.2s (you can change it)
  useEffect(() => {}, []);

  return (
    <motion.div
      className="splash"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="splashInner"
        initial={{ y: 14, opacity: 0, filter: "blur(6px)" }}
        animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
        transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <KeyboardHero />

        <motion.h1
          className="splashTitle"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.7 }}
        >
          Keyboard<span className="accent">Trainer</span>
        </motion.h1>

        <motion.p
          className="splashSub"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.45, duration: 0.7 }}
        >
          Train accuracy • Track progress • Light up the right keys
        </motion.p>

        <motion.button
          className="splashBtn"
          onClick={onDone}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.98 }}
        >
          Enter
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

function KeyboardHero() {
  // simple “keyboard outline + moving highlight”
  return (
    <div className="kbdWrap" aria-hidden="true">
      <div className="kbd">
        {Array.from({ length: 48 }).map((_, i) => (
          <div key={i} className="key" />
        ))}
        <div className="scan" />
      </div>
    </div>
  );
}

function Dashboard() {
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brandAccent">Keyboard</span>-Trainer
        </div>
        <nav className="nav">
          <button className="navItem active">🏠 Home</button>
          <button className="navItem">🎯 Practice</button>
          <button className="navItem">📊 Analytics</button>
          <button className="navItem">⚙️ Settings</button>
        </nav>
        <div className="version">Version 0.1.0</div>
      </aside>

      <main className="main">
        <div className="topbar">
          <div className="pageTitle">Home</div>
        </div>

        <div className="cards">
          <section className="card">
            <h2>Start Training</h2>
            <p>Begin a guided typing session with real-time LED feedback.</p>
            <button className="primary">Launch</button>
          </section>
          <section className="card">
            <h2>View Analytics</h2>
            <p>Review finger accuracy and typing consistency.</p>
            <button>Open</button>
          </section>
          <section className="card">
            <h2>Configure LEDs</h2>
            <p>Customize key highlight colors and behaviors.</p>
            <button>Settings</button>
          </section>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  const [stage, setStage] = useState("splash");

  return (
    <AnimatePresence mode="wait">
      {stage === "splash" ? (
        <Splash key="splash" onDone={() => setStage("app")} />
      ) : (
        <motion.div
          key="app"
          initial={{ opacity: 0, y: 10, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
          style={{ height: "100%", width: "100%" }}
        >
          <Dashboard />
        </motion.div>
      )}
    </AnimatePresence>
  );
}