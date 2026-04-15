"use client";

import { useState, useEffect, useCallback } from "react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { motion, AnimatePresence } from "framer-motion";
import type { Project, AnyObject } from "@/types";

interface Props {
  projects: Project[];
  allObjects: AnyObject[];
  onDismiss: () => void;
  onSelectProject: (id: string) => void;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function DailyDigest({ projects, allObjects, onDismiss, onSelectProject }: Props) {
  const [digestText, setDigestText] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const generateDigest = useAction(api.ai.generateDigest);

  const fetchDigest = useCallback(async () => {
    setLoading(true);
    setError(null);
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

      const result = await generateDigest({ projects: projectData });
      setDigestText(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      if (msg.includes("ANTHROPIC_API_KEY") || msg.includes("api_key")) {
        setError("Add ANTHROPIC_API_KEY to your Convex environment to enable AI digests.");
      } else {
        setError("Could not generate digest. Check your Convex logs for details.");
      }
    } finally {
      setLoading(false);
    }
  }, [projects, allObjects, generateDigest]);

  useEffect(() => {
    fetchDigest();
  }, [fetchDigest]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onDismiss]);

  // Find projects mentioned in digest text for linking
  const projectLinks = projects.filter(
    (p) => digestText && digestText.includes(p.name)
  );

  return (
    <AnimatePresence>
      <motion.div
        className="digest-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => { if (e.target === e.currentTarget) onDismiss(); }}
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
            <button className="digest-close" onClick={onDismiss} aria-label="Dismiss">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width={18} height={18}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="digest-body">
            {loading && (
              <div className="digest-loading">
                <div className="digest-loading-dots">
                  <span /><span /><span />
                </div>
                <p className="digest-loading-text">Thinking about your projects...</p>
              </div>
            )}

            {error && (
              <div className="digest-error">
                <p>{error}</p>
              </div>
            )}

            {digestText && !loading && (
              <>
                <div className="digest-content">
                  {digestText.split("\n").map((line, i) => {
                    if (!line.trim()) return <br key={i} />;
                    return <p key={i}>{line}</p>;
                  })}
                </div>

                {projectLinks.length > 0 && (
                  <div className="digest-projects">
                    <p className="digest-projects-label">Jump to project</p>
                    <div className="digest-project-links">
                      {projectLinks.map((p) => (
                        <button
                          key={p.id}
                          className="digest-project-btn"
                          onClick={() => { onSelectProject(p.id); onDismiss(); }}
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
