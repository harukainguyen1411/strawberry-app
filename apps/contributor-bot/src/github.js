import { Octokit } from "@octokit/rest";

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

const OWNER = process.env.GITHUB_OWNER || "Duongntd";
const REPO = process.env.GITHUB_REPO || "strawberry";

export async function createGitHubIssue(triageResult) {
  const { data } = await octokit.issues.create({
    owner: OWNER,
    repo: REPO,
    title: triageResult.title,
    body: triageResult.issueBody,
    labels: [triageResult.category, "contributor-pipeline"],
  });

  return data;
}

export async function triggerWorkflow({
  issueTitle,
  issueDescription,
  issueNumber,
  discordThreadId,
}) {
  await octokit.actions.createWorkflowDispatch({
    owner: OWNER,
    repo: REPO,
    workflow_id: "contributor-pipeline.yml",
    ref: "main",
    inputs: {
      issue_title: issueTitle,
      issue_description: issueDescription,
      issue_number: issueNumber,
      discord_thread_id: discordThreadId,
    },
  });
}
