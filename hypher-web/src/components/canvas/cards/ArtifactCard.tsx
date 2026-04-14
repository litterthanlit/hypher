"use client";

import type { Artifact } from "@/types";
import { getDisplayName } from "@/types";
import { ArtifactIcon } from "../../Icons";

interface Props {
  obj: Artifact;
}

export function ArtifactCard({ obj }: Props) {
  return (
    <>
      {obj.thumbnailDataUrl ? (
        <>
          <img className="spatial-card-thumb" src={obj.thumbnailDataUrl} alt={getDisplayName(obj)} />
          <div className="spatial-card-thumb-label">{getDisplayName(obj)}</div>
        </>
      ) : (
        <>
          <div className="spatial-card-no-thumb">
            <ArtifactIcon className="kind-icon" />
          </div>
          <div className="spatial-card-thumb-label">{getDisplayName(obj)}</div>
        </>
      )}
    </>
  );
}
