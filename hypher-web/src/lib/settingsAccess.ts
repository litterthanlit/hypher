export type SettingsAccessState = "loading" | "sign_in_required" | "beta_required" | "settings";

export function getSettingsAccessState(params: {
  isLoading: boolean;
  isAuthenticated: boolean;
  hasBetaAccess?: boolean;
  isAdmin?: boolean;
}): SettingsAccessState {
  if (params.isLoading) return "loading";
  if (!params.isAuthenticated) return "sign_in_required";
  if (params.isAdmin || params.hasBetaAccess) return "settings";
  return "beta_required";
}
