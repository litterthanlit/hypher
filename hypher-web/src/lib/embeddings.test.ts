import { describe, expect, it, vi } from "vitest";

const transformers = vi.hoisted(() => ({
  loaded: vi.fn(),
  pipeline: vi.fn(async () => async () => ({
    data: new Float32Array([0.25, 0.75]),
  })),
}));

vi.mock("@huggingface/transformers", () => {
  transformers.loaded();
  return { pipeline: transformers.pipeline };
});

describe("embeddings", () => {
  it("does not load transformers until an embedding is requested", async () => {
    const embeddings = await import("./embeddings");

    expect(transformers.loaded).not.toHaveBeenCalled();
    expect(transformers.pipeline).not.toHaveBeenCalled();
    expect(embeddings.isLoading()).toBe(false);

    await expect(embeddings.embed("lazy path")).resolves.toEqual([0.25, 0.75]);
    expect(transformers.loaded).toHaveBeenCalledTimes(1);
    expect(transformers.pipeline).toHaveBeenCalledTimes(1);
  });
});
