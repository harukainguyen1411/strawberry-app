import { Client, Events, MessageReaction, PartialMessageReaction, User, PartialUser } from "discord.js";
import { config } from "../config.js";
import { loadPendingPrs, removePendingPr } from "../state/pendingPrs.js";
import { appendAudit } from "../state/auditLog.js";
import { getOctokit } from "../github/client.js";

const MERGE_COOLDOWN_MS = 30_000;
let lastMergeTs = 0;

export function registerReactionHandler(client: Client): void {
  const approverId = config.approver?.discordId;
  if (!approverId) {
    console.log("APPROVER_DISCORD_ID not set — reaction handler disabled.");
    return;
  }

  client.on(Events.MessageReactionAdd, async (reaction, user) => {
    try {
      await handleReaction(reaction, user, approverId);
    } catch (err) {
      console.error("Reaction handler error:", err);
    }
  });

  console.log("Reaction approval handler registered.");
}

async function handleReaction(
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser,
  approverId: string,
): Promise<void> {
  // Ignore bots
  if (user.bot) return;

  // Fetch partial if needed
  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch {
      return;
    }
  }

  const messageId = reaction.message.id;
  const emoji = reaction.emoji.name;

  // Only handle checkmark and X
  if (emoji !== "\u2705" && emoji !== "\u274c") return;

  // Look up in pending PRs
  const pending = await loadPendingPrs();
  const entry = pending[messageId];
  if (!entry) return;

  // Approver gate
  if (user.id !== approverId) {
    await reaction.message.react("\u26d4").catch(() => {});
    return;
  }

  const octokit = getOctokit();
  const [owner, repo] = entry.repo.split("/");

  if (emoji === "\u2705") {
    // Rate limit
    const now = Date.now();
    if (now - lastMergeTs < MERGE_COOLDOWN_MS) {
      await reaction.message.reply("Rate limited — wait 30s between merges.").catch(() => {});
      return;
    }
    lastMergeTs = now;

    try {
      await octokit.pulls.merge({
        owner,
        repo,
        pull_number: entry.pr_number,
        merge_method: "squash",
      });
      await reaction.message.react("\u2705").catch(() => {});
      await reaction.message.reply(
        `Merging PR #${entry.pr_number} — prod deploy in flight.`,
      ).catch(() => {});
    } catch (err: any) {
      await reaction.message.reply(
        `Failed to merge PR #${entry.pr_number}: ${err.message}`,
      ).catch(() => {});
      return;
    }

    await appendAudit({
      timestamp: new Date().toISOString(),
      pr_number: entry.pr_number,
      repo: entry.repo,
      actor: user.id,
      action: "merge",
      message_id: messageId,
    });
  } else if (emoji === "\u274c") {
    try {
      await octokit.pulls.update({
        owner,
        repo,
        pull_number: entry.pr_number,
        state: "closed",
      });
      await reaction.message.reply(`Closed PR #${entry.pr_number}.`).catch(() => {});
    } catch (err: any) {
      await reaction.message.reply(
        `Failed to close PR #${entry.pr_number}: ${err.message}`,
      ).catch(() => {});
      return;
    }

    await appendAudit({
      timestamp: new Date().toISOString(),
      pr_number: entry.pr_number,
      repo: entry.repo,
      actor: user.id,
      action: "close",
      message_id: messageId,
    });
  }

  await removePendingPr(messageId);
}
