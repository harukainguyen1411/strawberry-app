import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { pollCycle } from "./worker.js";
import { log } from "./log.js";

// Resolve the repo root relative to this file's location:
// dist/index.js → ../../.. (apps/coder-worker → apps → repo root)
const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = resolve(__dirname, "..", "..", "..");

async function main(): Promise<void> {
  log(`Coder worker starting. Repo root: ${ROOT}`);
  log(`Polling ${config.github.targetRepo} every ${config.poll.intervalSeconds}s`);

  // Run immediately on start, then on interval
  const runCycle = async () => {
    try {
      await pollCycle(ROOT);
    } catch (err) {
      log(`Poll cycle error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  await runCycle();
  setInterval(runCycle, config.poll.intervalSeconds * 1000);
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
