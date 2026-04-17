"use client";

import { useState, useEffect, useCallback, useRef, useTransition } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import type { Project, AnyObject } from "@/types";

interface Props {
  projects: Project[];
  allObjects: AnyObject[];
  /** Pre-seeded demo digest (server); skips AI when set. */
  demoDigestText?: string | null;
  onDismiss: () => void;
  onSelectProject: (id: string) => void;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function DailyDigest({
  projects,
  allObjects,
  demoDigestText,
  onDismiss,
  onSelectProject,
}: Props) {
  const [digestText, setDigestText] = useState("");
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const [, startTransition] = useTransition();

  const fetchDigest = useCallback(async () => {
    // Short-circuit: pre-seeded demo digest, no network call needed
    if (demoDigestText) {
      setDigestText(demoDigestText);
      setLoading(false);
      return;
    }

    // Cancel any in-flight request before starting a new one
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setDigestText("");
    setErrored(false);
    setLoading(true);

    try {
      // Count items per project
      const itemCounts: Record<string, number> = {};
      for (const obj of allObjects) {
        if (obj.projectId) {
          itemCounts[obj.projectId] = (itemCounts[obj.projectId] ?? 0) + 1;
        }
      }

      const projectData = projects.map((p) => ({
        name: p.name,
        status: p.status,
        priority: p.priority,
        blockers: p.blockers,
        lastActivity: p.lastActivity,
        itemCount: itemCounts[p.id] ?? 0,
        githubRepo: p.githubRepo,
        githubSummary: p.githubRepo
          ? `Connected to ${p.githubRepo}${p.githubLastSync ? `, last synced ${new Date(p.githubLastSync).toLocaleDateString()}` : ""}`
          : undefined,
      }));

      const res = await fetch("/api/digest/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projects: projectData }),
        signal: ctrl.signal,
      });

      if (res.status === 503) {
        toast.error(
          "Add ANTHROPIC_API_KEY to your Vercel environment to enable AI digests."
        );
        return;
      }

      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        // Batch state updates into a transition to avoid jank on fast chunks.
        startTransition(() => {
          setDigestText((prev) => prev + value);
        });
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return; // expected on unmount/close
      setErrored(true);
      toast.error("Connection lost. Retry?", {
        action: { label: "Retry", onClick: fetchDigest },
      });
    } finally {
      setLoading(false);
    }
  }, [projects, allObjects, demoDigestText, startTransition]);

  useEffect(() => {
    fetchDigest();
    // Abort in-flight request on unmount
    return () => {
      abortRef.current?.abort();
    };
  }, [fetchDigest]);

  // Close on Escape — also aborts in-flight stream
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        abortRef.current?.abort();
        onDismiss();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onDismiss]);

  // Find projects mentioned in digest text — only rendered after stream completes
  // (gates on !loading to prevent half-matched name flicker mid-stream)
  const projectLinks = !loading
    ? projects.filter((p) => digestText && digestText.includes(p.name))
    : [];

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      abortRef.current?.abort();
      onDismiss();
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className="digest-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={handleBackdropClick}
      >
        <motion.div
          className="digest-card"
          initial={{ opacity: 0, y: -20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 400, damping: 30, delay: 0.05 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="digest-header">
            <h2 className="digest-greeting">{getGreeting()}</h2>
            <button
              className="digest-close"
              onClick={() => {
                abortRef.current?.abort();
                onDismiss();
              }}
              aria-label="Dismiss"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                width={18}
                height={18}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18 18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <div className="digest-body">
            {loading && !digestText && (
              <div className="digest-loading tw-animate-pulse" aria-busy="true">
                <div className="tw-space-y-3 tw-w-full tw-max-w-md">
                  <div className="tw-h-3 tw-rounded tw-bg-slate-200/80 tw-w-[92%]" />
                  <div className="tw-h-3 tw-rounded tw-bg-slate-200/80 tw-w-full" />
                  <div className="tw-h-3 tw-rounded tw-bg-slate-200/80 tw-w-[85%]" />
                  <div className="tw-h-3 tw-rounded tw-bg-slate-200/80 tw-w-[70%]" />
                </div>
                <p className="digest-loading-text tw-mt-4">
                  Thinking about your projects...
                </p>
              </div>
            )}

            {digestText && (
              <>
                <div className="digest-content">
                  {digestText.split("\n").map((line, i) => {
                    if (!line.trim()) return <br key={i} />;
                    return <p key={i}>{line}</p>;
                  })}
                  {loading && <span className="digest-caret" aria-hidden="true">|</span>}
                </div>

                {!loading && projectLinks.length > 0 && (
                  <div className="digest-projects">
                    <p className="digest-projects-label">Jump to project</p>
                    <div className="digest-project-links">
                      {projectLinks.map((p) => (
                        <button
                          key={p.id}
                          className="digest-project-btn"
                          onClick={() => {
                            onSelectProject(p.id);
                            onDismiss();
                          }}
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {errored && !digestText && (
              <div className="digest-error">
                Could not generate digest. Check your connection and try again.
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
