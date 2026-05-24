import { describe, expect, it } from "vitest";
import { getSettingsAccessState } from "./settingsAccess";

describe("getSettingsAccessState", () => {
  it("waits while auth is loading", () => {
    expect(getSettingsAccessState({ isLoading: true, isAuthenticated: false })).toBe("loading");
  });

  it("requires sign-in before protected settings queries run", () => {
    expect(getSettingsAccessState({ isLoading: false, isAuthenticated: false, hasBetaAccess: false, isAdmin: false })).toBe("sign_in_required");
  });

  it("HYP-SEC-002 blocks signed-in non-beta users from settings", () => {
    expect(getSettingsAccessState({ isLoading: false, isAuthenticated: true, hasBetaAccess: false, isAdmin: false })).toBe("beta_required");
  });

  it("allows settings for beta users and admins", () => {
    expect(getSettingsAccessState({ isLoading: false, isAuthenticated: true, hasBetaAccess: true, isAdmin: false })).toBe("settings");
    expect(getSettingsAccessState({ isLoading: false, isAuthenticated: true, hasBetaAccess: false, isAdmin: true })).toBe("settings");
  });
});
