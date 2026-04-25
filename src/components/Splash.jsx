import { motion } from "framer-motion";

function KeyboardHero() {
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

export default function Splash({ onDone }) {
  return (
    <motion.div
      className="splash"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="splashInner"
        initial={{ y: 14, opacity: 0, filter: "blur(8px)" }}
        animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
        transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <KeyboardHero />

        <motion.h1
          className="splashTitle"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.7 }}
        >
          Keyboard<span className="accent">Trainer</span>
        </motion.h1>

        <motion.p
          className="splashSub"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35, duration: 0.7 }}
        >
          Learn • Practice • Test • Local analytics
        </motion.p>

        <motion.button
          className="splashBtn"
          onClick={onDone}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.98 }}
        >
          Enter
        </motion.button>

        <div className="splashHint">Tip: Press Enter</div>
      </motion.div>
    </motion.div>
  );
}