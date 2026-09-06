"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useStore } from "@/lib/useStore";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { CaptureHome } from "@/components/CaptureHome";
import { Sidebar } from "@/components/Sidebar";
import { ProjectDashboard } from "@/components/ProjectDashboard";
import { ProjectPulse } from "@/components/ProjectPulse";
import { AgentInboxPanel } from "@/components/AgentInboxPanel";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { SearchDialog } from "@/components/SearchDialog";
import { AppChromeNav } from "@/components/AppChromeNav";
import { CreateForm } from "@/components/CreateForm";
import { toast } from "sonner";
import type { AgentEvent, AnyObject, ArtifactType } from "@/types";
import type { BetaGateState } from "@/lib/beta";

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
type ContentMode = "pulse" | "dashboard" | "agent-inbox";

export function HypherApp({ gateState }: { gateState: BetaGateState }) {
  const [appMode, setAppMode] = useState<AppMode>("capture");
  const [contentMode, setContentMode] = useState<ContentMode>("pulse");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);

  const needsAllObjects = appMode === "capture" || showSearch;
  const store = useStore({
    selectedProjectId,
    subscribeAllObjects: needsAllObjects,
    subscribeAllActivity: false,
  });
  const skipTags = store.skipConvex;
  const tagsList = useQuery(api.tags.listWithCounts, skipTags ? "skip" : {});
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const agentInbox = useQuery((api as any).agentEvents.listInbox, skipTags ? "skip" : {}) as AgentEvent[] | undefined;
  const tags = useMemo(() => tagsList ?? [], [tagsList]);

  // Server /capture route redirects here with ?project=…&toast=captured (or /app/p/:id → /app?project=…)
  useEffect(() => {
    if (typeof window === "undefined" || !store.clerkLoaded) return;
    const params = new URLSearchParams(window.location.search);
    const pid = params.get("project");
    if (pid) {
      setSelectedProjectId(pid);
      store.setSelectedId(pid);
      setContentMode("pulse");
      setAppMode("workspace");
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

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowSearch((s) => !s);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        setAppMode("capture");
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "V") {
        e.preventDefault();
        store.captureFromClipboard();
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === "p" || e.key === "P")) {
        e.preventDefault();
        setSelectedProjectId(null);
        setContentMode("dashboard");
        if (appMode !== "workspace") setAppMode("workspace");
      }
      if (e.key === "Escape" && showSearch) {
        setShowSearch(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showSearch, appMode, store]);

  const ingestLocalFiles = useCallback(
    (files: File[], projectId: string | null) => {
      files.forEach((file) => {
        const artifactType = guessArtifactType(file.name);
        const isImage = artifactType === "image";
        const baseArtifact = {
          id: crypto.randomUUID(),
          kind: "artifact" as const,
          name: file.name.replace(/\.[^/.]+$/, ""),
          type: artifactType,
          fileReference: file.name,
          createdAt: Date.now(),
          modifiedAt: Date.now(),
          projectId,
        };

        if (isImage) {
          const reader = new FileReader();
          reader.onload = () => {
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
              void store.addObject({
                ...baseArtifact,
                thumbnailDataUrl,
              });
            };
            img.src = reader.result as string;
          };
          reader.readAsDataURL(file);
        } else {
          void store.addObject(baseArtifact);
        }
      });
    },
    [store],
  );

  const handleAddCaptureFiles = useCallback(
    (files: File[]) => {
      ingestLocalFiles(files, null);
      toast.success(files.length === 1 ? "Added file to inbox" : `Added ${files.length} files to inbox`);
    },
    [ingestLocalFiles],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      ingestLocalFiles(Array.from(e.dataTransfer.files), selectedProjectId);
    },
    [ingestLocalFiles, selectedProjectId]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragOver(true); }, []);
  const handleDragLeave = useCallback(() => setDragOver(false), []);

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

  const handleCreateProject = useCallback(async (obj: AnyObject) => {
    const id = await store.addObject(obj);
    setShowCreateProject(false);
    if (obj.kind === "project") {
      setSelectedProjectId(id);
      store.setSelectedId(id);
      setContentMode("pulse");
      setAppMode("workspace");
    }
  }, [store]);

  const openProject = useCallback((id: string) => {
    setSelectedProjectId(id);
    store.setSelectedId(id);
    setContentMode("pulse");
    setAppMode("workspace");
  }, [store]);

  if (!store.clerkLoaded) {
    return (
      <div className="marketing-root auth-screen">
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
  const currentProject = selectedProjectId ? store.projects.find((p) => p.id === selectedProjectId) : null;
  const createProjectModal = showCreateProject ? (
    <CreateForm
      kind="project"
      onSubmit={(obj) => void handleCreateProject(obj)}
      onCancel={() => setShowCreateProject(false)}
    />
  ) : null;
  const searchDialog = showSearch ? (
    <SearchDialog
      search={store.search}
      onSelect={(id) => {
        store.setSelectedId(id);
        setShowSearch(false);
      }}
      onClose={() => setShowSearch(false)}
      tags={tags}
      onSelectTag={() => {
        store.setSelectedId(null);
        setShowSearch(false);
      }}
    />
  ) : null;
  const dropOverlay = dragOver ? (
    <div className="drop-overlay">
      <div className="drop-content">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width={32} height={32}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
        </svg>
        <p>Drop files to create artifacts</p>
      </div>
    </div>
  ) : null;

  // ── CAPTURE MODE ──
  if (appMode === "capture") {
    return (
      <div className="capture-root" onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}>
        <CaptureHome
          projects={store.projects}
          allObjects={store.objects}
          onCapture={handleCapture}
          onAssignCaptured={handleAssignCaptured}
          onKeepInInbox={handleKeepInInbox}
          onCreateProjectAndCapture={handleCreateProjectAndCapture}
          onNavigateToWorkspace={() => setAppMode("workspace")}
          onCreateProject={() => setShowCreateProject(true)}
          onProjectClick={openProject}
          onClipboardCapture={store.captureFromClipboard}
          onSearchClick={() => setShowSearch(true)}
          onAddFiles={handleAddCaptureFiles}
        />
        {dropOverlay}
        {store.modelLoading && (
          <div className="loading-bar"><span className="loading-dot" />Loading embedding model...</div>
        )}
        {searchDialog}
        {createProjectModal}
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
        selectedProjectId={selectedProjectId}
        onSelectProject={(id) => {
          setSelectedProjectId(id);
          store.setSelectedId(id);
          setContentMode("pulse");
        }}
        onAdd={store.addObject}
        onGoHome={() => { setMobileSidebarOpen(false); setAppMode("capture"); }}
        onDashboard={() => {
          setSelectedProjectId(null);
          setContentMode("dashboard");
        }}
        agentInboxCount={agentInbox?.length ?? 0}
        onAgentInbox={() => {
          setSelectedProjectId(null);
          setContentMode("agent-inbox");
        }}
        showBetaAdmin={gateState.isAdmin}
        activeSection={
          contentMode === "dashboard" && !selectedProjectId
            ? "projects"
            : contentMode === "agent-inbox"
              ? "agent"
              : "project"
        }
        className={mobileSidebarOpen ? "sidebar--drawer-open" : undefined}
        onMobileSidebarClose={() => setMobileSidebarOpen(false)}
      />

      <div className="main-panel">
        <div className="main-toolbar workspace-chrome">
          <div className="workspace-chrome__left">
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
            <button
              type="button"
              className="workspace-chrome-back"
              aria-label="Back to home"
              title="Home (⌘N)"
              onClick={() => {
                setMobileSidebarOpen(false);
                setAppMode("capture");
              }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M10 3 5 8l5 5" />
              </svg>
            </button>
            <nav className="workspace-breadcrumb" aria-label="Breadcrumb">
              <span className="workspace-breadcrumb__brand">hypher</span>
              <span className="workspace-breadcrumb__sep">/</span>
              <span className="workspace-breadcrumb__current">
                {contentMode === "dashboard"
                  ? "Projects"
                  : contentMode === "agent-inbox"
                    ? "Inbox"
                    : currentProject?.name ?? "Pulse"}
              </span>
            </nav>
          </div>

          <div className="workspace-chrome__right">
            <AppChromeNav
              layout="toolbar"
              showSearch
              onSearchClick={() => setShowSearch(true)}
              showBetaAdmin={gateState.isAdmin}
            />
          </div>
        </div>

        {store.projects.length === 0 && contentMode !== "agent-inbox" ? (
          <div className="workspace-empty">
            <p>No pulse yet</p>
            <p className="workspace-empty-sub">Give it a scrap of context first. Hypher will put it on a project.</p>
            <div className="workspace-empty-actions">
              <button type="button" className="workspace-empty-btn workspace-empty-btn--primary" onClick={() => setAppMode("capture")}>
                Home
              </button>
              <button type="button" className="workspace-empty-btn" onClick={() => setShowCreateProject(true)}>
                Create first project
              </button>
            </div>
          </div>
        ) : contentMode === "dashboard" || (!selectedProjectId && contentMode === "pulse") ? (
          <ProjectDashboard
            projects={store.projects}
            onSelectProject={(id) => {
              setSelectedProjectId(id);
              store.setSelectedId(id);
              setContentMode("pulse");
            }}
          />
        ) : contentMode === "agent-inbox" ? (
          <AgentInboxPanel events={agentInbox ?? []} projects={store.projects} />
        ) : selectedProjectId && !currentProject ? (
          <div className="workspace-empty">
            <p>Loading project pulse</p>
            <p className="workspace-empty-sub">Hypher is getting this project ready.</p>
          </div>
        ) : currentProject ? (
          <AppErrorBoundary label="Project Pulse">
            <ProjectPulse
              project={currentProject}
              allObjects={projectItems}
              activity={store.activity}
              onCapture={() => setAppMode("capture")}
              onUpdateCapture={store.updateCaptureMeta}
            />
          </AppErrorBoundary>
        ) : null}
      </div>

      {searchDialog}
      {dropOverlay}
      {store.modelLoading && (
        <div className="loading-bar"><span className="loading-dot" />Loading embedding model...</div>
      )}
      {createProjectModal}
    </main>
  );
}
