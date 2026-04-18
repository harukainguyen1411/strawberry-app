import { mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { acquireRunlock } from "./runlock.js";
import { downloadFile, uploadResultDocx, deleteFile } from "./storage.js";
import { runClaude } from "./claude.js";
import { injectComments } from "./docx.js";
import {
  fetchReadyIssues,
  atomicLabelSwap,
  commentOnIssue,
  closeIssue,
  parseIssueBody,
  type BeeIssue,
} from "./github.js";
import { config } from "./config.js";
import { log } from "./log.js";

/**
 * Map an internal error to a Vietnamese message for the sister.
 */
function toVietnameseError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.toLowerCase().includes("timed out") || msg.toLowerCase().includes("sigkill")) {
    return "Công việc bị hủy do quá thời gian xử lý (25 phút). Vui lòng thử lại với tài liệu ngắn hơn.";
  }
  if (msg.toLowerCase().includes("comments.py")) {
    return "Lỗi khi chèn bình luận vào tài liệu. Vui lòng kiểm tra định dạng file và thử lại.";
  }
  if (msg.toLowerCase().includes("claude exited")) {
    return "Lỗi khi chạy Claude. Vui lòng thử lại sau.";
  }
  if (msg.toLowerCase().includes("download") || msg.toLowerCase().includes("storage")) {
    return "Không thể tải tài liệu đầu vào. Vui lòng tải lên lại và thử lại.";
  }
  return `Đã xảy ra lỗi trong quá trình xử lý: ${msg.slice(0, 200)}`;
}

/**
 * One poll cycle: fetch ready issues, process the first one.
 */
export async function pollCycle(): Promise<void> {
  const issues = await fetchReadyIssues();
  if (issues.length === 0) return;

  // Process one issue per cycle (sequential, like coder-worker)
  await processIssue(issues[0]);
}

/**
 * Process a single bee issue end-to-end:
 *   claim (label swap) → acquire runlock → download docx (if any) → invoke claude
 *   → inject comments → upload result → post comment → cleanup → close issue
 */
async function processIssue(issue: BeeIssue): Promise<void> {
  const { number: issueNum } = issue;
  const jobDir = resolve(config.workDir, `issue-${issueNum}`);
  const { question, docxUrl } = parseIssueBody(issue.body);
  const filesToCleanup: string[] = [];

  log(`[#${issueNum}] Processing — docx=${docxUrl ? "yes" : "no"}`);

  // Step 1: Claim the issue (label swap ready -> bot-in-progress)
  await atomicLabelSwap(issueNum, "ready", "bot-in-progress");
  log(`[#${issueNum}] Claimed (label swap)`);

  let releaseLock: (() => Promise<void>) | null = null;

  try {
    await mkdir(jobDir, { recursive: true });

    // Step 2: Acquire runlock
    releaseLock = await acquireRunlock();

    // Step 3: Download input docx if present
    let inputDocxPath: string | null = null;
    if (docxUrl) {
      inputDocxPath = resolve(jobDir, "input.docx");
      log(`[#${issueNum}] Downloading docx from ${docxUrl}`);
      await downloadFile(docxUrl, inputDocxPath);
      filesToCleanup.push(docxUrl);
    }

    // Step 4: Run Claude
    const { comments, tokenCost } = await runClaude(
      `issue-${issueNum}`,
      jobDir,
      question,
    );
    log(`[#${issueNum}] Claude returned ${comments.length} comment(s)`);

    // Step 5: If docx, inject comments and upload result
    let resultDownloadUrl: string | null = null;
    if (inputDocxPath && comments.length > 0) {
      const resultDocxPath = resolve(jobDir, "result.docx");
      await injectComments(inputDocxPath, comments, resultDocxPath);

      const resultStoragePath = `bee-temp/issue-${issueNum}/${Date.now()}/result.docx`;
      const resultUri = await uploadResultDocx(resultDocxPath, resultStoragePath);
      filesToCleanup.push(resultUri);
      resultDownloadUrl = resultUri;
      log(`[#${issueNum}] Result docx uploaded: ${resultUri}`);
    }

    // Step 6: Post answer as issue comment
    const commentBody = buildAnswerComment(comments, tokenCost, resultDownloadUrl);
    await commentOnIssue(issueNum, commentBody);

    // Step 7: Label swap bot-in-progress -> done, close issue
    await atomicLabelSwap(issueNum, "bot-in-progress", "done");
    await closeIssue(issueNum);
    log(`[#${issueNum}] Done — issue closed`);

    // Step 8: Cleanup Storage temp files
    for (const uri of filesToCleanup) {
      await deleteFile(uri);
    }
  } catch (err) {
    const errMsg = toVietnameseError(err);
    log(`[#${issueNum}] Failed: ${err instanceof Error ? err.message : String(err)}`);

    // Post error as comment, swap label back to ready
    await commentOnIssue(issueNum, `**Lỗi:** ${errMsg}`).catch(() => {});
    await atomicLabelSwap(issueNum, "bot-in-progress", "ready").catch(() => {});
  } finally {
    if (releaseLock) {
      await releaseLock().catch((err) => {
        log(`[#${issueNum}] Failed to release runlock: ${err}`);
      });
    }
    await rm(jobDir, { recursive: true, force: true }).catch(() => {});
    log(`[#${issueNum}] Cleanup done`);
  }
}

function buildAnswerComment(
  comments: { quote: string; comment: string; source_url: string }[],
  tokenCost: number | null,
  resultDownloadUrl: string | null,
): string {
  const lines: string[] = [];

  if (resultDownloadUrl) {
    lines.push(`📎 [Tải file kết quả (result.docx)](${resultDownloadUrl})`);
    lines.push("");
  }

  if (comments.length === 0) {
    lines.push("Không tìm thấy vấn đề nào cần nhận xét.");
  } else {
    lines.push(`### Nhận xét (${comments.length} mục)`);
    lines.push("");
    for (let i = 0; i < comments.length; i++) {
      const c = comments[i];
      lines.push(`**${i + 1}.** > ${c.quote}`);
      lines.push("");
      lines.push(c.comment);
      if (c.source_url) {
        lines.push(`_Nguồn: ${c.source_url}_`);
      }
      lines.push("");
    }
  }

  if (tokenCost !== null) {
    lines.push(`---`);
    lines.push(`_Token: ${tokenCost}_`);
  }

  return lines.join("\n");
}
