"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  /** id of the dropped note that owns this chip */
  ownerId: string;
  /** ids of the candidate notes to connect */
  candidates: string[];
  /** human-readable top reason (e.g. closest match name + %) */
  reason: string;
  /** screen-space position (fixed) anchored below the dropped card */
  position: { x: number; y: number };
  /** Called when the user clicks "Connect all" */
  onConnectAll: () => void;
  /** Called when the user clicks "Dismiss" or the auto-dismiss timer fires */
  onDismiss: () => void;
}

const AUTO_DISMISS_MS = 8_000;

/**
 * Floating chip shown after a note drop that has nearby semantically-related notes.
 *
 * - Auto-dismisses after AUTO_DISMISS_MS (8 s) if untouched.
 * - Only one chip is on screen at a time (parent controls visibility via chip state).
 * - Framer Motion fade-in/out; skips animation when prefers-reduced-motion is set
 *   (the CSS class `.suggestion-chip` also enforces this via @media).
 */
export function SuggestionChip({
  candidates,
  position,
  onConnectAll,
  onDismiss,
}: Props) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Start / restart the auto-dismiss timer whenever this chip mounts.
  useEffect(() => {
    timerRef.current = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
    // onDismiss identity is stable (parent uses useCallback / arrow at call-site)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const n = candidates.length;

  return (
    <AnimatePresence>
      <motion.div
        className="suggestion-chip"
        style={{
          position: "fixed",
          left: position.x,
          top: position.y,
          zIndex: 200,
        }}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 6 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        // Prevent canvas mouse-down from stealing focus / closing other UI.
        onMouseDown={(e) => e.stopPropagation()}
        role="status"
        aria-live="polite"
      >
        <span className="suggestion-chip-text">
          These seem related&nbsp;&mdash;&nbsp;connect?
        </span>
        <div className="suggestion-chip-actions">
          <button
            className="suggestion-chip-btn suggestion-chip-btn--primary"
            onClick={() => {
              if (timerRef.current !== null) clearTimeout(timerRef.current);
              onConnectAll();
            }}
          >
            Connect all ({n})
          </button>
          <button
            className="suggestion-chip-btn suggestion-chip-btn--secondary"
            onClick={() => {
              if (timerRef.current !== null) clearTimeout(timerRef.current);
              onDismiss();
            }}
          >
            Dismiss
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
