import { afterEach, describe, expect, it, vi } from "vitest";
import { HYPHER_PUBLIC_API_ORIGIN, createClient } from "./index";

describe("createClient endpoint normalization", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("uses the documented public API origin by default", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: "note_1" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await createClient({ apiKey: "hy_test" }).capture({ content: "hello" });

    expect(fetchMock).toHaveBeenCalledWith(
      `${HYPHER_PUBLIC_API_ORIGIN}/api/capture`,
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("normalizes explicit API origins before appending paths", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ projects: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await createClient({ apiKey: "hy_test", baseUrl: "https://api.example.test/path/" }).getProjects();

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/api/projects",
      expect.any(Object),
    );
  });

  it("rejects invalid API origins", () => {
    expect(() => createClient({ apiKey: "hy_test", baseUrl: "chrome-extension://abc" })).toThrow(
      "Invalid Hypher API origin",
    );
  });
});
