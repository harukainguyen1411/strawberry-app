import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";

const SUGGESTIONS_FORUM_ID = process.env.SUGGESTIONS_FORUM_ID;
const PIPELINE_STATUS_CHANNEL_ID = process.env.PIPELINE_STATUS_CHANNEL_ID;
const PREVIEWS_CHANNEL_ID = process.env.PREVIEWS_CHANNEL_ID;

export async function postPipelineResult(client, data) {
  const { prUrl, previewUrl, prNumber, issueTitle, discordThreadId, branch } =
    data;

  // 1. Reply in original Discord suggestion thread
  if (discordThreadId) {
    try {
      const thread = await client.channels.fetch(discordThreadId);
      if (thread) {
        await thread.send({
          embeds: [
            new EmbedBuilder()
              .setTitle("Pipeline Complete")
              .setColor(0x43b581)
              .addFields(
                { name: "Preview", value: previewUrl || "N/A" },
                { name: "Pull Request", value: prUrl || "N/A" }
              )
              .setTimestamp(),
          ],
        });
      }
    } catch (err) {
      console.error("Failed to post to suggestion thread:", err.message);
    }
  }

  // 2. Post status embed to #pipeline-status
  if (PIPELINE_STATUS_CHANNEL_ID) {
    try {
      const statusChannel = await client.channels.fetch(
        PIPELINE_STATUS_CHANNEL_ID
      );
      if (statusChannel) {
        await statusChannel.send({
          embeds: [
            new EmbedBuilder()
              .setTitle(`Pipeline Complete: ${issueTitle || branch}`)
              .setColor(0x43b581)
              .addFields(
                { name: "PR", value: prUrl || "N/A", inline: true },
                {
                  name: "Preview",
                  value: previewUrl || "N/A",
                  inline: true,
                },
                {
                  name: "Branch",
                  value: branch || "N/A",
                  inline: true,
                }
              )
              .setTimestamp(),
          ],
        });
      }
    } catch (err) {
      console.error("Failed to post to #pipeline-status:", err.message);
    }
  }

  // 3. Post preview embed with approval buttons to #previews
  if (PREVIEWS_CHANNEL_ID) {
    try {
      const previewsChannel = await client.channels.fetch(PREVIEWS_CHANNEL_ID);
      if (previewsChannel) {
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`approve:${prNumber}:${discordThreadId || ""}`)
            .setLabel("Approve")
            .setStyle(ButtonStyle.Success)
            .setEmoji("✅"),
          new ButtonBuilder()
            .setCustomId(`request_changes:${prNumber}:${discordThreadId || ""}`)
            .setLabel("Request Changes")
            .setStyle(ButtonStyle.Danger)
            .setEmoji("❌")
        );

        await previewsChannel.send({
          embeds: [
            new EmbedBuilder()
              .setTitle(issueTitle || `PR #${prNumber}`)
              .setColor(0x5865f2)
              .setDescription(
                `A contributor suggestion has been implemented and is ready for review.`
              )
              .addFields(
                {
                  name: "Preview URL",
                  value: previewUrl || "N/A",
                },
                {
                  name: "Pull Request",
                  value: prUrl || "N/A",
                }
              )
              .setTimestamp(),
          ],
          components: [row],
        });
      }
    } catch (err) {
      console.error("Failed to post to #previews:", err.message);
    }
  }
}

export async function postMergeStatus(client, data) {
  const { prNumber, discordThreadId, issueTitle } = data;

  // Update the suggestion thread with deployed status
  if (discordThreadId) {
    try {
      const thread = await client.channels.fetch(discordThreadId);
      if (thread) {
        await thread.send({
          embeds: [
            new EmbedBuilder()
              .setTitle("Deployed to Production")
              .setColor(0x57f287)
              .setDescription(
                `PR #${prNumber} has been merged and deployed.`
              )
              .setTimestamp(),
          ],
        });

        // Apply "Deployed" tag to the forum post if available
        if (thread.parentId === SUGGESTIONS_FORUM_ID) {
          try {
            const forum = await client.channels.fetch(SUGGESTIONS_FORUM_ID);
            const deployedTag = forum.availableTags?.find(
              (t) => t.name.toLowerCase() === "deployed"
            );
            if (deployedTag) {
              const currentTags = thread.appliedTags || [];
              if (!currentTags.includes(deployedTag.id)) {
                await thread.setAppliedTags([
                  ...currentTags,
                  deployedTag.id,
                ]);
              }
            }
          } catch (tagErr) {
            console.error("Failed to set Deployed tag:", tagErr.message);
          }
        }
      }
    } catch (err) {
      console.error("Failed to post merge status:", err.message);
    }
  }

  // Post to #pipeline-status
  if (PIPELINE_STATUS_CHANNEL_ID) {
    try {
      const statusChannel = await client.channels.fetch(
        PIPELINE_STATUS_CHANNEL_ID
      );
      if (statusChannel) {
        await statusChannel.send({
          embeds: [
            new EmbedBuilder()
              .setTitle(`Deployed: ${issueTitle || `PR #${prNumber}`}`)
              .setColor(0x57f287)
              .setDescription("Merged to main and deployed to production.")
              .setTimestamp(),
          ],
        });
      }
    } catch (err) {
      console.error("Failed to post merge status to #pipeline-status:", err.message);
    }
  }
}
