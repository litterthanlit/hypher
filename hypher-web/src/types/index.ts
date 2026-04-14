export type ProjectStatus = "seed" | "growing" | "active" | "shipped" | "dormant" | "archived";
export type NoteMaturity = "fleeting" | "developing" | "structured" | "reference";
export type ArtifactType = "image" | "video" | "code" | "document" | "font" | "audio" | "other";
export type ConnectionType = "manual" | "ai_suggested" | "ai_confirmed" | "dismissed";
export type ObjectKind = "project" | "note" | "artifact";

export interface CanvasPosition {
  x: number;
  y: number;
}

export interface HypherObject {
  id: string;
  kind: ObjectKind;
  createdAt: number;
  modifiedAt: number;
  embedding?: number[];
  embeddingText?: string;
  tags?: string[];
  canvasPosition?: CanvasPosition;
  projectId?: string | null;
  lastSurfacedAt?: number;
  canvasColor?: string;
  canvasSize?: { w: number; h: number };
}

export interface Project extends HypherObject {
  kind: "project";
  name: string;
  description: string;
  status: ProjectStatus;
}

export interface Note extends HypherObject {
  kind: "note";
  content: string;
  maturity: NoteMaturity;
}

export interface Artifact extends HypherObject {
  kind: "artifact";
  name: string;
  type: ArtifactType;
  fileReference?: string;
  thumbnailDataUrl?: string;
}

export interface Connection {
  id: string;
  sourceId: string;
  targetId: string;
  sourceKind: ObjectKind;
  targetKind: ObjectKind;
  type: ConnectionType;
  confidence: number;
  reason: string;
  createdAt: number;
}

export type ActivityAction = "created" | "updated" | "deleted" | "connected" | "suggested" | "dismissed";

export interface ActivityEntry {
  id: string;
  action: ActivityAction;
  objectId: string;
  objectKind: ObjectKind;
  objectName: string;
  targetId?: string;
  targetKind?: ObjectKind;
  targetName?: string;
  timestamp: number;
}

export type AnyObject = Project | Note | Artifact;

export function getDisplayName(obj: AnyObject): string {
  switch (obj.kind) {
    case "project": return obj.name;
    case "note": {
      const trimmed = obj.content.trim();
      return trimmed.length <= 40 ? trimmed : trimmed.slice(0, 40) + "\u2026";
    }
    case "artifact": return obj.name;
  }
}

export function getEmbeddingText(obj: AnyObject): string {
  switch (obj.kind) {
    case "project": return [obj.name, obj.description].filter(Boolean).join(". ");
    case "note": return obj.content;
    case "artifact": return `${obj.name} — ${obj.type}`;
  }
}
