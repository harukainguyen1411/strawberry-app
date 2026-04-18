import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineString } from "firebase-functions/params";
import { Octokit } from "@octokit/rest";

initializeApp();

const CALLABLE_CORS = [
  "https://apps.darkstrawberry.com",
  "https://myapps-b31ea.web.app",
  "https://myapps-b31ea.firebaseapp.com",
  /localhost:\d+$/,
];

// Bee Gemini intake functions
export { beeIntakeStart, beeIntakeTurn, beeIntakeSubmit } from "./beeIntake";
const db = getFirestore();

// Config params (set via firebase functions:config or .env)
const discordWebhookUrl = defineString("DISCORD_WEBHOOK_URL", {
  description: "Discord webhook URL for sending notification DMs",
  default: "",
});

// ── Notification types ──

interface NotificationDoc {
  recipientId: string;
  type: "access_request" | "access_approved" | "access_denied" | "new_suggestion";
  payload: Record<string, string>;
  dispatched?: boolean;
  dispatchedAt?: FirebaseFirestore.Timestamp;
  dispatchChannel?: string;
  error?: string;
}

// ── Dispatch function ──

/**
 * Watches /notifications/{notifId} for new documents.
 * Reads the recipient's notification preference and dispatches accordingly.
 */
export const dispatchNotification = onDocumentCreated(
  "notifications/{notifId}",
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const notif = snap.data() as NotificationDoc;
    const notifRef = snap.ref;

    try {
      // Look up recipient's notification preference
      const userSnap = await db.collection("users").doc(notif.recipientId).get();
      if (!userSnap.exists) {
        await notifRef.update({
          dispatched: false,
          error: "recipient_not_found",
        });
        return;
      }

      const user = userSnap.data()!;
      const channel: string = user.notificationChannel || "email";

      if (channel === "discord") {
        await dispatchDiscord(notif, user.discordUserId);
      } else {
        await dispatchEmail(notif, user.email);
      }

      await notifRef.update({
        dispatched: true,
        dispatchedAt: FieldValue.serverTimestamp(),
        dispatchChannel: channel,
      });
    } catch (err) {
      console.error(`Failed to dispatch notification ${snap.id}:`, err);
      await notifRef.update({
        dispatched: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
);

// ── Email dispatch (Firebase Trigger Email extension) ──

async function dispatchEmail(
  notif: NotificationDoc,
  recipientEmail?: string
): Promise<void> {
  if (!recipientEmail) {
    throw new Error("no_email_address");
  }

  const { subject, body } = formatMessage(notif);

  // Write to /mail collection — the Firebase Trigger Email extension picks this up
  await db.collection("mail").add({
    to: recipientEmail,
    message: {
      subject: `[Dark Strawberry] ${subject}`,
      text: body,
      html: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #e8614a;">${subject}</h2>
        <p>${body}</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="color: #999; font-size: 12px;">Dark Strawberry Apps Platform</p>
      </div>`,
    },
  });
}

// ── Discord dispatch ──

async function dispatchDiscord(
  notif: NotificationDoc,
  discordUserId?: string
): Promise<void> {
  const webhookUrl = discordWebhookUrl.value();
  if (!webhookUrl) {
    throw new Error("discord_webhook_not_configured");
  }

  const { subject, body } = formatMessage(notif);
  const mention = discordUserId ? `<@${discordUserId}> ` : "";

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: `${mention}**${subject}**\n${body}`,
    }),
  });

  if (!response.ok) {
    throw new Error(`discord_webhook_error:${response.status}`);
  }
}

// ── Message formatting ──

function formatMessage(notif: NotificationDoc): { subject: string; body: string } {
  const p = notif.payload;

  switch (notif.type) {
    case "access_request":
      return {
        subject: "New Access Request",
        body: `${p.requesterName || "Someone"} has requested access to ${p.appName || "your app"}.`,
      };
    case "access_approved":
      return {
        subject: "Access Request Approved",
        body: `Your request to access ${p.appName || "an app"} has been approved.`,
      };
    case "access_denied":
      return {
        subject: "Access Request Denied",
        body: `Your request to access ${p.appName || "an app"} was denied.`,
      };
    case "new_suggestion":
      return {
        subject: "New Suggestion",
        body: `${p.authorName || "Someone"} suggested an improvement for ${p.appName || "your app"}: "${p.suggestionTitle || ""}"`,
      };
    default:
      return {
        subject: "Notification",
        body: `You have a new notification from Dark Strawberry.`,
      };
  }
}

// ── Bee Cloud Functions (GitHub issue bridge) ──

const githubToken = defineString("GITHUB_TOKEN", {
  description: "GitHub PAT for creating bee issues",
  default: "",
});

const beeGithubRepo = defineString("BEE_GITHUB_REPO", {
  description: "GitHub repo for bee issues (owner/repo format). Set via Firebase deploy param or GITHUB_REPOSITORY env var.",
  default: "",
});

// Allowed sister UIDs (comma-separated). Empty = allow all authenticated users.
const beeSisterUids = defineString("BEE_SISTER_UIDS", {
  description: "Comma-separated Firebase UIDs allowed to use Bee",
  default: "",
});

function getOctokit(): Octokit {
  const token = githubToken.value();
  if (!token) throw new HttpsError("failed-precondition", "github_token_not_configured");
  return new Octokit({ auth: token });
}

function parseBeeRepo(): { owner: string; repo: string } {
  const repoSlug = beeGithubRepo.value() || process.env.GITHUB_REPOSITORY || "";
  const [owner, repo] = repoSlug.split("/");
  if (!owner || !repo) throw new HttpsError("internal", "invalid_bee_repo_config");
  return { owner, repo };
}

function assertBeeAuth(uid: string | undefined): void {
  if (!uid) throw new HttpsError("unauthenticated", "login_required");
  const allowed = beeSisterUids.value();
  if (allowed && !allowed.split(",").map((s) => s.trim()).includes(uid)) {
    throw new HttpsError("permission-denied", "not_authorized_for_bee");
  }
}

/**
 * Create a GitHub issue for a bee question.
 * Input: { question: string, docxStorageUrl?: string }
 * Returns: { issueNumber: number, issueUrl: string }
 */
export const createBeeIssue = onCall({ cors: CALLABLE_CORS }, async (request) => {
  assertBeeAuth(request.auth?.uid);

  const { question, docxStorageUrl } = request.data as {
    question?: string;
    docxStorageUrl?: string;
  };

  if (!question || question.trim().length === 0) {
    throw new HttpsError("invalid-argument", "question_required");
  }

  let body = question.trim();
  if (docxStorageUrl) {
    body += `\n\n---\ndocx: ${docxStorageUrl}`;
  }

  const { owner, repo } = parseBeeRepo();
  const octokit = getOctokit();

  const { data: issue } = await octokit.issues.create({
    owner,
    repo,
    title: question.trim().slice(0, 100),
    body,
    labels: ["bee", "ready"],
  });

  return {
    issueNumber: issue.number,
    issueUrl: issue.html_url,
  };
});

/**
 * Get status of a bee issue.
 * Input: { issueNumber: number }
 * Returns: { state, labels, answer?, resultDocxUrl? }
 */
export const getBeeStatus = onCall({ cors: CALLABLE_CORS }, async (request) => {
  assertBeeAuth(request.auth?.uid);

  const { issueNumber } = request.data as { issueNumber?: number };
  if (!issueNumber) {
    throw new HttpsError("invalid-argument", "issue_number_required");
  }

  const { owner, repo } = parseBeeRepo();
  const octokit = getOctokit();

  const { data: issue } = await octokit.issues.get({
    owner,
    repo,
    issue_number: issueNumber,
  });

  const labels = issue.labels.map((l) =>
    typeof l === "string" ? l : l.name ?? "",
  );

  // Find the bot's answer comment (first comment not by the issue creator)
  let answer: string | null = null;
  let resultDocxUrl: string | null = null;

  if (labels.includes("done") || issue.state === "closed") {
    const { data: comments } = await octokit.issues.listComments({
      owner,
      repo,
      issue_number: issueNumber,
      per_page: 10,
    });

    // The bot's answer is typically the last comment
    const botComment = comments.find((c) =>
      c.body?.includes("Nhận xét") || c.body?.includes("Tải file kết quả"),
    );

    if (botComment?.body) {
      answer = botComment.body;
      // Extract docx download link if present
      const docxMatch = botComment.body.match(/\[Tải file kết quả.*?\]\((gs:\/\/[^)]+)\)/);
      if (docxMatch) {
        resultDocxUrl = docxMatch[1];
      }
    }
  }

  return {
    state: issue.state,
    labels,
    answer,
    resultDocxUrl,
  };
});

/**
 * List past bee issues for the current user.
 * Returns closed bee issues (most recent first).
 */
export const listBeeIssues = onCall({ cors: CALLABLE_CORS }, async (request) => {
  assertBeeAuth(request.auth?.uid);

  const { owner, repo } = parseBeeRepo();
  const octokit = getOctokit();

  const { data: issues } = await octokit.issues.listForRepo({
    owner,
    repo,
    state: "closed",
    labels: "bee",
    sort: "created",
    direction: "desc",
    per_page: 20,
  });

  return issues
    .filter((i) => !i.pull_request)
    .map((i) => ({
      number: i.number,
      title: i.title,
      createdAt: i.created_at,
      closedAt: i.closed_at,
    }));
});
