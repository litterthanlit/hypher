"use client";

import type { ObjectKind } from "@/types";
import { RESIZE_CONFIG } from "./useResize";

type HandlePos = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

interface Props {
  kind: ObjectKind;
  onStartResize: (e: React.MouseEvent, handle: HandlePos) => void;
}

export function ResizeHandles({ kind, onStartResize }: Props) {
  const config = RESIZE_CONFIG[kind];
  const isBar = kind === "note";

  return (
    <>
      {config.handles.map((handle) => (
        <div
          key={handle}
          className={`resize-handle ${isBar ? "resize-handle-bar" : "resize-handle-dot"}`}
          data-pos={handle}
          onMouseDown={(e) => onStartResize(e, handle)}
        />
      ))}
    </>
  );
}
