import { resolve } from "node:path";
import { fetchReadyIssues, atomicLabelSwap, createPr, commentOnIssue } from "./github.js";
import { acquireRunlock } from "./runlock.js";
import { repoRoot, createBranch, commitAndPush, checkoutMain } from "./git.js";
import { runClaude } from "./claude.js";
import { logEntry, log } from "./log.js";
import { config } from "./config.js";

/**
 * Process a single issue: branch → claude → commit → push → PR → label update.
 */
async function processIssue(
  root: string,
  issue: { number: number; title: string; body: string },
): Promise<void> {
  const start = Date.now();
  const branch = `bot/issue-${issue.number}`;
  const jobId = `issue-${issue.number}-${start}`;

  log(`Processing issue #${issue.number}: ${issue.title} (jobId=${jobId})`);

  // Step 1: atomic label swap ready → bot-in-progress
  await atomicLabelSwap(issue.number, "ready", "bot-in-progress");

  let prUrl: string | null = null;
  let outcome: "pr_opened" | "claude_error" | "git_error" = "pr_opened";
  let errorMsg: string | undefined;

  try {
    // Step 2: create branch from latest main
    await createBranch(root, branch);

    // Step 3: acquire shared runlock (blocks until free)
    const release = await acquireRunlock();
    try {
      // Step 4 + 5: invoke Claude Code headlessly
      await runClaude(root, jobId, issue.title, issue.body);
    } finally {
      await release();
    }

    // Step 6: commit and push
    const commitMsg = `chore: ${issue.title} (#${issue.number})`;
    await commitAndPush(root, branch, commitMsg);

    // Step 7: open PR with bot-authored label, forwarded meta, reviewer auto-assign
    prUrl = await createPr(branch, issue.number, issue.title, issue.body, []);

    // Step 8: update issue labels and comment
    await atomicLabelSwap(issue.number, "bot-in-progress", "bot-pr-opened");
    await commentOnIssue(
      issue.number,
      `Bot worker opened PR: ${prUrl}\n\nReview the diff and preview URL, then merge when satisfied.`,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`Error on issue #${issue.number}: ${msg}`);
    outcome = msg.toLowerCase().includes("claude") ? "claude_error" : "git_error";
    errorMsg = msg;

    // Revert label back to ready so it can be retried
    await atomicLabelSwap(issue.number, "bot-in-progress", "ready").catch(() => {});
  } finally {
    await checkoutMain(root);
  }

  await logEntry({
    ts: new Date().toISOString(),
    job_id: jobId,
    issue_number: issue.number,
    issue_title: issue.title,
    outcome,
    pr_url: prUrl,
    branch,
    audit_log: resolve(config.claude.auditLogDir, `${jobId}.jsonl`),
    duration_ms: Date.now() - start,
    error: errorMsg,
  });
}

/**
 * Run one poll cycle: fetch ready issues and process up to MAX_CONCURRENT_JOBS.
 * In practice MAX_CONCURRENT_JOBS=1 so this is serial.
 */
export async function pollCycle(root: string): Promise<void> {
  const issues = await fetchReadyIssues();
  if (issues.length === 0) {
    log("No ready issues found");
    return;
  }

  log(`Found ${issues.length} ready issue(s)`);
  // Process one at a time (MAX_CONCURRENT_JOBS=1 default)
  for (const issue of issues.slice(0, 1)) {
    await processIssue(root, issue);
  }
}
