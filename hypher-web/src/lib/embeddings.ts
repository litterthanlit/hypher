import type { FeatureExtractionPipeline } from "@huggingface/transformers";

export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
  isLoading(): boolean;
}

let extractor: FeatureExtractionPipeline | null = null;
let loading = false;
let loadPromise: Promise<void> | null = null;

async function loadModel() {
  if (extractor) return;
  if (loadPromise) {
    await loadPromise;
    return;
  }
  loading = true;
  loadPromise = (async () => {
    const { pipeline } = await import("@huggingface/transformers");
    extractor = await pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2",
      { dtype: "q8" }
    ) as FeatureExtractionPipeline;
    loading = false;
  })();
  try {
    await loadPromise;
  } catch (error) {
    loading = false;
    loadPromise = null;
    throw error;
  }
}

export function isLoading(): boolean {
  return loading;
}

export async function embed(text: string): Promise<number[]> {
  await loadModel();
  const output = await extractor!(text, { pooling: "mean", normalize: true });
  return Array.from(output.data as Float32Array);
}

export const browserEmbeddingProvider: EmbeddingProvider = {
  embed,
  isLoading,
};

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
