import "dotenv/config";

function required(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const config = {
  discord: {
    // Optional at module load time — discord-bot.ts validates at login
    botToken: optional("DISCORD_BOT_TOKEN", ""),
    // Deprecated: single-channel mode. Use channelMapPath for multi-channel routing.
    channelId: optional("TRIAGE_DISCORD_CHANNEL_ID", ""),
    channelMapPath: optional("CHANNEL_MAP_PATH", "./channel-map.json"),
  },
  gemini: {
    apiKey: required("GEMINI_API_KEY"),
    model: "gemini-2.0-flash",
  },
  github: {
    // Optional at module load time — github.ts validates at first API call
    token: optional("GITHUB_TOKEN", ""),
    // Repo slug (owner/repo). Read from GITHUB_REPOSITORY (standard GitHub Actions env).
    // Used for issue-filing URLs and by github.ts getRepoCoords().
    repository: optional("GITHUB_REPOSITORY", ""),
  },
  triage: {
    targetSubtree: optional("TRIAGE_TARGET_SUBTREE", "apps/myapps"),
    targetLabel: optional("TRIAGE_TARGET_LABEL", "myapps"),
    contextRefreshHours: Number(optional("TRIAGE_CONTEXT_REFRESH_HOURS", "6")),
    dailyQuota: Number(optional("TRIAGE_DAILY_QUOTA", "1000")),
  },
  log: {
    path: optional("LOG_PATH", ""),
  },
  webhook: {
    secret: optional("DISCORD_RELAY_WEBHOOK_SECRET", ""),
  },
  approver: {
    discordId: optional("APPROVER_DISCORD_ID", ""),
  },
  port: Number(optional("PORT", "8080")),
} as const;
