import { config } from "./config.js";
import { initQuota } from "./quota.js";
import { startHealthServer } from "./health.js";
import { buildClient } from "./discord-bot.js";

const healthState = {
  discordConnected: false,
  lastGeminiOkTs: 0,
  lastGithubOkTs: 0,
};

async function main(): Promise<void> {
  console.log("discord-relay triage bot starting...");

  await initQuota();

  startHealthServer(healthState);

  const client = buildClient(healthState);
  await client.login(config.discord.botToken);
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
