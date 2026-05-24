import { normalizeHypherApiOrigin } from "./origins";
import type {
  CaptureInput,
  CaptureTokenProvider,
  CaptureTokenValue,
  HypherBrowserConfig,
  Project,
} from "./types";

const TOKEN_REFRESH_SKEW_MS = 30_000;

function readToken(value: CaptureTokenValue): { token: string; expiresAt?: number } {
  if (typeof value === "string") return { token: value };
  return value;
}

function createTokenCache(provider: CaptureTokenProvider) {
  let cached: { token: string; expiresAt?: number } | null = null;
  return async () => {
    const now = Date.now();
    if (cached?.expiresAt && cached.expiresAt - TOKEN_REFRESH_SKEW_MS > now) {
      return cached.token;
    }
    cached = readToken(await provider());
    if (!cached.token.startsWith("hct_")) {
      throw new Error("Browser capture clients require a short-lived capture token");
    }
    return cached.token;
  };
}

export function createBrowserClient(config: HypherBrowserConfig) {
  const baseUrl = normalizeHypherApiOrigin(config.baseUrl);
  const getToken = createTokenCache(config.tokenProvider);

  async function authHeaders() {
    return {
      Authorization: `Bearer ${await getToken()}`,
      "Content-Type": "application/json",
    };
  }

  return {
    async capture(input: CaptureInput): Promise<{ id: string }> {
      const res = await fetch(`${baseUrl}/api/capture`, {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Capture failed: ${text}`);
      }
      return res.json();
    },

    async getProjects(): Promise<Project[]> {
      const res = await fetch(`${baseUrl}/api/projects`, {
        headers: await authHeaders(),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to fetch projects: ${text}`);
      }
      const data = await res.json();
      return data.projects;
    },
  };
}
