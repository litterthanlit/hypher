/**
 * Hypher extension options page.
 * - Auth mode toggle (session / API key)
 * - API key field (write-only — never displayed after save)
 * - Queue inspector with Retry now + Reset extension
 * - Privacy note
 */

import React, { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { getAuthMode, setAuthMode, setApiKey, clearApiKey, resetExtension } from "./lib/auth";
import type { AuthMode } from "./lib/auth";
import { getQueue, replayQueue } from "./lib/capture";
import type { PendingCapture } from "./lib/capture";

function formatAgo(ms: number): string {
  const diff = Date.now() - ms;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function Options() {
  const [authMode, setAuthModeState] = useState<AuthMode>("session");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [queue, setQueue] = useState<PendingCapture[]>([]);
  const [retrying, setRetrying] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const [resetConfirm, setResetConfirm] = useState(false);

  const reload = useCallback(async () => {
    const [mode, q, { apiKey }] = await Promise.all([
      getAuthMode(),
      getQueue(),
      chrome.storage.local.get("apiKey"),
    ]);
    setAuthModeState(mode);
    setQueue(q);
    setHasApiKey(!!apiKey);
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const handleAuthModeToggle = async (mode: AuthMode) => {
    await setAuthMode(mode);
    setAuthModeState(mode);
  };

  const handleSaveApiKey = async () => {
    if (!apiKeyInput.trim()) return;
    try {
      await setApiKey(apiKeyInput.trim());
      setApiKeyInput("");
      setHasApiKey(true);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch {
      setSaveStatus("error");
    }
  };

  const handleClearApiKey = async () => {
    await clearApiKey();
    setHasApiKey(false);
    setApiKeyInput("");
  };

  const handleRetryNow = async () => {
    setRetrying(true);
    try {
      await replayQueue();
      await reload();
    } finally {
      setRetrying(false);
    }
  };

  const handleReset = async () => {
    if (!resetConfirm) {
      setResetConfirm(true);
      return;
    }
    await resetExtension();
    await reload();
    setResetConfirm(false);
  };

  return (
    <div>
      {/* Header */}
      <div className="options-header">
        <div className="row" style={{ gap: "8px", marginBottom: "4px" }}>
          <span className="wordmark" style={{ fontSize: "18px" }}>
            hypher<span className="wordmark-dot" />
          </span>
        </div>
        <div className="options-title">Extension Settings</div>
      </div>

      {/* Auth Mode */}
      <div className="options-section">
        <div className="options-section-title">Authentication</div>

        {/* Session mode */}
        <div className="options-row">
          <div>
            <div className="options-label">Session mode (default)</div>
            <div className="options-hint">Uses your hypher.app login. Keep hypher.app open in a tab.</div>
          </div>
          <label className="toggle">
            <input
              type="radio"
              name="authMode"
              checked={authMode === "session"}
              onChange={() => void handleAuthModeToggle("session")}
              style={{ opacity: 0, width: 0, height: 0 }}
            />
            <span
              className="btn btn-ghost"
              style={{ fontSize: "11px", padding: "4px 10px", cursor: "pointer" }}
              onClick={() => void handleAuthModeToggle("session")}
            >
              {authMode === "session" ? "✓ Active" : "Select"}
            </span>
          </label>
        </div>

        {/* API key mode */}
        <div className="options-row">
          <div>
            <div className="options-label">API key mode</div>
            <div className="options-hint">
              For browsers where you are not signed in to hypher.app.
              Get a key from <a href="https://hypher.app/app/settings" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>hypher.app/app/settings</a>.
            </div>
          </div>
          <span
            className="btn btn-ghost"
            style={{ fontSize: "11px", padding: "4px 10px", cursor: "pointer", flexShrink: 0 }}
            onClick={() => void handleAuthModeToggle("api-key")}
          >
            {authMode === "api-key" ? "✓ Active" : "Select"}
          </span>
        </div>

        {authMode === "api-key" && (
          <div style={{ paddingTop: "10px" }}>
            {hasApiKey ? (
              <div className="row" style={{ gap: "8px" }}>
                <span style={{ fontSize: "12px", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                  ••••••••••••••••
                </span>
                <button type="button" className="btn btn-ghost" style={{ fontSize: "11px", padding: "4px 10px" }} onClick={() => void handleClearApiKey()}>
                  Replace key
                </button>
              </div>
            ) : (
              <div className="stack" style={{ gap: "8px" }}>
                <input
                  type="password"
                  className="api-key-input"
                  placeholder="Paste your API key…"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void handleSaveApiKey(); }}
                  autoComplete="off"
                />
                <div className="row" style={{ gap: "8px" }}>
                  <button type="button" className="btn btn-primary" style={{ fontSize: "12px" }} onClick={() => void handleSaveApiKey()} disabled={!apiKeyInput.trim()}>
                    Save key
                  </button>
                  {saveStatus === "saved" && <span className="alert alert-success" style={{ padding: "4px 10px" }}>Saved</span>}
                  {saveStatus === "error" && <span className="alert alert-error" style={{ padding: "4px 10px" }}>Error saving</span>}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Queue Inspector */}
      <div className="options-section">
        <div className="row" style={{ justifyContent: "space-between", marginBottom: "8px" }}>
          <div className="options-section-title" style={{ marginBottom: 0 }}>
            Offline Queue
            {queue.length > 0 && (
              <span style={{ marginLeft: "8px", fontSize: "11px", color: "#f59e0b", fontWeight: 400 }}>
                {queue.length} pending
              </span>
            )}
          </div>
          {queue.length > 0 && (
            <button type="button" className="btn btn-ghost" style={{ fontSize: "11px", padding: "4px 10px" }} onClick={() => void handleRetryNow()} disabled={retrying}>
              {retrying ? "Retrying…" : "Retry now"}
            </button>
          )}
        </div>

        {queue.length === 0 ? (
          <div className="queue-empty">No queued captures</div>
        ) : (
          <ul className="queue-list">
            {queue.map((item) => (
              <li key={item.id} className="queue-item">
                <div className="queue-item-content">{item.content.slice(0, 80)}{item.content.length > 80 ? "…" : ""}</div>
                <div className="queue-item-meta">
                  {formatAgo(item.createdAt)} · {item.attempts} attempt{item.attempts !== 1 ? "s" : ""}
                  {item.sourceUrl && ` · ${item.sourceUrl.slice(0, 40)}`}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Privacy note */}
      <div className="options-section" style={{ background: "var(--accent-light)", border: "1px solid var(--accent)" }}>
        <div style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: "1.6" }}>
          <strong>Privacy:</strong> Highlights are sent to Hypher exactly as selected. The extension does not scrape pages automatically. Your API key is stored locally and never logged.
        </div>
      </div>

      {/* Danger zone */}
      <div className="options-section">
        <div className="options-section-title">Danger zone</div>
        <div className="options-row">
          <div>
            <div className="options-label">Reset extension</div>
            <div className="options-hint">Clears all settings, API key, and queued captures.</div>
          </div>
          <button
            type="button"
            className="btn btn-danger"
            style={{ fontSize: "11px", padding: "4px 10px", flexShrink: 0 }}
            onClick={() => void handleReset()}
          >
            {resetConfirm ? "Confirm reset?" : "Reset"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Mount ──────────────────────────────────────────────────────────────────────
document.body.classList.add("options");
const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<Options />);
}
