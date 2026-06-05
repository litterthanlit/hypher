"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useStore } from "@/lib/useStore";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { CaptureHome } from "@/components/CaptureHome";
import { Sidebar } from "@/components/Sidebar";
import { SpatialCanvas } from "@/components/SpatialCanvas";
import { ListView } from "@/components/ListView";
import { ProjectDashboard } from "@/components/ProjectDashboard";
import { ProjectPulse } from "@/components/ProjectPulse";
import { AgentInboxPanel } from "@/components/AgentInboxPanel";
import { DailyDigest } from "@/components/DailyDigest";
import { WelcomeOverlay } from "@/components/WelcomeOverlay";
import { OnboardingTour } from "@/components/OnboardingTour";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { SearchDialog } from "@/components/SearchDialog";
import { AppChromeNav } from "@/components/AppChromeNav";
import { HealthRing } from "@/components/HealthRing";
import { InboxReviewPanel } from "@/components/InboxReviewPanel";
import { BetaFeedbackModal } from "@/components/BetaFeedbackModal";
import { CreateForm } from "@/components/CreateForm";
import { generateSeedData } from "@/lib/notion-seed";
import {
  getWorkspaceChromeState,
  getWorkspaceEmptyState,
  type WorkspaceContentMode,
} from "@/lib/activation";
import {
  ONBOARDING_TOUR_STEPS,
  getNextOnboardingTourIndex,
  getOnboardingTourStep,
  shouldRunOnboardingTour,
  shouldShowOnboardingWelcome,
  type OnboardingState,
} from "@/lib/onboarding";
import { toast } from "sonner";
import { computeHealthScore, type HealthInputs } from "@/lib/health";
import type { AgentEvent, AnyObject, ArtifactType, ObjectKind } from "@/types";
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
type ContentMode = WorkspaceContentMode;

export function HypherApp({ gateState }: { gateState: BetaGateState }) {
  const [appMode, setAppMode] = useState<AppMode>("capture");
  const [contentMode, setContentMode] = useState<ContentMode>("pulse");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showDigest, setShowDigest] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [welcomeBusy, setWelcomeBusy] = useState(false);
  const [welcomeDismissedThisSession, setWelcomeDismissedThisSession] = useState(false);
  const [tourActive, setTourActive] = useState(false);
  const [tourStepIndex, setTourStepIndex] = useState(0);
  const [showFeedback, setShowFeedback] = useState(false);
  const needsAllObjects =
    appMode === "capture" ||
    contentMode === "inbox" ||
    showSearch ||
    showDigest;
  const store = useStore({
    selectedProjectId,
    subscribeAllObjects: needsAllObjects,
    subscribeAllActivity: false,
  });
  const skipTags = !store.clerkLoaded || !store.isSignedIn;
  const tagsList = useQuery(api.tags.listWithCounts, skipTags ? "skip" : {});
  const demoDigestText = useQuery(api.seed.getDemoDigest, skipTags ? "skip" : {});
  const createProjectPulseVerificationProject = useMutation(
    // typegen pending convex codegen for local verification seed
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (api.seed as any).createProjectPulseVerificationProject
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const healthInputsList = useQuery((api as any).projects.healthInputs, skipTags ? "skip" : {});
  const agentInbox = useQuery((api as any).agentEvents.listInbox, skipTags ? "skip" : {}) as AgentEvent[] | undefined;
  const projectHealthScores = useMemo(() => {
    if (!healthInputsList) return {} as Record<string, number>;
    const now = Date.now();
    const m: Record<string, number> = {};
    for (const row of healthInputsList as HealthInputs[]) {
      m[row.projectId] = computeHealthScore(row, now).score;
    }
    return m;
  }, [healthInputsList]);

  const digestPreviewText = useMemo(() => {
    const raw = demoDigestText;
    if (typeof raw !== "string" || !raw.trim()) return null;
    const oneLine = raw.replace(/\s+/g, " ").trim();
    return oneLine.length > 160 ? `${oneLine.slice(0, 157)}…` : oneLine;
  }, [demoDigestText]);
  const onboardingState = useQuery(
    // typegen pending convex dev/codegen for this new module
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (api as any).onboarding.getState,
    skipTags ? "skip" : {}
  ) as OnboardingState | undefined;
  // typegen pending convex dev/codegen for this new module
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markWelcomeSeen = useMutation((api as any).onboarding.markWelcomeSeen);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markTourCompleted = useMutation((api as any).onboarding.markTourCompleted);
  const tags = useMemo(() => tagsList ?? [], [tagsList]);
  const onboardingReady = skipTags || onboardingState !== undefined;
  const welcomeVisible =
    !welcomeDismissedThisSession &&
    shouldShowOnboardingWelcome(onboardingState, {
      isSignedIn: store.isSignedIn,
      isReady: onboardingReady && !store.convexDataLoading,
      hasWorkspaceData: store.projects.length > 0,
    });
  const tourStep = tourActive ? getOnboardingTourStep(tourStepIndex) : null;
  const onboardingTourShouldRun = shouldRunOnboardingTour(onboardingState);

  // Server /capture route redirects here with ?project=…&toast=captured (or /app/p/:id → /app?project=…)
  useEffect(() => {
    if (typeof window === "undefined" || !store.clerkLoaded) return;
    const params = new URLSearchParams(window.location.search);
    const pid = params.get("project");
    if (pid) {
      setSelectedProjectId(pid);
      store.setSelectedId(pid);
      setAppMode("workspace");
      setContentMode("pulse");
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

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    if (typeof window === "undefined" || !store.clerkLoaded || !store.isSignedIn) return;

    const params = new URLSearchParams(window.location.search);
    if (params.get("demo") !== "project-pulse") return;

    params.delete("demo");
    const next = params.toString();
    window.history.replaceState({}, "", next ? `/app?${next}` : "/app");

    let cancelled = false;
    const run = async () => {
      try {
        const result = await createProjectPulseVerificationProject() as { projectId?: string } | null;
        if (cancelled || !result?.projectId) return;
        setSelectedProjectId(result.projectId);
        store.setSelectedId(result.projectId);
        setAppMode("workspace");
        setContentMode("pulse");
        localStorage.setItem(`hypher-view-mode-${result.projectId}`, "pulse");
        toast.success("Project Pulse demo ready");
      } catch (err) {
        console.error("[seed] project pulse verification", err);
        toast.error("Could not seed Project Pulse demo");
      }
    };
    void run();

    return () => {
      cancelled = true;
    };
  }, [createProjectPulseVerificationProject, store.clerkLoaded, store.isSignedIn]);

  // Auto-show digest on first open of the day
  useEffect(() => {
    if (typeof window === "undefined") return;
    const today = new Date().toISOString().slice(0, 10);
    const lastDigest = localStorage.getItem("hypher-last-digest-date");
    if (
      lastDigest !== today &&
      store.projects.length > 0 &&
      onboardingReady &&
      !welcomeVisible &&
      !tourActive &&
      !onboardingTourShouldRun
    ) {
      setShowDigest(true);
    }
  }, [store.projects.length, onboardingReady, welcomeVisible, tourActive, onboardingTourShouldRun]);

  useEffect(() => {
    if (welcomeVisible || tourActive || !onboardingTourShouldRun) return;
    setTourStepIndex(0);
    setTourActive(true);
  }, [welcomeVisible, tourActive, onboardingTourShouldRun]);

  useEffect(() => {
    if (!tourActive || !tourStep) return;
    setShowDigest(false);
    setMobileSidebarOpen(false);
    if (tourStep.destination === "capture") {
      setAppMode("capture");
      return;
    }
    setAppMode("workspace");
    setContentMode("dashboard");
    setSelectedProjectId(null);
  }, [tourActive, tourStep?.id, tourStep?.destination]);

  // Load content mode from localStorage when project changes
  useEffect(() => {
    if (selectedProjectId) {
      const saved = localStorage.getItem(`hypher-view-mode-${selectedProjectId}`);
      if (saved === "pulse" || saved === "canvas" || saved === "list") setContentMode(saved);
      else setContentMode("pulse");
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
    if (!store.hasFullObjectSubscription) return;
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
  }, [store.hasFullObjectSubscription, store.objects.length > 0]);

  const ingestLocalFiles = useCallback(
    (
      files: File[],
      projectId: string | null,
      opts?: { canvasAnchor?: { x: number; y: number } },
    ) => {
      const anchor = opts?.canvasAnchor;
      files.forEach((file, index) => {
        const canvasPosition = anchor
          ? { x: anchor.x + index * 36, y: anchor.y + index * 28 }
          : undefined;
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
          ...(canvasPosition ? { canvasPosition } : {}),
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

  const handleCanvasFileImport = useCallback(
    (files: File[], canvasX: number, canvasY: number) => {
      if (!selectedProjectId) return;
      ingestLocalFiles(files, selectedProjectId, { canvasAnchor: { x: canvasX, y: canvasY } });
      toast.success(files.length === 1 ? "Added to canvas" : `Added ${files.length} files to canvas`);
    },
    [ingestLocalFiles, selectedProjectId],
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

  const handleCreateProject = useCallback(async (obj: AnyObject) => {
    const id = await store.addObject(obj);
    setShowCreateProject(false);
    if (obj.kind === "project") {
      setSelectedProjectId(id);
      store.setSelectedId(id);
      setContentMode("pulse");
      setAppMode("workspace");
      localStorage.setItem(`hypher-view-mode-${id}`, "pulse");
    }
  }, [store]);

  const handleCreateProjectFromCapture = useCallback(async (objectId: string, projectName: string) => {
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
  }, [store]);

  const handleMergeCurrentProject = useCallback(async (targetProjectId: string) => {
    if (!selectedProjectId) return;
    const current = store.projects.find((candidate) => candidate.id === selectedProjectId);
    if (!current) return;
    const children = store.objectsForProject(selectedProjectId);
    for (const child of children) {
      await store.assignToProject(child.id, targetProjectId);
    }
    await store.updateObject({ ...current, status: "archived", modifiedAt: Date.now() });
    setSelectedProjectId(targetProjectId);
    store.setSelectedId(targetProjectId);
    setContentMode("pulse");
  }, [selectedProjectId, store]);

  const handleStartOnboardingTour = useCallback(async () => {
    setWelcomeBusy(true);
    try {
      await markWelcomeSeen();
      setWelcomeDismissedThisSession(true);
      setTourStepIndex(0);
      setTourActive(true);
    } catch (err) {
      console.error("[onboarding] mark welcome seen", err);
      toast.error("Could not start onboarding");
    } finally {
      setWelcomeBusy(false);
    }
  }, [markWelcomeSeen]);

  const handleExploreSelf = useCallback(async () => {
    setWelcomeBusy(true);
    try {
      await markTourCompleted();
      setWelcomeDismissedThisSession(true);
      setTourActive(false);
      setTourStepIndex(0);
    } catch (err) {
      console.error("[onboarding] mark tour complete", err);
      toast.error("Could not dismiss onboarding");
    } finally {
      setWelcomeBusy(false);
    }
  }, [markTourCompleted]);

  const completeTour = useCallback(async () => {
    try {
      await markTourCompleted();
      setTourActive(false);
      setTourStepIndex(0);
    } catch (err) {
      console.error("[onboarding] complete tour", err);
      toast.error("Could not save onboarding progress");
    }
  }, [markTourCompleted]);

  const handleTourNext = useCallback(() => {
    const next = getNextOnboardingTourIndex(tourStepIndex);
    if (next === null) {
      void completeTour();
      return;
    }
    setTourStepIndex(next);
  }, [completeTour, tourStepIndex]);

  // Canvas create handler
  const handleCreateAtPosition = useCallback((kind: ObjectKind, text: string, x: number, y: number) => {
    const now = Date.now();
    const base = { id: crypto.randomUUID(), createdAt: now, modifiedAt: now, canvasPosition: { x, y }, projectId: selectedProjectId };
    if (kind === "note") store.addObject({ ...base, kind: "note", content: text, maturity: "fleeting" });
    else store.addObject({ ...base, kind: "artifact", name: text, type: "other" });
  }, [store, selectedProjectId]);

  if (!store.clerkLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-root)] text-[var(--text-secondary)]">
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
  const currentProject = selectedProjectId ? store.projects.find((p) => p.id === selectedProjectId) : null;
  const toolbarHealthScore =
    selectedProjectId && projectHealthScores[selectedProjectId] != null
      ? projectHealthScores[selectedProjectId]!
      : null;
  const workspaceChromeState = getWorkspaceChromeState({
    projectCount: store.projects.length,
    selectedProjectId,
    contentMode,
  });
  const workspaceEmptyState = getWorkspaceEmptyState({
    projectCount: store.projects.length,
    selectedProjectId,
    contentMode,
  });
  const onboardingUi = (
    <>
      <WelcomeOverlay
        visible={welcomeVisible}
        busy={welcomeBusy}
        onShowTour={handleStartOnboardingTour}
        onExploreSelf={handleExploreSelf}
      />
      <OnboardingTour
        step={tourStep}
        stepIndex={tourStepIndex}
        totalSteps={ONBOARDING_TOUR_STEPS.length}
        onNext={handleTourNext}
        onSkip={completeTour}
      />
    </>
  );
  const createProjectModal = showCreateProject ? (
    <CreateForm
      kind="project"
      onSubmit={(obj) => void handleCreateProject(obj)}
      onCancel={() => setShowCreateProject(false)}
    />
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
          onProjectClick={(id) => {
            setSelectedProjectId(id);
            store.setSelectedId(id);
            setContentMode("pulse");
            localStorage.setItem(`hypher-view-mode-${id}`, "pulse");
            setAppMode("workspace");
          }}
          onClipboardCapture={store.captureFromClipboard}
          onNotionImport={notionImported ? undefined : handleNotionImport}
          onSearchClick={() => setShowSearch(true)}
          onDigestClick={() => setShowDigest(true)}
          digestPreviewText={digestPreviewText}
          projectHealthScores={projectHealthScores}
          onAddFiles={handleAddCaptureFiles}
        />
        <button type="button" className="beta-feedback-floating" onClick={() => setShowFeedback(true)}>
          Feedback
        </button>
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
        {showSearch && (
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
                setAppMode("workspace");
              }}
            />
          </AppErrorBoundary>
        )}
        {onboardingUi}
        {createProjectModal}
        <BetaFeedbackModal visible={showFeedback} onClose={() => setShowFeedback(false)} />
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
        onSelectProject={(id) => {
          setSelectedProjectId(id);
          store.setSelectedId(id);
          setContentMode("pulse");
          localStorage.setItem(`hypher-view-mode-${id}`, "pulse");
        }}
        onSelectInboxItem={(id) => { store.setSelectedId(id); setSelectedProjectId(null); setContentMode("inbox"); }}
        onSelectRecent={(id) => { store.setSelectedId(id); }}
        onAdd={store.addObject}
        onGoHome={() => { setMobileSidebarOpen(false); setAppMode("capture"); }}
        onDashboard={() => { setContentMode("dashboard"); setSelectedProjectId(null); }}
        onDigest={() => setShowDigest(true)}
        agentInboxCount={agentInbox?.length ?? 0}
        onAgentInbox={() => { setContentMode("agent-inbox"); setSelectedProjectId(null); }}
        onFeedback={() => setShowFeedback(true)}
        showBetaAdmin={gateState.isAdmin}
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
              aria-label="Back to capture home"
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
                  ? "projects"
                  : contentMode === "agent-inbox"
                    ? "agent inbox"
                  : contentMode === "inbox"
                    ? "inbox"
                    : currentProject?.name ?? workspaceChromeState.currentLabel}
              </span>
            </nav>
          </div>

          <div className="workspace-chrome__center">
            {workspaceChromeState.showProjectViewTabs ? (
              <div className="workspace-view-toggle" role="tablist" aria-label="Project view">
                <button
                  type="button"
                  role="tab"
                  aria-selected={contentMode === "pulse"}
                  className={contentMode === "pulse" ? "is-active" : ""}
                  onClick={() => {
                    setContentMode("pulse");
                    if (selectedProjectId) localStorage.setItem(`hypher-view-mode-${selectedProjectId}`, "pulse");
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
                    <path d="M2.5 8h2l1.25-3 2.5 6 1.5-3H13.5" />
                  </svg>
                  pulse
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={contentMode === "canvas"}
                  className={contentMode === "canvas" ? "is-active" : ""}
                  onClick={() => {
                    setContentMode("canvas");
                    if (selectedProjectId) localStorage.setItem(`hypher-view-mode-${selectedProjectId}`, "canvas");
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
                    <circle cx="4" cy="4" r="1.5" />
                    <circle cx="12" cy="6" r="1.5" />
                    <circle cx="6" cy="12" r="1.5" />
                    <circle cx="12" cy="12" r="1.5" />
                  </svg>
                  canvas
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={contentMode === "list"}
                  className={contentMode === "list" ? "is-active" : ""}
                  onClick={() => {
                    setContentMode("list");
                    if (selectedProjectId) localStorage.setItem(`hypher-view-mode-${selectedProjectId}`, "list");
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
                    <line x1="3" y1="4" x2="13" y2="4" />
                    <line x1="3" y1="8" x2="13" y2="8" />
                    <line x1="3" y1="12" x2="13" y2="12" />
                  </svg>
                  list
                </button>
              </div>
            ) : null}
          </div>

          <div className="workspace-chrome__right">
            {toolbarHealthScore != null && selectedProjectId ? (
              <div className="workspace-health-pill">
                <HealthRing score={toolbarHealthScore} size={18} strokeWidth={2} />
                <span>{toolbarHealthScore}%</span>
              </div>
            ) : null}
            {store.projects.length > 0 ? (
              <button type="button" className="workspace-chrome-icon" aria-label="Daily digest" title="Digest (⌘D)" onClick={() => setShowDigest(true)}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <rect x="2" y="3" width="12" height="10" rx="1.5" />
                  <path d="M2 5 8 9l6-4" />
                </svg>
              </button>
            ) : null}
            {selectedProjectId && contentMode === "canvas" ? (
              <button
                type="button"
                className="workspace-chrome-icon workspace-chrome-icon--on"
                aria-label="Ambient Ask"
                title="Ambient Ask — uses items near the center of the canvas"
                onClick={() => window.dispatchEvent(new Event("hypher-open-ambient-ask"))}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <circle cx="8" cy="8" r="6" />
                  <path d="M8 11v.01" />
                  <path d="M6.5 6.5a1.5 1.5 0 0 1 3 0c0 1-1.5 1.5-1.5 2.5" />
                </svg>
              </button>
            ) : null}
            {selectedProjectId ? (
              <button
                type="button"
                className="workspace-share-btn"
                onClick={() => window.dispatchEvent(new Event("hypher-open-project-settings"))}
              >
                share
              </button>
            ) : null}
            <AppChromeNav
              layout="toolbar"
              showSearch
              onSearchClick={() => setShowSearch(true)}
              onFeedbackClick={() => setShowFeedback(true)}
              showBetaAdmin={gateState.isAdmin}
            />
          </div>
        </div>

        {workspaceEmptyState ? (
          <div className="workspace-empty">
            <p>{workspaceEmptyState.title}</p>
            <p className="workspace-empty-sub">{workspaceEmptyState.body}</p>
            <div className="workspace-empty-actions">
              <button type="button" className="workspace-empty-btn workspace-empty-btn--primary" onClick={() => setAppMode("capture")}>
                Go to capture
              </button>
              {workspaceEmptyState.secondaryAction === "manual_project" ? (
                <button type="button" className="workspace-empty-btn" onClick={() => setShowCreateProject(true)}>
                  Create first project
                </button>
              ) : null}
            </div>
          </div>
        ) : contentMode === "dashboard" ? (
          <ProjectDashboard
            projects={store.projects}
            onSelectProject={(id) => {
              setSelectedProjectId(id);
              store.setSelectedId(id);
              setContentMode("pulse");
              localStorage.setItem(`hypher-view-mode-${id}`, "pulse");
            }}
          />
        ) : contentMode === "agent-inbox" ? (
          <AgentInboxPanel events={agentInbox ?? []} projects={store.projects} />
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
        ) : selectedProjectId && !currentProject ? (
          <div className="workspace-empty">
            <p>Loading project pulse</p>
            <p className="workspace-empty-sub">Hypher is getting this project ready.</p>
          </div>
        ) : contentMode === "pulse" && currentProject ? (
          <ProjectPulse
            project={currentProject}
            allObjects={projectItems}
            activity={store.activity}
            healthScore={toolbarHealthScore}
            projects={store.projects}
            onOpenCanvas={() => {
              setContentMode("canvas");
              if (selectedProjectId) localStorage.setItem(`hypher-view-mode-${selectedProjectId}`, "canvas");
            }}
            onOpenList={() => {
              setContentMode("list");
              if (selectedProjectId) localStorage.setItem(`hypher-view-mode-${selectedProjectId}`, "list");
            }}
            onCapture={() => setAppMode("capture")}
            onSelectItem={(id) => {
              store.setSelectedId(id);
              setContentMode("list");
              if (selectedProjectId) localStorage.setItem(`hypher-view-mode-${selectedProjectId}`, "list");
            }}
            onMoveCapture={async (objectId, projectId) => {
              await store.assignToProject(objectId, projectId);
              const project = store.projects.find((candidate) => candidate.id === projectId);
              store.addToast(project ? `Moved to ${project.name}` : "Capture moved");
            }}
            onArchiveCapture={store.markCaptureArchived}
            onUpdateCapture={store.updateCaptureMeta}
            onCreateProjectFromCapture={handleCreateProjectFromCapture}
            onMergeProject={handleMergeCurrentProject}
          />
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
              onImportFilesAtCanvas={handleCanvasFileImport}
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

      {showDigest && store.hasFullObjectSubscription && (
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
              setContentMode("pulse");
              localStorage.setItem(`hypher-view-mode-${id}`, "pulse");
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
      {onboardingUi}
      {createProjectModal}
      <BetaFeedbackModal visible={showFeedback} onClose={() => setShowFeedback(false)} />
    </main>
  );
}
