import type { AnyObject } from "@/types";
import { getEmbeddingText } from "@/types";
import {
  browserEmbeddingProvider,
  type EmbeddingProvider,
} from "./embeddings";
export {
  computeSuggestionsForObject,
  computeSuggestionsFromData,
  cosineSimilarity,
  suggestProjectFromData,
  suggestRelatedOnDrop,
} from "./suggestions";

export async function generateEmbedding(
  obj: AnyObject,
  provider: Pick<EmbeddingProvider, "embed"> = browserEmbeddingProvider
): Promise<AnyObject> {
  const text = getEmbeddingText(obj);
  if (!text) return obj;
  if (obj.embeddingText === text && obj.embedding) return obj;

  const vector = await provider.embed(text);
  return { ...obj, embedding: vector, embeddingText: text, modifiedAt: Date.now() };
}
