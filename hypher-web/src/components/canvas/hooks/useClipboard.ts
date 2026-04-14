import { useCallback, useRef } from "react";
import type { AnyObject, Connection } from "@/types";

interface ClipboardEntry {
  objects: AnyObject[];
  connections: Connection[];
}

interface UseClipboardOptions {
  getSelectedObjects: () => AnyObject[];
  getConnectionsBetween: (ids: string[]) => Connection[];
  onPaste: (objects: AnyObject[], connections: Connection[]) => Promise<void>;
  onDelete: (ids: string[]) => void;
}

export function useClipboard({
  getSelectedObjects,
  getConnectionsBetween,
  onPaste,
  onDelete,
}: UseClipboardOptions) {
  const clipboard = useRef<ClipboardEntry | null>(null);
  const pasteCount = useRef(0);

  const copy = useCallback(() => {
    const objects = getSelectedObjects();
    if (objects.length === 0) return;
    const ids = objects.map((o) => o.id);
    const connections = getConnectionsBetween(ids);
    clipboard.current = { objects, connections };
    pasteCount.current = 0;
  }, [getSelectedObjects, getConnectionsBetween]);

  const cut = useCallback(() => {
    const objects = getSelectedObjects();
    if (objects.length === 0) return;
    const ids = objects.map((o) => o.id);
    const connections = getConnectionsBetween(ids);
    clipboard.current = { objects, connections };
    pasteCount.current = 0;
    onDelete(ids);
  }, [getSelectedObjects, getConnectionsBetween, onDelete]);

  const paste = useCallback(async () => {
    if (!clipboard.current || clipboard.current.objects.length === 0) return;
    pasteCount.current++;
    const offset = pasteCount.current * 20;

    // Clone objects with new IDs and offset positions
    const idMap = new Map<string, string>();
    const newObjects = clipboard.current.objects.map((obj) => {
      const newId = crypto.randomUUID();
      idMap.set(obj.id, newId);
      const pos = obj.canvasPosition ?? { x: 0, y: 0 };
      return {
        ...obj,
        id: newId,
        canvasPosition: { x: pos.x + offset, y: pos.y + offset },
        createdAt: Date.now(),
        modifiedAt: Date.now(),
      } as AnyObject;
    });

    // Clone connections between pasted items
    const newConnections = clipboard.current.connections
      .filter((c) => idMap.has(c.sourceId) && idMap.has(c.targetId))
      .map((c) => ({
        ...c,
        id: crypto.randomUUID(),
        sourceId: idMap.get(c.sourceId)!,
        targetId: idMap.get(c.targetId)!,
        createdAt: Date.now(),
      }));

    await onPaste(newObjects, newConnections);
  }, [onPaste]);

  const hasClipboard = clipboard.current !== null && clipboard.current.objects.length > 0;

  return { copy, cut, paste, hasClipboard };
}
