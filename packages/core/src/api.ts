import type { CaptureInput, Project, HypherConfig } from "./types";

const DEFAULT_BASE_URL = "https://grandiose-manatee-518.eu-west-1.convex.site";

export function createClient(config: HypherConfig) {
  const baseUrl = config.baseUrl || DEFAULT_BASE_URL;
  const headers = {
    Authorization: `Bearer ${config.apiKey}`,
    "Content-Type": "application/json",
  };

  return {
    async capture(input: CaptureInput): Promise<{ id: string }> {
      const res = await fetch(`${baseUrl}/api/capture`, {
        method: "POST",
        headers,
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Capture failed: ${text}`);
      }
      return res.json();
    },

    async getProjects(): Promise<Project[]> {
      const res = await fetch(`${baseUrl}/api/projects`, { headers });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to fetch projects: ${text}`);
      }
      const data = await res.json();
      return data.projects;
    },
  };
}
