import { normalizeHypherApiOrigin } from "./origins";
import type { CaptureInput, HypherServerConfig, Project } from "./types";

export function createServerClient(config: HypherServerConfig) {
  const baseUrl = normalizeHypherApiOrigin(config.baseUrl);
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
