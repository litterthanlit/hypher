"use client";

import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export function ApiKeysPanel({ onClose }: { onClose: () => void }) {
  const keys = useQuery(api.apiKeys.list);
  const createKey = useMutation(api.apiKeys.create);
  const revokeKey = useMutation(api.apiKeys.revoke);

  const [newKeyName, setNewKeyName] = useState("");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = useCallback(async () => {
    if (!newKeyName.trim()) return;
    const plainKey = await createKey({ name: newKeyName.trim() });
    setRevealedKey(plainKey);
    setNewKeyName("");
    setCopied(false);
  }, [newKeyName, createKey]);

  const handleCopy = useCallback(() => {
    if (revealedKey) {
      navigator.clipboard.writeText(revealedKey);
      setCopied(true);
    }
  }, [revealedKey]);

  const handleRevoke = useCallback(
    async (keyId: string) => {
      await revokeKey({ keyId: keyId as Id<"apiKeys"> });
    },
    [revokeKey]
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal api-keys-panel" onClick={(e) => e.stopPropagation()}>
        <div className="project-settings-header">
          <h3>API Keys</h3>
          <button className="project-settings-close" onClick={onClose} aria-label="Close">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width={18} height={18}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="api-keys-desc">
          API keys let you capture into Hypher from external apps using <code>@hypher/core</code>.
        </p>

        {/* Revealed key warning */}
        {revealedKey && (
          <div className="api-key-revealed">
            <p className="api-key-revealed-warning">
              This key will only be shown once. Copy it now.
            </p>
            <div className="api-key-revealed-value">
              <code>{revealedKey}</code>
              <button className="api-key-copy-btn" onClick={handleCopy}>
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <button className="api-key-dismiss-btn" onClick={() => setRevealedKey(null)}>
              Done
            </button>
          </div>
        )}

        {/* Create new key */}
        {!revealedKey && (
          <div className="api-key-create">
            <input
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="Key name (e.g. My App, CLI)"
              className="settings-github-input"
            />
            <button
              className="settings-github-connect"
              onClick={handleCreate}
              disabled={!newKeyName.trim()}
            >
              Create Key
            </button>
          </div>
        )}

        {/* List existing keys */}
        <div className="api-keys-list">
          {keys?.length === 0 && (
            <p className="api-keys-empty">No API keys yet.</p>
          )}
          {keys?.map((k) => (
            <div key={k.id} className="api-key-row">
              <div className="api-key-info">
                <span className="api-key-name">{k.name}</span>
                <span className="api-key-meta">
                  Created {new Date(k.createdAt).toLocaleDateString()}
                  {k.lastUsed && ` · Last used ${new Date(k.lastUsed).toLocaleDateString()}`}
                </span>
              </div>
              <button
                className="api-key-revoke"
                onClick={() => handleRevoke(k.id)}
              >
                Revoke
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
