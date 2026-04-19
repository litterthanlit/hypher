"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

interface Props {
  visible: boolean;
  busy?: boolean;
  onShowTour: () => void;
  onExploreSelf: () => void;
}

export function WelcomeOverlay({
  visible,
  busy = false,
  onShowTour,
  onExploreSelf,
}: Props) {
  const reduceMotion = useReducedMotion();
  const primaryRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!visible) return;
    primaryRef.current?.focus();
  }, [visible]);

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          className="welcome-overlay"
          initial={{ opacity: reduceMotion ? 1 : 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: reduceMotion ? 1 : 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.18 }}
          role="presentation"
        >
          <motion.section
            className="welcome-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="welcome-title"
            aria-describedby="welcome-description"
            initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
            transition={{ duration: reduceMotion ? 0 : 0.22, ease: "easeOut" }}
          >
            <p className="welcome-logo">hypher</p>
            <h2 id="welcome-title" className="welcome-title">
              Your demo workspace is ready.
            </h2>
            <p id="welcome-description" className="welcome-copy">
              We loaded a demo project so you can feel the loop: capture loose ideas, let projects remember context, and review what matters next.
            </p>
            <div className="welcome-actions">
              <button
                ref={primaryRef}
                type="button"
                className="welcome-btn welcome-btn--primary"
                disabled={busy}
                onClick={onShowTour}
              >
                {busy ? "Starting..." : "Show me around"}
              </button>
              <button
                type="button"
                className="welcome-btn"
                disabled={busy}
                onClick={onExploreSelf}
              >
                Explore myself
              </button>
            </div>
            <p className="welcome-footnote">Takes about 20 seconds.</p>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
