import { config } from "./config.js";
import { log } from "./log.js";
import { pollCycle } from "./worker.js";

async function main(): Promise<void> {
  log(`Bee worker starting.`);
  log(`GitHub repo: ${config.github.repo}`);
  log(`Poll interval: ${config.poll.intervalMs}ms`);
  log(`Work dir: ${config.workDir}`);

  const runCycle = async () => {
    try {
      await pollCycle();
    } catch (err) {
      log(`Poll cycle error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Run immediately, then on interval
  await runCycle();
  const timer = setInterval(runCycle, config.poll.intervalMs);

  // Graceful shutdown
  const shutdown = (signal: string) => {
    log(`Received ${signal} — shutting down`);
    clearInterval(timer);
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
