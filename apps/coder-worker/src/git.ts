import { execa } from "execa";
import { log } from "./log.js";

/**
 * Run a git command in the given working directory.
 * Throws on non-zero exit.
 */
async function git(cwd: string, args: string[]): Promise<string> {
  log(`git ${args.join(" ")}`);
  const result = await execa("git", args, { cwd, reject: true });
  return result.stdout;
}

/**
 * Resolve the root of the git repo that contains `cwd`.
 */
export async function repoRoot(cwd: string): Promise<string> {
  return git(cwd, ["rev-parse", "--show-toplevel"]);
}

/**
 * Fetch latest from origin and create a new branch from origin/main.
 */
export async function createBranch(root: string, branch: string): Promise<void> {
  await git(root, ["fetch", "origin", "main"]);
  await git(root, ["checkout", "-B", branch, "origin/main"]);
}

/**
 * Stage all changes, commit, and push.
 */
export async function commitAndPush(
  root: string,
  branch: string,
  message: string,
): Promise<void> {
  const status = await git(root, ["status", "--porcelain"]);
  if (!status.trim()) {
    throw new Error("No changes to commit — Claude made no file modifications");
  }
  await git(root, ["add", "apps/myapps/"]);
  await git(root, ["commit", "-m", message]);
  await git(root, ["push", "origin", branch]);
}

/**
 * Return to main branch (cleanup after success or failure).
 */
export async function checkoutMain(root: string): Promise<void> {
  await git(root, ["checkout", "main"]).catch(() => {
    // Non-fatal — best effort cleanup
  });
}
