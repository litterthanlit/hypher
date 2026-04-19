"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import { BETA_FEEDBACK_STATUSES, type BetaFeedbackStatus } from "@/lib/beta";

type InviteRow = {
  id: string;
  prefix: string;
  label: string;
  maxRedemptions: number;
  redemptionCount: number;
  createdBy: string;
  createdAt: number;
  revokedAt?: number;
  expiresAt?: number;
};

type FeedbackRow = {
  id: string;
  userId: string;
  category: string;
  message: string;
  pagePath?: string;
  userAgent?: string;
  status: BetaFeedbackStatus;
  createdAt: number;
  updatedAt: number;
};

type GateState = {
  gateEnabled: boolean;
  hasAccess: boolean;
  isAdmin: boolean;
  accessGrantedAt?: number;
};

function formatDate(ts?: number): string {
  return ts ? new Date(ts).toLocaleString() : "-";
}

export function BetaAdminPanel() {
  const gateState = useQuery((api as any).beta.getGateState, {}) as GateState | undefined;
  const inviteRows = useQuery((api as any).beta.listInvites, gateState?.isAdmin ? {} : "skip") as InviteRow[] | undefined;
  const feedbackRows = useQuery((api as any).beta.listFeedback, gateState?.isAdmin ? {} : "skip") as FeedbackRow[] | undefined;
  const createInvite = useMutation((api as any).beta.createInvite);
  const revokeInvite = useMutation((api as any).beta.revokeInvite);
  const updateFeedbackStatus = useMutation((api as any).beta.updateFeedbackStatus);

  const [label, setLabel] = useState("Beta invite");
  const [maxRedemptions, setMaxRedemptions] = useState(1);
  const [expiresInDays, setExpiresInDays] = useState(30);
  const [creating, setCreating] = useState(false);
  const [newCode, setNewCode] = useState<string | null>(null);

  const handleCreate = useCallback(async () => {
    setCreating(true);
    try {
      const expiresAt = expiresInDays > 0
        ? Date.now() + expiresInDays * 86_400_000
        : undefined;
      const result = await createInvite({
        label,
        maxRedemptions,
        ...(expiresAt ? { expiresAt } : {}),
      });
      setNewCode(result.code);
      await navigator.clipboard.writeText(result.code);
      toast.success("Invite created and copied.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create invite.");
    } finally {
      setCreating(false);
    }
  }, [createInvite, expiresInDays, label, maxRedemptions]);

  const handleRevoke = useCallback(async (inviteId: string) => {
    if (!window.confirm("Revoke this invite?")) return;
    await revokeInvite({ inviteId });
    toast.success("Invite revoked.");
  }, [revokeInvite]);

  const handleStatus = useCallback(async (feedbackId: string, status: BetaFeedbackStatus) => {
    await updateFeedbackStatus({ feedbackId, status });
    toast.success("Feedback updated.");
  }, [updateFeedbackStatus]);

  if (gateState === undefined) {
    return (
      <div className="settings-api-keys-page">
        <div className="modal api-keys-panel api-keys-panel--page">
          <p className="api-keys-empty">Loading beta settings...</p>
        </div>
      </div>
    );
  }

  if (!gateState.isAdmin) {
    return (
      <div className="settings-api-keys-page">
        <div className="modal api-keys-panel api-keys-panel--page">
          <div className="project-settings-header">
            <h3>Beta</h3>
            <Link href="/app" className="api-keys-back-link">Back to app</Link>
          </div>
          <p className="api-keys-desc">This page is only available to beta admins.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-api-keys-page">
      <div className="modal api-keys-panel api-keys-panel--page beta-admin-page">
        <div className="project-settings-header">
          <div>
            <p className="launch-eyebrow">Beta ops</p>
            <h3>Invites and feedback</h3>
          </div>
          <Link href="/app" className="api-keys-back-link">Back to app</Link>
        </div>
        <p className="api-keys-desc">
          Gate status: <strong>{gateState.gateEnabled ? "Invite gate enabled" : "Invite gate disabled"}</strong>.
          Admins can always enter.
        </p>

        <section className="integrations-section">
          <h4 className="integrations-section-title">Create invite</h4>
          <div className="beta-admin-form">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="settings-github-input"
              placeholder="Invite label"
            />
            <input
              type="number"
              min={1}
              max={500}
              value={maxRedemptions}
              onChange={(e) => setMaxRedemptions(Number(e.target.value))}
              className="settings-github-input"
              aria-label="Max redemptions"
            />
            <input
              type="number"
              min={0}
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(Number(e.target.value))}
              className="settings-github-input"
              aria-label="Expires in days"
            />
            <button
              type="button"
              className="settings-github-connect"
              onClick={() => void handleCreate()}
              disabled={creating}
            >
              {creating ? "Creating..." : "Create"}
            </button>
          </div>
          {newCode ? (
            <div className="beta-new-code">
              <span>Copy this now:</span>
              <code>{newCode}</code>
              <button type="button" className="api-key-dismiss-btn" onClick={() => void navigator.clipboard.writeText(newCode)}>
                Copy
              </button>
            </div>
          ) : null}
        </section>

        <section className="integrations-section">
          <h4 className="integrations-section-title">Invites</h4>
          <div className="beta-table-wrap">
            <table className="api-keys-table">
              <thead>
                <tr>
                  <th>Label</th>
                  <th>Prefix</th>
                  <th>Uses</th>
                  <th>Expires</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {inviteRows?.length === 0 && (
                  <tr><td colSpan={6} className="api-keys-empty-cell">No invites yet.</td></tr>
                )}
                {inviteRows?.map((invite) => (
                  <tr key={invite.id}>
                    <td>{invite.label}</td>
                    <td><code className="api-key-prefix">{invite.prefix}</code></td>
                    <td>{invite.redemptionCount}/{invite.maxRedemptions}</td>
                    <td>{formatDate(invite.expiresAt)}</td>
                    <td>{invite.revokedAt ? "Revoked" : "Active"}</td>
                    <td>
                      {!invite.revokedAt ? (
                        <button type="button" className="api-key-revoke" onClick={() => void handleRevoke(invite.id)}>
                          Revoke
                        </button>
                      ) : <span className="api-key-meta">-</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="integrations-section">
          <h4 className="integrations-section-title">Feedback inbox</h4>
          <div className="beta-feedback-list">
            {feedbackRows?.length === 0 && <p className="api-keys-empty">No feedback yet.</p>}
            {feedbackRows?.map((row) => (
              <article className="beta-feedback-row" key={row.id}>
                <div className="beta-feedback-row-head">
                  <span className={`launch-status launch-status--${row.status === "new" ? "warning" : "ready"}`}>
                    {row.category}
                  </span>
                  <span className="launch-muted">{formatDate(row.createdAt)}</span>
                </div>
                <p>{row.message}</p>
                <div className="beta-feedback-meta">
                  <span>{row.userId}</span>
                  {row.pagePath ? <code>{row.pagePath}</code> : null}
                </div>
                <div className="beta-feedback-actions">
                  {BETA_FEEDBACK_STATUSES.map((status) => (
                    <button
                      key={status}
                      type="button"
                      className={row.status === status ? "api-key-copy-btn" : "api-key-dismiss-btn"}
                      onClick={() => void handleStatus(row.id, status)}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
