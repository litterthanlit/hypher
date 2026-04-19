"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { NoteIcon, ArtifactIcon } from "./Icons";

interface NearbyItem {
  kind: string;
  name: string;
  content?: string;
  tags: string[];
}

interface Props {
  /** Click-anchored panel vs fixed dock (project mockup). */
  variant?: "floating" | "docked";
  screenX: number;
  screenY: number;
  nearby: NearbyItem[];
  /** Shown in docked context row (e.g. project title). */
  contextLabel?: string;
  onClose: () => void;
}

/**
 * Compute fixed-position style for the panel anchored to the right-click point.
 *
 * Default: panel opens to the bottom-right of the click.
 * Flip on X if clickX + PANEL_W > window.innerWidth  (would overflow right edge).
 * Flip on Y if clickY + PANEL_H > window.innerHeight (would overflow bottom edge).
 *
 * PANEL_W ~420px, PANEL_H ~360px (estimated; actual height is clamped to 60vh by CSS).
 */
function computePanelStyle(
  clickX: number,
  clickY: number,
): React.CSSProperties {
  const PANEL_W = 420; // matches max-width in .ambient-ask-panel CSS
  const PANEL_H = 360; // estimated panel height at full load

  const vw = typeof window !== "undefined" ? window.innerWidth : 1440;
  const vh = typeof window !== "undefined" ? window.innerHeight : 900;

  // Flip horizontally: if panel would overflow right edge, open to the left instead.
  const flipX = clickX + PANEL_W > vw;
  // Flip vertically: if panel would overflow bottom edge, open upward instead.
  const flipY = clickY + PANEL_H > vh;

  return {
    position: "fixed",
    left: flipX ? Math.max(0, clickX - PANEL_W) : clickX,
    top: flipY ? Math.max(0, clickY - PANEL_H) : clickY,
    zIndex: 200,
  };
}

function KindIcon({ kind }: { kind: string }) {
  if (kind === "note") return <NoteIcon className="ambient-ask-chip-icon" />;
  if (kind === "artifact") return <ArtifactIcon className="ambient-ask-chip-icon" />;
  // Fallback for any future kinds
  return <span className="ambient-ask-chip-icon" aria-hidden="true">·</span>;
}

export function AmbientAskPanel({
  variant = "floating",
  screenX,
  screenY,
  nearby,
  contextLabel,
  onClose,
}: Props) {
  const [prompt, setPrompt] = useState("What patterns do you see here?");
  const [reply, setReply] = useState("");
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const replyRef = useRef<HTMLDivElement>(null);

  // Abort any in-flight stream when the panel unmounts.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // Close on Escape; abort in-flight stream first.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        abortRef.current?.abort();
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Scroll reply area to bottom as tokens stream in.
  useEffect(() => {
    if (replyRef.current) {
      replyRef.current.scrollTop = replyRef.current.scrollHeight;
    }
  }, [reply]);

  const send = async () => {
    if (streaming) {
      abortRef.current?.abort();
    }
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setReply("");
    setStreaming(true);

    try {
      const payload: { prompt: string; nearby: NearbyItem[] } = {
        prompt,
        // Send trimmed payload: kind, name, first 600 chars of content, tags.
        nearby: nearby.map((n) => ({
          kind: n.kind,
          name: n.name,
          ...(n.content ? { content: n.content.slice(0, 600) } : {}),
          tags: n.tags,
        })),
      };

      const res = await fetch("/api/canvas/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });

      if (res.status === 429) {
        toast.error("Too many asks. Try again in a minute.");
        return;
      }
      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        setReply((p) => p + value);
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        toast.error("Couldn't reach Claude. Check the server logs.");
      }
    } finally {
      setStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const panelStyle = variant === "docked" ? undefined : computePanelStyle(screenX, screenY);
  const uniqueTags = Array.from(
    new Set(nearby.flatMap((n) => n.tags ?? []).filter(Boolean)),
  ).slice(0, 6);

  return (
    <AnimatePresence>
      <motion.div
        className={`ambient-ask-panel${variant === "docked" ? " ambient-ask-panel--docked" : ""}`}
        style={panelStyle}
        initial={{ opacity: 0, scale: variant === "docked" ? 1 : 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: variant === "docked" ? 1 : 0.96 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="ambient-ask-header">
          <span className="ambient-ask-title">
            {variant === "docked" ? (
              <>
                <span className="ambient-ask-title-dot" aria-hidden />
                ambient ask
              </>
            ) : (
              <>
                Asking Claude about {nearby.length} nearby item{nearby.length !== 1 ? "s" : ""}
              </>
            )}
          </span>
          <button
            className="ambient-ask-close"
            aria-label="Close panel"
            type="button"
            onClick={() => {
              abortRef.current?.abort();
              onClose();
            }}
          >
            ✕
          </button>
        </div>

        {variant === "docked" && (
          <div className="ambient-ask-context" aria-label="Ask context">
            <span className="ambient-ask-context-label">context:</span>
            <span className="ambient-ask-context-pill">{nearby.length} items</span>
            {uniqueTags.length > 0 ? (
              <span className="ambient-ask-context-pill">{uniqueTags.length} tags</span>
            ) : null}
            {contextLabel ? <span className="ambient-ask-context-pill">{contextLabel}</span> : null}
          </div>
        )}

        <div
          className={`ambient-ask-chips${variant === "docked" ? " ambient-ask-chips--docked" : ""}`}
          aria-label="Items Claude is reading"
        >
          {nearby.map((item, i) => (
            <span key={i} className="ambient-ask-chip">
              <KindIcon kind={item.kind} />
              <span className="ambient-ask-chip-name">{item.name || "(unnamed)"}</span>
            </span>
          ))}
        </div>

        {/* Prompt input */}
        <textarea
          className="ambient-ask-textarea"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            variant === "docked"
              ? "ask about what's on this canvas…"
              : "Ask Claude something about these items…"
          }
          rows={variant === "docked" ? 2 : 2}
          disabled={streaming}
          aria-label="Question for Claude"
        />
        <div className="ambient-ask-actions">
          <span className="ambient-ask-hint">
            {variant === "docked" ? (
              <>
                <kbd className="ambient-ask-kbd">↵</kbd> send · <kbd className="ambient-ask-kbd">esc</kbd> stop
              </>
            ) : (
              <>Enter to send · Shift+Enter for newline</>
            )}
          </span>
          <button
            type="button"
            className="ambient-ask-send"
            onClick={send}
            disabled={streaming || !prompt.trim()}
            aria-busy={streaming}
          >
            {streaming ? "Streaming…" : variant === "docked" ? "Send" : "Send"}
          </button>
        </div>

        {(reply || streaming) && (
          <div className="ambient-ask-reply" ref={replyRef} aria-live="polite">
            {reply}
            {streaming && !reply ? <span className="ambient-ask-cursor" aria-hidden="true" /> : null}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
