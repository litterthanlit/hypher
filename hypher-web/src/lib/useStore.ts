"use client";

import { useState, useEffect, useCallback } from "react";
import type { AnyObject, Connection, Project, Note, Artifact, ActivityEntry } from "@/types";
import { getDisplayName } from "@/types";
import * as db from "./db";
import { generateAndSuggest, computeSuggestions } from "./engine";

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

  // Search
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
    selected, selectedId, setSelectedId,
    suggestionsFor, connectionsFor, pendingCount,
    addObject, updateObject, removeObject,
    confirmConnection, dismissConnection, refreshSuggestions,
    createManualConnection, removeConnection,
    resolveObject, isProcessing, modelLoading,
    search,
  };
}
