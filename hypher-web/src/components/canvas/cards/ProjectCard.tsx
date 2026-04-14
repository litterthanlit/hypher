"use client";

import type { Project } from "@/types";
import { getDisplayName } from "@/types";
import { KindIcon } from "../../Icons";
import { KIND_ACCENT, getPreview, getStatus } from "./cardUtils";

interface Props {
  obj: Project;
}

export function ProjectCard({ obj }: Props) {
  return (
    <>
      <div className="spatial-card-accent-bar" />
      <div className="spatial-card-body">
        <div className="spatial-card-header">
          <KindIcon kind={obj.kind} className="kind-icon" />
          <span className="spatial-card-title">{getDisplayName(obj)}</span>
        </div>
        {getPreview(obj) && <p className="spatial-card-preview">{getPreview(obj)}</p>}
        <div className="spatial-card-footer">
          <span className="spatial-card-status" style={{ color: KIND_ACCENT[obj.kind] }}>{getStatus(obj)}</span>
        </div>
      </div>
    </>
  );
}
