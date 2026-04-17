/**
 * Hypher extension popup — 360×420px React UI.
 * Toolbar icon click → popup.html → this script.
 *
 * Three sections:
 *   1. Header: wordmark + page title/url strip
 *   2. Content: textarea pre-filled with selection
 *   3. ProjectPicker + TagChips
 *   4. Footer: queue badge + Capture / Cancel
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Project } from "./lib/api";
import { fetchProjects, fetchTagSuggestions } from "./lib/api";
import { captureToHypher, getQueue, setLastProjectId } from "./lib/capture";

// ── Types ──────────────────────────────────────────────────────────────────────
interface PageInfo {
  selection: string;
  pageTitle: string;
  pageUrl: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

async function getActivePageInfo(): Promise<PageInfo> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return { selection: "", pageTitle: tab?.title ?? "", pageUrl: tab?.url ?? "" };

  try {
    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => ({
        selection: window.getSelection()?.toString() ?? "",
        pageTitle: document.title ?? "",
        pageUrl: window.location.href ?? "",
      }),
    });
    return result?.[0]?.result ?? { selection: "", pageTitle: tab.title ?? "", pageUrl: tab.url ?? "" };
  } catch {
    return { selection: "", pageTitle: tab.title ?? "", pageUrl: tab.url ?? "" };
  }
}

// ── Root component ─────────────────────────────────────────────────────────────
function Popup() {
  const [pageInfo, setPageInfo] = useState<PageInfo>({ selection: "", pageTitle: "", pageUrl: "" });
  const [content, setContent] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [tags, setTags] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [tagsLoading, setTagsLoading] = useState(false);
  const [queueLength, setQueueLength] = useState(0);
  const [capturing, setCapturing] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const debouncedContent = useDebounce(content, 600);

  // Load initial data on mount
  useEffect(() => {
    void (async () => {
      const [info, queue] = await Promise.all([
        getActivePageInfo(),
        getQueue(),
      ]);
      setPageInfo(info);
      if (info.selection) setContent(info.selection);
      setQueueLength(queue.length);

      // Load last project + project list
      const { lastProjectId } = await chrome.storage.local.get("lastProjectId");
      try {
        const projs = await fetchProjects();
        setProjects(projs);
        if (lastProjectId && projs.some((p) => p.id === lastProjectId)) {
          setSelectedProject(lastProjectId as string);
        }
      } catch {
        // Silently fail — user may not be signed in
      }

      // Focus textarea
      setTimeout(() => textareaRef.current?.focus(), 50);
    })();
  }, []);

  // Tag suggestion on content change (debounced 600ms)
  useEffect(() => {
    if (debouncedContent.length < 10) {
      setTags([]);
      return;
    }
    let cancelled = false;
    setTagsLoading(true);
    void fetchTagSuggestions(debouncedContent).then((suggested) => {
      if (cancelled) return;
      setTags(suggested);
      setSelectedTags(new Set(suggested));
      setTagsLoading(false);
    });
    return () => { cancelled = true; };
  }, [debouncedContent]);

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }, []);

  const handleCapture = useCallback(async () => {
    if (!content.trim() || capturing) return;
    setCapturing(true);
    try {
      if (selectedProject) await setLastProjectId(selectedProject);
      await captureToHypher({
        content,
        sourceUrl: pageInfo.pageUrl,
        sourceTitle: pageInfo.pageTitle,
        projectId: selectedProject || null,
        tags: [...selectedTags],
      });
      setStatus("success");
      setTimeout(() => window.close(), 800);
    } catch {
      setStatus("error");
    } finally {
      setCapturing(false);
    }
  }, [content, capturing, selectedProject, selectedTags, pageInfo]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      void handleCapture();
    }
    if (e.key === "Escape") window.close();
  }, [handleCapture]);

  return (
    <div className="stack" style={{ height: "100%" }} onKeyDown={handleKeyDown}>
      {/* Header */}
      <div className="popup-header">
        <span className="wordmark">
          hypher<span className="wordmark-dot" />
        </span>
        <span className="page-meta" title={pageInfo.pageUrl}>
          {pageInfo.pageTitle || pageInfo.pageUrl}
        </span>
      </div>

      {/* Content textarea */}
      <div className="content-area">
        <div className="label" style={{ marginBottom: "6px" }}>Capture</div>
        <textarea
          ref={textareaRef}
          className="content-textarea"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Highlight or type something…"
          rows={4}
        />
      </div>

      {/* Project picker */}
      <div className="project-section">
        <div className="label" style={{ marginBottom: "6px" }}>Project</div>
        <select
          className="project-select"
          value={selectedProject}
          onChange={(e) => setSelectedProject(e.target.value)}
        >
          <option value="">Inbox (no project)</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.title}</option>
          ))}
        </select>
        <div style={{ marginTop: "4px" }}>
          <a
            href="https://hypher.app/app?new-project=true"
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: "11px", color: "var(--accent)", textDecoration: "none" }}
          >
            + Create new project
          </a>
        </div>
      </div>

      {/* Tag chips */}
      <div className="tags-section">
        {tagsLoading ? (
          <span className="tags-loading">Suggesting tags…</span>
        ) : tags.length > 0 ? (
          <div className="tags-row">
            {tags.map((tag) => (
              <button
                key={tag}
                type="button"
                className={`tag-chip ${selectedTags.has(tag) ? "selected" : ""}`}
                onClick={() => toggleTag(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        ) : (
          <span className="label-sm">Tags appear after you type…</span>
        )}
      </div>

      {/* Footer */}
      <div className="popup-footer">
        <span className={`queue-badge ${queueLength > 0 ? "has-items" : ""}`}>
          {queueLength > 0 ? `(${queueLength} queued)` : ""}
        </span>
        <div className="row" style={{ gap: "8px" }}>
          {status === "success" && (
            <span style={{ fontSize: "12px", color: "var(--accent)" }}>Captured!</span>
          )}
          {status === "error" && (
            <span style={{ fontSize: "12px", color: "#dc2626" }}>Error — queued</span>
          )}
          <button type="button" className="btn btn-ghost" onClick={() => window.close()}>
            Cancel <span className="kbd">Esc</span>
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!content.trim() || capturing}
            onClick={() => void handleCapture()}
          >
            Capture <span className="kbd" style={{ color: "rgba(255,255,255,0.7)" }}>⌘↵</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Mount ──────────────────────────────────────────────────────────────────────
document.body.classList.add("popup");
const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<Popup />);
}
