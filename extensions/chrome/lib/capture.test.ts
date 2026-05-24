import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { captureToHypher, getQueue, replayQueue, setLastProjectId } from "./capture";
import { HYPHER_PUBLIC_API_ORIGIN } from "./origins";

type Storage = Record<string, unknown>;

function response(status = 200): Response {
  return new Response("{}", { status });
}

function installChrome(storage: Storage = {}) {
  const get = vi.fn(async (keys?: string | string[]) => {
    if (!keys) return { ...storage };
    if (typeof keys === "string") return { [keys]: storage[keys] };
    return Object.fromEntries(keys.map((key) => [key, storage[key]]));
  });
  const set = vi.fn(async (items: Storage) => {
    Object.assign(storage, items);
  });

  vi.stubGlobal("chrome", {
    storage: { local: { get, set } },
    notifications: { create: vi.fn() },
    action: {
      setBadgeText: vi.fn(),
      setBadgeBackgroundColor: vi.fn(),
    },
  });

  return { storage, get, set };
}

describe("capture endpoints", () => {
  beforeEach(() => {
    vi.stubGlobal("crypto", { randomUUID: () => "queued-1" });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("sends session captures to the public app origin with cookies", async () => {
    installChrome({ authMode: "session" });
    const fetchMock = vi.fn().mockResolvedValue(response());
    vi.stubGlobal("fetch", fetchMock);

    await captureToHypher({ content: "hello", sourceUrl: "https://source.test", sourceTitle: "Source" });

    expect(fetchMock).toHaveBeenCalledWith(
      `${HYPHER_PUBLIC_API_ORIGIN}/capture`,
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("sends API-key captures to the same public API origin without cookies", async () => {
    installChrome({ authMode: "api-key", apiKey: "hy_test" });
    const fetchMock = vi.fn().mockResolvedValue(response());
    vi.stubGlobal("fetch", fetchMock);

    await captureToHypher({ content: "hello", sourceUrl: "", sourceTitle: "" });

    expect(fetchMock).toHaveBeenCalledWith(
      `${HYPHER_PUBLIC_API_ORIGIN}/api/capture`,
      expect.objectContaining({
        credentials: "omit",
        headers: expect.objectContaining({ Authorization: "Bearer hy_test" }),
      }),
    );
  });

  it("queues captures when a configured API host is invalid", async () => {
    installChrome({ authMode: "api-key", apiKey: "hy_test", apiHostOverride: "chrome-extension://bad" });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await captureToHypher({ content: "hello", sourceUrl: "", sourceTitle: "" });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(await getQueue()).toHaveLength(1);
  });

  it("retries queued captures and removes them after success", async () => {
    const now = 1_700_000_000_000;
    vi.useFakeTimers();
    vi.setSystemTime(now);
    installChrome({
      authMode: "session",
      queue: [{
        id: "queued-1",
        content: "queued",
        sourceUrl: "https://source.test",
        sourceTitle: "Source",
        createdAt: now,
        attempts: 0,
      }],
    });
    const fetchMock = vi.fn().mockResolvedValue(response());
    vi.stubGlobal("fetch", fetchMock);

    await replayQueue();

    expect(fetchMock).toHaveBeenCalledWith(`${HYPHER_PUBLIC_API_ORIGIN}/capture`, expect.any(Object));
    expect(await getQueue()).toEqual([]);
  });

  it("persists the selected project for later captures", async () => {
    const { storage } = installChrome();

    await setLastProjectId("project_123");

    expect(storage.lastProjectId).toBe("project_123");
  });
});
