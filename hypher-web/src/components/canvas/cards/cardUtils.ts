import type { AnyObject, ObjectKind } from "@/types";

export const KIND_ACCENT: Record<ObjectKind, string> = {
  project: "var(--accent)",
  note: "var(--blue)",
  artifact: "var(--amber)",
};

const CARD_COLORS = ["yellow", "green", "blue", "pink", "purple", "orange", "red", "grey"] as const;

function defaultCardColor(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) hash = (hash * 31 + content.charCodeAt(i)) | 0;
  return CARD_COLORS[Math.abs(hash) % CARD_COLORS.length];
}

export function getCardColor(obj: AnyObject): string {
  if (obj.canvasColor) return obj.canvasColor;
  if (obj.kind === "note") return defaultCardColor(obj.content);
  return "";
}

export function getCardRotation(id: string): number {
  const c0 = id.charCodeAt(0) || 0;
  const c1 = id.charCodeAt(1) || 0;
  return ((c0 + c1) % 400) / 100 - 2;
}

export function getPreview(obj: AnyObject): string {
  if (obj.kind === "note") return obj.content.slice(0, 120);
  if (obj.kind === "artifact") return obj.fileReference || obj.type;
  return "";
}

export function getStatus(obj: AnyObject): string {
  if (obj.kind === "note") return obj.maturity;
  if (obj.kind === "artifact") return obj.type;
  return "";
}
