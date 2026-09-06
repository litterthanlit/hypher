"use client";

import Link from "next/link";
import { MarketingBrand } from "@/components/marketing/MarketingBrand";
import { useMutation } from "convex/react";
import type { FormEvent } from "react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import {
  BETA_REQUEST_LIMITS,
  validateBetaRequestInput,
  type BetaRequestInput,
} from "@/lib/beta";

const initialForm: BetaRequestInput = {
  name: "",
  email: "",
  role: "",
  work: "",
  pain: "",
  link: "",
  howFound: "",
  website: "",
};

async function withSubmitTimeout<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error("Request timed out. Try again in a moment.")), 15_000);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function errorMessage(code: string): string {
  switch (code) {
    case "name-required":
      return "Add your name.";
    case "email-invalid":
      return "Add a valid email address.";
    case "role-required":
      return "Add your role or work type.";
    case "work-required":
      return "Tell us what you are building.";
    case "pain-required":
      return "Share the workflow pain you want Hypher to solve.";
    case "how-found-required":
      return "Tell us how you found Hypher.";
    default:
      return "Could not submit the request.";
  }
}

export function BetaRequestForm() {
  const submitRequest = useMutation((api as any).beta.submitRequest);
  const [form, setForm] = useState<BetaRequestInput>(initialForm);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const setField = useCallback(
    (field: keyof BetaRequestInput, value: string) => {
      setForm((current) => ({ ...current, [field]: value }));
    },
    []
  );

  const handleSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = validateBetaRequestInput(form);
    if (!parsed.ok) {
      toast.error(errorMessage(parsed.error));
      return;
    }

    setBusy(true);
    try {
      const result = await withSubmitTimeout(submitRequest(form));
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      setSubmitted(true);
      toast.success(result.duplicate ? "Your request is already in the queue." : "Request received.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit the request.");
    } finally {
      setBusy(false);
    }
  }, [form, submitRequest]);

  if (submitted) {
    return (
      <div className="marketing-root beta-request-shell">
        <div className="marketing-atmosphere" aria-hidden />
        <div className="beta-request-card">
          <MarketingBrand className="beta-request-logo" />
          <p className="launch-eyebrow">Private beta</p>
          <h1>Request received.</h1>
          <p className="beta-request-lede">
            Hypher is opening carefully with small cohorts. If it looks like a fit, you will get a personal invite code.
          </p>
          <div className="beta-request-confirmation">
            <span>What happens next</span>
            <p>Requests are reviewed manually so the early room stays focused on builders who already drown in agent sessions.</p>
          </div>
          <div className="beta-request-actions">
            <Link href="/" className="marketing-cta marketing-cta--ghost">Back to homepage</Link>
            <Link href="/app" className="marketing-cta">I have an invite</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="marketing-root beta-request-shell">
      <div className="marketing-atmosphere" aria-hidden />
      <form className="beta-request-card" onSubmit={(event) => void handleSubmit(event)}>
        <MarketingBrand className="beta-request-logo" />
        <p className="launch-eyebrow">Private beta</p>
        <h1>Request beta access.</h1>
        <p className="beta-request-lede">
          A short signal check for builders drowning in agent sessions. No pitch deck required.
        </p>

        <div className="beta-request-grid">
          <label>
            <span>Name</span>
            <input
              value={form.name}
              onChange={(event) => setField("name", event.target.value)}
              maxLength={BETA_REQUEST_LIMITS.name}
              autoComplete="name"
              className="settings-github-input"
              required
            />
          </label>
          <label>
            <span>Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(event) => setField("email", event.target.value)}
              maxLength={BETA_REQUEST_LIMITS.email}
              autoComplete="email"
              className="settings-github-input"
              required
            />
          </label>
        </div>

        <label className="beta-request-field">
          <span>Role / work type</span>
          <input
            value={form.role}
            onChange={(event) => setField("role", event.target.value)}
            maxLength={BETA_REQUEST_LIMITS.role}
            placeholder="Solo founder, designer-developer, researcher..."
            className="settings-github-input"
            required
          />
        </label>

        <label className="beta-request-field">
          <span>What are you building?</span>
          <textarea
            value={form.work}
            onChange={(event) => setField("work", event.target.value)}
            maxLength={BETA_REQUEST_LIMITS.work}
            className="beta-request-textarea"
            required
          />
        </label>

        <label className="beta-request-field">
          <span>Biggest workflow pain</span>
          <textarea
            value={form.pain}
            onChange={(event) => setField("pain", event.target.value)}
            maxLength={BETA_REQUEST_LIMITS.pain}
            className="beta-request-textarea"
            required
          />
        </label>

        <div className="beta-request-grid">
          <label>
            <span>Link</span>
            <input
              value={form.link}
              onChange={(event) => setField("link", event.target.value)}
              maxLength={BETA_REQUEST_LIMITS.link}
              placeholder="X, GitHub, site, portfolio..."
              className="settings-github-input"
            />
          </label>
          <label>
            <span>How did you find Hypher?</span>
            <input
              value={form.howFound}
              onChange={(event) => setField("howFound", event.target.value)}
              maxLength={BETA_REQUEST_LIMITS.howFound}
              className="settings-github-input"
              required
            />
          </label>
        </div>

        <label className="beta-request-honeypot" aria-hidden="true">
          Website
          <input
            tabIndex={-1}
            autoComplete="off"
            value={form.website}
            onChange={(event) => setField("website", event.target.value)}
          />
        </label>

        <div className="beta-request-actions">
          <Link href="/app" className="marketing-cta marketing-cta--ghost">I have an invite</Link>
          <button type="submit" className="marketing-cta" disabled={busy}>
            {busy ? "Submitting..." : "Request access"}
          </button>
        </div>
      </form>
    </div>
  );
}
