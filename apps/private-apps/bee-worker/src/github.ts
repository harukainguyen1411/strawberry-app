import { Octokit } from "@octokit/rest";
import { config } from "./config.js";

let _octokit: Octokit | null = null;

function octokit(): Octokit {
  if (!_octokit) {
    _octokit = new Octokit({ auth: config.github.token });
  }
  return _octokit;
}

function parseRepo(): { owner: string; repo: string } {
  const [owner, repo] = config.github.repo.split("/");
  if (!owner || !repo) throw new Error(`Invalid GITHUB_REPO: ${config.github.repo}`);
  return { owner, repo };
}

export interface BeeIssue {
  number: number;
  title: string;
  body: string;
}

/**
 * Fetch open issues labeled `bee` AND `ready` but NOT `bot-in-progress`.
 */
export async function fetchReadyIssues(): Promise<BeeIssue[]> {
  const { owner, repo } = parseRepo();
  const { data } = await octokit().issues.listForRepo({
    owner,
    repo,
    state: "open",
    labels: "bee,ready",
    per_page: 10,
  });

  return data
    .filter((issue) => !issue.pull_request)
    .filter((issue) => {
      const labelNames = issue.labels.map((l) =>
        typeof l === "string" ? l : l.name ?? "",
      );
      return !labelNames.includes("bot-in-progress");
    })
    .map((issue) => ({
      number: issue.number,
      title: issue.title,
      body: issue.body ?? "",
    }));
}

export async function atomicLabelSwap(
  issueNumber: number,
  remove: string,
  add: string,
): Promise<void> {
  const { owner, repo } = parseRepo();
  await octokit().issues.removeLabel({
    owner,
    repo,
    issue_number: issueNumber,
    name: remove,
  });
  await octokit().issues.addLabels({
    owner,
    repo,
    issue_number: issueNumber,
    labels: [add],
  });
}

export async function commentOnIssue(
  issueNumber: number,
  body: string,
): Promise<void> {
  const { owner, repo } = parseRepo();
  await octokit().issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body,
  });
}

export async function closeIssue(issueNumber: number): Promise<void> {
  const { owner, repo } = parseRepo();
  await octokit().issues.update({
    owner,
    repo,
    issue_number: issueNumber,
    state: "closed",
  });
}

/**
 * Parse a bee issue body to extract the question text and optional docx Storage URL.
 *
 * Format:
 *   <question text>
 *
 *   ---
 *   docx: gs://bucket/path/to/input.docx
 */
export function parseIssueBody(body: string): { question: string; docxUrl: string | null } {
  const separatorIdx = body.indexOf("\n---\n");
  if (separatorIdx === -1) {
    return { question: body.trim(), docxUrl: null };
  }

  const question = body.slice(0, separatorIdx).trim();
  const metaSection = body.slice(separatorIdx + 5);
  const docxMatch = metaSection.match(/^docx:\s*(.+)$/m);

  return {
    question,
    docxUrl: docxMatch ? docxMatch[1].trim() : null,
  };
}
