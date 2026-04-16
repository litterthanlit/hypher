"use client";

import { useCallback } from "react";
import type { AnyObject, Connection, Project } from "@/types";
import { SpatialCanvas } from "@/components/SpatialCanvas";

interface Props {
  project: Project;
  items: AnyObject[];
  connections: Connection[];
}

export function PublicCanvasView({ project, items, connections }: Props) {
  const noop = useCallback(() => {}, []);
  const noopAsync = useCallback(async () => {}, []);
  const noopSelect = useCallback((_id: string) => {}, []);
  const noopDelete = useCallback((_ids: string[]) => {}, []);
  const noopDup = useCallback(async (_ids: string[]) => [] as string[], []);
  const noopRestoreObj = useCallback(async () => {}, []);
  const noopRestoreConn = useCallback(async () => {}, []);
  const noopConn = useCallback(async (_a: string, _b: string) => {}, []);

  return (
    <div className="public-canvas-wrap">
      <SpatialCanvas
        project={project}
        items={items}
        connections={connections}
        onSelect={noopSelect}
        onUpdatePosition={noop}
        onCreateAtPosition={noop}
        onConfirmConnection={noop}
        onDismissConnection={noop}
        onUpdateObject={noop}
        onDeleteObjects={noopDelete}
        onDuplicateObjects={noopDup}
        onRestoreObjects={noopRestoreObj}
        onRestoreConnections={noopRestoreConn}
        onCreateManualConnection={noopConn}
        readOnly
      />
    </div>
  );
}
