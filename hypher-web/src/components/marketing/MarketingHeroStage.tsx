"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  compileDemoBrief,
  DEMO_CHIPS,
  DEMO_WRITEBACK,
} from "./marketingHeroDemo";

export type DemoPhase = "dormant" | "capture" | "brief" | "writeback";

export function MarketingHeroStage() {
  const [phase, setPhase] = useState<DemoPhase>("dormant");
  const [draft, setDraft] = useState("");
  const [saved, setSaved] = useState("");
  const [compiling, setCompiling] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const compileTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const brief = compileDemoBrief(saved || draft);

  useEffect(() => {
    return () => {
      if (compileTimer.current) clearTimeout(compileTimer.current);
    };
  }, []);

  const start = useCallback(() => {
    setPhase("capture");
    window.requestAnimationFrame(() => textareaRef.current?.focus());
  }, []);

  const dropChip = useCallback((chip: string) => {
    setDraft(chip);
    setSaved(chip);
    setCompiling(true);
    setAccepted(false);
    setPhase("capture");
    if (compileTimer.current) clearTimeout(compileTimer.current);
    compileTimer.current = setTimeout(() => {
      setCompiling(false);
      setPhase("brief");
      compileTimer.current = setTimeout(() => setPhase("writeback"), 900);
    }, 640);
  }, []);

  const save = useCallback(() => {
    const text = draft.trim() || DEMO_CHIPS[0];
    setDraft(text);
    setSaved(text);
    setCompiling(true);
    setAccepted(false);
    setPhase("capture");
    if (compileTimer.current) clearTimeout(compileTimer.current);
    compileTimer.current = setTimeout(() => {
      setCompiling(false);
      setPhase("brief");
      compileTimer.current = setTimeout(() => setPhase("writeback"), 900);
    }, 720);
  }, [draft]);

  const copyBrief = useCallback(async () => {
    const packet = [
      `Summary: ${brief.summary}`,
      `Direction: ${brief.direction}`,
      `Do not: ${brief.doNot}`,
      `Next: ${brief.next}`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(packet);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }, [brief]);

  const replay = useCallback(() => {
    if (compileTimer.current) clearTimeout(compileTimer.current);
    setPhase("dormant");
    setDraft("");
    setSaved("");
    setCompiling(false);
    setAccepted(false);
    setCopied(false);
  }, []);

  const latestLabel = saved || draft.trim();

  return (
    <div className="marketing-proto">
      {phase === "dormant" ? (
        <div className="marketing-proto__dormant">
          <p className="marketing-proto__sleep-title">Give them the context they don&apos;t have.</p>
          <p className="marketing-proto__sleep-copy">
            One field. One brief. They write back. Click in and run the loop.
          </p>
          <button type="button" className="marketing-proto__enable" onClick={start}>
            Try the loop
          </button>
        </div>
      ) : null}

      <div className={`marketing-proto__app${phase === "dormant" ? " is-asleep" : ""}`}>
        <MiniChrome />

        <div className="marketing-proto__home">
          <p className="marketing-proto__kicker">Home</p>
          <h3 className="marketing-proto__home-title">Give them the context they don&apos;t have.</h3>
          <label className="marketing-proto__field">
            <span className="sr-only">Context in</span>
            <textarea
              ref={textareaRef}
              className="marketing-proto__textarea"
              rows={3}
              value={draft}
              placeholder="Don't widen OAuth. Pulse stays three panels…"
              onChange={(event) => {
                setDraft(event.target.value);
                if (phase === "dormant") setPhase("capture");
              }}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  event.preventDefault();
                  save();
                }
              }}
            />
            <button type="button" className="marketing-proto__save" onClick={save} disabled={compiling}>
              {compiling ? "Compiling" : "Save"}
            </button>
          </label>
          <div className="marketing-proto__chips" aria-label="Try a note">
            {DEMO_CHIPS.map((chip) => (
              <button key={chip} type="button" className="marketing-proto__chip" onClick={() => dropChip(chip)}>
                {chip}
              </button>
            ))}
          </div>
        </div>

        <div className="marketing-proto__pulse" aria-label="Pulse">
          <article className={`marketing-proto__panel${phase === "capture" && latestLabel ? " is-live" : ""}`}>
            <h4>Latest</h4>
            {latestLabel && !compiling ? (
              <p>
                <strong>{latestLabel.split("\n")[0]}</strong>
                <span>capture · just now</span>
              </p>
            ) : (
              <p className="marketing-proto__empty">Nothing in yet. Add context from home.</p>
            )}
          </article>

          <article className={`marketing-proto__panel${phase === "brief" || phase === "writeback" ? " is-live" : ""}`}>
            <div className="marketing-proto__panel-head">
              <h4>The brief</h4>
              <button type="button" className="marketing-proto__copy" onClick={() => void copyBrief()} disabled={!saved}>
                {copied ? "Copied" : "Copy brief"}
              </button>
            </div>
            {compiling ? (
              <p className="marketing-proto__empty">Compiling the note they actually read…</p>
            ) : saved ? (
              <dl>
                <div>
                  <dt>Direction</dt>
                  <dd>{brief.direction}</dd>
                </div>
                <div>
                  <dt>Do not</dt>
                  <dd>{brief.doNot}</dd>
                </div>
                <div>
                  <dt>Next</dt>
                  <dd>{accepted ? `${brief.next} Gate is in.` : brief.next}</dd>
                </div>
              </dl>
            ) : (
              <p className="marketing-proto__empty">No summary captured yet.</p>
            )}
          </article>

          <article className={`marketing-proto__panel${phase === "writeback" ? " is-live" : ""}`}>
            <h4>Wrote back</h4>
            {phase === "writeback" || accepted ? (
              <div className="marketing-proto__agent">
                <p>
                  <strong>{DEMO_WRITEBACK.title}</strong>
                  {DEMO_WRITEBACK.body}
                </p>
                {accepted ? (
                  <p className="marketing-proto__accepted">Accepted. The next chat already knows.</p>
                ) : (
                  <button type="button" className="marketing-proto__accept" onClick={() => setAccepted(true)}>
                    Accept
                  </button>
                )}
              </div>
            ) : (
              <p className="marketing-proto__empty">When an agent stops, its handoff lands here.</p>
            )}
          </article>
        </div>
      </div>

      <div className="marketing-proto__dock">
        <div className="marketing-hero-stage__tabs" role="tablist" aria-label="The loop">
          {(
            [
              ["capture", "Context in"],
              ["brief", "The note"],
              ["writeback", "Writeback"],
            ] as const
          ).map(([id, label]) => {
            const selected = phase === id || (phase === "dormant" && id === "capture");
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={phase === id}
                className={`marketing-hero-tab${selected && phase !== "dormant" ? " is-active" : ""}`}
                onClick={() => {
                  if (id === "capture") {
                    start();
                    return;
                  }
                  const text = saved || draft.trim() || DEMO_CHIPS[0];
                  setDraft(text);
                  setSaved(text);
                  setCompiling(false);
                  setPhase(id);
                  if (id === "brief") setAccepted(false);
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
        {phase !== "dormant" ? (
          <button type="button" className="marketing-proto__replay" onClick={replay}>
            Replay
          </button>
        ) : null}
      </div>
    </div>
  );
}

function MiniChrome() {
  return (
    <div className="marketing-proto__chrome" aria-hidden>
      <span className="marketing-proto__dots">
        <i />
        <i />
        <i />
      </span>
      <span className="marketing-proto__word">hypher</span>
      <span className="marketing-proto__crumb">hypher-web</span>
    </div>
  );
}
