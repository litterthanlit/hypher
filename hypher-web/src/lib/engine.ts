import type { AnyObject, Connection } from "@/types";
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
): { projectId: string; projectName: string; confidence: number }[] {
  const projects = allObjects.filter(
    (o) => o.kind === "project" && o.embedding && o.embedding.length > 0
  );
  if (!obj.embedding || projects.length === 0) return [];

  return projects
    .map((p) => ({
      projectId: p.id,
      projectName: p.kind === "project" ? p.name : "",
      confidence: cosineSimilarity(obj.embedding!, p.embedding!),
    }))
    .filter((s) => s.confidence >= 0.35)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);
}

function pairKey(a: string, b: string): string {
  return [a, b].sort().join("|");
}
