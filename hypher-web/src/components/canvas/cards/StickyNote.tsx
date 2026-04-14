"use client";

import type { Note } from "@/types";
import { getDisplayName } from "@/types";
import { getPreview, getStatus } from "./cardUtils";

interface Props {
  obj: Note;
}

export function StickyNote({ obj }: Props) {
  return (
    <div className="spatial-card-body">
      <span className="spatial-card-title">{getDisplayName(obj)}</span>
      {getPreview(obj) && <p className="spatial-card-preview">{getPreview(obj)}</p>}
      <div className="spatial-card-footer">
        <span className="spatial-card-status">{getStatus(obj)}</span>
        {obj.embedding && <span className="spatial-card-embedded" />}
      </div>
    </div>
  );
}
