"use client";

import { useState, useEffect, useCallback } from "react";
import { useStore } from "@/lib/useStore";
import { Sidebar } from "@/components/Sidebar";
import { DetailView } from "@/components/DetailView";
import { SuggestionsPanel } from "@/components/SuggestionsPanel";
import { GraphView } from "@/components/GraphView";
import { GardenView } from "@/components/GardenView";
import { StreamView } from "@/components/StreamView";
import { SpatialCanvas } from "@/components/SpatialCanvas";
import { SearchDialog } from "@/components/SearchDialog";
import { ViewSwitcher, type ViewMode } from "@/components/ViewSwitcher";
import type { ArtifactType } from "@/types";

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

export default function Home() {
  const store = useStore();
  const [viewMode, setViewMode] = useState<ViewMode>("canvas");
  const [showSearch, setShowSearch] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Cmd+K — Search
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowSearch((s) => !s);
      }
      // Escape — close search
      if (e.key === "Escape" && showSearch) {
        setShowSearch(false);
      }
      // 1-4 — view switching (only when not typing in input)
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
  }, [showSearch]);

  // File drop handler
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const files = Array.from(e.dataTransfer.files);
      for (const file of files) {
        const artifact = {
          id: crypto.randomUUID(),
          kind: "artifact" as const,
          name: file.name.replace(/\.[^/.]+$/, ""),
          type: guessArtifactType(file.name),
          fileReference: file.name,
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        };
        store.addObject(artifact);
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
        selectedId={store.selectedId}
        onSelect={(id) => { store.setSelectedId(id); if (viewMode === "garden" || viewMode === "stream") setViewMode("focus"); }}
        onAdd={store.addObject}
        pendingCount={store.pendingCount}
        onOpenSearch={() => setShowSearch(true)}
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
      />

      {/* Drop zone overlay */}
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

      {/* Search overlay */}
      {showSearch && (
        <SearchDialog
          search={store.search}
          onSelect={(id) => { store.setSelectedId(id); setViewMode("focus"); }}
          onClose={() => setShowSearch(false)}
        />
      )}

      {store.modelLoading && (
        <div className="loading-bar">
          <span className="loading-dot" />
          Loading embedding model...
        </div>
      )}
    </main>
  );
}
