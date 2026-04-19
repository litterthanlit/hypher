import { describe, expect, it } from "vitest";
import {
  LAUNCH_CHECKLIST_STORAGE_KEY,
  LAUNCH_SMOKE_TESTS,
  readLaunchChecklist,
  toggleLaunchChecklistItem,
  writeLaunchChecklist,
  type StorageLike,
} from "./launchReadinessChecklist";

function memoryStorage(initial: Record<string, string> = {}): StorageLike & { values: Record<string, string> } {
  const values = { ...initial };
  return {
    values,
    getItem(key: string) {
      return values[key] ?? null;
    },
    setItem(key: string, value: string) {
      values[key] = value;
    },
  };
}

describe("launch readiness checklist", () => {
  it("starts every smoke test unchecked", () => {
    const state = readLaunchChecklist(undefined);
    expect(LAUNCH_SMOKE_TESTS.every((test) => state[test.id] === false)).toBe(true);
  });

  it("persists checklist state in storage", () => {
    const storage = memoryStorage();
    const state = toggleLaunchChecklistItem(readLaunchChecklist(storage), "capture-sort");
    writeLaunchChecklist(storage, state);
    expect(readLaunchChecklist(storage)["capture-sort"]).toBe(true);
  });

  it("ignores unknown saved checklist ids", () => {
    const storage = memoryStorage({
      [LAUNCH_CHECKLIST_STORAGE_KEY]: JSON.stringify({
        "capture-sort": true,
        "old-flow": true,
      }),
    });
    const state = readLaunchChecklist(storage);
    expect(state["capture-sort"]).toBe(true);
    expect(state["old-flow"]).toBeUndefined();
  });
});
