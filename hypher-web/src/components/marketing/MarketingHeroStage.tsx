"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  compileDemoBrief,
  DEMO_BEATS,
  DEMO_CHIPS,
  DEMO_WRITEBACK,
  PUBLIC_CAPTURE_LABEL,
  PUBLIC_DROP_HINT,
} from "./marketingHeroDemo";

export type DemoPhase = "capture" | "brief" | "writeback";

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return reduced;
}

export function MarketingHeroStage() {
  const reducedMotion = usePrefersReducedMotion();
  const [phase, setPhase] = useState<DemoPhase>("capture");
  const [draft, setDraft] = useState("");
  const [saved, setSaved] = useState("");
  const [compiling, setCompiling] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const compileTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const brief = compileDemoBrief(saved || draft);

  useEffect(() => {
    return () => {
      if (compileTimer.current) clearTimeout(compileTimer.current);
    };
  }, []);

  const runLoop = useCallback(
    (text: string) => {
      const note = text.trim() || DEMO_CHIPS[0];
      setDraft(note);
      setSaved(note);
      setPhase("capture");
      if (compileTimer.current) clearTimeout(compileTimer.current);

      if (reducedMotion) {
        setCompiling(false);
        setPhase("writeback");
        return;
      }

      setCompiling(true);
      compileTimer.current = setTimeout(() => {
        setCompiling(false);
        setPhase("brief");
        compileTimer.current = setTimeout(() => setPhase("writeback"), 720);
      }, 520);
    },
    [reducedMotion],
  );

  const capture = useCallback(() => {
    runLoop(draft);
  }, [draft, runLoop]);

  const reset = useCallback(() => {
    if (compileTimer.current) clearTimeout(compileTimer.current);
    setPhase("capture");
    setDraft("");
    setSaved("");
    setCompiling(false);
    window.requestAnimationFrame(() => textareaRef.current?.focus());
  }, []);

  const showNote = Boolean(saved) && !compiling;
  const showWriteback = phase === "writeback" && Boolean(saved) && !compiling;

  return (
    <div className="marketing-proto">
      <div className="marketing-proto__beats">
        <article
          className={`marketing-proto__beat${phase === "capture" ? " is-active" : ""}`}
          aria-current={phase === "capture" ? "step" : undefined}
        >
          <h3 className="marketing-proto__beat-label">{DEMO_BEATS[0]}</h3>
          <label className="marketing-proto__field">
            <span className="sr-only">Capture context for the next session</span>
            <textarea
              ref={textareaRef}
              className="marketing-proto__textarea"
              rows={3}
              value={draft}
              placeholder="Don't widen OAuth. Pulse stays three panels…"
              onChange={(event) => {
                setDraft(event.target.value);
                setPhase("capture");
              }}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  event.preventDefault();
                  capture();
                }
              }}
            />
            <button
              type="button"
              className="marketing-proto__save"
              onClick={capture}
              disabled={compiling}
            >
              {compiling ? "Compiling" : PUBLIC_CAPTURE_LABEL}
            </button>
          </label>
          <div className="marketing-proto__chips" aria-label={PUBLIC_DROP_HINT}>
            <span className="marketing-proto__chip-hint">{PUBLIC_DROP_HINT}</span>
            {DEMO_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                className="marketing-proto__chip"
                onClick={() => runLoop(chip)}
              >
                {chip}
              </button>
            ))}
          </div>
        </article>

        <article
          className={`marketing-proto__beat${compiling || phase === "brief" ? " is-active" : ""}${!showNote && !compiling ? " is-waiting" : ""}`}
          aria-current={phase === "brief" || compiling ? "step" : undefined}
        >
          <h3 className="marketing-proto__beat-label">{DEMO_BEATS[1]}</h3>
          {compiling ? (
            <p className="marketing-proto__empty">Compiling the note they actually read…</p>
          ) : showNote ? (
            <dl className="marketing-proto__note">
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
                <dd>{brief.next}</dd>
              </div>
            </dl>
          ) : (
            <p className="marketing-proto__empty">
              Direction, decisions, do-not-do, next move — after you capture.
            </p>
          )}
        </article>

        <article
          className={`marketing-proto__beat${showWriteback ? " is-active" : ""}${!showWriteback ? " is-waiting" : ""}`}
          aria-current={phase === "writeback" ? "step" : undefined}
        >
          <h3 className="marketing-proto__beat-label">{DEMO_BEATS[2]}</h3>
          {showWriteback ? (
            <p className="marketing-proto__writeback">
              <strong>{DEMO_WRITEBACK.title}</strong>
              {DEMO_WRITEBACK.body}
            </p>
          ) : (
            <p className="marketing-proto__empty">What they post when they stop.</p>
          )}
        </article>
      </div>

      {saved ? (
        <div className="marketing-proto__footer">
          <button type="button" className="marketing-proto__reset" onClick={reset}>
            Reset
          </button>
        </div>
      ) : null}
    </div>
  );
}
