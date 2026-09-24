"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AGENTS,
  compileDemoNote,
  DEMO_CHIPS,
  DEMO_DIRECTIONS,
  DEMO_SOURCE_LOG,
  DEMO_TREE,
  DEMO_WRITEBACK,
  PUBLIC_CAPTURE_LABEL,
  PUBLIC_DROP_HINT,
} from "./marketingHeroDemo";

export type DemoPhase = "working" | "saving" | "note" | "resuming" | "done";

const PHASE_ORDER: DemoPhase[] = ["working", "saving", "note", "resuming", "done"];
const PHASE_DELAY: Record<Exclude<DemoPhase, "done">, number> = {
  working: 1400,
  saving: 900,
  note: 1500,
  resuming: 1000,
};

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

function reached(phase: DemoPhase, target: DemoPhase): boolean {
  return PHASE_ORDER.indexOf(phase) >= PHASE_ORDER.indexOf(target);
}

export function MarketingHeroStage() {
  const reducedMotion = usePrefersReducedMotion();
  const [directionIndex, setDirectionIndex] = useState(0);
  const [phase, setPhase] = useState<DemoPhase>("working");
  const [captured, setCaptured] = useState<string>(DEMO_CHIPS[0]);
  const [draft, setDraft] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  const direction = DEMO_DIRECTIONS[directionIndex];
  const source = AGENTS[direction.from];
  const destination = AGENTS[direction.to];
  const note = compileDemoNote(captured);

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const play = useCallback(() => {
    clear();
    if (reducedMotion) {
      setPhase("done");
      return;
    }
    const step = (current: DemoPhase) => {
      setPhase(current);
      if (current === "done") return;
      const next = PHASE_ORDER[PHASE_ORDER.indexOf(current) + 1];
      timer.current = setTimeout(() => step(next), PHASE_DELAY[current]);
    };
    step("working");
  }, [reducedMotion]);

  // Start once, when the stage scrolls into view.
  useEffect(() => {
    const node = stageRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting) && !started.current) {
          started.current = true;
          play();
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [play]);

  useEffect(() => clear, []);

  const chooseDirection = (index: number) => {
    setDirectionIndex(index);
    started.current = true;
    play();
  };

  const capture = (text: string) => {
    const value = text.trim();
    if (!value) return;
    setCaptured(value);
    setDraft("");
    started.current = true;
    play();
  };

  const statusText =
    phase === "working"
      ? `${source.name} is working`
      : phase === "saving"
        ? `${source.name} saved the handoff`
        : phase === "note"
          ? "Hypher folded it into the note"
          : phase === "resuming"
            ? `${destination.name} is resuming`
            : `${destination.name} continued. No recap typed.`;

  return (
    <div ref={stageRef} className="marketing-stage" data-phase={phase}>
      <div className="marketing-stage__bar">
        <div className="marketing-stage__switch" role="group" aria-label="Handoff direction">
          {DEMO_DIRECTIONS.map((option, index) => (
            <button
              key={`${option.from}-${option.to}`}
              type="button"
              className="marketing-stage__switch-btn"
              aria-pressed={index === directionIndex}
              onClick={() => chooseDirection(index)}
            >
              {AGENTS[option.from].short}
              <span aria-hidden> → </span>
              <span className="sr-only"> to </span>
              {AGENTS[option.to].short}
            </button>
          ))}
        </div>
        <p className="marketing-stage__status" aria-live="polite">
          <span className="marketing-stage__pulse" aria-hidden />
          {statusText}
        </p>
      </div>

      <div className="marketing-stage__grid">
        {/* Source agent */}
        <section
          className={`marketing-pane marketing-pane--term${phase === "working" || phase === "saving" ? " is-active" : ""}`}
          aria-label={`${source.name}, the agent that stops`}
        >
          <header className="marketing-pane__head">
            <span className="marketing-pane__dot" aria-hidden />
            <span>{source.name}</span>
            <span className="marketing-pane__meta">stopping</span>
          </header>
          <ol className="marketing-term">
            {DEMO_SOURCE_LOG.map((line) => (
              <li key={line} className="marketing-term__line marketing-term__log">
                {line}
              </li>
            ))}
            <li
              className={`marketing-term__line marketing-term__cmd${reached(phase, "saving") ? " is-shown" : ""}`}
            >
              <span aria-hidden>› </span>
              {source.save}
            </li>
            <li className={`marketing-term__line marketing-term__ok${reached(phase, "saving") ? " is-shown" : ""}`}>
              Saved revision 7 · {DEMO_TREE.branch} @ {DEMO_TREE.commit}
            </li>
          </ol>
        </section>

        {/* Hypher note */}
        <section
          className={`marketing-pane marketing-pane--note${phase === "note" ? " is-active" : ""}`}
          aria-label="The Hypher note"
        >
          <header className="marketing-pane__head">
            <span className="marketing-pane__mark" aria-hidden />
            <span>The note</span>
            <span className="marketing-pane__meta">rev {reached(phase, "saving") ? 7 : 6}</span>
          </header>

          <form
            className="marketing-capture"
            onSubmit={(event) => {
              event.preventDefault();
              capture(draft);
            }}
          >
            <label className="sr-only" htmlFor="marketing-capture-input">
              Capture a constraint for the next agent
            </label>
            <input
              id="marketing-capture-input"
              className="marketing-capture__input"
              value={draft}
              maxLength={72}
              placeholder="Don't widen OAuth…"
              onChange={(event) => setDraft(event.target.value)}
            />
            <button type="submit" className="marketing-capture__btn">
              {PUBLIC_CAPTURE_LABEL}
            </button>
          </form>
          <div className="marketing-capture__chips" aria-label={PUBLIC_DROP_HINT}>
            {DEMO_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                className="marketing-chip"
                aria-pressed={captured === chip}
                onClick={() => capture(chip)}
              >
                {chip}
              </button>
            ))}
          </div>

          <dl className={`marketing-note${reached(phase, "note") ? " is-folded" : ""}`}>
            <div>
              <dt>Constraints</dt>
              <dd>
                <ul>
                  {note.constraints.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </dd>
            </div>
            <div className="marketing-note__fold">
              <dt>Decision</dt>
              <dd>
                {note.decision.now}{" "}
                <span className="marketing-note__struck">
                  <span className="sr-only">Replaces: </span>
                  {note.decision.replaces}
                </span>
              </dd>
            </div>
            <div className="marketing-note__fold">
              <dt>Unverified</dt>
              <dd>{note.unverified}</dd>
            </div>
            <div className="marketing-note__fold">
              <dt>Next</dt>
              <dd>{note.next}</dd>
            </div>
          </dl>
        </section>

        {/* Destination agent */}
        <section
          className={`marketing-pane marketing-pane--term${phase === "resuming" || phase === "done" ? " is-active" : ""}${!reached(phase, "resuming") ? " is-waiting" : ""}`}
          aria-label={`${destination.name}, the agent that continues`}
        >
          <header className="marketing-pane__head">
            <span className="marketing-pane__dot marketing-pane__dot--go" aria-hidden />
            <span>{destination.name}</span>
            <span className="marketing-pane__meta">new session</span>
          </header>
          {reached(phase, "resuming") ? (
            <ol className="marketing-term">
              <li className="marketing-term__line marketing-term__cmd is-shown">
                <span aria-hidden>› </span>
                {destination.resume}
              </li>
              <li className="marketing-term__line marketing-term__check is-shown">
                {DEMO_TREE.branch} @ {DEMO_TREE.commit} · dirty {DEMO_TREE.dirty} · matches
              </li>
              <li className={`marketing-term__line${reached(phase, "done") ? " is-shown" : ""}`}>
                Goal: {note.goal}
              </li>
              <li className={`marketing-term__line${reached(phase, "done") ? " is-shown" : ""}`}>
                Changed: {note.decision.now} (was: {note.decision.replaces})
              </li>
              <li className={`marketing-term__line${reached(phase, "done") ? " is-shown" : ""}`}>
                Holding: {note.constraints[0]}
              </li>
              <li className={`marketing-term__line marketing-term__warn${reached(phase, "done") ? " is-shown" : ""}`}>
                Unverified: {note.unverified}
              </li>
              <li className={`marketing-term__line marketing-term__ok${reached(phase, "done") ? " is-shown" : ""}`}>
                Next: {note.next}
              </li>
            </ol>
          ) : (
            <p className="marketing-pane__empty">Waits for the handoff. Checks the working tree itself.</p>
          )}
        </section>
      </div>

      <div className="marketing-stage__foot">
        <p className="marketing-stage__writeback">
          {reached(phase, "done") ? (
            <>
              <strong>{DEMO_WRITEBACK.title}</strong> {DEMO_WRITEBACK.body}
            </>
          ) : (
            "Nothing on this page is sent anywhere."
          )}
        </p>
        <button type="button" className="marketing-stage__replay" onClick={play}>
          Replay
        </button>
      </div>
    </div>
  );
}
