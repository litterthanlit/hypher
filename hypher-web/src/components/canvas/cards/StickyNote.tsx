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
      {obj.tags && obj.tags.length > 0 && (
        <div className="card-tags">
          {obj.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="tag-pill">{tag}</span>
          ))}
          {obj.tags.length > 3 && (
            <span className="tag-more">+{obj.tags.length - 3}</span>
          )}
        </div>
      )}
      <div className="spatial-card-footer">
        <span className="spatial-card-status">{getStatus(obj)}</span>
        {obj.embedding && <span className="spatial-card-embedded" />}
      </div>
    </div>
  );
}
