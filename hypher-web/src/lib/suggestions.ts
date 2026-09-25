import type { AnyObject, Connection, ProjectSuggestion } from "@/types";
import { getDisplayName } from "@/types";

const SIMILARITY_THRESHOLD = 0.45; // MiniLM scores are lower than Apple NLEmbedding

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    magA += a[i]! * a[i]!;
    magB += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
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

  const existingPairs = connectionPairSet(existingConnections);
  const newConnections: Omit<Connection, "id">[] = [];

  for (let i = 0; i < embedded.length; i++) {
    for (let j = i + 1; j < embedded.length; j++) {
      const a = embedded[i]!;
      const b = embedded[j]!;

      const key = pairKey(a.id, b.id);
      if (existingPairs.has(key)) continue;

      const similarity = cosineSimilarity(a.embedding!, b.embedding!);
      if (similarity >= SIMILARITY_THRESHOLD) {
        newConnections.push(buildSuggestionConnection(a, b, similarity));
        existingPairs.add(key);
      }
    }
  }

  return newConnections;
}

export function computeSuggestionsForObject(
  changedObject: AnyObject,
  candidateObjects: AnyObject[],
  existingConnections: Connection[]
): Omit<Connection, "id">[] {
  if (!changedObject.embedding || changedObject.embedding.length === 0) return [];

  const existingPairs = connectionPairSet(existingConnections);
  const newConnections: Omit<Connection, "id">[] = [];

  for (const candidate of candidateObjects) {
    if (candidate.id === changedObject.id) continue;
    if (!candidate.embedding || candidate.embedding.length === 0) continue;

    const key = pairKey(changedObject.id, candidate.id);
    if (existingPairs.has(key)) continue;

    const similarity = cosineSimilarity(changedObject.embedding, candidate.embedding);
    if (similarity >= SIMILARITY_THRESHOLD) {
      newConnections.push(buildSuggestionConnection(changedObject, candidate, similarity));
      existingPairs.add(key);
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

function connectionPairSet(connections: Connection[]): Set<string> {
  return new Set(connections.map((conn) => pairKey(conn.sourceId, conn.targetId)));
}

function buildSuggestionConnection(
  source: AnyObject,
  target: AnyObject,
  similarity: number
): Omit<Connection, "id"> {
  return {
    sourceId: source.id,
    targetId: target.id,
    sourceKind: source.kind,
    targetKind: target.kind,
    type: "ai_suggested",
    confidence: similarity,
    reason: `Similarity: ${Math.round(similarity * 100)}% — related themes between "${getDisplayName(source)}" and "${getDisplayName(target)}"`,
    createdAt: Date.now(),
  };
}
