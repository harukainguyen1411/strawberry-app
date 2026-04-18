/**
 * Smoke test — verifies the context loader + Gemini pipeline without touching Discord or GitHub.
 *
 * Usage:
 *   GEMINI_API_KEY=... TRIAGE_DISCORD_CHANNEL_ID=dummy DISCORD_BOT_TOKEN=dummy GITHUB_TOKEN=dummy \
 *     tsx apps/discord-relay/scripts/smoke.ts
 *
 * Expected output: pretty-printed JSON verdict from Gemini.
 */

import "dotenv/config";
import { loadContext } from "../src/context.js";
import { triage } from "../src/gemini.js";

const TEST_MESSAGE =
  "author: duong#0001\nchannel: test\nts: " +
  new Date().toISOString() +
  "\nmessage: The Vietnamese date picker in the signup flow is broken on Safari";

async function run(): Promise<void> {
  console.log("Loading context...");
  const context = await loadContext();
  console.log(`Context loaded (${context.length} chars). Calling Gemini...`);

  const verdict = await triage(TEST_MESSAGE, context);
  console.log("\nVerdict:");
  console.log(JSON.stringify(verdict, null, 2));
}

run().catch((err) => {
  console.error("Smoke test failed:", err);
  process.exit(1);
});
