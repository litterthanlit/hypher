export type SettingsAccessState = "loading" | "sign_in_required" | "settings";

export function getSettingsAccessState(params: {
  isLoading: boolean;
  isAuthenticated: boolean;
}): SettingsAccessState {
  if (params.isLoading) return "loading";
  return params.isAuthenticated ? "settings" : "sign_in_required";
}
