import {
  Client,
  Events,
  GatewayIntentBits,
  Message,
} from "discord.js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "./config.js";
import { loadContext } from "./context.js";
import { triage } from "./gemini.js";
import { fileIssue } from "./github.js";
import { quotaStatus, recordCall, checkRateLimit, callsToday } from "./quota.js";
import { logTriage } from "./log.js";
import { registerReactionHandler } from "./discord/reactionHandler.js";
import { setDiscordClient } from "./discord/postPreview.js";

// Message-length cap before passing to Gemini
const MAX_MESSAGE_CHARS = 4000;

export interface ChannelEntry {
  app: string | null;
  type: string;
}

export interface ChannelMap {
  channels: Record<string, ChannelEntry>;
  categoryId: string;
}

function loadChannelMap(): ChannelMap {
  const mapPath = resolve(config.discord.channelMapPath);
  let raw: string;
  try {
    raw = readFileSync(mapPath, "utf8");
  } catch (err) {
    console.error("FATAL: Failed to read channel-map.json:", err);
    process.exit(1);
  }

  let parsed: ChannelMap;
  try {
    parsed = JSON.parse(raw) as ChannelMap;
  } catch (err) {
    console.error("FATAL: channel-map.json is not valid JSON:", err);
    process.exit(1);
  }

  if (!parsed.channels || typeof parsed.channels !== "object") {
    console.error("FATAL: channel-map.json missing 'channels' object");
    process.exit(1);
  }

  // Warn if any channel IDs are still placeholder values (bot will be inert until setup)
  const placeholderKeys = Object.keys(parsed.channels).filter((k) =>
    /^CHANNEL_ID_/.test(k),
  );
  if (placeholderKeys.length > 0) {
    console.warn(
      `WARNING: channel-map.json contains ${placeholderKeys.length} placeholder channel ID(s): ` +
        placeholderKeys.join(", ") +
        ". Run scripts/setup-discord-channels.sh to populate real IDs.",
    );
  }

  return parsed;
}

/** Sanitize user content to prevent prompt injection */
function sanitize(text: string): string {
  if (!text) return "";
  return text
    .replace(/<\/?system[^>]*>/gi, "")
    .replace(/\[INST\]|\[\/INST\]/gi, "")
    .replace(/<\/?prompt[^>]*>/gi, "")
    .replace(/<\/?human[^>]*>/gi, "")
    .replace(/ignore (previous|above|all) instructions?/gi, "")
    .slice(0, MAX_MESSAGE_CHARS);
}

export function buildClient(healthState: {
  discordConnected: boolean;
  lastGeminiOkTs: number;
  lastGithubOkTs: number;
}): Client {
  const channelMap = loadChannelMap();
  console.log(`Loaded channel map with ${Object.keys(channelMap.channels).length} channel(s)`);

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMessageReactions,
    ],
  });

  client.once(Events.ClientReady, (c) => {
    console.log(`Triage bot logged in as ${c.user.tag}`);
    healthState.discordConnected = true;
    setDiscordClient(client);
    // Pre-warm the context cache
    loadContext().catch((err) => console.error("Context pre-warm failed:", err));
  });

  // Phase D: reaction-based PR approval
  registerReactionHandler(client);

  client.on(Events.ShardDisconnect, () => {
    healthState.discordConnected = false;
  });

  client.on(Events.MessageCreate, (message) => {
    handleMessage(message, channelMap, healthState).catch((err) => {
      console.error("Unhandled error in message handler:", err);
    });
  });

  return client;
}

async function handleMessage(
  message: Message,
  channelMap: ChannelMap,
  healthState: {
    discordConnected: boolean;
    lastGeminiOkTs: number;
    lastGithubOkTs: number;
  },
): Promise<void> {
  if (message.author.bot) return;

  // Multi-channel routing: check channel map first
  let channelEntry = channelMap.channels[message.channelId] ?? null;

  // Legacy fallback: single TRIAGE_DISCORD_CHANNEL_ID.
  // LEGACY-ONLY: this path exists for Phase 1 parallel operation.
  // It hard-codes app="myapps" and type="feature" because the original single-channel
  // bot was myapps-specific. Once all traffic has migrated to the per-channel map,
  // remove TRIAGE_DISCORD_CHANNEL_ID from .env and delete this block.
  if (!channelEntry && config.discord.channelId) {
    const isDirectMatch = message.channelId === config.discord.channelId;
    const ch = message.channel;
    const isForumPostStarter =
      ch.isThread() &&
      ch.parentId === config.discord.channelId &&
      // Only trigger on the opening message of the thread, not subsequent replies.
      message.id === ch.id;
    if (isDirectMatch || isForumPostStarter) {
      channelEntry = { app: "myapps", type: "feature" };
    }
  }

  if (!channelEntry) return;

  const start = Date.now();
  const author = `${message.author.username}#${message.author.discriminator}`;
  const rawText = message.content ?? "";
  const sanitized = sanitize(rawText);

  if (!sanitized.trim()) return;

  // Processing indicator
  await message.react("⏳").catch(() => {});

  // Daily quota check
  const qStatus = quotaStatus();
  if (qStatus === "exceeded") {
    await message.react("❌").catch(() => {});
    await message.reply(
      `Daily triage quota exhausted — resets at 00:00 UTC. ` +
        `File manually in GitHub if urgent: https://github.com/${config.github.repository || "owner/repo"}/issues/new`,
    ).catch(() => {});
    await logTriage({
      ts: new Date().toISOString(),
      discord_user: author,
      discord_channel: message.channelId,
      discord_message_id: message.id,
      message_preview: sanitized.slice(0, 120),
      outcome: "quota",
      issue_url: null,
      dupe_of: null,
      gemini_calls_today: callsToday(),
      duration_ms: Date.now() - start,
    });
    return;
  }

  // Per-minute rate limit check
  if (!checkRateLimit()) {
    await message.react("❌").catch(() => {});
    await message.reply(
      "Too many requests — please wait a minute before filing again.",
    ).catch(() => {});
    return;
  }

  let context: string;
  try {
    context = await loadContext(channelEntry.app ?? undefined);
  } catch (err) {
    console.error("Failed to load context:", err);
    await message.react("❌").catch(() => {});
    await message.reply("Triage temporarily unavailable — context load failed.").catch(() => {});
    return;
  }

  const userContent =
    `author: ${author}\n` +
    `channel: ${message.channelId}\n` +
    `ts: ${message.createdAt.toISOString()}\n` +
    (sanitized.length < rawText.length
      ? `message (truncated from ${rawText.length} chars): ${sanitized}`
      : `message: ${sanitized}`);

  let verdict;
  try {
    verdict = await triage(userContent, context, channelEntry.app, channelEntry.type);
    await recordCall();
    healthState.lastGeminiOkTs = Date.now();
  } catch (err) {
    console.error("Gemini triage failed:", err);
    await message.react("❌").catch(() => {});
    await message.reply("Triage failed — try rephrasing your message.").catch(() => {});
    await logTriage({
      ts: new Date().toISOString(),
      discord_user: author,
      discord_channel: message.channelId,
      discord_message_id: message.id,
      message_preview: sanitized.slice(0, 120),
      outcome: "parse_error",
      issue_url: null,
      dupe_of: null,
      gemini_calls_today: callsToday(),
      duration_ms: Date.now() - start,
    });
    return;
  }

  // If Gemini flagged this as not-applicable
  if (verdict.title === "__NOT_MYAPPS__") {
    await message.react("❌").catch(() => {});
    await message.reply(
      `This doesn't look like an applicable issue — ${verdict.body}\nFile it manually if needed.`,
    ).catch(() => {});
    return;
  }

  let filed;
  try {
    filed = await fileIssue(
      verdict,
      {
        author,
        channelId: message.channelId,
        messageId: message.id,
        userId: message.author.id,
        guildId: message.guildId ?? "",
        messageTs: message.createdAt.toISOString(),
        originalMessage: sanitized,
      },
      channelEntry,
      healthState,
    );
  } catch (err) {
    console.error("GitHub filing failed:", err);
    await message.react("❌").catch(() => {});
    await message.reply("Issue filing failed — check bot logs for details.").catch(() => {});
    await logTriage({
      ts: new Date().toISOString(),
      discord_user: author,
      discord_channel: message.channelId,
      discord_message_id: message.id,
      message_preview: sanitized.slice(0, 120),
      outcome: "api_error",
      issue_url: null,
      dupe_of: null,
      gemini_calls_today: callsToday(),
      duration_ms: Date.now() - start,
    });
    return;
  }

  // Success — remove processing emoji, add result emoji
  await message.reactions.cache.get("⏳")?.remove().catch(() => {});

  if (filed.isDupe) {
    await message.react("🔁").catch(() => {});
    await message.reply(
      `Added to existing #${filed.number}: ${filed.url}`,
    ).catch(() => {});
  } else {
    await message.react("✅").catch(() => {});
    const warnSuffix =
      qStatus === "warn"
        ? "\n_Approaching daily triage quota._"
        : "";
    await message.reply(`Filed as #${filed.number}: ${filed.url}${warnSuffix}`).catch(() => {});
  }

  await logTriage({
    ts: new Date().toISOString(),
    discord_user: author,
    discord_channel: message.channelId,
    discord_message_id: message.id,
    message_preview: sanitized.slice(0, 120),
    outcome: filed.isDupe ? "deduped" : "filed",
    issue_url: filed.url,
    dupe_of: filed.isDupe ? filed.number : null,
    gemini_calls_today: callsToday(),
    duration_ms: Date.now() - start,
  });
}
