"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useStore } from "@/lib/useStore";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { CaptureHome } from "@/components/CaptureHome";
import { Sidebar } from "@/components/Sidebar";
import { SpatialCanvas } from "@/components/SpatialCanvas";
import { ListView } from "@/components/ListView";
import { ProjectDashboard } from "@/components/ProjectDashboard";
import { DailyDigest } from "@/components/DailyDigest";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { SearchDialog } from "@/components/SearchDialog";
import { AppChromeNav } from "@/components/AppChromeNav";
import { InboxReviewPanel } from "@/components/InboxReviewPanel";
import { generateSeedData } from "@/lib/notion-seed";
import { toast } from "sonner";
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
type ContentMode = "canvas" | "list" | "dashboard" | "inbox";

export default function AppHome() {
  const store = useStore();
  const skipTags = !store.clerkLoaded || !store.isSignedIn;
  const tagsList = useQuery(api.tags.listWithCounts, skipTags ? "skip" : {});
  const demoDigestText = useQuery(api.seed.getDemoDigest, skipTags ? "skip" : {});
  const tags = useMemo(() => tagsList ?? [], [tagsList]);
  const [appMode, setAppMode] = useState<AppMode>("capture");
  const [contentMode, setContentMode] = useState<ContentMode>("canvas");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showDigest, setShowDigest] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Server /capture route redirects here with ?project=…&toast=captured (or /app/p/:id → /app?project=…)
  useEffect(() => {
    if (typeof window === "undefined" || !store.clerkLoaded) return;
    const params = new URLSearchParams(window.location.search);
    const pid = params.get("project");
    if (pid) {
      setSelectedProjectId(pid);
      store.setSelectedId(pid);
      setAppMode("workspace");
      setContentMode("canvas");
    }
    if (params.get("toast") === "captured") {
      toast.success("Captured");
    }
    if (pid || params.get("toast")) {
      params.delete("project");
      params.delete("toast");
      const next = params.toString();
      window.history.replaceState({}, "", next ? `/app?${next}` : "/app");
    }
  }, [store.clerkLoaded]);

  // Auto-show digest on first open of the day
  useEffect(() => {
    if (typeof window === "undefined") return;
    const today = new Date().toISOString().slice(0, 10);
    const lastDigest = localStorage.getItem("hypher-last-digest-date");
    if (lastDigest !== today && store.projects.length > 0) {
      setShowDigest(true);
    }
  }, [store.projects.length]);

  // Load content mode from localStorage when project changes
  useEffect(() => {
    if (selectedProjectId) {
      const saved = localStorage.getItem(`hypher-view-mode-${selectedProjectId}`);
      if (saved === "canvas" || saved === "list") setContentMode(saved);
      else setContentMode("canvas");
    }
  }, [selectedProjectId]);

  // Save content mode to localStorage
  const toggleContentMode = useCallback(() => {
    if (!selectedProjectId) return;
    const next = contentMode === "canvas" ? "list" : "canvas";
    setContentMode(next);
    if (selectedProjectId) localStorage.setItem(`hypher-view-mode-${selectedProjectId}`, next);
  }, [contentMode, selectedProjectId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (appMode === "workspace") setShowSearch((s) => !s);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        setAppMode("capture");
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "V") {
        e.preventDefault();
        store.captureFromClipboard();
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "d" || e.key === "D") && !e.shiftKey) {
        e.preventDefault();
        setShowDigest(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === "p" || e.key === "P")) {
        e.preventDefault();
        setContentMode("dashboard");
        setSelectedProjectId(null);
        if (appMode !== "workspace") setAppMode("workspace");
      }
      if (e.key === "Escape" && showSearch) {
        setShowSearch(false);
      }
      // Tab toggles canvas/list (only in workspace, not in inputs)
      if (appMode === "workspace" && e.key === "Tab") {
        const tag = (e.target as HTMLElement).tagName;
        if (tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") {
          e.preventDefault();
          toggleContentMode();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showSearch, appMode, store, toggleContentMode]);

  // Rediscovery
  useEffect(() => {
    const surface = () => {
      const item = store.getRediscovery();
      if (!item) return;
      const name = item.kind === "note"
        ? (item as any).content?.slice(0, 50)
        : (item as any).name ?? "an idea";
      const daysAgo = Math.floor((Date.now() - item.createdAt) / 86400000);
      store.addToast(
        `Remember? "${name}" — ${daysAgo}d ago`,
        { label: "View", onClick: () => { store.setSelectedId(item.id); setAppMode("workspace"); } }
      );
      store.markSurfaced(item.id);
    };
    const initial = setTimeout(surface, 3000);
    const interval = setInterval(surface, 600000);
    return () => { clearTimeout(initial); clearInterval(interval); };
  }, [store.objects.length > 0]);

  // File drop — reads images as thumbnails
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    for (const file of Array.from(e.dataTransfer.files)) {
      const artifactType = guessArtifactType(file.name);
      const isImage = artifactType === "image";

      if (isImage) {
        const reader = new FileReader();
        reader.onload = () => {
          // Resize to thumbnail
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement("canvas");
            const maxSize = 400;
            const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;
            const ctx = canvas.getContext("2d")!;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const thumbnailDataUrl = canvas.toDataURL("image/jpeg", 0.7);
            store.addObject({
              id: crypto.randomUUID(),
              kind: "artifact",
              name: file.name.replace(/\.[^/.]+$/, ""),
              type: artifactType,
              fileReference: file.name,
              thumbnailDataUrl,
              createdAt: Date.now(),
              modifiedAt: Date.now(),
              projectId: selectedProjectId,
            });
          };
          img.src = reader.result as string;
        };
        reader.readAsDataURL(file);
      } else {
        store.addObject({
          id: crypto.randomUUID(),
          kind: "artifact",
          name: file.name.replace(/\.[^/.]+$/, ""),
          type: artifactType,
          fileReference: file.name,
          createdAt: Date.now(),
          modifiedAt: Date.now(),
          projectId: selectedProjectId,
        });
      }
    }
  }, [store, selectedProjectId]);

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragOver(true); }, []);
  const handleDragLeave = useCallback(() => setDragOver(false), []);

  // Notion import
  const [notionImported, setNotionImported] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("hypher-notion-imported") === "true";
  });

  const handleNotionImport = useCallback(async () => {
    const seed = generateSeedData();
    store.addToast(`Importing ${seed.length} items from Notion...`);

    // Track client-ID → Convex-ID mapping for project references
    const idMap = new Map<string, string>();

    // First pass: add projects
    for (const obj of seed.filter((o) => o.kind === "project")) {
      const convexId = await store.addObject(obj);
      idMap.set(obj.id, convexId);
    }

    // Second pass: add notes/artifacts with remapped projectIds
    for (const obj of seed.filter((o) => o.kind !== "project")) {
      const remapped = obj.projectId ? { ...obj, projectId: idMap.get(obj.projectId) ?? obj.projectId } : obj;
      await store.addObject(remapped);
    }

    localStorage.setItem("hypher-notion-imported", "true");
    setNotionImported(true);
    store.addToast(`Imported ${seed.length} items from Notion`);
  }, [store]);

  // Capture handlers
  const handleCapture = useCallback(
    async (text: string, projectId?: string | null) => store.addQuickCapture(text, projectId),
    [store]
  );

  const handleAssignCaptured = useCallback(async (noteId: string, projectId: string) => {
    await store.assignToProject(noteId, projectId);
    const project = store.projects.find((p) => p.id === projectId);
    store.addToast(project ? `Sorted into ${project.name}` : "Sorted into project");
  }, [store]);

  const handleKeepInInbox = useCallback(async (noteId: string) => {
    await store.markReviewed(noteId);
    store.addToast("Kept in inbox");
  }, [store]);

  const handleCreateProjectAndCapture = useCallback(async (projectName: string, noteId: string) => {
    const now = Date.now();
    const convexProjectId = await store.addObject({ id: crypto.randomUUID(), kind: "project", name: projectName, description: "", status: "active", createdAt: now, modifiedAt: now });
    await store.assignToProject(noteId, convexProjectId);
    store.addToast(`Sorted into ${projectName}`);
  }, [store]);

  // Canvas create handler
  const handleCreateAtPosition = useCallback((kind: ObjectKind, text: string, x: number, y: number) => {
    const now = Date.now();
    const base = { id: crypto.randomUUID(), createdAt: now, modifiedAt: now, canvasPosition: { x, y }, projectId: selectedProjectId };
    if (kind === "note") store.addObject({ ...base, kind: "note", content: text, maturity: "fleeting" });
    else store.addObject({ ...base, kind: "artifact", name: text, type: "other" });
  }, [store, selectedProjectId]);

  if (!store.clerkLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fafafa] text-[#444]">
        <p className="text-sm tracking-wide">Loading…</p>
      </div>
    );
  }

  // Get items for selected project
  const projectItems = selectedProjectId
    ? (() => {
        const proj = store.projects.find((p) => p.id === selectedProjectId);
        const children = store.objectsForProject(selectedProjectId);
        return proj ? [proj, ...children] : children;
      })()
    : [];
  const projectConnections = store.connections.filter((c) => c.type !== "dismissed");

  // ── CAPTURE MODE ──
  if (appMode === "capture") {
    return (
      <div className="capture-root" onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}>
        <AppChromeNav layout="floating" />
        <CaptureHome
          projects={store.projects}
          allObjects={store.objects}
          onCapture={handleCapture}
          onAssignCaptured={handleAssignCaptured}
          onKeepInInbox={handleKeepInInbox}
          onCreateProjectAndCapture={handleCreateProjectAndCapture}
          onNavigateToWorkspace={() => setAppMode("workspace")}
          onProjectClick={(id) => {
            setSelectedProjectId(id);
            store.setSelectedId(id);
            setAppMode("workspace");
          }}
          onClipboardCapture={store.captureFromClipboard}
          onNotionImport={notionImported ? undefined : handleNotionImport}
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
        {store.modelLoading && (
          <div className="loading-bar"><span className="loading-dot" />Loading embedding model...</div>
        )}
      </div>
    );
  }

  // ── WORKSPACE MODE ──
  return (
    <main className="app-layout-simple" onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}>
      {mobileSidebarOpen ? (
        <button
          type="button"
          className="app-sidebar-backdrop"
          aria-label="Close menu"
          onClick={() => setMobileSidebarOpen(false)}
        />
      ) : null}
      <Sidebar
        projects={store.projects}
        inboxItems={store.inboxItems}
        recentItems={store.recentItems}
        selectedProjectId={selectedProjectId}
        selectedObjectId={store.selectedId}
        onSelectProject={(id) => { setSelectedProjectId(id); store.setSelectedId(id); }}
        onSelectInboxItem={(id) => { store.setSelectedId(id); setSelectedProjectId(null); setContentMode("inbox"); }}
        onSelectRecent={(id) => { store.setSelectedId(id); }}
        onAdd={store.addObject}
        onGoHome={() => { setMobileSidebarOpen(false); setAppMode("capture"); }}
        onDashboard={() => { setContentMode("dashboard"); setSelectedProjectId(null); }}
        onDigest={() => setShowDigest(true)}
        className={mobileSidebarOpen ? "sidebar--drawer-open" : undefined}
        onMobileSidebarClose={() => setMobileSidebarOpen(false)}
      />

      <div className="main-panel">
        <div className="main-toolbar">
          <div className="main-toolbar__start">
            <button
              type="button"
              className="main-toolbar__menu-btn"
              aria-label={mobileSidebarOpen ? "Close projects menu" : "Open projects menu"}
              aria-expanded={mobileSidebarOpen}
              onClick={() => setMobileSidebarOpen((o) => !o)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width={18} height={18} aria-hidden>
                {mobileSidebarOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                )}
              </svg>
            </button>
            <button className="mode-toggle" onClick={toggleContentMode} disabled={!selectedProjectId} title={`Switch to ${contentMode === "canvas" ? "list" : "canvas"} (Tab)`}>
              {contentMode === "canvas" ? (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width={16} height={16}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width={16} height={16}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
                </svg>
              )}
            </button>
          </div>
          <AppChromeNav layout="toolbar" showSearch onSearchClick={() => setShowSearch(true)} />
        </div>

        {contentMode === "dashboard" ? (
          <ProjectDashboard
            projects={store.projects}
            allObjects={store.objects}
            onSelectProject={(id) => {
              setSelectedProjectId(id);
              store.setSelectedId(id);
              setContentMode("canvas");
            }}
          />
        ) : contentMode === "inbox" ? (
          <InboxReviewPanel
            items={store.inboxItems}
            reviewItems={store.reviewItems}
            projects={store.projects}
            selectedId={store.selectedId}
            getSuggestions={store.projectSuggestionsFor}
            onSelect={store.setSelectedId}
            onAssign={async (objectId, projectId) => {
              await store.assignToProject(objectId, projectId);
              const project = store.projects.find((p) => p.id === projectId);
              store.addToast(project ? `Sorted into ${project.name}` : "Sorted into project");
            }}
            onKeepInInbox={async (objectId) => {
              await store.markReviewed(objectId);
              store.addToast("Kept in inbox");
            }}
            onCreateProject={async (objectId, projectName) => {
              const now = Date.now();
              const projectId = await store.addObject({
                id: crypto.randomUUID(),
                kind: "project",
                name: projectName,
                description: "",
                status: "active",
                createdAt: now,
                modifiedAt: now,
              });
              await store.assignToProject(objectId, projectId);
              store.addToast(`Sorted into ${projectName}`);
            }}
          />
        ) : !selectedProjectId ? (
          <div className="workspace-empty">
            <p>Select a project from the sidebar</p>
            <p className="workspace-empty-sub">or press Cmd+N to capture a new thought</p>
          </div>
        ) : contentMode === "canvas" ? (
          <AppErrorBoundary label="Canvas">
            <SpatialCanvas
              project={store.projects.find((p) => p.id === selectedProjectId)}
              convexLoading={store.convexDataLoading}
              items={projectItems}
              connections={projectConnections}
              onSelect={store.setSelectedId}
              onUpdatePosition={store.updatePosition}
              onCreateAtPosition={handleCreateAtPosition}
              onConfirmConnection={store.confirmConnection}
              onDismissConnection={store.dismissConnection}
              onUpdateObject={store.updateObject}
              onDeleteObjects={async (ids) => { for (const id of ids) await store.removeObject(id); }}
              onDuplicateObjects={store.duplicateObjects}
              onRestoreObjects={store.restoreObjects}
              onRestoreConnections={store.restoreConnections}
              onCreateManualConnection={store.createManualConnection}
              onLogView={store.logProjectView}
            />
          </AppErrorBoundary>
        ) : (
          <ListView
            items={projectItems}
            connections={projectConnections}
            onUpdate={store.updateObject}
            onDelete={store.removeObject}
            selectedId={store.selectedId}
            onSelect={store.setSelectedId}
          />
        )}
      </div>

      {showSearch && (
        <SearchDialog
          search={store.search}
          onSelect={(id) => { store.setSelectedId(id); setShowSearch(false); }}
          onClose={() => setShowSearch(false)}
          tags={tags}
          onSelectTag={(tag) => {
            // Search for the tag to show matching items
            store.setSelectedId(null);
            setShowSearch(false);
          }}
        />
      )}

      {showDigest && (
        <AppErrorBoundary label="Digest">
          <DailyDigest
            projects={store.projects}
            allObjects={store.objects}
            demoDigestText={demoDigestText}
            onDismiss={() => {
              setShowDigest(false);
              localStorage.setItem("hypher-last-digest-date", new Date().toISOString().slice(0, 10));
            }}
            onSelectProject={(id) => {
              setSelectedProjectId(id);
              store.setSelectedId(id);
              setContentMode("canvas");
              if (appMode !== "workspace") setAppMode("workspace");
            }}
          />
        </AppErrorBoundary>
      )}

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

      {store.modelLoading && (
        <div className="loading-bar"><span className="loading-dot" />Loading embedding model...</div>
      )}
    </main>
  );
}
