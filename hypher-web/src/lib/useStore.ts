"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { useQuery, useMutation, useAction, useConvex } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { AnyObject, CaptureResult, Connection, Project, ProjectSuggestion, Note, Artifact, ActivityEntry } from "@/types";
import { getDisplayName } from "@/types";
import { toast } from "sonner";
import {
  computeSuggestionsForObject,
  computeSuggestionsFromData,
  generateEmbedding,
  suggestProjectFromData,
} from "./engine";
import { reportConvexActionFailed } from "./convexActionFailed";
import {
  enrichCapture,
  normalizeCaptureInput,
  prepareCaptureObject,
  safeEnrichCapture,
} from "../../shared/capture";

/* ── Convex doc → app type mappers ──────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapObject(doc: any): AnyObject {
  if (doc && typeof doc.id === "string" && !doc._id) return doc as AnyObject;
  const { _id, _creationTime, ...rest } = doc;
  return { ...rest, id: String(_id) } as AnyObject;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapConnection(doc: any): Connection {
  const { _id, _creationTime, ...rest } = doc;
  return { ...rest, id: _id } as Connection;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapActivity(doc: any): ActivityEntry {
  if (doc && typeof doc.id === "string" && !doc._id) return doc as ActivityEntry;
  const { _id, _creationTime, ...rest } = doc;
  return { ...rest, id: String(_id) } as ActivityEntry;
}

/* ── App type → Convex mutation args ────────────────────────────── */

function stripUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function convexInsertArgs(obj: AnyObject): any {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, ...rest } = obj;
  return stripUndefined(rest);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function convexUpdateArgs(obj: AnyObject): any {
  const { id, ...rest } = obj;
  return { id: id as Id<"objects">, ...stripUndefined(rest) };
}

interface UseStoreOptions {
  selectedProjectId?: string | null;
  subscribeAllObjects?: boolean;
  subscribeAllActivity?: boolean;
}

function mergeObjects(...groups: AnyObject[][]): AnyObject[] {
  const byId = new Map<string, AnyObject>();
  for (const group of groups) {
    for (const object of group) byId.set(object.id, object);
  }
  return Array.from(byId.values());
}

export function useStore(options: UseStoreOptions = {}) {
  const { isLoaded: clerkLoaded, isSignedIn } = useAuth();
  const convex = useConvex();
  const skipConvex = !clerkLoaded || !isSignedIn;
  const selectedProjectId = options.selectedProjectId ?? null;
  const subscribeAllObjects = options.subscribeAllObjects ?? true;
  const subscribeAllActivity = options.subscribeAllActivity ?? subscribeAllObjects;

  const ensureDemoForUser = useMutation(api.seed.ensureDemoForUser);
  // typegen pending convex dev
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ensureDefaultPrefs = useMutation((api as any).digestEmail.ensureDefaultPrefs);

  useEffect(() => {
    if (!clerkLoaded || !isSignedIn) return;
    const run = async () => {
      await ensureDemoForUser();
      // Bootstrap digestPrefs row for new users (idempotent — no-op if row exists)
      const timezone =
        typeof Intl !== "undefined"
          ? Intl.DateTimeFormat().resolvedOptions().timeZone
          : "UTC";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (ensureDefaultPrefs as any)({ timezone });
    };
    void run();
  }, [clerkLoaded, isSignedIn, ensureDemoForUser, ensureDefaultPrefs]);

  /* ── Reactive queries (replaces reload()) ─────────────────────── */
  const rawAllObjects = useQuery(api.objects.list, skipConvex || !subscribeAllObjects ? "skip" : {});
  const rawProjects = useQuery(api.projects.list, skipConvex ? "skip" : {});
  const rawInboxObjects = useQuery(api.objects.listInbox, skipConvex ? "skip" : {});
  const rawRecentObjects = useQuery(api.objects.listRecent, skipConvex ? "skip" : { limit: 8 });
  const rawProjectObjects = useQuery(
    api.objects.listForProject,
    skipConvex || !selectedProjectId ? "skip" : { projectId: selectedProjectId as Id<"objects"> }
  );
  const rawConnections = useQuery(api.connections.list, skipConvex ? "skip" : {});
  const rawActivity = useQuery(api.activity.list, skipConvex || !subscribeAllActivity ? "skip" : {});
  const rawProjectActivity = useQuery(
    api.activity.recentForProject,
    skipConvex || !selectedProjectId ? "skip" : { projectId: selectedProjectId as Id<"objects">, limit: 5 }
  );

  const projectObjects = useMemo(
    (): Project[] => (rawProjects ?? []).map(mapObject).filter((o): o is Project => o.kind === "project"),
    [rawProjects]
  );
  const inboxObjects = useMemo(
    (): AnyObject[] => (rawInboxObjects ?? []).map(mapObject),
    [rawInboxObjects]
  );
  const recentObjects = useMemo(
    (): AnyObject[] => (rawRecentObjects ?? []).map(mapObject),
    [rawRecentObjects]
  );
  const selectedProjectObjects = useMemo(
    (): AnyObject[] => (rawProjectObjects ?? []).map(mapObject),
    [rawProjectObjects]
  );
  const rawMappedObjects = useMemo(
    (): AnyObject[] => {
      if (rawAllObjects !== undefined) return rawAllObjects.map(mapObject);
      return mergeObjects(projectObjects, inboxObjects, recentObjects, selectedProjectObjects);
    },
    [inboxObjects, projectObjects, rawAllObjects, recentObjects, selectedProjectObjects]
  );
  const connections = useMemo(
    (): Connection[] => (rawConnections ?? []).map(mapConnection),
    [rawConnections]
  );
  const activity = useMemo(
    (): ActivityEntry[] => {
      if (rawActivity !== undefined) return rawActivity.map(mapActivity);
      return (rawProjectActivity ?? []).map(mapActivity);
    },
    [rawActivity, rawProjectActivity]
  );

  /* ── Convex mutations ─────────────────────────────────────────── */
  const putObjectMut = useMutation(api.objects.put);
  const removeObjectMut = useMutation(api.objects.remove);
  // typegen pending convex dev
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const assignToProjectMut = useMutation((api.objects as any).assignToProject);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markReviewedMut = useMutation((api.objects as any).markReviewed);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patchCaptureMetadataMut = useMutation((api.objects as any).patchCaptureMetadata);
  const putConnectionMut = useMutation(api.connections.put);
  const removeConnectionMut = useMutation(api.connections.remove);
  const putActivityMut = useMutation(api.activity.put);
  const touchLastActivityMut = useMutation(api.objects.touchLastActivity);
  const generateTagsAction = useAction(api.ai.generateTags);

  /* ── Position overrides for smooth drag ───────────────────────── */
  const [positionOverrides, setPositionOverrides] = useState<
    Record<string, { x: number; y: number }>
  >({});

  // Merge Convex data with local position overrides
  const objects = useMemo(() => {
    if (Object.keys(positionOverrides).length === 0) return rawMappedObjects;
    return rawMappedObjects.map((obj) => {
      const override = positionOverrides[obj.id];
      return override ? ({ ...obj, canvasPosition: override } as AnyObject) : obj;
    });
  }, [rawMappedObjects, positionOverrides]);

  // Clear overrides when Convex data updates
  useEffect(() => {
    setPositionOverrides({});
  }, [rawAllObjects, rawProjectObjects]);

  // Ref for latest objects (used in debounced writes)
  const objectsRef = useRef(rawMappedObjects);
  useEffect(() => {
    objectsRef.current = rawMappedObjects;
  }, [rawMappedObjects]);

  // Position write debounce timers
  const positionTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  useEffect(() => {
    return () => {
      for (const timer of Object.values(positionTimers.current)) {
        clearTimeout(timer);
      }
    };
  }, []);

  /* ── Local UI state ───────────────────────────────────────────── */
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [modelLoading, setModelLoading] = useState(false);
  /* ── Toasts (Sonner, root layout) ─────────────────────────────── */
  const addToast = useCallback(
    (text: string, action?: { label: string; onClick: () => void }) => {
      if (action) {
        toast(text, {
          duration: 8000,
          action: { label: action.label, onClick: action.onClick },
        });
      } else {
        toast(text, { duration: 4000 });
      }
    },
    []
  );

  /* ── Derived data ─────────────────────────────────────────────── */
  const selected = objects.find((o) => o.id === selectedId) ?? null;
  const projects = useMemo(
    () => (rawProjects !== undefined ? projectObjects : objects.filter((o): o is Project => o.kind === "project")),
    [objects, projectObjects, rawProjects]
  );
  const notes = objects.filter((o): o is Note => o.kind === "note");
  const artifacts = objects.filter((o): o is Artifact => o.kind === "artifact");

  const inboxItems = useMemo(
    () => rawInboxObjects !== undefined
      ? inboxObjects
      : objects.filter((o) => o.kind !== "project" && !o.projectId && o.captureStatus !== "archived"),
    [inboxObjects, objects, rawInboxObjects]
  );

  const reviewItems = useMemo(
    () => inboxItems.filter((o) => !o.reviewedAt),
    [inboxItems]
  );

  const recentItems = useMemo(
    () =>
      rawRecentObjects !== undefined
        ? recentObjects
        : [...objects]
            .filter((o) => o.kind !== "project")
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(0, 8),
    [objects, rawRecentObjects, recentObjects]
  );

  const objectsForProject = useCallback(
    (projectId: string) => {
      if (projectId === selectedProjectId && rawProjectObjects !== undefined) {
        return selectedProjectObjects;
      }
      return objects.filter((o) => o.projectId === projectId && o.captureStatus !== "archived");
    },
    [objects, rawProjectObjects, selectedProjectId, selectedProjectObjects]
  );

  const suggestionsFor = (id: string) =>
    connections
      .filter(
        (c) => c.type === "ai_suggested" && (c.sourceId === id || c.targetId === id)
      )
      .sort((a, b) => b.confidence - a.confidence);

  const connectionsFor = (id: string) =>
    connections
      .filter(
        (c) =>
          (c.type === "ai_confirmed" || c.type === "manual") &&
          (c.sourceId === id || c.targetId === id)
      )
      .sort((a, b) => b.confidence - a.confidence);

  const pendingCount = connections.filter((c) => c.type === "ai_suggested").length;

  /* ── Activity logging ─────────────────────────────────────────── */
  const logActivity = async (
    action: ActivityEntry["action"],
    obj: AnyObject,
    target?: AnyObject,
    activityType?: string,
  ) => {
    const now = Date.now();
    const projectId = obj.kind === "project" ? obj.id : obj.projectId ?? undefined;

    await putActivityMut({
      action,
      objectId: obj.id,
      objectKind: obj.kind,
      objectName: getDisplayName(obj),
      targetId: target?.id,
      targetKind: target?.kind,
      targetName: target ? getDisplayName(target) : undefined,
      timestamp: now,
      projectId: projectId ?? undefined,
      activityType: activityType ?? action,
      summary: undefined,
    });

    // Update project's lastActivity timestamp
    if (projectId) {
      touchLastActivityMut({ id: projectId as Id<"objects">, timestamp: now });
    }
  };

  const logProjectView = async (projectId: string) => {
    const project = objects.find((o) => o.id === projectId);
    if (!project) return;
    const now = Date.now();
    await putActivityMut({
      action: "updated",
      objectId: projectId,
      objectKind: "project",
      objectName: getDisplayName(project),
      timestamp: now,
      projectId,
      activityType: "view",
    });
    touchLastActivityMut({ id: projectId as Id<"objects">, timestamp: now });
  };

  /* ── Suggestion helper ────────────────────────────────────────── */
  const saveSuggestionsAndToast = async (
    allObjects: AnyObject[],
    allConns: Connection[]
  ) => {
    const newConns = computeSuggestionsFromData(allObjects, allConns);
    await saveConnectionSuggestionsAndToast(newConns);
  };

  const saveSuggestionsForObjectAndToast = async (
    changedObject: AnyObject,
    candidateObjects: AnyObject[],
    allConns: Connection[]
  ) => {
    const newConns = computeSuggestionsForObject(changedObject, candidateObjects, allConns);
    await saveConnectionSuggestionsAndToast(newConns);
  };

  const saveConnectionSuggestionsAndToast = async (
    newConns: Omit<Connection, "id">[]
  ) => {
    for (const conn of newConns) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await putConnectionMut(conn as any);
    }
    if (newConns.length > 0) {
      addToast(
        `Found ${newConns.length} new connection${newConns.length > 1 ? "s" : ""}`
      );
    }
  };

  const loadSuggestionObjects = useCallback(async (): Promise<AnyObject[]> => {
    if (rawAllObjects !== undefined) return objects;
    const rows = await convex.query(api.objects.list, {});
    return rows.map(mapObject);
  }, [convex, objects, rawAllObjects]);

  /* ── Object mutations ─────────────────────────────────────────── */

  const addObject = async (obj: AnyObject): Promise<string> => {
    setIsProcessing(true);
    setModelLoading(true);
    try {
      // Insert into Convex (strips client id, lets Convex generate _id)
      const convexId = await putObjectMut(convexInsertArgs(obj));
      const saved = { ...obj, id: convexId as string } as AnyObject;

      await logActivity("created", saved, undefined, "capture");

      // Generate embedding and update the object
      const embedded = await generateEmbedding(saved);
      await putObjectMut(convexUpdateArgs(embedded));

      // Compute and save suggestions for the new object only
      const suggestionObjects = await loadSuggestionObjects();
      await saveSuggestionsForObjectAndToast(
        embedded,
        suggestionObjects.filter((o) => o.id !== (convexId as string)),
        connections
      );

      // Non-blocking: generate AI tags
      const tagContent = obj.kind === "note" ? (obj as Note).content : obj.kind === "artifact" ? (obj as Artifact).name : "";
      if (tagContent && !obj.tags?.length) {
        generateTagsAction({ content: tagContent }).then((tags) => {
          if (tags.length > 0) {
            putObjectMut({ id: convexId as Id<"objects">, ...convexInsertArgs({ ...embedded, tags } as AnyObject) } as any);
          }
        }).catch((e) => reportConvexActionFailed("ai.generateTags", e));
      }

      return convexId as string;
    } finally {
      setIsProcessing(false);
      setModelLoading(false);
    }
  };

  const addQuickCapture = async (
    text: string,
    projectId?: string | null
  ): Promise<CaptureResult> => {
    const now = Date.now();
    const input = normalizeCaptureInput({
      content: text,
      projectId: projectId ?? null,
      validateProjectId: false,
    });
    if (!input.ok) throw new Error(input.error);

    setIsProcessing(true);
    setModelLoading(true);

    try {
      const prepared = prepareCaptureObject({
        content: input.content,
        projectId: input.projectId,
        now,
        includeClientFields: true,
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const convexId = await putObjectMut(prepared as any);
      const note = {
        id: convexId as string,
        ...prepared,
      } as Note;

      await logActivity("created", note, undefined, "capture");

      const suggestionObjects = await loadSuggestionObjects();
      const enrichment = await safeEnrichCapture(
        () => enrichCapture({
          capture: note,
          allObjects: suggestionObjects.filter((o) => o.id !== (convexId as string)),
          connections,
          projectId: input.projectId,
          embedCapture: generateEmbedding,
          suggestProjects: suggestProjectFromData,
          computeConnections: computeSuggestionsForObject,
        }),
        (error) => reportConvexActionFailed("capture.enrich", error)
      );
      const embedded = enrichment.capture ?? note;
      await putObjectMut(convexUpdateArgs(embedded));

      if (!input.projectId && enrichment.suggestions[0]) {
        await patchCaptureMetadataMut({
          id: convexId as Id<"objects">,
          timestamp: now,
          suggestedProjectId: enrichment.suggestions[0].projectId,
          confidence: enrichment.suggestions[0].confidence,
        });
      }

      await saveConnectionSuggestionsAndToast(enrichment.connectionsToCreate);

      // Non-blocking: generate AI tags
      if (input.content.length >= 10) {
        generateTagsAction({ content: input.content }).then((tags) => {
          if (tags.length > 0) {
            putObjectMut({ id: convexId as Id<"objects">, ...convexInsertArgs({ ...embedded, tags } as AnyObject) } as any);
          }
        }).catch((e) => reportConvexActionFailed("ai.generateTags", e));
      }

      return { noteId: convexId as string, suggestions: enrichment.suggestions };
    } finally {
      setIsProcessing(false);
      setModelLoading(false);
    }
  };

  const assignToProject = async (objectId: string, projectId: string) => {
    await assignToProjectMut({
      id: objectId as Id<"objects">,
      projectId: projectId as Id<"objects">,
      timestamp: Date.now(),
    });
  };

  const markReviewed = async (objectId: string) => {
    await markReviewedMut({
      id: objectId as Id<"objects">,
      timestamp: Date.now(),
    });
  };

  const projectSuggestionsFor = useCallback(
    (objectId: string): ProjectSuggestion[] => {
      const obj = objects.find((o) => o.id === objectId);
      if (!obj || obj.kind === "project") return [];
      return suggestProjectFromData(obj, objects);
    },
    [objects]
  );

  const unassignFromProject = async (objectId: string) => {
    const obj = objects.find((o) => o.id === objectId);
    if (!obj) return;
    await putObjectMut(
      convexUpdateArgs({
        ...obj,
        projectId: null,
        confirmedProjectId: null,
        captureStatus: "unsorted",
        modifiedAt: Date.now(),
      })
    );
  };

  const updateCaptureMeta = async (
    objectId: string,
    patch: Partial<Pick<
      AnyObject,
      | "captureType"
      | "source"
      | "suggestedProjectId"
      | "confirmedProjectId"
      | "confidence"
      | "captureStatus"
      | "linkedHandoffId"
      | "excludeFromPackets"
      | "pinnedAsDecision"
      | "convertedToTask"
      | "stale"
    >>
  ) => {
    await patchCaptureMetadataMut({
      id: objectId as Id<"objects">,
      timestamp: Date.now(),
      ...stripUndefined(patch as Record<string, unknown>),
    });
  };

  const markCaptureArchived = async (objectId: string) => {
    await updateCaptureMeta(objectId, { captureStatus: "archived" });
  };

  const updateObject = async (obj: AnyObject) => {
    setIsProcessing(true);
    try {
      await logActivity("updated", obj, undefined, "edit");

      // Generate embedding and update
      const embedded = await generateEmbedding(obj);
      await putObjectMut(convexUpdateArgs(embedded));

      // Recompute suggestions for the changed object only
      const suggestionObjects = await loadSuggestionObjects();
      await saveSuggestionsForObjectAndToast(
        embedded,
        suggestionObjects.filter((o) => o.id !== obj.id),
        connections
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const removeObject = async (id: string) => {
    const obj = objects.find((o) => o.id === id);
    if (obj) await logActivity("deleted", obj);

    await removeObjectMut({ id: id as Id<"objects"> });

    // Remove related connections
    const related = connections.filter(
      (c) => c.sourceId === id || c.targetId === id
    );
    for (const c of related) {
      await removeConnectionMut({ id: c.id as Id<"connections"> });
    }

    if (selectedId === id) setSelectedId(null);
  };

  const confirmConnection = async (connId: string) => {
    const conn = connections.find((c) => c.id === connId);
    if (!conn) return;
    const { id, ...data } = conn;
    await putConnectionMut({
      id: connId as Id<"connections">,
      ...data,
      type: "ai_confirmed",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const source = objects.find((o) => o.id === conn.sourceId);
    const target = objects.find((o) => o.id === conn.targetId);
    if (source && target) await logActivity("connected", source, target, "connection");
  };

  const dismissConnection = async (connId: string) => {
    const conn = connections.find((c) => c.id === connId);
    if (!conn) return;
    const { id, ...data } = conn;
    await putConnectionMut({
      id: connId as Id<"connections">,
      ...data,
      type: "dismissed",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const source = objects.find((o) => o.id === conn.sourceId);
    if (source) await logActivity("dismissed", source);
  };

  const createManualConnection = async (
    sourceId: string,
    targetId: string
  ) => {
    const source = objects.find((o) => o.id === sourceId);
    const target = objects.find((o) => o.id === targetId);
    if (!source || !target) return;

    const existing = connections.find(
      (c) =>
        (c.sourceId === sourceId && c.targetId === targetId) ||
        (c.sourceId === targetId && c.targetId === sourceId)
    );
    if (
      existing &&
      (existing.type === "manual" || existing.type === "ai_confirmed")
    )
      return;

    if (existing) {
      const { id, ...data } = existing;
      await putConnectionMut({
        id: id as Id<"connections">,
        ...data,
        type: "manual",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
    } else {
      await putConnectionMut({
        sourceId,
        targetId,
        sourceKind: source.kind,
        targetKind: target.kind,
        type: "manual",
        confidence: 1,
        reason: "Manual connection",
        createdAt: Date.now(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
    }
    await logActivity("connected", source, target);
  };

  const removeConnection = async (connId: string) => {
    await removeConnectionMut({ id: connId as Id<"connections"> });
  };

  const updatePosition = (id: string, x: number, y: number) => {
    // Immediate local update for smooth drag
    setPositionOverrides((prev) => ({ ...prev, [id]: { x, y } }));

    // Debounce the Convex write (at most every 200ms per object)
    clearTimeout(positionTimers.current[id]);
    positionTimers.current[id] = setTimeout(() => {
      delete positionTimers.current[id];
      const obj = objectsRef.current.find((o) => o.id === id);
      if (!obj) return;
      putObjectMut(convexUpdateArgs({ ...obj, canvasPosition: { x, y } }));
    }, 200);
  };

  const refreshSuggestions = async () => {
    setIsProcessing(true);
    try {
      await saveSuggestionsAndToast(await loadSuggestionObjects(), connections);
    } finally {
      setIsProcessing(false);
    }
  };

  const resolveObject = (id: string) => objects.find((o) => o.id === id);

  const duplicateObjects = async (ids: string[]): Promise<string[]> => {
    const idMap = new Map<string, string>();
    for (const oldId of ids) {
      const obj = objects.find((o) => o.id === oldId);
      if (!obj) continue;
      const pos = obj.canvasPosition ?? { x: 0, y: 0 };
      const newObj = {
        ...obj,
        id: crypto.randomUUID(),
        canvasPosition: { x: pos.x + 20, y: pos.y + 20 },
        createdAt: Date.now(),
        modifiedAt: Date.now(),
      };
      const newId = await addObject(newObj);
      idMap.set(oldId, newId);
    }

    // Duplicate connections between the duplicated items
    const duplicatedSet = new Set(ids);
    const internalConns = connections.filter(
      (c) =>
        (c.type === "manual" || c.type === "ai_confirmed") &&
        duplicatedSet.has(c.sourceId) &&
        duplicatedSet.has(c.targetId)
    );
    for (const conn of internalConns) {
      const newSource = idMap.get(conn.sourceId);
      const newTarget = idMap.get(conn.targetId);
      if (newSource && newTarget) {
        await createManualConnection(newSource, newTarget);
      }
    }

    return Array.from(idMap.values());
  };

  /* ── Forgetting curve / rediscovery ───────────────────────────── */
  const REDISCOVERY_INTERVALS = [1, 3, 7, 14, 30].map((d) => d * 86400000);

  const getRediscovery = useCallback((): AnyObject | null => {
    if (rawAllObjects === undefined) return null;
    const now = Date.now();
    const candidates = objects.filter((obj) => {
      if (obj.kind === "project") return false;
      const age = now - obj.createdAt;
      if (age < 86400000) return false;
      const lastSurfaced = obj.lastSurfacedAt ?? 0;
      const timeSinceSurface = now - lastSurfaced;

      for (const interval of REDISCOVERY_INTERVALS) {
        if (age >= interval && timeSinceSurface >= interval) {
          return true;
        }
      }
      return false;
    });

    if (candidates.length === 0) return null;
    candidates.sort(
      (a, b) => (a.lastSurfacedAt ?? 0) - (b.lastSurfacedAt ?? 0)
    );
    return candidates[0] ?? null;
  }, [objects, rawAllObjects]);

  const markSurfaced = async (id: string) => {
    const obj = objects.find((o) => o.id === id);
    if (!obj) return;
    await putObjectMut(
      convexUpdateArgs({ ...obj, lastSurfacedAt: Date.now() })
    );
  };

  /* ── Clipboard capture ────────────────────────────────────────── */
  const captureFromClipboard = async (): Promise<boolean> => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) return false;
      await addQuickCapture(text.trim());
      addToast("Captured from clipboard");
      return true;
    } catch {
      addToast("Could not read clipboard — check browser permissions");
      return false;
    }
  };

  /* ── Undo/redo restore helpers ───────────────────────────────── */

  const restoreObjects = async (from: AnyObject[], to: AnyObject[]) => {
    const fromMap = new Map(from.map((o) => [o.id, o]));
    const toMap = new Map(to.map((o) => [o.id, o]));

    // Objects in "to" but not "from" → re-create
    for (const obj of to) {
      if (!fromMap.has(obj.id)) {
        await putObjectMut(convexUpdateArgs(obj));
      }
    }

    // Objects in "from" but not "to" → delete
    for (const obj of from) {
      if (!toMap.has(obj.id)) {
        await removeObjectMut({ id: obj.id as Id<"objects"> });
      }
    }

    // Objects in both → restore "to" state
    for (const obj of to) {
      if (fromMap.has(obj.id)) {
        await putObjectMut(convexUpdateArgs(obj));
      }
    }
  };

  const restoreConnections = async (from: Connection[], to: Connection[]) => {
    const fromMap = new Map(from.map((c) => [c.id, c]));
    const toMap = new Map(to.map((c) => [c.id, c]));

    for (const conn of to) {
      if (!fromMap.has(conn.id)) {
        const { id, ...data } = conn;
        await putConnectionMut({ id: id as Id<"connections">, ...data } as any);
      }
    }
    for (const conn of from) {
      if (!toMap.has(conn.id)) {
        await removeConnectionMut({ id: conn.id as Id<"connections"> });
      }
    }
    for (const conn of to) {
      if (fromMap.has(conn.id)) {
        const { id, ...data } = conn;
        await putConnectionMut({ id: id as Id<"connections">, ...data } as any);
      }
    }
  };

  /* ── Search ───────────────────────────────────────────────────── */
  const search = (query: string): AnyObject[] => {
    if (rawAllObjects === undefined) return [];
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return objects.filter((obj) => {
      // Search tags on any object
      if (obj.tags?.some((t) => t.toLowerCase().includes(q))) return true;
      if (obj.kind === "project")
        return (
          obj.name.toLowerCase().includes(q) ||
          obj.description.toLowerCase().includes(q)
        );
      if (obj.kind === "note") return obj.content.toLowerCase().includes(q);
      if (obj.kind === "artifact") return obj.name.toLowerCase().includes(q);
      return false;
    });
  };

  const convexDataLoading =
    !skipConvex &&
    (rawProjects === undefined ||
      rawInboxObjects === undefined ||
      rawRecentObjects === undefined ||
      rawConnections === undefined ||
      (subscribeAllObjects && rawAllObjects === undefined) ||
      (subscribeAllActivity && rawActivity === undefined) ||
      (selectedProjectId != null && rawProjectObjects === undefined) ||
      (selectedProjectId != null && rawProjectActivity === undefined));

  return {
    clerkLoaded,
    isSignedIn: isSignedIn ?? false,
    convexDataLoading,
    hasFullObjectSubscription: rawAllObjects !== undefined,
    objects,
    projects,
    notes,
    artifacts,
    connections,
    activity,
    inboxItems,
    reviewItems,
    recentItems,
    objectsForProject,
    selected,
    selectedId,
    setSelectedId,
    suggestionsFor,
    connectionsFor,
    pendingCount,
    addObject,
    addQuickCapture,
    updateObject,
    removeObject,
    assignToProject,
    markReviewed,
    unassignFromProject,
    updateCaptureMeta,
    markCaptureArchived,
    projectSuggestionsFor,
    confirmConnection,
    dismissConnection,
    refreshSuggestions,
    createManualConnection,
    removeConnection,
    updatePosition,
    resolveObject,
    isProcessing,
    modelLoading,
    addToast,
    getRediscovery,
    markSurfaced,
    captureFromClipboard,
    search,
    duplicateObjects,
    restoreObjects,
    restoreConnections,
    logProjectView,
  };
}
