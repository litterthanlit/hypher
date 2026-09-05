import { normalizeGitHubRepo } from "../../shared/githubRepo";

const MAX_GITHUB_REPO_RAW_INPUT = 500;

export const INVALID_GITHUB_REPO_INPUT =
  "Enter a valid repo (owner/name) or GitHub URL.";

export type GithubRepoBindPlan =
  | { ok: false; error: string }
  | { ok: true; repo: string; validateAndSync: boolean };

export function parseGithubRepoBindInput(input: string): string | null {
  if (input.length > MAX_GITHUB_REPO_RAW_INPUT) return null;
  return normalizeGitHubRepo(input);
}

/** Bind writes githubRepo from the string. Validate/sync only when a PAT can be decrypted. */
export function planGithubRepoBind(
  repoInput: string,
  hasDecryptableToken: boolean
): GithubRepoBindPlan {
  const repo = parseGithubRepoBindInput(repoInput);
  if (!repo) {
    return { ok: false, error: INVALID_GITHUB_REPO_INPUT };
  }
  return { ok: true, repo, validateAndSync: hasDecryptableToken };
}
