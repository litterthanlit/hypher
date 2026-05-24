import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchProjects, fetchTagSuggestions } from "./api";
import { HYPHER_PUBLIC_API_ORIGIN } from "./origins";

function installChrome(storage: Record<string, unknown> = {}) {
  vi.stubGlobal("chrome", {
    storage: {
      local: {
        get: vi.fn(async (key: string) => ({ [key]: storage[key] })),
      },
    },
  });
}

describe("popup API helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("loads projects from the public app origin", async () => {
    installChrome();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([{ id: "p1", title: "Project" }]), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchProjects()).resolves.toEqual([{ id: "p1", title: "Project" }]);
    expect(fetchMock).toHaveBeenCalledWith(
      `${HYPHER_PUBLIC_API_ORIGIN}/api/projects`,
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("loads tag suggestions from the public app origin", async () => {
    installChrome();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ tags: ["alpha", "beta"] }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchTagSuggestions("long enough content")).resolves.toEqual(["alpha", "beta"]);
    expect(fetchMock).toHaveBeenCalledWith(
      `${HYPHER_PUBLIC_API_ORIGIN}/api/tag-suggest`,
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("rejects invalid host overrides before making requests", async () => {
    installChrome({ hostOverride: "file:///tmp/hypher" });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchProjects()).rejects.toThrow("Invalid Hypher API origin");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
