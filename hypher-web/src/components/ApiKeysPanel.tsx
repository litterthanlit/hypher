"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { getSettingsAccessState } from "@/lib/settingsAccess";

type Variant = "modal" | "page";

interface Props {
  onClose?: () => void;
  variant?: Variant;
}

export function ApiKeysPanel({ onClose, variant = "modal" }: Props) {
  const [includeRevoked, setIncludeRevoked] = useState(false);
  const { isLoading, isAuthenticated } = useConvexAuth();
  const accessState = getSettingsAccessState({ isLoading, isAuthenticated });
  const keys = useQuery(api.apiKeys.list, accessState === "settings" ? { includeRevoked } : "skip");
  const createKey = useMutation(api.apiKeys.create);
  const revokeKey = useMutation(api.apiKeys.revoke);

  // ── Daily email digest ────────────────────────────────────────────────────
  // typegen pending convex dev
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const savePrefs = useMutation((api as any).digestEmail.savePrefs);
  const [digestEnabled, setDigestEnabled] = useState(true);
  const [digestHour, setDigestHour] = useState(8);
  const digestTimezone =
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : "UTC";

  const handleSaveDigest = useCallback(
    async (enabled: boolean, localHour: number) => {
      await savePrefs({ enabled, localHour, timezone: digestTimezone });
      toast.success("Saved.");
    },
    [savePrefs, digestTimezone]
  );

  const handleUnsubscribe = useCallback(async () => {
    setDigestEnabled(false);
    await savePrefs({ enabled: false, localHour: digestHour, timezone: digestTimezone });
    toast.success("Saved.");
  }, [savePrefs, digestHour, digestTimezone]);
  // ─────────────────────────────────────────────────────────────────────────

  const [showNameModal, setShowNameModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleOpenCreate = useCallback(() => {
    if (accessState !== "settings") return;
    setNewKeyName("");
    setShowNameModal(true);
  }, [accessState]);

  const handleCreate = useCallback(async () => {
    if (accessState !== "settings") return;
    if (!newKeyName.trim()) return;
    const plainKey = await createKey({ name: newKeyName.trim() });
    setShowNameModal(false);
    setNewKeyName("");
    setRevealedKey(plainKey);
    setCopied(false);
  }, [accessState, newKeyName, createKey]);

  const handleCopy = useCallback(() => {
    if (revealedKey) {
      void navigator.clipboard.writeText(revealedKey);
      setCopied(true);
    }
  }, [revealedKey]);

  const dismissReveal = useCallback(() => {
    setRevealedKey(null);
    setCopied(false);
  }, []);

  const handleRevoke = useCallback(
    async (keyId: string) => {
      if (accessState !== "settings") return;
      if (!window.confirm("Revoke this API key? Apps using it will stop working.")) return;
      await revokeKey({ keyId: keyId as Id<"apiKeys"> });
    },
    [accessState, revokeKey]
  );

  useEffect(() => {
    if (variant !== "modal" || !onClose) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !revealedKey && !showNameModal) onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, variant, revealedKey, showNameModal]);

  const authRequired = accessState !== "settings";

  const inner = (
    <>
      <div className="project-settings-header">
        <h3>API Keys</h3>
        {variant === "modal" && onClose && (
          <button className="project-settings-close" onClick={onClose} aria-label="Close">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width={18} height={18}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        {variant === "page" && (
          <Link href="/app" className="api-keys-back-link">
            ← Back to app
          </Link>
        )}
      </div>

      <p className="api-keys-desc">
        API keys let you capture into Hypher from external apps using <code>@hypher/core</code>.
      </p>

      {authRequired ? (
        <div className="api-keys-auth-required">
          <p>{accessState === "loading" ? "Checking sign-in..." : "Sign in to create and manage Hypher API keys."}</p>
          {accessState === "sign_in_required" ? (
            <Link href="/sign-in?redirect_url=/app/settings/api-keys" className="settings-github-connect">
              Sign in
            </Link>
          ) : null}
        </div>
      ) : null}

      {!authRequired ? <div className="api-keys-toolbar">
        <button
          type="button"
          className="settings-github-connect"
          onClick={handleOpenCreate}
        >
          Create new key
        </button>
        <label className="api-keys-toggle">
          <input
            type="checkbox"
            checked={includeRevoked}
            onChange={(e) => setIncludeRevoked(e.target.checked)}
          />
          Show revoked
        </label>
      </div> : null}

      {!authRequired && showNameModal && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowNameModal(false); }}>
          <div className="modal api-keys-name-modal" onClick={(e) => e.stopPropagation()}>
            <h4 className="api-keys-modal-title">Name this key</h4>
            <input
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="e.g. CLI, My App"
              className="settings-github-input"
              autoFocus
            />
            <div className="api-keys-modal-actions">
              <button type="button" className="api-key-dismiss-btn" onClick={() => setShowNameModal(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="settings-github-connect"
                onClick={() => void handleCreate()}
                disabled={!newKeyName.trim()}
              >
                Generate key
              </button>
            </div>
          </div>
        </div>
      )}

      {!authRequired && revealedKey && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) dismissReveal(); }}>
          <div className="modal api-keys-panel" onClick={(e) => e.stopPropagation()}>
            <div className="api-key-revealed">
              <p className="api-key-revealed-warning">
                Copy this now — you won&apos;t see it again.
              </p>
              <div className="api-key-revealed-value">
                <code>{revealedKey}</code>
                <button type="button" className="api-key-copy-btn" onClick={handleCopy}>
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <button type="button" className="api-key-dismiss-btn" onClick={dismissReveal}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {!authRequired ? <div className="api-keys-table-wrap">
        <table className="api-keys-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Prefix</th>
              <th>Created</th>
              <th>Last used</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {keys?.length === 0 && (
              <tr>
                <td colSpan={5} className="api-keys-empty-cell">No API keys yet.</td>
              </tr>
            )}
            {keys?.map((k) => (
              <tr key={k.id} className={k.revokedAt ? "api-key-row-revoked" : ""}>
                <td>
                  <span className="api-key-name">{k.name}</span>
                  {k.needsRotation && (
                    <span className="api-key-badge">Rotation suggested</span>
                  )}
                  {k.revokedAt && (
                    <span className="api-key-badge api-key-badge-revoked">Revoked</span>
                  )}
                </td>
                <td>
                  <code className="api-key-prefix">{k.prefix}</code>
                </td>
                <td>{new Date(k.createdAt).toLocaleString()}</td>
                <td>{k.lastUsed ? new Date(k.lastUsed).toLocaleString() : "—"}</td>
                <td>
                  {!k.revokedAt ? (
                    <button
                      type="button"
                      className="api-key-revoke"
                      onClick={() => void handleRevoke(k.id)}
                    >
                      Revoke
                    </button>
                  ) : (
                    <span className="api-key-meta">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div> : null}

      {/* ── Daily email digest ──────────────────────────────────────────── */}
      {!authRequired ? <div className="api-keys-digest-section">
        <h4 className="api-keys-section-title">Daily email digest</h4>
        <p className="api-keys-desc">
          Receive a morning summary of your projects by email. Reply to add a thought to your inbox.
        </p>

        <div className="api-keys-digest-row">
          <label className="api-keys-toggle">
            <input
              type="checkbox"
              checked={digestEnabled}
              onChange={(e) => {
                setDigestEnabled(e.target.checked);
                void handleSaveDigest(e.target.checked, digestHour);
              }}
            />
            Enable daily digest
          </label>
        </div>

        <div className="api-keys-digest-row">
          <label className="api-keys-digest-label" htmlFor="digest-hour">
            Send hour (local time)
          </label>
          <select
            id="digest-hour"
            className="api-keys-digest-select"
            value={digestHour}
            onChange={(e) => {
              const h = Number(e.target.value);
              setDigestHour(h);
              void handleSaveDigest(digestEnabled, h);
            }}
          >
            {Array.from({ length: 24 }, (_, i) => (
              <option key={i} value={i}>
                {String(i).padStart(2, "0")}:00
              </option>
            ))}
          </select>
        </div>

        <div className="api-keys-digest-row">
          <span className="api-keys-digest-label">Timezone</span>
          <span className="api-keys-digest-tz">{digestTimezone}</span>
        </div>

        <div className="api-keys-digest-row">
          <button
            type="button"
            className="api-key-revoke"
            onClick={() => void handleUnsubscribe()}
          >
            Unsubscribe from digest
          </button>
        </div>
      </div> : null}
    </>
  );

  if (variant === "page") {
    return (
      <div className="settings-api-keys-page">
        <div className="modal api-keys-panel api-keys-panel--page">
          {inner}
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}>
      <div className="modal api-keys-panel" onClick={(e) => e.stopPropagation()}>
        {inner}
      </div>
    </div>
  );
}
