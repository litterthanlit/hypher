"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { OnboardingTourStep } from "@/lib/onboarding";

interface Props {
  step: OnboardingTourStep | null;
  stepIndex: number;
  totalSteps: number;
  onNext: () => void;
  onSkip: () => void;
}

interface TourLayout {
  spotlight: CSSProperties | null;
  tooltip: CSSProperties;
}

const TOOLTIP_WIDTH = 320;
const TOOLTIP_HEIGHT_ESTIMATE = 190;
const GAP = 16;
const PADDING = 16;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function measureStep(step: OnboardingTourStep | null): TourLayout {
  if (typeof window === "undefined" || !step) {
    return {
      spotlight: null,
      tooltip: { left: "50%", top: "50%", transform: "translate(-50%, -50%)" },
    };
  }

  const target = document.querySelector<HTMLElement>(
    `[data-onboarding-target="${step.target}"]`
  );

  if (!target) {
    return {
      spotlight: null,
      tooltip: { left: "50%", top: "50%", transform: "translate(-50%, -50%)" },
    };
  }

  const rect = target.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const left = clamp(
    rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2,
    PADDING,
    viewportWidth - TOOLTIP_WIDTH - PADDING
  );
  const hasRoomBelow = rect.bottom + GAP + TOOLTIP_HEIGHT_ESTIMATE < viewportHeight;
  const top = hasRoomBelow
    ? rect.bottom + GAP
    : clamp(rect.top - TOOLTIP_HEIGHT_ESTIMATE - GAP, PADDING, viewportHeight - TOOLTIP_HEIGHT_ESTIMATE - PADDING);

  return {
    spotlight: {
      left: rect.left - 8,
      top: rect.top - 8,
      width: rect.width + 16,
      height: rect.height + 16,
    },
    tooltip: {
      left,
      top,
      width: TOOLTIP_WIDTH,
    },
  };
}

export function OnboardingTour({
  step,
  stepIndex,
  totalSteps,
  onNext,
  onSkip,
}: Props) {
  const reduceMotion = useReducedMotion();
  const [layout, setLayout] = useState<TourLayout>(() => measureStep(step));

  const updateLayout = useCallback(() => {
    setLayout(measureStep(step));
  }, [step]);

  useEffect(() => {
    updateLayout();
    const frame = requestAnimationFrame(updateLayout);
    const timeout = window.setTimeout(updateLayout, 260);
    window.addEventListener("resize", updateLayout);
    window.addEventListener("scroll", updateLayout, true);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
      window.removeEventListener("resize", updateLayout);
      window.removeEventListener("scroll", updateLayout, true);
    };
  }, [step, updateLayout]);

  if (!step) return null;

  const isFinalStep = stepIndex === totalSteps - 1;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={step.id}
        className="onboarding-tour-overlay"
        initial={{ opacity: reduceMotion ? 1 : 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: reduceMotion ? 1 : 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.16 }}
      >
        {layout.spotlight ? (
          <motion.div
            className="onboarding-tour-spotlight"
            style={layout.spotlight}
            layout
            transition={{ duration: reduceMotion ? 0 : 0.18 }}
          />
        ) : null}
        <motion.section
          className="onboarding-tour-card"
          style={layout.tooltip}
          role="dialog"
          aria-modal="true"
          aria-labelledby={`onboarding-tour-title-${step.id}`}
          initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
          transition={{ duration: reduceMotion ? 0 : 0.18 }}
        >
          <div className="onboarding-tour-kicker">
            Step {stepIndex + 1} of {totalSteps}
          </div>
          <h2 id={`onboarding-tour-title-${step.id}`} className="onboarding-tour-title">
            {step.title}
          </h2>
          <p className="onboarding-tour-copy">{step.body}</p>
          <div className="onboarding-tour-actions">
            <button type="button" className="onboarding-tour-skip" onClick={onSkip}>
              Skip tour
            </button>
            <button type="button" className="onboarding-tour-next" onClick={onNext}>
              {isFinalStep ? "Done" : "Next"}
            </button>
          </div>
        </motion.section>
      </motion.div>
    </AnimatePresence>
  );
}
