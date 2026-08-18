export function normalizeGitHubRepo(input: string | undefined | null): string | null {
  const raw = (input ?? "").trim();
  if (!raw) return null;

  let value = raw.replace(/\.git$/i, "");
  const sshMatch = value.match(/^git@github\.com:(.+)$/i);
  if (sshMatch?.[1]) {
    value = sshMatch[1];
  } else if (/github\.com/i.test(value)) {
    try {
      const url = new URL(value.startsWith("http") ? value : `https://${value.replace(/^git\+/, "")}`);
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length >= 2) {
        value = `${parts[0]}/${parts[1]}`;
      }
    } catch {
      return null;
    }
  }

  value = value.replace(/^\/+/, "").replace(/\.git$/i, "");
  if (!/^[\w.-]+\/[\w.-]+$/.test(value)) return null;
  return value;
}
