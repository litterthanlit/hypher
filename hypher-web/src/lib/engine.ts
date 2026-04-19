import type { AnyObject, Connection, ProjectSuggestion } from "@/types";
import { getEmbeddingText, getDisplayName } from "@/types";
import { embed, cosineSimilarity } from "./embeddings";

const SIMILARITY_THRESHOLD = 0.45; // MiniLM scores are lower than Apple NLEmbedding

export async function generateEmbedding(obj: AnyObject): Promise<AnyObject> {
  const text = getEmbeddingText(obj);
  if (!text) return obj;
  if (obj.embeddingText === text && obj.embedding) return obj;

  const vector = await embed(text);
  return { ...obj, embedding: vector, embeddingText: text, modifiedAt: Date.now() };
}

/**
 * Pure computation: given all objects and existing connections,
 * returns NEW connection data to be saved (without IDs — caller assigns them).
 */
export function computeSuggestionsFromData(
  allObjects: AnyObject[],
  existingConnections: Connection[]
): Omit<Connection, "id">[] {
  const embedded = allObjects.filter((o) => o.embedding && o.embedding.length > 0);

  const existingPairs = new Set<string>();
  for (const conn of existingConnections) {
    existingPairs.add(pairKey(conn.sourceId, conn.targetId));
  }

  const newConnections: Omit<Connection, "id">[] = [];

  for (let i = 0; i < embedded.length; i++) {
    for (let j = i + 1; j < embedded.length; j++) {
      const a = embedded[i]!;
      const b = embedded[j]!;

      const key = pairKey(a.id, b.id);
      if (existingPairs.has(key)) continue;

      const similarity = cosineSimilarity(a.embedding!, b.embedding!);
      if (similarity >= SIMILARITY_THRESHOLD) {
        newConnections.push({
          sourceId: a.id,
          targetId: b.id,
          sourceKind: a.kind,
          targetKind: b.kind,
          type: "ai_suggested",
          confidence: similarity,
          reason: `Similarity: ${Math.round(similarity * 100)}% — related themes between "${getDisplayName(a)}" and "${getDisplayName(b)}"`,
          createdAt: Date.now(),
        });
        existingPairs.add(key);
      }
    }
  }

  return newConnections;
}

/**
 * Pure computation: suggest projects for an object based on embedding similarity.
 */
export function suggestProjectFromData(
  obj: AnyObject,
  allObjects: AnyObject[]
): ProjectSuggestion[] {
  const projects = allObjects.filter(
    (o) => o.kind === "project" && o.embedding && o.embedding.length > 0
  );
  if (!obj.embedding || projects.length === 0) return [];

  return projects
    .map((p) => {
      const metadataSimilarity = cosineSimilarity(obj.embedding!, p.embedding!);
      const childMatches = allObjects
        .filter(
          (candidate) =>
            candidate.projectId === p.id &&
            candidate.id !== obj.id &&
            candidate.embedding &&
            candidate.embedding.length > 0
        )
        .map((candidate) => ({
          candidate,
          similarity: cosineSimilarity(obj.embedding!, candidate.embedding!),
        }))
        .sort((a, b) => b.similarity - a.similarity);

      const bestChild = childMatches[0];
      const confidence = Math.max(metadataSimilarity, bestChild?.similarity ?? 0);
      const projectName = p.kind === "project" ? p.name : "";
      const reason =
        bestChild && bestChild.similarity > metadataSimilarity
          ? `Related to "${getDisplayName(bestChild.candidate)}" in ${projectName}`
          : `Matches the project "${projectName}"`;

      return {
        projectId: p.id,
        projectName,
        confidence,
        reason,
      };
    })
    .filter((s) => s.confidence >= 0.35)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);
}

function pairKey(a: string, b: string): string {
  return [a, b].sort().join("|");
}

// ── Drop-to-suggest chip ──────────────────────────────────────────────────────
// Higher threshold than SIMILARITY_THRESHOLD (0.45): "definitely related" vs
// "could be related". Only note-to-note, spatial proximity required on both.
const SPATIAL_RADIUS_PX = 600;
const SEMANTIC_THRESHOLD = 0.7;

/**
 * Given a freshly-dropped note and all canvas objects, return nearby notes
 * that are both within SPATIAL_RADIUS_PX **and** semantically similar
 * (cosine similarity ≥ SEMANTIC_THRESHOLD). Used to drive the SuggestionChip.
 *
 * Requirements for both sides:
 *  - kind === "note"
 *  - embedding present and non-empty
 *  - canvasPosition present
 *  - candidate id !== dropped id
 */
export function suggestRelatedOnDrop(
  dropped: AnyObject,
  allObjects: AnyObject[],
): { candidateIds: string[]; topReason: string } {
  if (!dropped.embedding || !dropped.canvasPosition || dropped.kind !== "note") {
    return { candidateIds: [], topReason: "" };
  }
  const dx = dropped.canvasPosition.x;
  const dy = dropped.canvasPosition.y;
  const r2 = SPATIAL_RADIUS_PX * SPATIAL_RADIUS_PX;

  const matches: { id: string; sim: number; name: string }[] = [];

  for (const o of allObjects) {
    if (o.id === dropped.id) continue;
    if (o.kind !== "note") continue;
    if (!o.embedding || o.embedding.length === 0) continue;
    if (!o.canvasPosition) continue;
    const d2 = (o.canvasPosition.x - dx) ** 2 + (o.canvasPosition.y - dy) ** 2;
    if (d2 > r2) continue;
    const sim = cosineSimilarity(dropped.embedding, o.embedding);
    if (sim >= SEMANTIC_THRESHOLD) {
      matches.push({ id: o.id, sim, name: getDisplayName(o) });
    }
  }

  matches.sort((a, b) => b.sim - a.sim);

  return {
    candidateIds: matches.map((m) => m.id),
    topReason: matches[0]
      ? `Closest match: "${matches[0].name}" (${Math.round(matches[0].sim * 100)}%)`
      : "",
  };
}
