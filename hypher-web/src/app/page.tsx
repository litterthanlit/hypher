"use client";

import { useState, useEffect, useCallback } from "react";
import { useStore } from "@/lib/useStore";
import { CaptureHome } from "@/components/CaptureHome";
import { Sidebar } from "@/components/Sidebar";
import { DetailView } from "@/components/DetailView";
import { SuggestionsPanel } from "@/components/SuggestionsPanel";
import { GraphView } from "@/components/GraphView";
import { GardenView } from "@/components/GardenView";
import { StreamView } from "@/components/StreamView";
import { SpatialCanvas } from "@/components/SpatialCanvas";
import { SearchDialog } from "@/components/SearchDialog";
import { ViewSwitcher, type ViewMode } from "@/components/ViewSwitcher";
import { ToastContainer } from "@/components/Toast";
import type { ArtifactType, ObjectKind } from "@/types";

function guessArtifactType(filename: string): ArtifactType {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (["jpg", "jpeg", "png", "gif", "svg", "webp", "ico", "bmp", "heic"].includes(ext)) return "image";
  if (["mp4", "mov", "avi", "webm", "mkv"].includes(ext)) return "video";
  if (["mp3", "wav", "aac", "flac", "ogg", "m4a"].includes(ext)) return "audio";
  if (["js", "ts", "tsx", "jsx", "py", "rb", "go", "rs", "swift", "c", "cpp", "h", "css", "html", "json", "yaml", "yml", "sh"].includes(ext)) return "code";
  if (["otf", "ttf", "woff", "woff2"].includes(ext)) return "font";
  if (["pdf", "doc", "docx", "txt", "md", "rtf", "pages", "csv", "xls", "xlsx"].includes(ext)) return "document";
  return "other";
}

type AppMode = "capture" | "workspace";

export default function Home() {
  const store = useStore();
  const [appMode, setAppMode] = useState<AppMode>("capture");
  const [viewMode, setViewMode] = useState<ViewMode>("canvas");
  const [showSearch, setShowSearch] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Cmd+K — Search (both modes)
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (appMode === "workspace") setShowSearch((s) => !s);
      }
      // Cmd+N — Jump to capture mode
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        setAppMode("capture");
      }
      // Escape — close search
      if (e.key === "Escape" && showSearch) {
        setShowSearch(false);
      }

      if (appMode !== "workspace") return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "1") setViewMode("canvas");
      if (e.key === "2") setViewMode("garden");
      if (e.key === "3") setViewMode("focus");
      if (e.key === "4") setViewMode("stream");
      if (e.key === "5") setViewMode("graph");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showSearch, appMode]);

  // File drop handler (both modes)
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const files = Array.from(e.dataTransfer.files);
      for (const file of files) {
        store.addObject({
          id: crypto.randomUUID(),
          kind: "artifact" as const,
          name: file.name.replace(/\.[^/.]+$/, ""),
          type: guessArtifactType(file.name),
          fileReference: file.name,
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        });
      }
    },
    [store]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  // Capture home handlers
  const handleCapture = useCallback(
    async (text: string, projectId?: string | null) => {
      return store.addQuickCapture(text, projectId);
    },
    [store]
  );

  const handleCreateProjectAndCapture = useCallback(
    (projectName: string, noteText: string) => {
      const now = Date.now();
      const projectId = crypto.randomUUID();
      const project = {
        id: projectId,
        kind: "project" as const,
        name: projectName,
        description: "",
        status: "seed" as const,
        createdAt: now,
        modifiedAt: now,
      };
      store.addObject(project);
      // The note was already created in inbox by addQuickCapture — assign it
      const recentNote = store.inboxItems.find(
        (o) => o.kind === "note" && (o as any).content === noteText
      );
      if (recentNote) {
        store.assignToProject(recentNote.id, projectId);
      }
    },
    [store]
  );

  // Canvas create handler
  const handleCreateAtPosition = useCallback(
    (kind: ObjectKind, text: string, x: number, y: number) => {
      const now = Date.now();
      const id = crypto.randomUUID();
      const base = { id, createdAt: now, modifiedAt: now, canvasPosition: { x, y } };

      if (kind === "project") {
        store.addObject({ ...base, kind: "project", name: text, description: "", status: "seed" });
      } else if (kind === "note") {
        store.addObject({ ...base, kind: "note", content: text, maturity: "fleeting" });
      } else {
        store.addObject({ ...base, kind: "artifact", name: text, type: "other" });
      }
    },
    [store]
  );

  // ── CAPTURE MODE ──
  if (appMode === "capture") {
    return (
      <div
        className="capture-root"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <CaptureHome
          projects={store.projects}
          onCapture={handleCapture}
          onCreateProjectAndCapture={handleCreateProjectAndCapture}
          onNavigateToWorkspace={() => setAppMode("workspace")}
        />

        {dragOver && (
          <div className="drop-overlay">
            <div className="drop-content">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width={32} height={32}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
              </svg>
              <p>Drop files to create artifacts</p>
            </div>
          </div>
        )}

        <ToastContainer messages={store.toasts} onDismiss={store.dismissToast} />

        {store.modelLoading && (
          <div className="loading-bar">
            <span className="loading-dot" />
            Loading embedding model...
          </div>
        )}
      </div>
    );
  }

  // ── WORKSPACE MODE ──
  return (
    <main
      className="app-layout"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <Sidebar
        projects={store.projects}
        notes={store.notes}
        artifacts={store.artifacts}
        inboxItems={store.inboxItems}
        selectedId={store.selectedId}
        onSelect={(id) => { store.setSelectedId(id); if (viewMode === "garden" || viewMode === "stream") setViewMode("focus"); }}
        onAdd={store.addObject}
        pendingCount={store.pendingCount}
        onOpenSearch={() => setShowSearch(true)}
        onGoHome={() => setAppMode("capture")}
      />

      <div className="main-panel">
        <div className="main-toolbar">
          <ViewSwitcher mode={viewMode} onChange={setViewMode} />
          <div className="toolbar-spacer" />
          <button className="btn-search" onClick={() => setShowSearch(true)}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width={14} height={14}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            Search
            <kbd className="toolbar-kbd">⌘K</kbd>
          </button>
        </div>

        {viewMode === "canvas" && (
          <SpatialCanvas
            objects={store.objects}
            connections={store.connections.filter((c) => c.type !== "dismissed")}
            selectedId={store.selectedId}
            onSelect={(id) => { store.setSelectedId(id); }}
            onUpdatePosition={store.updatePosition}
            onCreateAtPosition={handleCreateAtPosition}
            onProjectClick={(id) => { store.setSelectedId(id); setViewMode("focus"); }}
            onAssignToProject={store.assignToProject}
          />
        )}

        {viewMode === "garden" && (
          <GardenView
            projects={store.projects}
            connections={store.connections}
            selectedId={store.selectedId}
            onSelect={(id) => { store.setSelectedId(id); setViewMode("focus"); }}
          />
        )}

        {viewMode === "focus" && (
          <DetailView
            object={store.selected}
            connections={store.selected ? store.connectionsFor(store.selected.id) : []}
            allObjects={store.objects}
            resolveObject={store.resolveObject}
            onUpdate={store.updateObject}
            onDelete={store.removeObject}
            onSelect={store.setSelectedId}
            onManualConnect={store.createManualConnection}
            onRemoveConnection={store.removeConnection}
            onAssignToProject={store.assignToProject}
            onUnassignFromProject={store.unassignFromProject}
          />
        )}

        {viewMode === "stream" && (
          <StreamView
            activity={store.activity}
            objects={store.objects}
            onSelect={(id) => { store.setSelectedId(id); setViewMode("focus"); }}
          />
        )}

        {viewMode === "graph" && (
          <GraphView
            objects={store.objects}
            connections={store.connections.filter((c) => c.type !== "dismissed")}
            selectedId={store.selectedId}
            onSelect={(id) => { store.setSelectedId(id); }}
          />
        )}
      </div>

      <SuggestionsPanel
        suggestions={store.selected ? store.suggestionsFor(store.selected.id) : []}
        resolveObject={store.resolveObject}
        selectedId={store.selectedId}
        onConfirm={store.confirmConnection}
        onDismiss={store.dismissConnection}
        onRefresh={store.refreshSuggestions}
        isProcessing={store.isProcessing}
        pendingCount={store.pendingCount}
        inboxItems={store.inboxItems}
        projects={store.projects}
        onAssignToProject={store.assignToProject}
        onSelectObject={(id) => { store.setSelectedId(id); setViewMode("focus"); }}
      />

      {dragOver && (
        <div className="drop-overlay">
          <div className="drop-content">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width={32} height={32}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
            </svg>
            <p>Drop files to create artifacts</p>
          </div>
        </div>
      )}

      {showSearch && (
        <SearchDialog
          search={store.search}
          onSelect={(id) => { store.setSelectedId(id); setViewMode("focus"); }}
          onClose={() => setShowSearch(false)}
        />
      )}

      <ToastContainer messages={store.toasts} onDismiss={store.dismissToast} />

      {store.modelLoading && (
        <div className="loading-bar">
          <span className="loading-dot" />
          Loading embedding model...
        </div>
      )}
    </main>
  );
}
