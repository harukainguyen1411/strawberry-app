import { Octokit } from "@octokit/rest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { config } from "./config.js";
import type { TriageVerdict } from "./gemini.js";
import type { ChannelEntry } from "./discord-bot.js";

const execFileAsync = promisify(execFile);

let _octokit: Octokit | null = null;
let _repoOwner: string | null = null;
let _repoName: string | null = null;

function getOctokit(): Octokit {
  if (!_octokit) {
    _octokit = new Octokit({ auth: config.github.token });
  }
  return _octokit;
}

async function getRepoCoords(): Promise<{ owner: string; repo: string }> {
  if (_repoOwner && _repoName) {
    return { owner: _repoOwner, repo: _repoName };
  }
  // Prefer the env var (set by GitHub Actions / Cloud Run binding)
  if (process.env.GITHUB_REPOSITORY) {
    const [owner, repo] = process.env.GITHUB_REPOSITORY.split("/");
    _repoOwner = owner;
    _repoName = repo;
    return { owner, repo };
  }
  // Fall back to gh CLI
  const { stdout } = await execFileAsync("gh", [
    "repo", "view", "--json", "nameWithOwner",
  ]);
  const { nameWithOwner } = JSON.parse(stdout) as { nameWithOwner: string };
  const [owner, repo] = nameWithOwner.split("/");
  _repoOwner = owner;
  _repoName = repo;
  return { owner, repo };
}

export interface FiledResult {
  url: string;
  number: number;
  isDupe: boolean;
}

/** Build labels from channel map entry + Gemini verdict labels. */
function buildLabels(entry: ChannelEntry, verdictLabels: string[]): string[] {
  const channelLabels: string[] = [];
  if (entry.app) {
    channelLabels.push(`app:${entry.app}`);
    // Keep legacy label for backward compat during transition
    channelLabels.push(entry.app);
  }
  channelLabels.push(`type:${entry.type}`);
  // Also keep legacy targetLabel for backward compat
  const legacyLabel = config.triage.targetLabel;
  return Array.from(new Set([legacyLabel, ...channelLabels, ...verdictLabels]));
}

/** Build issue title prefix from channel entry. */
function buildTitlePrefix(entry: ChannelEntry): string {
  if (entry.type === "new-app") return "[new-app] ";
  if (entry.app) return `[${entry.app}] `;
  return "";
}

export async function fileIssue(
  verdict: TriageVerdict,
  discordMeta: {
    author: string;
    channelId: string;
    messageId: string;
    userId: string;
    guildId: string;
    messageTs: string;
    originalMessage: string;
  },
  channelEntry: ChannelEntry,
  _lastGithubOkRef: { lastGithubOkTs: number },
): Promise<FiledResult> {
  const octokit = getOctokit();
  const { owner, repo } = await getRepoCoords();
  const fixedLabel = config.triage.targetLabel;

  if (verdict.dupe_of_issue_number !== null) {
    // Verify the target issue actually carries the fixed label
    let isValidDupe = false;
    try {
      const { data: existing } = await octokit.rest.issues.get({
        owner,
        repo,
        issue_number: verdict.dupe_of_issue_number,
      });
      isValidDupe = existing.labels.some(
        (l) => (typeof l === "string" ? l : l.name) === fixedLabel,
      );
    } catch {
      isValidDupe = false;
    }

    if (isValidDupe) {
      const commentBody =
        `**Possible duplicate filed via Discord triage bot.**\n\n` +
        `Author: ${discordMeta.author} | Channel: <#${discordMeta.channelId}> | ${discordMeta.messageTs}\n\n` +
        `> ${discordMeta.originalMessage.slice(0, 500)}`;

      const { data: comment } = await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: verdict.dupe_of_issue_number,
        body: commentBody,
      });
      _lastGithubOkRef.lastGithubOkTs = Date.now();
      return {
        url: comment.html_url,
        number: verdict.dupe_of_issue_number,
        isDupe: true,
      };
    }
    // Fall through to filing a new issue if dupe target is invalid
  }

  // Build labels from channel entry + Gemini's verdict labels, deduplicated
  const labels = buildLabels(channelEntry, verdict.labels);

  // Prefix title with app/type context.
  // Guard checks for the specific expected prefix — not any bracket — so that
  // Gemini titles like "[regression] ..." still get the app prefix prepended.
  const titlePrefix = buildTitlePrefix(channelEntry);
  const title =
    titlePrefix && verdict.title.startsWith(titlePrefix)
      ? verdict.title
      : titlePrefix + verdict.title;

  const footer =
    `\n\n---\n_Filed via triage-bot from Discord <#${discordMeta.channelId}> ` +
    `by ${discordMeta.author} at ${discordMeta.messageTs}._`;

  const metaBlock =
    `\n\n<!-- strawberry-meta\n` +
    `discord_channel_id: ${discordMeta.channelId}\n` +
    `discord_message_id: ${discordMeta.messageId}\n` +
    `discord_user_id: ${discordMeta.userId}\n` +
    `discord_guild_id: ${discordMeta.guildId}\n` +
    `origin: discord-relay\n` +
    `-->`;

  const { data: issue } = await octokit.rest.issues.create({
    owner,
    repo,
    title,
    body: verdict.body + footer + metaBlock,
    labels,
  });
  _lastGithubOkRef.lastGithubOkTs = Date.now();
  return {
    url: issue.html_url,
    number: issue.number,
    isDupe: false,
  };
}
