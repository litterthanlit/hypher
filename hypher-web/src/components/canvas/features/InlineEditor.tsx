"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import type { AnyObject, Note, Project, Artifact } from "@/types";

interface Props {
  obj: AnyObject;
  onSave: (updates: Partial<Note> | Partial<Project> | Partial<Artifact>) => void;
  onExit: () => void;
}

export function InlineEditor({ obj, onSave, onExit }: Props) {
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const debouncedSave = useCallback((updates: Record<string, string>) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      onSave(updates as any);
    }, 300);
  }, [onSave]);

  // Click outside to exit
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        if (saveTimer.current) {
          clearTimeout(saveTimer.current);
          saveTimer.current = null;
        }
        onExit();
      }
    };
    const timer = setTimeout(() => document.addEventListener("mousedown", handler), 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handler);
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [onExit]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onExit();
  };

  if (obj.kind === "note") return <NoteEditor note={obj as Note} debouncedSave={debouncedSave} onKeyDown={onKeyDown} containerRef={containerRef} />;
  if (obj.kind === "project") return <ProjectEditor project={obj as Project} debouncedSave={debouncedSave} onKeyDown={onKeyDown} containerRef={containerRef} />;
  if (obj.kind === "artifact") return <ArtifactEditor artifact={obj as Artifact} debouncedSave={debouncedSave} onKeyDown={onKeyDown} containerRef={containerRef} />;
  return null;
}

function NoteEditor({ note, debouncedSave, onKeyDown, containerRef }: {
  note: Note;
  debouncedSave: (u: Record<string, string>) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [content, setContent] = useState(note.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
    textareaRef.current?.select();
  }, []);

  return (
    <div ref={containerRef} className="inline-editor" onKeyDown={onKeyDown}>
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => {
          setContent(e.target.value);
          debouncedSave({ content: e.target.value });
        }}
        style={{ fontSize: 14, fontWeight: 400, lineHeight: 1.5 }}
        rows={Math.max(3, content.split("\n").length)}
      />
    </div>
  );
}

function ProjectEditor({ project, debouncedSave, onKeyDown, containerRef }: {
  project: Project;
  debouncedSave: (u: Record<string, string>) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <div ref={containerRef} className="inline-editor" onKeyDown={onKeyDown}>
      <input
        ref={inputRef}
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          debouncedSave({ name: e.target.value, description });
        }}
        style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}
      />
      <textarea
        value={description}
        onChange={(e) => {
          setDescription(e.target.value);
          debouncedSave({ name, description: e.target.value });
        }}
        style={{ fontSize: 12 }}
        rows={2}
      />
    </div>
  );
}

function ArtifactEditor({ artifact, debouncedSave, onKeyDown, containerRef }: {
  artifact: Artifact;
  debouncedSave: (u: Record<string, string>) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [name, setName] = useState(artifact.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <div ref={containerRef} className="inline-editor" onKeyDown={onKeyDown}>
      <input
        ref={inputRef}
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          debouncedSave({ name: e.target.value });
        }}
        style={{ fontSize: 11 }}
      />
    </div>
  );
}
