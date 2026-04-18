import { readFile, mkdir } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { resolve } from "node:path";
import { execa } from "execa";
import { config } from "./config.js";
import { log } from "./log.js";

// Tools Claude is allowed to use inside the Bee job.
// Bash is intentionally excluded — comment injection is a controlled execa call
// from the worker (Node side), not from inside Claude (§7.5 of plan).
// Edit is excluded — Claude must use Write for any output (scoped to job dir).
// WebSearch + WebFetch allow citation lookup.
const ALLOWED_TOOLS = "WebSearch,WebFetch,Read,Write";

export interface CommentEntry {
  quote: string;
  comment: string;
  source_url: string;
}

export interface ClaudeResult {
  comments: CommentEntry[];
  tokenCost: number | null;
}

/**
 * Build the user-facing prompt for Claude:
 *   1. House Rules block (verbatim content of style-rules.md)
 *   2. Sister's prompt (verbatim)
 *   3. Instruction to read input.docx and return JSON
 */
async function buildUserPrompt(
  styleRulesPath: string,
  sisterPrompt: string,
): Promise<string> {
  const houseRules = await readFile(styleRulesPath, "utf8");

  return [
    "## Quy tắc nhà (House Rules)",
    "",
    houseRules.trim(),
    "",
    "---",
    "",
    "## Yêu cầu của người dùng",
    "",
    sisterPrompt.trim(),
    "",
    "---",
    "",
    "## Nhiệm vụ",
    "",
    "Đọc file `input.docx` trong thư mục làm việc hiện tại.",
    "Phân tích văn bản dựa trên Quy tắc nhà và yêu cầu của người dùng ở trên.",
    "Trả về MỘT mảng JSON duy nhất (không có văn bản bổ sung) với định dạng:",
    "",
    "```json",
    '[{"quote":"<đoạn trích từ văn bản gốc>","comment":"<nhận xét bằng tiếng Việt>","source_url":"<URL nguồn hoặc chuỗi rỗng>"}]',
    "```",
    "",
    "Mỗi mục phải có đủ ba trường: quote, comment, source_url.",
    "Không xuất bất kỳ nội dung nào khác ngoài mảng JSON.",
  ].join("\n");
}

/**
 * Ensure the audit log directory exists and return the path for this job's log.
 * The directory is outside the job working directory so Claude cannot Read it.
 */
async function resolveAuditLogPath(jobId: string): Promise<string> {
  await mkdir(config.claude.auditLogDir, { recursive: true });
  return resolve(config.claude.auditLogDir, `${jobId}.jsonl`);
}

/**
 * Extract total token cost from stream-json output lines.
 * The final result event carries usage.input_tokens + usage.output_tokens.
 * Returns null if no usage data found.
 */
function extractTokenCost(stdoutLines: string[]): number | null {
  let total: number | null = null;
  for (const line of stdoutLines) {
    try {
      const event = JSON.parse(line) as Record<string, unknown>;
      const usage = event?.usage as
        | { input_tokens?: number; output_tokens?: number }
        | undefined;
      if (usage) {
        const input = usage.input_tokens ?? 0;
        const output = usage.output_tokens ?? 0;
        total = input + output;
      }
    } catch {
      // not valid JSON — skip
    }
  }
  return total;
}

/**
 * Parse the final assistant message from stream-json output and extract the
 * JSON comment list. Claude is instructed to return only a JSON array.
 *
 * We search for the last occurrence of a JSON array in the output — robust
 * against any preamble Claude might emit before the array.
 */
function parseComments(stdoutLines: string[]): CommentEntry[] {
  const textParts: string[] = [];

  for (const line of stdoutLines) {
    try {
      const event = JSON.parse(line) as Record<string, unknown>;
      // stream-json emits content_block_delta events with text deltas
      const delta = event?.delta as
        | { type?: string; text?: string }
        | undefined;
      if (event?.type === "content_block_delta" && delta?.type === "text_delta") {
        textParts.push(delta.text ?? "");
      }
      // Also handle result events with a final text field
      if (event?.type === "result" && typeof event?.result === "string") {
        textParts.push(event.result as string);
      }
    } catch {
      // not valid JSON — skip
    }
  }

  const fullText = textParts.join("");

  // Find JSON array in the text — handle optional markdown code fences
  const fencedMatch = fullText.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
  if (fencedMatch) {
    return JSON.parse(fencedMatch[1]) as CommentEntry[];
  }

  // Bare array — find the last [ ... ] block
  const lastBracket = fullText.lastIndexOf("[");
  if (lastBracket !== -1) {
    const candidate = fullText.slice(lastBracket);
    const closeIdx = candidate.lastIndexOf("]");
    if (closeIdx !== -1) {
      return JSON.parse(candidate.slice(0, closeIdx + 1)) as CommentEntry[];
    }
  }

  throw new Error("Could not find JSON comment array in Claude output");
}

/**
 * Invoke Claude Code headlessly via `claude -p` to review a docx job.
 *
 * Security guardrails (plan §7):
 *  - --system-prompt-file: Vietnamese system prompt denying shell/FS escape
 *  - --add-dir: scoped strictly to the job working directory
 *  - --allowedTools: WebSearch, WebFetch, Read, Write only — no Bash
 *  - Hard kill timer via BEE_JOB_TIMEOUT_MS (default 25 min)
 *  - Audit log written outside job dir (Claude cannot Read it)
 *
 * @param jobId        Job identifier (e.g. "issue-123")
 * @param jobDir       Ephemeral per-job directory containing input.docx
 * @param sisterPrompt Vietnamese prompt from the sister
 * @returns Parsed comment entries and token cost
 */
export async function runClaude(
  jobId: string,
  jobDir: string,
  sisterPrompt: string,
): Promise<ClaudeResult> {
  const styleRulesPath = resolve(process.cwd(), "style-rules.md");
  const systemPromptPath = config.claude.systemPromptPath;
  const logPath = await resolveAuditLogPath(jobId);

  const userPrompt = await buildUserPrompt(styleRulesPath, sisterPrompt);

  log(
    `[${jobId}] Invoking claude -p (timeout=${config.claude.jobTimeoutMs}ms, tools=${ALLOWED_TOOLS})`,
  );
  log(`[${jobId}] Job dir: ${jobDir}`);
  log(`[${jobId}] Audit log: ${logPath}`);

  const auditStream = createWriteStream(logPath, { flags: "a" });

  const proc = execa(
    config.claude.bin,
    [
      "-p",
      userPrompt,
      "--output-format",
      "stream-json",
      "--system-prompt-file",
      systemPromptPath,
      "--add-dir",
      jobDir,
      "--allowedTools",
      ALLOWED_TOOLS,
    ],
    {
      cwd: jobDir,
      reject: false,
      stdin: "ignore",
      timeout: config.claude.jobTimeoutMs,
      killSignal: "SIGKILL",
    },
  );

  const stdoutLines: string[] = [];

  proc.stdout?.on("data", (chunk: Buffer) => {
    const text = chunk.toString("utf8");
    process.stdout.write(chunk);
    auditStream.write(chunk);
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (trimmed) stdoutLines.push(trimmed);
    }
  });

  proc.stderr?.pipe(process.stderr);

  const result = await proc;

  // Flush and close audit log
  await new Promise<void>((res, rej) =>
    auditStream.end((err: Error | null | undefined) =>
      err ? rej(err) : res(),
    ),
  );

  // Check for timeout (execa sets timedOut=true)
  if ((result as unknown as { timedOut?: boolean }).timedOut) {
    throw new Error(
      `[${jobId}] Claude subprocess timed out after ${config.claude.jobTimeoutMs}ms — killed with SIGKILL`,
    );
  }

  if (result.exitCode !== 0) {
    throw new Error(`[${jobId}] claude exited with code ${result.exitCode}`);
  }

  const tokenCost = extractTokenCost(stdoutLines);
  const comments = parseComments(stdoutLines);

  log(
    `[${jobId}] Claude finished — ${comments.length} comments, tokenCost=${tokenCost ?? "unknown"}`,
  );

  return { comments, tokenCost };
}
