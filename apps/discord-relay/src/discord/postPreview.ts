import { Client, EmbedBuilder, TextChannel } from "discord.js";
import { loadPendingPrs, savePendingPrs } from "../state/pendingPrs.js";

let discordClient: Client | null = null;

export function setDiscordClient(client: Client): void {
  discordClient = client;
}

interface PreviewPayload {
  pr_number: number;
  pr_url: string;
  pr_title: string;
  preview_url: string;
  repo: string;
  discord_channel_id: string;
  discord_user_id: string;
  discord_message_id: string;
}

export async function postPreview(payload: PreviewPayload): Promise<void> {
  if (!discordClient) {
    throw new Error("Discord client not initialized");
  }

  const channel = await discordClient.channels.fetch(payload.discord_channel_id);
  if (!channel || !(channel instanceof TextChannel)) {
    throw new Error(`Channel ${payload.discord_channel_id} not found or not a text channel`);
  }

  const embed = new EmbedBuilder()
    .setTitle(`PR #${payload.pr_number}: ${payload.pr_title}`)
    .setURL(payload.pr_url)
    .addFields(
      { name: "Preview", value: payload.preview_url },
      { name: "Actions", value: "React ✅ to merge, ❌ to close." }
    )
    .setColor(0x5865f2)
    .setTimestamp();

  const sent = await channel.send({
    embeds: [embed],
    reply: {
      messageReference: payload.discord_message_id,
      failIfNotExists: false,
    },
  });

  // Store in pending PRs for the reaction handler
  const pending = await loadPendingPrs();
  pending[sent.id] = {
    pr_number: payload.pr_number,
    repo: payload.repo,
    channel_id: payload.discord_channel_id,
    requester: payload.discord_user_id,
    source_message_id: payload.discord_message_id,
  };
  await savePendingPrs(pending);

  console.log(`Posted preview for PR #${payload.pr_number} in channel ${payload.discord_channel_id}`);
}
