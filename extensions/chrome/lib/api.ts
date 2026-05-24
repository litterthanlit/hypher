/**
 * Fetch wrappers for hypher.app API endpoints used by the popup.
 * The service worker uses these for project listing and tag suggestion.
 */

import { getConfiguredAppOrigin } from "./origins";

const FETCH_TIMEOUT_MS = 10_000;

function withTimeout(promise: Promise<Response>): Promise<Response> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Request timed out")), FETCH_TIMEOUT_MS);
    promise.then(
      (r) => { clearTimeout(timer); resolve(r); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

export interface Project {
  id: string;
  title: string;
}

/**
 * Fetch the user's project list from the session-authed Next.js endpoint.
 * Requires the user to be signed into hypher.app in another tab.
 */
export async function fetchProjects(): Promise<Project[]> {
  const host = await getConfiguredAppOrigin();
  const res = await withTimeout(
    fetch(`${host}/api/projects`, {
      method: "GET",
      credentials: "include",
      headers: { Accept: "application/json" },
    }),
  );
  if (!res.ok) throw new Error(`projects: HTTP ${res.status}`);
  const data = (await res.json()) as { projects?: Project[] } | Project[];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.projects)) return data.projects;
  return [];
}

/**
 * Request AI-suggested tags for the given content from the session-authed endpoint.
 */
export async function fetchTagSuggestions(content: string): Promise<string[]> {
  const host = await getConfiguredAppOrigin();
  const res = await withTimeout(
    fetch(`${host}/api/tag-suggest`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ content }),
    }),
  );
  if (!res.ok) return [];
  const data = (await res.json()) as { tags?: string[] };
  return Array.isArray(data.tags) ? data.tags : [];
}
