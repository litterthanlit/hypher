import { afterEach, describe, expect, it, vi } from "vitest";
import { HYPHER_PUBLIC_API_ORIGIN } from "./origins";
import { createBrowserClient } from "./browser";

describe("createBrowserClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("uses short-lived capture tokens for browser requests", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: "note_1" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = createBrowserClient({
      tokenProvider: () => ({ token: `hct_${"a".repeat(32)}_${"b".repeat(64)}`, expiresAt: Date.now() + 60_000 }),
    });

    await client.capture({ content: "hello" });

    expect(fetchMock).toHaveBeenCalledWith(
      `${HYPHER_PUBLIC_API_ORIGIN}/api/capture`,
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: expect.stringMatching(/^Bearer hct_/),
        }),
      })
    );
  });

  it("rejects static API keys in the browser-safe client", async () => {
    const client = createBrowserClient({ tokenProvider: () => "hyp_server_key" });

    await expect(client.capture({ content: "hello" })).rejects.toThrow(
      "Browser capture clients require a short-lived capture token"
    );
  });
});
