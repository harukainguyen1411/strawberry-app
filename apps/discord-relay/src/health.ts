import express from "express";
import { config } from "./config.js";
import { callsToday, quotaRemaining } from "./quota.js";
import { contextCacheAgeSeconds, invalidateContext } from "./context.js";
import { registerGithubWebhook } from "./http/githubWebhook.js";

interface HealthState {
  discordConnected: boolean;
  lastGeminiOkTs: number;
  lastGithubOkTs: number;
}

export function startHealthServer(state: HealthState): void {
  const app = express();

  app.get("/health", (_req, res) => {
    const now = Date.now();
    const lastGeminiOkAgeS = state.lastGeminiOkTs
      ? Math.floor((now - state.lastGeminiOkTs) / 1000)
      : -1;
    const lastGithubOkAgeS = state.lastGithubOkTs
      ? Math.floor((now - state.lastGithubOkTs) / 1000)
      : -1;

    const ok =
      state.discordConnected &&
      (state.lastGeminiOkTs === 0 || lastGeminiOkAgeS < 86400) &&
      (state.lastGithubOkTs === 0 || lastGithubOkAgeS < 86400);

    res.status(ok ? 200 : 503).json({
      discord_connected: state.discordConnected,
      last_gemini_ok_age_s: lastGeminiOkAgeS,
      last_github_ok_age_s: lastGithubOkAgeS,
      gemini_calls_today: callsToday(),
      quota_remaining: quotaRemaining(),
      context_cache_age_s: contextCacheAgeSeconds(),
      ok,
    });
  });

  app.get("/webhook/github-push", (_req, res) => {
    // Invalidate the context cache on push to main.
    // In v1 this is unauthenticated — add HMAC validation in v1.1.
    invalidateContext();
    res.json({ ok: true, message: "Context cache invalidated" });
  });

  app.use(express.json());
  registerGithubWebhook(app);

  app.listen(config.port, () => {
    console.log(`Health server listening on port ${config.port}`);
  });
}
