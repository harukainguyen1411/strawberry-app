import {
  Events,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from "discord.js";
import { Octokit } from "@octokit/rest";

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const OWNER = process.env.GITHUB_OWNER || "Duongntd";
const REPO = process.env.GITHUB_REPO || "strawberry";

export function registerInteractions(client) {
  client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isButton()) {
      await handleButton(interaction);
    } else if (interaction.isModalSubmit()) {
      await handleModal(interaction);
    }
  });
}

async function handleButton(interaction) {
  const [action, prNumber, threadId] = interaction.customId.split(":");

  if (action === "approve") {
    await interaction.deferReply({ ephemeral: true });

    try {
      await octokit.issues.addLabels({
        owner: OWNER,
        repo: REPO,
        issue_number: Number(prNumber),
        labels: ["approved"],
      });

      await interaction.editReply({
        content: `PR #${prNumber} labeled as **approved**.`,
      });

      // Update the button message to show approval
      await interaction.message.edit({
        embeds: interaction.message.embeds,
        components: [], // Remove buttons after action
      });

      // Notify the suggestion thread
      if (threadId) {
        try {
          const thread = await interaction.client.channels.fetch(threadId);
          if (thread) {
            await thread.send(
              `Approved by <@${interaction.user.id}>. PR #${prNumber} has been labeled for merge.`
            );
          }
        } catch {}
      }
    } catch (err) {
      console.error("Approve error:", err);
      await interaction.editReply({
        content: `Failed to approve: ${err.message}`,
      });
    }
  } else if (action === "request_changes") {
    // Show a modal to collect feedback
    const modal = new ModalBuilder()
      .setCustomId(`feedback_modal:${prNumber}:${threadId}`)
      .setTitle("Request Changes");

    const feedbackInput = new TextInputBuilder()
      .setCustomId("feedback")
      .setLabel("What changes are needed?")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(feedbackInput));
    await interaction.showModal(modal);
  }
}

async function handleModal(interaction) {
  if (!interaction.customId.startsWith("feedback_modal:")) return;

  const [, prNumber, threadId] = interaction.customId.split(":");
  const feedback = interaction.fields.getTextInputValue("feedback");

  await interaction.deferReply({ ephemeral: true });

  try {
    // Post feedback as PR comment
    await octokit.issues.createComment({
      owner: OWNER,
      repo: REPO,
      issue_number: Number(prNumber),
      body: `## Changes Requested (via Discord)\n\n${feedback}\n\n— <@${interaction.user.id}> via contributor pipeline`,
    });

    await interaction.editReply({
      content: `Feedback posted to PR #${prNumber}.`,
    });

    // Remove buttons from the preview message
    await interaction.message.edit({
      embeds: interaction.message.embeds,
      components: [],
    });

    // Notify the suggestion thread
    if (threadId) {
      try {
        const thread = await interaction.client.channels.fetch(threadId);
        if (thread) {
          await thread.send(
            `Changes requested by <@${interaction.user.id}> on PR #${prNumber}:\n> ${feedback}`
          );
        }
      } catch {}
    }
  } catch (err) {
    console.error("Feedback error:", err);
    await interaction.editReply({
      content: `Failed to post feedback: ${err.message}`,
    });
  }
}
