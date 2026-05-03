import { describe, expect, it } from "vitest";
import { getSettingsAccessState } from "./settingsAccess";

describe("getSettingsAccessState", () => {
  it("waits while auth is loading", () => {
    expect(getSettingsAccessState({ isLoading: true, isAuthenticated: false })).toBe("loading");
  });

  it("requires sign-in before protected settings queries run", () => {
    expect(getSettingsAccessState({ isLoading: false, isAuthenticated: false })).toBe("sign_in_required");
  });

  it("allows settings when authenticated", () => {
    expect(getSettingsAccessState({ isLoading: false, isAuthenticated: true })).toBe("settings");
  });
});
