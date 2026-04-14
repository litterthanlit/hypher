import { useCallback, useRef, useState } from "react";
import type { AnyObject, Connection } from "@/types";

const MAX_STACK = 50;

export interface UndoSnapshot {
  objects: AnyObject[];
  connections: Connection[];
}

export interface UndoCommand {
  description: string;
  before: UndoSnapshot;
  after: UndoSnapshot;
}

interface UseUndoRedoOptions {
  restoreObjects: (from: AnyObject[], to: AnyObject[]) => Promise<void>;
  restoreConnections: (from: Connection[], to: Connection[]) => Promise<void>;
}

export function useUndoRedo({ restoreObjects, restoreConnections }: UseUndoRedoOptions) {
  const undoStack = useRef<UndoCommand[]>([]);
  const redoStack = useRef<UndoCommand[]>([]);
  const [, setVersion] = useState(0);
  const bump = () => setVersion((v) => v + 1);

  const pushUndo = useCallback((command: UndoCommand) => {
    undoStack.current.push(command);
    if (undoStack.current.length > MAX_STACK) {
      undoStack.current.shift();
    }
    redoStack.current = [];
    bump();
  }, []);

  const undo = useCallback(async () => {
    const command = undoStack.current.pop();
    if (!command) return;
    redoStack.current.push(command);
    await restoreObjects(command.after.objects, command.before.objects);
    await restoreConnections(command.after.connections, command.before.connections);
    bump();
  }, [restoreObjects, restoreConnections]);

  const redo = useCallback(async () => {
    const command = redoStack.current.pop();
    if (!command) return;
    undoStack.current.push(command);
    await restoreObjects(command.before.objects, command.after.objects);
    await restoreConnections(command.before.connections, command.after.connections);
    bump();
  }, [restoreObjects, restoreConnections]);

  const canUndo = undoStack.current.length > 0;
  const canRedo = redoStack.current.length > 0;

  return { pushUndo, undo, redo, canUndo, canRedo };
}
