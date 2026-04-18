import { Client, Events, GatewayIntentBits } from "discord.js";
import { triage } from "./triage.js";
import { createGitHubIssue, triggerWorkflow } from "./github.js";
import { registerInteractions } from "./interactions.js";
import { startServer } from "./server.js";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const REQUIRED_ENV = ["DISCORD_TOKEN", "SUGGESTIONS_FORUM_ID", "GEMINI_API_KEY", "GITHUB_TOKEN"];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}`);
    process.exit(1);
  }
}

const SUGGESTIONS_FORUM_ID = process.env.SUGGESTIONS_FORUM_ID;
const PIPELINE_STATUS_CHANNEL_ID = process.env.PIPELINE_STATUS_CHANNEL_ID;

client.once(Events.ClientReady, (c) => {
  console.log(`Logged in as ${c.user.tag}`);
  startServer(client);
});

registerInteractions(client);

// Detect new forum posts (threads created in the suggestions forum)
client.on(Events.ThreadCreate, async (thread, newlyCreated) => {
  if (!newlyCreated) return;
  if (thread.parentId !== SUGGESTIONS_FORUM_ID) return;

  console.log(`New suggestion: "${thread.name}" by ${thread.ownerId}`);

  try {
    // Fetch the starter message
    const starterMessage = await thread.fetchStarterMessage();
    const content = starterMessage?.content || "";
    const title = thread.name;

    // Step 1: LLM triage
    await thread.send("Triaging your suggestion...");
    const triageResult = await triage(title, content);

    if (triageResult.rejected) {
      await thread.send(
        `This suggestion was filtered out during triage.\n**Reason:** ${triageResult.reason}`
      );
      return;
    }

    // Step 2: Create GitHub issue
    const issue = await createGitHubIssue(triageResult);
    await thread.send(
      `GitHub issue created: **#${issue.number}** — ${issue.html_url}`
    );

    // Step 3: Trigger workflow
    await triggerWorkflow({
      issueTitle: triageResult.title,
      issueDescription: triageResult.issueBody,
      issueNumber: String(issue.number),
      discordThreadId: thread.id,
    });

    await thread.send("Pipeline triggered. Claude Code is working on it.");

    // Step 4: Post to #pipeline-status
    if (PIPELINE_STATUS_CHANNEL_ID) {
      const statusChannel = await client.channels.fetch(
        PIPELINE_STATUS_CHANNEL_ID
      );
      if (statusChannel) {
        await statusChannel.send(
          `New pipeline run: **${triageResult.title}** (${triageResult.category})\nIssue: ${issue.html_url}\nDiscord thread: <#${thread.id}>`
        );
      }
    }
  } catch (err) {
    console.error("Pipeline error:", err);
    const msg = err.message?.includes("invalid JSON")
      ? "Triage failed — the LLM returned an unexpected response. Try rephrasing your suggestion."
      : "Something went wrong processing this suggestion. Check the logs.";
    await thread.send(msg).catch(() => {});
  }
});

client.login(process.env.DISCORD_TOKEN);
