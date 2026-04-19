"use client";

import { useCallback, useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import {
  BETA_FEEDBACK_CATEGORIES,
  MAX_FEEDBACK_MESSAGE_LENGTH,
  type BetaFeedbackCategory,
} from "@/lib/beta";

type Props = {
  visible: boolean;
  onClose: () => void;
};

const labels: Record<BetaFeedbackCategory, string> = {
  bug: "Bug",
  friction: "Friction",
  idea: "Idea",
  praise: "Praise",
};

export function BetaFeedbackModal({ visible, onClose }: Props) {
  const submitFeedback = useMutation((api as any).beta.submitFeedback);
  const [category, setCategory] = useState<BetaFeedbackCategory>("friction");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const remaining = MAX_FEEDBACK_MESSAGE_LENGTH - message.length;

  const pagePath = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    return `${window.location.pathname}${window.location.search}`;
  }, [visible]);

  const handleSubmit = useCallback(async () => {
    const trimmed = message.trim();
    if (!trimmed) {
      toast.error("Write a note first.");
      return;
    }
    if (trimmed.length > MAX_FEEDBACK_MESSAGE_LENGTH) {
      toast.error("That feedback is a little too long.");
      return;
    }
    setBusy(true);
    try {
      await submitFeedback({
        category,
        message: trimmed,
        pagePath,
        userAgent: navigator.userAgent,
      });
      setMessage("");
      setCategory("friction");
      toast.success("Feedback sent. Thank you.");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send feedback.");
    } finally {
      setBusy(false);
    }
  }, [category, message, onClose, pagePath, submitFeedback]);

  if (!visible) return null;

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal beta-feedback-modal" onClick={(e) => e.stopPropagation()}>
        <div className="project-settings-header">
          <h3>Send feedback</h3>
          <button className="project-settings-close" onClick={onClose} aria-label="Close">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width={18} height={18}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className="api-keys-desc">
          Tell us what felt sharp, confusing, broken, or weirdly good.
        </p>
        <div className="beta-feedback-categories" role="radiogroup" aria-label="Feedback category">
          {BETA_FEEDBACK_CATEGORIES.map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={category === value}
              className={category === value ? "is-active" : ""}
              onClick={() => setCategory(value)}
            >
              {labels[value]}
            </button>
          ))}
        </div>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="What should we know?"
          className="beta-feedback-textarea"
          maxLength={MAX_FEEDBACK_MESSAGE_LENGTH + 50}
          autoFocus
        />
        <div className="beta-feedback-footer">
          <span className={remaining < 0 ? "is-over" : ""}>{remaining} characters left</span>
          <button
            type="button"
            className="settings-github-connect"
            disabled={busy || !message.trim() || remaining < 0}
            onClick={() => void handleSubmit()}
          >
            {busy ? "Sending..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
