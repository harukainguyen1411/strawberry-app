import { readFile, mkdir, appendFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { resolve } from "node:path";
import { execa } from "execa";
import { config } from "./config.js";
import { log } from "./log.js";

// Tools Claude is allowed to use — Bash intentionally excluded.
// Dropping Bash closes the prompt-injection → shell → network exfil path (Pyke §11.6).
const ALLOWED_TOOLS = "Edit,Write,Read,Glob,Grep,LS";

/**
 * Load the system prompt from disk and combine with the issue content.
 */
async function buildPrompt(issueTitle: string, issueBody: string): Promise<string> {
  const systemPrompt = await readFile(config.claude.systemPromptPath, "utf8");
  return [
    systemPrompt.trim(),
    "",
    "---",
    "",
    `## Issue: ${issueTitle}`,
    "",
    issueBody.trim(),
  ].join("\n");
}

/**
 * Ensure the audit log directory exists and return the path for this job's log file.
 * Directory is outside the repo tree and outside Claude's --add-dir scope so
 * Claude cannot Read the audit log of its own invocation (Pyke §11.6 audit trail).
 */
async function auditLogPath(jobId: string): Promise<string> {
  await mkdir(config.claude.auditLogDir, { recursive: true });
  return resolve(config.claude.auditLogDir, `${jobId}.jsonl`);
}

/**
 * Invoke Claude Code headlessly via `claude -p`.
 * Streams every stream-json event to:
 *   1. Our process stdout (NSSM captures this)
 *   2. A per-invocation JSONL audit log at auditLogDir/{jobId}.jsonl
 *
 * --allowedTools restricts Claude to Edit, Write, Read, Glob, Grep, LS — no Bash.
 *
 * Working directory is the myapps subtree so Claude's relative file paths resolve.
 */
export async function runClaude(
  repoRoot: string,
  jobId: string,
  issueTitle: string,
  issueBody: string,
): Promise<void> {
  const prompt = await buildPrompt(issueTitle, issueBody);
  const cwd = `${repoRoot}/apps/myapps`;
  const logPath = await auditLogPath(jobId);

  log(`Invoking claude -p (max-turns=${config.claude.maxTurns}, allowed-tools=${ALLOWED_TOOLS}) in ${cwd}`);
  log(`Audit log: ${logPath}`);

  const auditStream = createWriteStream(logPath, { flags: "a" });

  const proc = execa(
    "claude",
    [
      "-p",
      prompt,
      "--output-format",
      "stream-json",
      "--max-turns",
      String(config.claude.maxTurns),
      "--allowedTools",
      ALLOWED_TOOLS,
    ],
    {
      cwd,
      reject: false,
      stdin: "ignore",
    },
  );

  // Tee stdout: process stdout (NSSM) + per-job audit log
  proc.stdout?.on("data", (chunk: Buffer) => {
    process.stdout.write(chunk);
    auditStream.write(chunk);
  });
  proc.stderr?.pipe(process.stderr);

  const result = await proc;

  // Flush and close audit log
  await new Promise<void>((resolve, reject) =>
    auditStream.end((err: Error | null | undefined) => (err ? reject(err) : resolve())),
  );

  if (result.exitCode !== 0) {
    throw new Error(`claude exited with code ${result.exitCode}`);
  }
}
