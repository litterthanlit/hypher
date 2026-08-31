"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useUser } from "@clerk/nextjs";
import { UserButton } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { CaptureResult, Project, ProjectSuggestion, AnyObject, ProjectMemory } from "@/types";
import { ProjectAssignPopup } from "./ProjectAssignPopup";
import { ONBOARDING_TARGETS } from "@/lib/onboarding";
import { HealthRing } from "./HealthRing";
import { getCaptureEmptyState, getFirstUseActivationRail } from "@/lib/activation";
import { toast } from "sonner";
import { AppClock } from "./AppClock";
import { HypherLockup } from "./HypherLockup";

interface Props {
  projects: Project[];
  allObjects: AnyObject[];
  onCapture: (text: string, projectId?: string | null) => Promise<CaptureResult>;
  onAssignCaptured: (noteId: string, projectId: string) => Promise<void>;
  onKeepInInbox: (noteId: string) => Promise<void>;
  onCreateProjectAndCapture: (projectName: string, noteId: string) => Promise<void>;
  onNavigateToWorkspace: () => void;
  onCreateProject?: () => void;
  onProjectClick: (projectId: string) => void;
  onClipboardCapture?: () => void;
  onNotionImport?: () => void;
  onSearchClick?: () => void;
  onDigestClick?: () => void;
  digestPreviewText?: string | null;
  /** Convex project id → health score 0–100 */
  projectHealthScores?: Record<string, number>;
  onAddFiles?: (files: File[]) => void | Promise<void>;
}

type CaptureStep = "idle" | "assigning";
type VoiceCaptureState = "idle" | "recording" | "transcribing";

const FIRST_USE_RAIL_STORAGE_KEY = "hypher-first-use-activation-complete";
const RECORDER_MIME_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];

function weekdayPart(): string {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return days[new Date().getDay()];
}

function daypartLabel(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "night";
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 22) return "evening";
  return "night";
}

function formatRelative(ms: number): string {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "yesterday";
  if (d < 7) return `${d}d ago`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

function itemLabel(o: AnyObject): string {
  if (o.kind === "note") return ((o as import("@/types").Note).content ?? "").slice(0, 48) || "Note";
  if (o.kind === "artifact") return (o as import("@/types").Artifact).name || "File";
  return "Item";
}

function getRecorderMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") return undefined;
  return RECORDER_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
}

function extensionForMimeType(mimeType: string): string {
  if (mimeType.includes("mp4")) return "m4a";
  return "webm";
}

function voiceErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return "Voice capture failed.";
  if (error.message === "no-openai-api-key") return "Voice capture needs OPENAI_API_KEY on the server.";
  if (error.message === "audio-too-large") return "Voice capture is limited to 25 MB.";
  if (error.message === "rate-limited") return "Voice capture is rate-limited. Try again soon.";
  if (error.message === "empty-transcript") return "No speech was detected.";
  if (error.name === "NotAllowedError") return "Microphone access was blocked.";
  return "Voice capture failed.";
}

export function CaptureHome({
  projects,
  allObjects,
  onCapture,
  onAssignCaptured,
  onKeepInInbox,
  onCreateProjectAndCapture,
  onNavigateToWorkspace,
  onCreateProject,
  onProjectClick,
  onClipboardCapture,
  onNotionImport,
  onSearchClick,
  onDigestClick,
  digestPreviewText,
  projectHealthScores = {},
  onAddFiles,
}: Props) {
  const { user } = useUser();
  const firstName = user?.firstName || user?.username || "there";

  const [text, setText] = useState("");
  const [step, setStep] = useState<CaptureStep>("idle");
  const [aiSuggestions, setAiSuggestions] = useState<ProjectSuggestion[]>([]);
  const [capturedText, setCapturedText] = useState("");
  const [capturedNoteId, setCapturedNoteId] = useState<string | null>(null);
  const [isDragNear, setIsDragNear] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceCaptureState>("idle");
  const [activationRailHidden, setActivationRailHidden] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(FIRST_USE_RAIL_STORAGE_KEY) === "true";
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
  const voiceStreamRef = useRef<MediaStream | null>(null);
  const voiceAbortRef = useRef<AbortController | null>(null);
  const memories = useQuery((api as any).projectMemories.listForDashboard) as ProjectMemory[] | undefined;

  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => b.modifiedAt - a.modifiedAt),
    [projects]
  );

  const activeCount = projects.filter((p) => p.status === "active").length;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onDragEnter = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("Files")) setIsDragNear(true);
    };
    const onDragLeave = (e: DragEvent) => {
      if (e.relatedTarget === null) setIsDragNear(false);
    };
    const onDrop = () => setIsDragNear(false);
    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, []);

  useEffect(() => {
    return () => {
      voiceAbortRef.current?.abort();
      const recorder = mediaRecorderRef.current;
      if (recorder?.state === "recording") {
        recorder.onstop = null;
        recorder.stop();
      }
      voiceStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    if (step === "idle") inputRef.current?.focus();
  }, [step]);

  const captureTextForReview = useCallback(async (trimmed: string) => {
    setCapturedText(trimmed);
    const result = await onCapture(trimmed, null);
    setCapturedNoteId(result.noteId);
    setAiSuggestions(result.suggestions);
    setStep("assigning");
  }, [onCapture]);

  const handleSubmit = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || voiceState === "transcribing") return;
    await captureTextForReview(trimmed);
    setText("");
  }, [captureTextForReview, text, voiceState]);

  const transcribeVoice = useCallback(async (blob: Blob) => {
    const mimeType = blob.type || "audio/webm";
    const extension = extensionForMimeType(mimeType);
    const file = new File([blob], `hypher-voice-${Date.now()}.${extension}`, { type: mimeType });
    const form = new FormData();
    form.append("audio", file);

    const controller = new AbortController();
    voiceAbortRef.current = controller;

    try {
      const response = await fetch("/api/voice/transcribe", {
        method: "POST",
        body: form,
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => ({})) as { text?: unknown; error?: unknown };
      if (!response.ok) {
        throw new Error(typeof payload.error === "string" ? payload.error : "transcription-failed");
      }
      const captureText = typeof payload.text === "string" ? payload.text.trim() : "";
      if (!captureText) throw new Error("empty-transcript");
      await captureTextForReview(captureText);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        toast.error(voiceErrorMessage(error));
      }
    } finally {
      voiceAbortRef.current = null;
      setVoiceState("idle");
    }
  }, [captureTextForReview]);

  const stopVoiceStream = useCallback(() => {
    voiceStreamRef.current?.getTracks().forEach((track) => track.stop());
    voiceStreamRef.current = null;
  }, []);

  const startVoiceRecording = useCallback(async () => {
    if (step !== "idle" || voiceState !== "idle") return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      toast.error("Voice capture is not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      const mimeType = getRecorderMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      voiceStreamRef.current = stream;
      voiceChunksRef.current = [];
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) voiceChunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        stopVoiceStream();
        setVoiceState("idle");
        toast.error("Voice capture failed.");
      };
      recorder.onstop = () => {
        const chunks = voiceChunksRef.current;
        voiceChunksRef.current = [];
        mediaRecorderRef.current = null;
        stopVoiceStream();

        if (chunks.length === 0) {
          setVoiceState("idle");
          toast.error("No audio was recorded.");
          return;
        }

        setVoiceState("transcribing");
        void transcribeVoice(new Blob(chunks, { type: recorder.mimeType || mimeType || "audio/webm" }));
      };

      recorder.start();
      setVoiceState("recording");
    } catch (error) {
      stopVoiceStream();
      setVoiceState("idle");
      toast.error(voiceErrorMessage(error));
    }
  }, [step, stopVoiceStream, transcribeVoice, voiceState]);

  const stopVoiceRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "recording") return;
    recorder.stop();
  }, []);

  const handleVoiceClick = useCallback(() => {
    if (voiceState === "recording") {
      stopVoiceRecording();
      return;
    }
    void startVoiceRecording();
  }, [startVoiceRecording, stopVoiceRecording, voiceState]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit();
    }
  };

  const resetAssignState = () => {
    setStep("idle");
    setCapturedText("");
    setCapturedNoteId(null);
    setAiSuggestions([]);
  };

  const handleAssign = async (projectId: string) => {
    if (!capturedNoteId) return;
    await onAssignCaptured(capturedNoteId, projectId);
    resetAssignState();
  };

  const handleInbox = async () => {
    if (capturedNoteId) await onKeepInInbox(capturedNoteId);
    resetAssignState();
  };

  const handleDismiss = () => {
    resetAssignState();
  };

  const handleNewProject = async (name: string) => {
    if (!capturedNoteId) return;
    await onCreateProjectAndCapture(name, capturedNoteId);
    resetAssignState();
  };

  const primary = sortedProjects[0];
  const secondary = sortedProjects.slice(1, 4);
  const emptyState = getCaptureEmptyState(projects.length);
  const firstUseRail = useMemo(() => {
    const projectIds = new Set(projects.map((project) => project.id));
    const captureCount = allObjects.filter((object) => object.kind !== "project").length;
    const sortedCaptureCount = allObjects.filter(
      (object) => object.kind !== "project" && object.projectId && projectIds.has(object.projectId)
    ).length;
    const projectMemories = (memories ?? []).filter(
      (memory) => projectIds.has(memory.projectId) && Boolean(memory.summary?.trim())
    );
    const reviewedNextActionCount = projectMemories.reduce(
      (count, memory) =>
        count + memory.nextActions.filter((action) => action.status === "accepted" || action.status === "dismissed").length,
      0
    );
    return getFirstUseActivationRail({
      captureCount,
      projectCount: projects.length,
      sortedCaptureCount,
      memoryCount: projectMemories.length,
      reviewedNextActionCount,
    });
  }, [allObjects, memories, projects]);

  useEffect(() => {
    if (!firstUseRail.isComplete || activationRailHidden) return;
    localStorage.setItem(FIRST_USE_RAIL_STORAGE_KEY, "true");
    setActivationRailHidden(true);
  }, [activationRailHidden, firstUseRail.isComplete]);

  const handleRailPrimaryAction = () => {
    if (firstUseRail.primaryAction === "capture") {
      inputRef.current?.focus();
      return;
    }
    if (firstUseRail.primaryAction === "manual_project") {
      if (onCreateProject) onCreateProject();
      else inputRef.current?.focus();
      return;
    }
    if (primary) onProjectClick(primary.id);
    else onNavigateToWorkspace();
  };

  const handleHideActivationRail = () => {
    localStorage.setItem(FIRST_USE_RAIL_STORAGE_KEY, "true");
    setActivationRailHidden(true);
  };

  const previewForProject = (p: Project): string => {
    if (p.description?.trim()) return p.description.trim();
    const items = allObjects
      .filter((o) => o.projectId === p.id && o.kind !== "project")
      .sort((a, b) => b.modifiedAt - a.modifiedAt);
    if (items.length === 0) return "No items yet — capture something to get started.";
    return items
      .slice(0, 3)
      .map(itemLabel)
      .join(" · ");
  };

  const recentLinesForProject = (p: Project): string[] => {
    return allObjects
      .filter((o) => o.projectId === p.id && o.kind !== "project")
      .sort((a, b) => b.modifiedAt - a.modifiedAt)
      .slice(0, 3)
      .map(itemLabel);
  };

  const itemCount = (pid: string) =>
    allObjects.filter((o) => o.projectId === pid && o.kind !== "project").length;
  const captureDisabled = step === "assigning" || voiceState === "transcribing";
  const voiceButtonLabel =
    voiceState === "recording"
      ? "stop recording"
      : voiceState === "transcribing"
        ? "transcribing voice..."
        : "record voice";

  return (
    <div className="capture-home capture-home-mock">
      <input
        ref={fileRef}
        type="file"
        hidden
        multiple
        aria-hidden
        tabIndex={-1}
        onChange={(e) => {
          const list = e.target.files;
          if (list?.length && onAddFiles) {
            void onAddFiles(Array.from(list));
          }
          e.target.value = "";
        }}
      />

      <header className="capture-chrome-mock">
        <div className="capture-chrome-mock__inner">
          <div className="capture-chrome-mock__left">
            <button
              type="button"
              className="capture-icon-btn"
              aria-label={projects.length > 0 ? "Open workspace" : "Focus capture"}
              title={projects.length > 0 ? "Workspace" : "Capture first"}
              onClick={projects.length > 0 ? onNavigateToWorkspace : () => inputRef.current?.focus()}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
                <line x1="2" y1="4" x2="14" y2="4" />
                <line x1="2" y1="8" x2="14" y2="8" />
                <line x1="2" y1="12" x2="14" y2="12" />
              </svg>
            </button>
            <span className="capture-chrome-brand">
              <HypherLockup />
            </span>
          </div>
          <div className="capture-chrome-mock__right">
            <AppClock className="app-clock--capture" />
            {onSearchClick ? (
              <button type="button" className="capture-icon-btn" aria-label="Search" title="Search (⌘K)" onClick={onSearchClick}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
                  <circle cx="7" cy="7" r="5" />
                  <line x1="11" y1="11" x2="14" y2="14" />
                </svg>
              </button>
            ) : null}
            {onDigestClick ? (
              <button type="button" className="capture-icon-btn" aria-label="Daily digest" title="Digest (⌘D)" onClick={onDigestClick}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M3.5 6a4.5 4.5 0 0 1 9 0v3l1.5 2.5H2L3.5 9V6z" />
                  <path d="M6 12.5a2 2 0 0 0 4 0" />
                </svg>
              </button>
            ) : null}
            <span className="capture-user-wrap" title="Signed in">
              <UserButton />
            </span>
          </div>
        </div>
      </header>

      <main className="capture-home-mock__main">
        <section className="home-hero-mock">
          <div className="home-hero-glass">
          <p className="home-greeting-mock">
            {weekdayPart()} {daypartLabel()}, <span className="home-greeting-name">{firstName}</span>
          </p>
          <h1 className="home-hero-title-mock">Stay single-threaded.</h1>
          <p className="home-hero-subtitle-mock">
            Hypher keeps your project memory fresh and briefs your agents with the right context.
          </p>

          <div
            className={`home-input-shell-mock ${isDragNear ? "is-drag" : ""}`}
            data-onboarding-target={ONBOARDING_TARGETS.captureInput}
          >
            <input
              ref={inputRef}
              className="home-input-mock"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="dump a thought, bug, decision, or agent output..."
              disabled={captureDisabled}
            />
            <button
              type="button"
              className="home-input-submit-mock"
              aria-label="Capture"
              title="Capture"
              disabled={captureDisabled}
              onClick={() => void handleSubmit()}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M8 3.5v9M3.5 8h9" />
              </svg>
            </button>
          </div>

          {step === "idle" && (
            <div className="home-quick-row-mock">
              {onClipboardCapture ? (
                <button type="button" className="home-quick-mock" onClick={onClipboardCapture}>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <rect x="3" y="2" width="10" height="12" rx="1" />
                    <path d="M6 5h4M6 8h4M6 11h2" />
                  </svg>
                  paste from clipboard
                </button>
              ) : null}
              <button
                type="button"
                className={[
                  "home-quick-mock",
                  "home-quick-mock--voice",
                  voiceState === "recording" ? "is-recording" : "",
                ].filter(Boolean).join(" ")}
                onClick={handleVoiceClick}
                disabled={voiceState === "transcribing"}
                aria-pressed={voiceState === "recording"}
                aria-label={voiceButtonLabel}
                title={voiceButtonLabel}
              >
                {voiceState === "recording" ? <span className="home-quick-recording-dot" aria-hidden /> : (
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M8 2.5a2 2 0 0 0-2 2v3a2 2 0 0 0 4 0v-3a2 2 0 0 0-2-2z" />
                    <path d="M4.5 7.5a3.5 3.5 0 0 0 7 0M8 11v2.5M6 13.5h4" />
                  </svg>
                )}
                {voiceButtonLabel}
              </button>
              {onAddFiles ? (
                <button type="button" className="home-quick-mock" onClick={() => fileRef.current?.click()}>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M8 2v8M5 7l3 3 3-3M3 13h10" />
                  </svg>
                  upload file
                </button>
              ) : null}
              {onNotionImport ? (
                <button type="button" className="home-quick-mock" onClick={onNotionImport}>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
                    <rect x="2" y="2" width="5" height="5" rx="0.5" />
                    <rect x="9" y="2" width="5" height="5" rx="0.5" />
                    <rect x="2" y="9" width="5" height="5" rx="0.5" />
                    <rect x="9" y="9" width="5" height="5" rx="0.5" />
                  </svg>
                  import from notion
                </button>
              ) : null}
            </div>
          )}
          </div>

          {step === "idle" && !activationRailHidden ? (
            <div className="first-use-rail" aria-label="First project pulse progress">
              <div className="first-use-rail__head">
                <div>
                  <p className="first-use-rail__eyebrow">Activation</p>
                  <h2>{firstUseRail.title}</h2>
                  <p>{firstUseRail.body}</p>
                </div>
                <button type="button" className="first-use-rail__skip" onClick={handleHideActivationRail}>
                  Skip
                </button>
              </div>
              <ol className="first-use-rail__steps">
                {firstUseRail.steps.map((railStep) => (
                  <li
                    key={railStep.label}
                    className={[
                      "first-use-rail__step",
                      railStep.complete ? "is-complete" : "",
                      railStep.current ? "is-current" : "",
                    ].filter(Boolean).join(" ")}
                  >
                    <span className="first-use-rail__dot" aria-hidden />
                    <span className="first-use-rail__label">{railStep.label}</span>
                    {railStep.meta ? <span className="first-use-rail__meta">{railStep.meta}</span> : null}
                  </li>
                ))}
              </ol>
              <button type="button" className="first-use-rail__action" onClick={handleRailPrimaryAction}>
                {firstUseRail.primaryLabel}
              </button>
            </div>
          ) : null}

          {step === "idle" && (
            <div className="home-kbd-hints-mock">
              <span className="home-kbd-hint-group-mock">
                <span className="home-kbd-hint-keys-mock">
                  <kbd className="hint-kbd hint-kbd--mock">⌘</kbd>
                  <kbd className="hint-kbd hint-kbd--mock">↵</kbd>
                </span>
                <span className="home-kbd-hint-label-mock">capture</span>
              </span>
              <span className="home-kbd-hint-group-mock">
                <span className="home-kbd-hint-keys-mock">
                  <kbd className="hint-kbd hint-kbd--mock">⌘</kbd>
                  <kbd className="hint-kbd hint-kbd--mock">⇧</kbd>
                  <kbd className="hint-kbd hint-kbd--mock">V</kbd>
                </span>
                <span className="home-kbd-hint-label-mock">paste</span>
              </span>
              {onSearchClick ? (
                <span className="home-kbd-hint-group-mock">
                  <span className="home-kbd-hint-keys-mock">
                    <kbd className="hint-kbd hint-kbd--mock">⌘</kbd>
                    <kbd className="hint-kbd hint-kbd--mock">K</kbd>
                  </span>
                  <span className="home-kbd-hint-label-mock">search</span>
                </span>
              ) : null}
            </div>
          )}

          {step === "assigning" && (
            <>
              <div className="capture-working-steps" aria-live="polite">
                <span>Captured</span>
                <span>Sorting</span>
                <span>{aiSuggestions.length > 0 ? "Suggested project" : "Ready for review"}</span>
              </div>
              <ProjectAssignPopup
                text={capturedText}
                projects={projects}
                aiSuggestions={aiSuggestions}
                onAssign={handleAssign}
                onInbox={handleInbox}
                onNewProject={handleNewProject}
                onDismiss={handleDismiss}
              />
            </>
          )}
        </section>

        {projects.length > 0 && onDigestClick && digestPreviewText ? (
          <button type="button" className="home-digest-mock" onClick={onDigestClick}>
            <span className="home-digest-dot" aria-hidden />
            <span className="home-digest-text">{digestPreviewText}</span>
            <span className="home-digest-action">open →</span>
          </button>
        ) : null}

        <section className="home-projects-section-mock">
          <div className="home-projects-head-mock">
            <h2 className="home-projects-title-mock">projects</h2>
            <span className="home-projects-meta-mock">{activeCount} active</span>
          </div>

          {emptyState && step === "idle" ? (
            <div className="capture-clusters-empty">
              <p className="capture-clusters-empty-title">{emptyState.title}</p>
              <p className="capture-clusters-empty-sub">
                {emptyState.body}
              </p>
              <div className="capture-empty-actions">
                <button type="button" className="capture-clusters-empty-btn" onClick={() => inputRef.current?.focus()}>
                  Capture first fragment
                </button>
                {onClipboardCapture ? (
                  <button type="button" className="capture-clusters-empty-btn capture-clusters-empty-btn--secondary" onClick={onClipboardCapture}>
                    Paste from clipboard
                  </button>
                ) : null}
                {onCreateProject ? (
                  <button type="button" className="capture-clusters-empty-btn capture-clusters-empty-btn--secondary" onClick={onCreateProject}>
                    Create project manually
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="home-projects-grid-mock">
              {primary ? (
                <article
                  key={primary.id}
                  className="home-project-card-mock home-project-card-mock--primary"
                  onClick={() => onProjectClick(primary.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onProjectClick(primary.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div className="home-project-card-head-mock">
                    <h3 className="home-project-name-mock">{primary.name}</h3>
                    {projectHealthScores[primary.id] != null ? (
                      <div
                        className="home-project-health-wrap"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <HealthRing score={projectHealthScores[primary.id]!} size={20} strokeWidth={2} />
                      </div>
                    ) : null}
                  </div>
                  <p className="home-project-summary-mock">{previewForProject(primary)}</p>
                  <ul className="home-project-items-mock">
                    {recentLinesForProject(primary).map((line, i) => (
                      <li key={i} className="home-project-item-mock">
                        <svg className="home-project-item-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
                          <rect x="2" y="3" width="12" height="10" rx="1.5" />
                          <path d="M5 7h6M5 10h4" />
                        </svg>
                        <span className="home-project-item-text">{line}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="home-project-foot-mock">
                    <span>{itemCount(primary.id)} items</span>
                    <span>edited {formatRelative(primary.modifiedAt)}</span>
                  </div>
                </article>
              ) : null}

              {secondary.map((p) => (
                <article
                  key={p.id}
                  className="home-project-card-mock"
                  role="button"
                  tabIndex={0}
                  onClick={() => onProjectClick(p.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onProjectClick(p.id);
                    }
                  }}
                >
                  <div className="home-project-card-head-mock">
                    <h3 className="home-project-name-mock">{p.name}</h3>
                    {projectHealthScores[p.id] != null ? (
                      <div
                        className="home-project-health-wrap"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <HealthRing score={projectHealthScores[p.id]!} size={20} strokeWidth={2} />
                      </div>
                    ) : null}
                  </div>
                  <div className="home-project-foot-mock">
                    <span>{itemCount(p.id)} items</span>
                    <span>{formatRelative(p.modifiedAt)}</span>
                  </div>
                </article>
              ))}

              <button type="button" className="home-project-new-mock" onClick={onNavigateToWorkspace}>
                <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
                  <path d="M8 3v10M3 8h10" />
                </svg>
                <span>new project</span>
              </button>
            </div>
          )}
        </section>

      </main>
    </div>
  );
}
