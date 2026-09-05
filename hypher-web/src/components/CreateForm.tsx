"use client";

import { useState } from "react";
import type { AnyObject, NoteMaturity, ArtifactType } from "@/types";

interface Props {
  kind: "project" | "note" | "artifact";
  onSubmit: (obj: AnyObject) => void;
  onCancel: () => void;
}

export function CreateForm({ kind, onSubmit, onCancel }: Props) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [content, setContent] = useState("");
  const [maturity, setMaturity] = useState<NoteMaturity>("fleeting");
  const [artType, setArtType] = useState<ArtifactType>("other");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const now = Date.now();
    const id = crypto.randomUUID();

    if (kind === "project" && name.trim()) {
      onSubmit({ id, kind: "project", name: name.trim(), description: desc, status: "active", createdAt: now, modifiedAt: now });
    } else if (kind === "note" && content.trim()) {
      onSubmit({ id, kind: "note", content: content.trim(), maturity, createdAt: now, modifiedAt: now });
    } else if (kind === "artifact" && name.trim()) {
      onSubmit({ id, kind: "artifact", name: name.trim(), type: artType, createdAt: now, modifiedAt: now });
    }
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h3>New {kind.charAt(0).toUpperCase() + kind.slice(1)}</h3>

        {kind === "project" && (
          <>
            <label>Name<input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Project name…" /></label>
            <label>Description<textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Optional — what this project is" rows={3} /></label>
          </>
        )}

        {kind === "note" && (
          <>
            <label>Content<textarea autoFocus value={content} onChange={(e) => setContent(e.target.value)} placeholder="Write your note…" rows={5} /></label>
            <label>Maturity
              <select value={maturity} onChange={(e) => setMaturity(e.target.value as NoteMaturity)}>
                {["fleeting", "developing", "structured", "reference"].map((m) => (
                  <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
                ))}
              </select>
            </label>
          </>
        )}

        {kind === "artifact" && (
          <>
            <label>Name<input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Artifact name…" /></label>
            <label>Type
              <select value={artType} onChange={(e) => setArtType(e.target.value as ArtifactType)}>
                {["image", "video", "code", "document", "font", "audio", "other"].map((t) => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </label>
          </>
        )}

        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
          <button type="submit" className="btn-primary">Create</button>
        </div>
      </form>
    </div>
  );
}
