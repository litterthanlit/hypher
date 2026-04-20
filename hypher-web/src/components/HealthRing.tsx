"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { HealthBreakdown } from "@/lib/health";

interface Props {
  score: number;        // 0–100
  size?: number;        // px, default 24
  strokeWidth?: number; // default 2.5
  ariaLabel?: string;   // default "Project health 73 percent"
  breakdown?: HealthBreakdown;
}

export function HealthRing({ score, size = 24, strokeWidth = 2.5, ariaLabel, breakdown }: Props) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const color = score >= 70 ? "var(--accent)" : score >= 40 ? "var(--amber)" : "var(--danger)";
  const label = ariaLabel ?? `Project health ${score} percent`;

  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  };

  const handleMouseLeave = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 100);
  };

  const handleFocus = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  };

  const handleBlur = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 150);
  };

  return (
    <span
      className="health-ring-wrapper"
      style={{ position: "relative", display: "inline-flex", alignItems: "center" }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        className="health-ring-btn"
        aria-label={label}
        onFocus={handleFocus}
        onBlur={handleBlur}
        style={{
          background: "none",
          border: "none",
          padding: 0,
          cursor: "default",
          display: "inline-flex",
          alignItems: "center",
          pointerEvents: open ? "none" : undefined,
        }}
        tabIndex={0}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={label}
          style={{ transform: "rotate(-90deg)", display: "block" }}
        >
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke="var(--bg-tertiary)" strokeWidth={strokeWidth}
          />
          <motion.circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
            strokeDasharray={circumference}
            initial={false}
            animate={{ strokeDashoffset: circumference * (1 - score / 100) }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        </svg>
      </button>

      {breakdown && (
        <AnimatePresence>
          {open && (
            <motion.div
              className="health-popover health-popover-motion"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              <HealthPopoverContent breakdown={breakdown} score={score} />
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </span>
  );
}

interface PopoverProps {
  breakdown: HealthBreakdown;
  score: number;
}

function HealthPopoverContent({ breakdown, score }: PopoverProps) {
  const rows: { label: string; sub: { score: number; reason: string } | null; color: string }[] = [
    { label: "Activity", sub: breakdown.activity, color: scoreColor(breakdown.activity.score) },
    { label: "Blockers", sub: breakdown.blockers, color: scoreColor(breakdown.blockers.score) },
    { label: "GitHub", sub: breakdown.github, color: breakdown.github ? scoreColor(breakdown.github.score) : "var(--text-tertiary)" },
    { label: "Notes", sub: breakdown.noteFreshness, color: scoreColor(breakdown.noteFreshness.score) },
  ];

  return (
    <>
      <div className="health-popover-header">
        <span className="health-popover-title">Health</span>
        <span
          className="health-popover-chip"
          style={{
            background: scoreColor(score),
            color: score >= 70 ? "var(--text-on-accent)" : "#ffffff",
          }}
        >
          {score}
        </span>
      </div>
      <div className="health-popover-rows">
        {rows.map(({ label, sub, color }) => {
          if (!sub) return null; // hide GitHub row when null
          return (
            <div key={label} className="health-popover-row">
              <span className="health-popover-swatch" style={{ background: color }} />
              <span className="health-popover-label">{label}</span>
              <span className="health-popover-reason">{sub.reason}</span>
              <span className="health-popover-score-chip">{sub.score}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}

function scoreColor(score: number): string {
  return score >= 70 ? "var(--accent)" : score >= 40 ? "var(--amber)" : "var(--danger)";
}
