import { resolve } from "node:path";
import { execa } from "execa";
import { config } from "./config.js";
import { log } from "./log.js";
import { CommentEntry } from "./claude.js";

/**
 * Invoke tools/comments.py to inject OOXML comments into a docx file.
 *
 * @param inputPath    Path to the input .docx file
 * @param comments     Array of {quote, comment, source_url} to inject
 * @param outputPath   Path where the annotated .docx will be written
 */
export async function injectComments(
  inputPath: string,
  comments: CommentEntry[],
  outputPath: string,
): Promise<void> {
  const scriptPath = resolve(process.cwd(), "tools", "comments.py");
  const commentsJson = JSON.stringify(comments);

  log(
    `[docx] Injecting ${comments.length} comment(s) via comments.py`,
  );
  log(`[docx] Script: ${scriptPath}`);
  log(`[docx] Input: ${inputPath} → Output: ${outputPath}`);

  const result = await execa(
    config.python.bin,
    [scriptPath, inputPath, commentsJson, outputPath],
    {
      reject: false,
      stdin: "ignore",
    },
  );

  if (result.exitCode !== 0) {
    const stderr = result.stderr?.trim() ?? "";
    throw new Error(
      `comments.py failed (exit ${result.exitCode}): ${stderr}`,
    );
  }

  log(`[docx] comments.py completed successfully`);
}
