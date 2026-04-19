"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import {
  combineLaunchReadinessGroups,
  getLaunchStatusLabel,
  type LaunchReadinessGroup,
  type LaunchReadinessResponse,
  type LaunchReadinessStatus,
} from "@/lib/launchReadiness";
import {
  LAUNCH_SMOKE_TESTS,
  readLaunchChecklist,
  toggleLaunchChecklistItem,
  writeLaunchChecklist,
  type LaunchChecklistState,
} from "@/lib/launchReadinessChecklist";

type ConvexReadiness = {
  checkedAt: number;
  groups: LaunchReadinessGroup[];
};

const statusRank: Record<LaunchReadinessStatus, number> = {
  ready: 0,
  warning: 1,
  blocked: 2,
};

function statusClass(status: LaunchReadinessStatus): string {
  return `launch-status launch-status--${status}`;
}

function formatCheckedAt(checkedAt?: number): string {
  if (!checkedAt) return "Not checked yet";
  return new Date(checkedAt).toLocaleString();
}

export function LaunchReadinessPanel() {
  const [nextReadiness, setNextReadiness] = useState<LaunchReadinessResponse | null>(null);
  const [loadingNext, setLoadingNext] = useState(true);
  const [nextError, setNextError] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<LaunchChecklistState>(() =>
    readLaunchChecklist(undefined)
  );

  const convexReadiness = useQuery(
    // typegen pending convex dev/codegen for this new module
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (api as any).launchReadiness.getStatus,
    {}
  ) as ConvexReadiness | undefined;

  const loadNextReadiness = useCallback(async () => {
    setLoadingNext(true);
    setNextError(null);
    try {
      const res = await fetch("/api/launch-readiness", { cache: "no-store" });
      const data = (await res.json()) as LaunchReadinessResponse | { error?: string };
      if (!res.ok || !("groups" in data)) {
        throw new Error("error" in data && data.error ? data.error : "readiness-check-failed");
      }
      setNextReadiness(data);
    } catch (err) {
      setNextError(err instanceof Error ? err.message : "Could not check readiness.");
    } finally {
      setLoadingNext(false);
    }
  }, []);

  useEffect(() => {
    void loadNextReadiness();
  }, [loadNextReadiness]);

  useEffect(() => {
    setChecklist(readLaunchChecklist(window.localStorage));
  }, []);

  const combined = useMemo(() => {
    const groups = [
      ...(nextReadiness?.groups ?? []),
      ...(convexReadiness?.groups ?? []),
    ].sort((a, b) => statusRank[b.status] - statusRank[a.status]);
    if (groups.length === 0) return null;
    return combineLaunchReadinessGroups(
      groups,
      Math.max(nextReadiness?.checkedAt ?? 0, convexReadiness?.checkedAt ?? 0)
    );
  }, [convexReadiness, nextReadiness]);

  const completedCount = LAUNCH_SMOKE_TESTS.filter((test) => checklist[test.id]).length;

  const toggleChecklist = useCallback((id: string) => {
    setChecklist((current) => {
      const next = toggleLaunchChecklistItem(current, id);
      writeLaunchChecklist(window.localStorage, next);
      return next;
    });
  }, []);

  const copyCurl = useCallback(async (curl: string) => {
    await navigator.clipboard.writeText(curl);
    toast.success("Copied smoke test command.");
  }, []);

  const overallStatus: LaunchReadinessStatus =
    !combined ? "warning" : combined.ok === false ? "blocked" : combined.groups.some((group) => group.status === "warning") ? "warning" : "ready";
  const heroTitle = !combined
    ? "Checking launch configuration."
    : combined.ok
      ? "No blocking config gaps found."
      : "A required launch item is missing.";

  return (
    <div className="settings-api-keys-page">
      <div className="modal api-keys-panel api-keys-panel--page launch-readiness-page">
        <div className="project-settings-header">
          <div>
            <p className="launch-eyebrow">Launch readiness</p>
            <h3>Smoke-test cockpit</h3>
          </div>
          <Link href="/app" className="api-keys-back-link">
            ← Back to app
          </Link>
        </div>

        <p className="api-keys-desc">
          Check beta-critical configuration without exposing secrets, then walk the core flows by hand before inviting users.
        </p>

        <section className={`launch-hero launch-hero--${overallStatus}`}>
          <div>
            <span className={statusClass(overallStatus)}>{getLaunchStatusLabel(overallStatus)}</span>
            <h4>{heroTitle}</h4>
            <p>
              Last checked: {formatCheckedAt(combined?.checkedAt)}. The Convex section loads through the signed-in app session.
            </p>
          </div>
          <button
            type="button"
            className="settings-github-connect"
            onClick={() => void loadNextReadiness()}
            disabled={loadingNext}
          >
            {loadingNext ? "Checking…" : "Refresh"}
          </button>
        </section>

        {nextError && (
          <p className="launch-error">Next.js readiness failed: {nextError}</p>
        )}

        <section className="launch-section">
          <div className="launch-section-head">
            <h4 className="integrations-section-title">Configuration</h4>
            <span className="launch-muted">
              {convexReadiness ? "Next.js + Convex" : "Convex status loading…"}
            </span>
          </div>

          {!combined && !nextError ? (
            <p className="api-keys-empty">Checking readiness…</p>
          ) : (
            <div className="launch-group-grid">
              {combined?.groups.map((group) => (
                <article className="launch-group-card" key={group.id}>
                  <div className="launch-group-head">
                    <h5>{group.label}</h5>
                    <span className={statusClass(group.status)}>
                      {getLaunchStatusLabel(group.status)}
                    </span>
                  </div>
                  <div className="launch-item-list">
                    {group.items.map((item) => (
                      <div className="launch-item" key={item.id}>
                        <div className="launch-item-main">
                          <span className={statusClass(item.status)}>
                            {getLaunchStatusLabel(item.status)}
                          </span>
                          <div>
                            <div className="launch-item-title">
                              {item.label}
                              <span>{item.required ? "Required" : "Optional"}</span>
                            </div>
                            {item.note && <p>{item.note}</p>}
                            {item.missing?.length ? (
                              <div className="launch-missing">
                                Missing: {item.missing.map((name) => (
                                  <code key={name}>{name}</code>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="launch-section">
          <div className="launch-section-head">
            <h4 className="integrations-section-title">Manual smoke tests</h4>
            <span className="launch-muted">
              {completedCount}/{LAUNCH_SMOKE_TESTS.length} complete
            </span>
          </div>

          <div className="launch-smoke-list">
            {LAUNCH_SMOKE_TESTS.map((test) => (
              <article className="launch-smoke-row" key={test.id}>
                <label className="launch-smoke-check">
                  <input
                    type="checkbox"
                    checked={checklist[test.id] === true}
                    onChange={() => toggleChecklist(test.id)}
                  />
                  <span>
                    <strong>{test.title}</strong>
                    <small>{test.detail}</small>
                  </span>
                </label>
                <div className="launch-smoke-actions">
                  {test.href && (
                    <Link href={test.href} className="api-key-dismiss-btn">
                      Open
                    </Link>
                  )}
                  {test.curl && (
                    <button
                      type="button"
                      className="api-key-dismiss-btn"
                      onClick={() => void copyCurl(test.curl!)}
                    >
                      Copy cURL
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
