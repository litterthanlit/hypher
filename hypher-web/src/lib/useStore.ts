"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { AnyObject, Connection, Project, Note, Artifact, ActivityEntry } from "@/types";
import { getDisplayName } from "@/types";
import * as db from "./db";
import { generateAndSuggest, computeSuggestions, suggestProjectForObject, generateEmbedding } from "./engine";

export function useStore() {
  const [objects, setObjects] = useState<AnyObject[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [modelLoading, setModelLoading] = useState(false);

  const reload = useCallback(async () => {
    const [objs, conns, acts] = await Promise.all([
      db.getAllObjects(),
      db.getAllConnections(),
      db.getAllActivity(),
    ]);
    setObjects(objs);
    setConnections(conns);
    setActivity(acts);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const selected = objects.find((o) => o.id === selectedId) ?? null;

  const projects = objects.filter((o): o is Project => o.kind === "project");
  const notes = objects.filter((o): o is Note => o.kind === "note");
  const artifacts = objects.filter((o): o is Artifact => o.kind === "artifact");

  // Inbox: notes and artifacts not assigned to any project
  const inboxItems = useMemo(
    () => objects.filter((o) => o.kind !== "project" && !o.projectId),
    [objects]
  );

  // Objects belonging to a specific project
  const objectsForProject = useCallback(
    (projectId: string) => objects.filter((o) => o.projectId === projectId),
    [objects]
  );

  const suggestionsFor = (id: string) =>
    connections.filter(
      (c) => c.type === "ai_suggested" && (c.sourceId === id || c.targetId === id)
    ).sort((a, b) => b.confidence - a.confidence);

  const connectionsFor = (id: string) =>
    connections.filter(
      (c) =>
        (c.type === "ai_confirmed" || c.type === "manual") &&
        (c.sourceId === id || c.targetId === id)
    ).sort((a, b) => b.confidence - a.confidence);

  const pendingCount = connections.filter((c) => c.type === "ai_suggested").length;

  const logActivity = async (
    action: ActivityEntry["action"],
    obj: AnyObject,
    target?: AnyObject
  ) => {
    const entry: ActivityEntry = {
      id: crypto.randomUUID(),
      action,
      objectId: obj.id,
      objectKind: obj.kind,
      objectName: getDisplayName(obj),
      targetId: target?.id,
      targetKind: target?.kind,
      targetName: target ? getDisplayName(target) : undefined,
      timestamp: Date.now(),
    };
    await db.putActivity(entry);
  };

  const addObject = async (obj: AnyObject) => {
    setIsProcessing(true);
    setModelLoading(true);
    try {
      await logActivity("created", obj);
      await generateAndSuggest(obj);
      await reload();
    } finally {
      setIsProcessing(false);
      setModelLoading(false);
    }
  };

  // Quick capture: create a fleeting note, embed it, return AI project suggestions
  const addQuickCapture = async (
    text: string,
    projectId?: string | null
  ): Promise<{ projectId: string; projectName: string; confidence: number }[]> => {
    const now = Date.now();
    const note: Note = {
      id: crypto.randomUUID(),
      kind: "note",
      content: text,
      maturity: "fleeting",
      createdAt: now,
      modifiedAt: now,
      projectId: projectId ?? null,
    };

    // Optimistic: show immediately
    setObjects((prev) => [...prev, note]);
    setIsProcessing(true);
    setModelLoading(true);

    try {
      await logActivity("created", note);
      const embedded = await generateEmbedding(note);
      await db.putObject(embedded);
      await computeSuggestions();

      // Get AI project suggestions if not already assigned
      let suggestions: { projectId: string; projectName: string; confidence: number }[] = [];
      if (!projectId && embedded.embedding) {
        suggestions = await suggestProjectForObject(embedded);
      }

      await reload();
      return suggestions;
    } finally {
      setIsProcessing(false);
      setModelLoading(false);
    }
  };

  const assignToProject = async (objectId: string, projectId: string) => {
    const obj = objects.find((o) => o.id === objectId);
    if (!obj) return;
    const updated = { ...obj, projectId, modifiedAt: Date.now() };
    await db.putObject(updated);
    setObjects((prev) => prev.map((o) => (o.id === objectId ? updated : o)));
  };

  const unassignFromProject = async (objectId: string) => {
    const obj = objects.find((o) => o.id === objectId);
    if (!obj) return;
    const updated = { ...obj, projectId: null, modifiedAt: Date.now() };
    await db.putObject(updated);
    setObjects((prev) => prev.map((o) => (o.id === objectId ? updated : o)));
  };

  const updateObject = async (obj: AnyObject) => {
    setIsProcessing(true);
    try {
      await logActivity("updated", obj);
      await generateAndSuggest(obj);
      await reload();
    } finally {
      setIsProcessing(false);
    }
  };

  const removeObject = async (id: string) => {
    const obj = objects.find((o) => o.id === id);
    if (obj) await logActivity("deleted", obj);
    await db.deleteObject(id);
    const related = connections.filter(
      (c) => c.sourceId === id || c.targetId === id
    );
    for (const c of related) {
      await db.deleteConnection(c.id);
    }
    if (selectedId === id) setSelectedId(null);
    await reload();
  };

  const confirmConnection = async (connId: string) => {
    const conn = connections.find((c) => c.id === connId);
    if (!conn) return;
    await db.putConnection({ ...conn, type: "ai_confirmed" });
    const source = objects.find((o) => o.id === conn.sourceId);
    const target = objects.find((o) => o.id === conn.targetId);
    if (source && target) await logActivity("connected", source, target);
    await reload();
  };

  const dismissConnection = async (connId: string) => {
    const conn = connections.find((c) => c.id === connId);
    if (!conn) return;
    await db.putConnection({ ...conn, type: "dismissed" });
    const source = objects.find((o) => o.id === conn.sourceId);
    if (source) await logActivity("dismissed", source);
    await reload();
  };

  const createManualConnection = async (sourceId: string, targetId: string) => {
    const source = objects.find((o) => o.id === sourceId);
    const target = objects.find((o) => o.id === targetId);
    if (!source || !target) return;

    const existing = connections.find(
      (c) =>
        (c.sourceId === sourceId && c.targetId === targetId) ||
        (c.sourceId === targetId && c.targetId === sourceId)
    );
    if (existing && (existing.type === "manual" || existing.type === "ai_confirmed")) return;

    if (existing) {
      await db.putConnection({ ...existing, type: "manual" });
    } else {
      await db.putConnection({
        id: crypto.randomUUID(),
        sourceId,
        targetId,
        sourceKind: source.kind,
        targetKind: target.kind,
        type: "manual",
        confidence: 1,
        reason: "Manual connection",
        createdAt: Date.now(),
      });
    }
    await logActivity("connected", source, target);
    await reload();
  };

  const removeConnection = async (connId: string) => {
    await db.deleteConnection(connId);
    await reload();
  };

  const updatePosition = async (id: string, x: number, y: number) => {
    const obj = objects.find((o) => o.id === id);
    if (!obj) return;
    const updated = { ...obj, canvasPosition: { x, y } };
    await db.putObject(updated);
    setObjects((prev) => prev.map((o) => (o.id === id ? updated : o)));
  };

  const refreshSuggestions = async () => {
    setIsProcessing(true);
    try {
      await computeSuggestions();
      await reload();
    } finally {
      setIsProcessing(false);
    }
  };

  const resolveObject = (id: string) => objects.find((o) => o.id === id);

  const search = (query: string): AnyObject[] => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return objects.filter((obj) => {
      if (obj.kind === "project") return obj.name.toLowerCase().includes(q) || obj.description.toLowerCase().includes(q);
      if (obj.kind === "note") return obj.content.toLowerCase().includes(q);
      if (obj.kind === "artifact") return obj.name.toLowerCase().includes(q);
      return false;
    });
  };

  return {
    objects, projects, notes, artifacts, connections, activity,
    inboxItems, objectsForProject,
    selected, selectedId, setSelectedId,
    suggestionsFor, connectionsFor, pendingCount,
    addObject, addQuickCapture, updateObject, removeObject,
    assignToProject, unassignFromProject,
    confirmConnection, dismissConnection, refreshSuggestions,
    createManualConnection, removeConnection, updatePosition,
    resolveObject, isProcessing, modelLoading,
    search,
  };
}
