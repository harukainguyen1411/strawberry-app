/**
 * Reviewer resolution for coder-worker PRs.
 *
 * Priority:
 * 1. CODER_WORKER_DEFAULT_REVIEWERS env var (comma-separated GitHub usernames).
 * 2. Hardcoded default: ["Duongntd"].
 *
 * resolveReviewers drops the PR author (GitHub rejects self-review)
 * and deduplicates the list.
 */

function loadDefaultReviewers(): string[] {
  const envVal = process.env.CODER_WORKER_DEFAULT_REVIEWERS;
  if (envVal) {
    return envVal
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return ["Duongntd"];
}

/**
 * Resolves the list of reviewers for a PR.
 *
 * @param labels - Labels on the triggering issue (unused in single-repo setup;
 *                 kept for API compatibility with the plan's by_label extension point).
 * @param prAuthor - GitHub login of the PR author to exclude (GitHub rejects self-review).
 * @returns Deduplicated list of reviewer logins.
 */
export function resolveReviewers(
  labels: string[],
  prAuthor?: string,
): string[] {
  void labels; // no per-label overrides in the single-repo setup
  const reviewers = loadDefaultReviewers();
  const seen = new Set<string>();
  const result: string[] = [];
  for (const r of reviewers) {
    if (r === prAuthor) continue;
    if (seen.has(r)) continue;
    seen.add(r);
    result.push(r);
  }
  return result;
}
