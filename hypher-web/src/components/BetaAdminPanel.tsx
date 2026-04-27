"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import {
  BETA_FEEDBACK_STATUSES,
  BETA_REQUEST_STATUSES,
  type BetaFeedbackStatus,
  type BetaRequestStatus,
} from "@/lib/beta";

type AdminTab = "requests" | "invites" | "feedback";

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

type RequestRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  work: string;
  pain: string;
  link?: string;
  howFound: string;
  status: BetaRequestStatus;
  adminNotes?: string;
  idealUserType?: string;
  inviteId?: string;
  invitePrefix?: string;
  createdAt: number;
  updatedAt: number;
  reviewedAt?: number;
  reviewedBy?: string;
  archivedAt?: number;
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

type ApprovedInvite = {
  requestId: string;
  name: string;
  email: string;
  code: string;
};

function formatDate(ts?: number): string {
  return ts ? new Date(ts).toLocaleString() : "-";
}

function statusTone(status: BetaRequestStatus | BetaFeedbackStatus): "ready" | "warning" | "blocked" {
  if (status === "pending" || status === "new") return "warning";
  if (status === "rejected" || status === "archived" || status === "closed") return "blocked";
  return "ready";
}

export function BetaAdminPanel() {
  const gateState = useQuery((api as any).beta.getGateState, {}) as GateState | undefined;
  const requestRows = useQuery((api as any).beta.listRequests, gateState?.isAdmin ? {} : "skip") as RequestRow[] | undefined;
  const inviteRows = useQuery((api as any).beta.listInvites, gateState?.isAdmin ? {} : "skip") as InviteRow[] | undefined;
  const feedbackRows = useQuery((api as any).beta.listFeedback, gateState?.isAdmin ? {} : "skip") as FeedbackRow[] | undefined;

  const createInvite = useMutation((api as any).beta.createInvite);
  const revokeInvite = useMutation((api as any).beta.revokeInvite);
  const approveRequest = useMutation((api as any).beta.approveRequest);
  const updateRequestReview = useMutation((api as any).beta.updateRequestReview);
  const updateRequestStatus = useMutation((api as any).beta.updateRequestStatus);
  const updateFeedbackStatus = useMutation((api as any).beta.updateFeedbackStatus);

  const [activeTab, setActiveTab] = useState<AdminTab>("requests");
  const [label, setLabel] = useState("Beta invite");
  const [maxRedemptions, setMaxRedemptions] = useState(1);
  const [expiresInDays, setExpiresInDays] = useState(30);
  const [creating, setCreating] = useState(false);
  const [newCode, setNewCode] = useState<string | null>(null);
  const [approvedInvite, setApprovedInvite] = useState<ApprovedInvite | null>(null);

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

  const handleApprove = useCallback(async (request: RequestRow) => {
    try {
      const result = await approveRequest({ requestId: request.id });
      const next = {
        requestId: request.id,
        name: request.name,
        email: request.email,
        code: result.code,
      };
      setApprovedInvite(next);
      await navigator.clipboard.writeText(result.code);
      toast.success("Request approved and invite copied.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not approve request.");
    }
  }, [approveRequest]);

  const handleRequestStatus = useCallback(async (requestId: string, status: BetaRequestStatus) => {
    await updateRequestStatus({ requestId, status });
    toast.success(`Request marked ${status}.`);
  }, [updateRequestStatus]);

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

  const pendingCount = requestRows?.filter((row) => row.status === "pending").length ?? 0;
  const feedbackCount = feedbackRows?.filter((row) => row.status === "new").length ?? 0;

  return (
    <div className="settings-api-keys-page">
      <div className="modal api-keys-panel api-keys-panel--page beta-admin-page">
        <div className="project-settings-header">
          <div>
            <p className="launch-eyebrow">Beta ops</p>
            <h3>Requests, invites, and feedback</h3>
          </div>
          <Link href="/app" className="api-keys-back-link">Back to app</Link>
        </div>
        <p className="api-keys-desc">
          Gate status: <strong>{gateState.gateEnabled ? "Invite gate enabled" : "Invite gate disabled"}</strong>.
          Admins can always enter.
        </p>

        <div className="beta-admin-tabs" role="tablist" aria-label="Beta admin sections">
          <button type="button" className={activeTab === "requests" ? "is-active" : ""} onClick={() => setActiveTab("requests")}>
            Requests {pendingCount > 0 ? <span>{pendingCount}</span> : null}
          </button>
          <button type="button" className={activeTab === "invites" ? "is-active" : ""} onClick={() => setActiveTab("invites")}>
            Invites
          </button>
          <button type="button" className={activeTab === "feedback" ? "is-active" : ""} onClick={() => setActiveTab("feedback")}>
            Feedback {feedbackCount > 0 ? <span>{feedbackCount}</span> : null}
          </button>
        </div>

        {approvedInvite ? (
          <div className="beta-new-code beta-approved-code">
            <span>Send this invite to {approvedInvite.name} ({approvedInvite.email}):</span>
            <code>{approvedInvite.code}</code>
            <button type="button" className="api-key-dismiss-btn" onClick={() => void navigator.clipboard.writeText(approvedInvite.code)}>
              Copy
            </button>
            <button type="button" className="api-key-dismiss-btn" onClick={() => setApprovedInvite(null)}>
              Dismiss
            </button>
          </div>
        ) : null}

        {activeTab === "requests" ? (
          <section className="integrations-section">
            <h4 className="integrations-section-title">Access requests</h4>
            <div className="beta-request-list">
              {requestRows?.length === 0 && <p className="api-keys-empty">No requests yet.</p>}
              {requestRows?.map((row) => (
                <RequestAdminRow
                  key={row.id}
                  row={row}
                  onApprove={handleApprove}
                  onStatus={handleRequestStatus}
                  onSaveReview={updateRequestReview}
                />
              ))}
            </div>
          </section>
        ) : null}

        {activeTab === "invites" ? (
          <>
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
          </>
        ) : null}

        {activeTab === "feedback" ? (
          <section className="integrations-section">
            <h4 className="integrations-section-title">Feedback inbox</h4>
            <div className="beta-feedback-list">
              {feedbackRows?.length === 0 && <p className="api-keys-empty">No feedback yet.</p>}
              {feedbackRows?.map((row) => (
                <article className="beta-feedback-row" key={row.id}>
                  <div className="beta-feedback-row-head">
                    <span className={`launch-status launch-status--${statusTone(row.status)}`}>
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
        ) : null}
      </div>
    </div>
  );
}

function RequestAdminRow({
  row,
  onApprove,
  onStatus,
  onSaveReview,
}: {
  row: RequestRow;
  onApprove: (row: RequestRow) => Promise<void>;
  onStatus: (requestId: string, status: BetaRequestStatus) => Promise<void>;
  onSaveReview: (args: { requestId: string; adminNotes?: string; idealUserType?: string }) => Promise<unknown>;
}) {
  const [adminNotes, setAdminNotes] = useState(row.adminNotes ?? "");
  const [idealUserType, setIdealUserType] = useState(row.idealUserType ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await onSaveReview({
        requestId: row.id,
        adminNotes: adminNotes.trim() || undefined,
        idealUserType: idealUserType.trim() || undefined,
      });
      toast.success("Review notes saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save review notes.");
    } finally {
      setSaving(false);
    }
  }, [adminNotes, idealUserType, onSaveReview, row.id]);

  return (
    <article className="beta-request-admin-row">
      <div className="beta-feedback-row-head">
        <div>
          <h5>{row.name}</h5>
          <div className="beta-feedback-meta">
            <span>{row.email}</span>
            <span>{row.role}</span>
            {row.link ? <a href={row.link} target="_blank" rel="noreferrer">{row.link}</a> : null}
          </div>
        </div>
        <span className={`launch-status launch-status--${statusTone(row.status)}`}>
          {row.status}
        </span>
      </div>

      <div className="beta-request-admin-copy">
        <p><strong>Building:</strong> {row.work}</p>
        <p><strong>Pain:</strong> {row.pain}</p>
        <p><strong>Found Hypher:</strong> {row.howFound}</p>
        <p><strong>Requested:</strong> {formatDate(row.createdAt)}</p>
        {row.invitePrefix ? <p><strong>Invite prefix:</strong> <code>{row.invitePrefix}</code></p> : null}
      </div>

      <div className="beta-request-review-grid">
        <label>
          <span>Archetype</span>
          <input
            value={idealUserType}
            onChange={(event) => setIdealUserType(event.target.value)}
            className="settings-github-input"
            placeholder="AI builder, indie hacker..."
          />
        </label>
        <label>
          <span>Admin notes</span>
          <textarea
            value={adminNotes}
            onChange={(event) => setAdminNotes(event.target.value)}
            className="beta-feedback-textarea beta-request-notes"
          />
        </label>
      </div>

      <div className="beta-feedback-actions">
        <button type="button" className="api-key-dismiss-btn" onClick={() => void handleSave()} disabled={saving}>
          {saving ? "Saving..." : "Save notes"}
        </button>
        {row.status !== "approved" ? (
          <button type="button" className="api-key-copy-btn" onClick={() => void onApprove(row)}>
            Approve + copy invite
          </button>
        ) : null}
        {BETA_REQUEST_STATUSES.filter((status) => status !== "approved" && status !== row.status).map((status) => (
          <button
            key={status}
            type="button"
            className="api-key-dismiss-btn"
            onClick={() => void onStatus(row.id, status)}
          >
            {status}
          </button>
        ))}
      </div>
    </article>
  );
}
