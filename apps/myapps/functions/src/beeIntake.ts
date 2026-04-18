/**
 * Bee Gemini Intake Functions
 *
 * Three callable Cloud Functions that power the conversational intake flow:
 *   beeIntakeStart  — create a new session, send initial input to Gemini
 *   beeIntakeTurn   — continue the conversation
 *   beeIntakeSubmit — finalize and file a GitHub Issue
 *
 * Local testing: export GEMINI_API_KEY=<key> and run
 *   firebase emulators:start --only functions,firestore,storage,auth --project myapps-b31ea
 */

import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineString, defineSecret } from "firebase-functions/params";
import { Octokit } from "@octokit/rest";
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";
import * as mammoth from "mammoth";

const db = getFirestore();

// ── Config ──────────────────────────────────────────────────────────────────

const geminiApiKey = defineSecret("GEMINI_API_KEY");

const githubToken = defineString("GITHUB_TOKEN", {
  description: "GitHub PAT for creating bee issues",
  default: "",
});

const beeGithubRepo = defineString("BEE_GITHUB_REPO", {
  description: "GitHub repo for bee issues (owner/repo format). Set via Firebase deploy param or GITHUB_REPOSITORY env var.",
  default: "",
});

const beeSisterUids = defineString("BEE_SISTER_UIDS", {
  description: "Comma-separated Firebase UIDs allowed to use Bee",
  default: "",
});

// ── Auth helper ───────────────────────────────────────────────────────────────

function assertBeeAuth(uid: string | undefined): string {
  if (!uid) throw new HttpsError("unauthenticated", "login_required");
  const allowed = beeSisterUids.value();
  if (allowed && !allowed.split(",").map((s) => s.trim()).includes(uid)) {
    throw new HttpsError("permission-denied", "not_authorized_for_bee");
  }
  return uid;
}

// ── Shared constants ──────────────────────────────────────────────────────────

/**
 * The Vietnamese intro message shown immediately before Gemini responds.
 * This is stored as the first model message in Firestore (seed, not sent to Gemini).
 * The same string is hardcoded in BeeIntake.vue for immediate display;
 * keep both in sync if this changes.
 */
export const BEE_INTRO_MESSAGE =
  "Chào Haruka! Mình là trợ lý của Bee. Bạn cứ mô tả hoặc tải tài liệu lên — mình sẽ hỏi vài câu để chắc chắn hiểu đúng yêu cầu trước khi giao cho Bee xử lý.";

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are Bee's intake assistant. Your job is to review a user's request and ensure it is clear, complete, and actionable before it is sent to the worker agent for execution.

You will receive the user's original request (either typed text, pasted content, or extracted text from an uploaded document).

## Your Process

1. Read the request carefully.
2. Evaluate it against this rubric — identify any gaps:
   - **Scope**: What exactly needs to be done? Is the deliverable clearly defined?
   - **Audience**: Who is the output for? (e.g., academic professor, casual reader, client)
   - **Format**: What format should the output be in? (e.g., Word doc, PDF, slides, plain text)
   - **Language**: What language should the output be in?
   - **Length/depth**: How long or detailed should the output be?
   - **References/sources**: Are there specific sources to use or avoid?
   - **Deadline or priority**: Is there a time constraint?
   - **Edge cases**: Anything ambiguous that could be interpreted multiple ways?
3. If there are gaps, ask clarifying questions. Rules:
   - Ask at most 3 questions per turn.
   - Be concise. Each question should be 1-2 sentences.
   - Offer reasonable defaults the user can accept (e.g., "Should the output be in Vietnamese? If you don't specify, I'll assume Vietnamese.")
   - If the request is already clear and complete, skip straight to producing the final spec.
4. If the user says "just go", "you decide", "skip", or anything indicating they want you to proceed without further clarification, make reasonable assumptions and produce the final spec immediately.

## Output Format

When you have enough information (or the user tells you to proceed), respond with EXACTLY this JSON block and nothing else:

\`\`\`json
{
  "ready": true,
  "summary": "One-sentence summary of what will be done",
  "original_request": "The verbatim original request or a faithful summary if it was very long",
  "clarifications": [
    {"question": "What you asked", "answer": "What the user said"}
  ],
  "final_spec": {
    "task": "Clear description of the task",
    "audience": "Who the output is for",
    "format": "Output format",
    "language": "Output language",
    "length": "Expected length or depth",
    "references": "Any sources or constraints",
    "deadline": "If mentioned, otherwise null",
    "notes": "Any other relevant details"
  }
}
\`\`\`

Until you are ready to produce the final spec, respond conversationally with your clarifying questions. Do NOT include the JSON block in intermediate responses.`;

// ── Gemini helpers ────────────────────────────────────────────────────────────

interface GeminiResult {
  text: string;
  done: boolean;
  finalSpec?: Record<string, unknown>;
  promptTokens: number;
  outputTokens: number;
}

function getGemini(): GoogleGenerativeAI {
  // In emulator, reads from GEMINI_API_KEY env var
  const key = process.env.GEMINI_API_KEY || geminiApiKey.value();
  if (!key) throw new HttpsError("failed-precondition", "gemini_api_key_not_configured");
  return new GoogleGenerativeAI(key);
}

function parseReadySpec(text: string): Record<string, unknown> | null {
  const match = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]);
    if (parsed && parsed.ready === true && parsed.final_spec) return parsed;
    return null;
  } catch {
    return null;
  }
}

interface ConversationMessage {
  role: "user" | "model";
  parts: Array<{ text: string }>;
}

async function callGemini(
  messages: ConversationMessage[],
  gemini: GoogleGenerativeAI
): Promise<GeminiResult> {
  const model = gemini.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: SYSTEM_PROMPT,
    safetySettings: [
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
    ],
    generationConfig: {
      maxOutputTokens: 2000,
    },
  });

  const history = messages.slice(0, -1);
  const lastMessage = messages[messages.length - 1];

  const chat = model.startChat({ history });
  const result = await chat.sendMessage(lastMessage.parts[0].text);
  const response = result.response;
  const text = response.text();
  const usage = response.usageMetadata;

  const spec = parseReadySpec(text);

  return {
    text,
    done: spec !== null,
    finalSpec: spec ?? undefined,
    promptTokens: usage?.promptTokenCount ?? 0,
    outputTokens: usage?.candidatesTokenCount ?? 0,
  };
}

// ── Session helpers ───────────────────────────────────────────────────────────

interface SessionMessage {
  role: "user" | "model";
  content: string;
  timestamp: Timestamp;
  tokenCount: number;
}

async function getSessionMessages(sessionId: string): Promise<SessionMessage[]> {
  const snap = await db
    .collection("bee-intake-sessions")
    .doc(sessionId)
    .collection("messages")
    .orderBy("timestamp", "asc")
    .get();

  return snap.docs.map((d) => d.data() as SessionMessage);
}

async function appendMessage(
  sessionId: string,
  role: "user" | "model",
  content: string,
  tokenCount: number
): Promise<void> {
  await db
    .collection("bee-intake-sessions")
    .doc(sessionId)
    .collection("messages")
    .add({
      role,
      content,
      timestamp: FieldValue.serverTimestamp(),
      tokenCount,
    });
}

// ── Daily rate limit ──────────────────────────────────────────────────────────

async function checkDailyLimit(uid: string): Promise<void> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const snap = await db
    .collection("bee-intake-sessions")
    .where("uid", "==", uid)
    .where("createdAt", ">=", Timestamp.fromDate(startOfDay))
    .get();

  if (snap.size >= 20) {
    throw new HttpsError("resource-exhausted", "daily_session_limit_reached");
  }
}

// ── beeIntakeStart ─────────────────────────────────────────────────────────────

interface StartInput {
  textInput?: string;
  fileRef?: string;
}

interface StartOutput {
  sessionId: string;
  botMessage: string;
  done: boolean;
}

export const beeIntakeStart = onCall<StartInput, Promise<StartOutput>>(
  { secrets: ["GEMINI_API_KEY"], timeoutSeconds: 120, cors: ["https://apps.darkstrawberry.com", "https://myapps-b31ea.web.app", "https://myapps-b31ea.firebaseapp.com", /localhost:\d+$/] },
  async (request) => {
    const uid = assertBeeAuth(request.auth?.uid);
    await checkDailyLimit(uid);

    const { textInput, fileRef } = request.data;

    // ── Vietnamese intro message (see BEE_INTRO_MESSAGE at module level) ────

    // Build the user's first message content
    let userContent = "";

    if (fileRef) {
      // P1: extract text from docx
      // Validate fileRef to prevent path traversal — must be under the caller's uid prefix
      if (!fileRef.startsWith(`bee-temp/${uid}/`)) {
        throw new HttpsError("invalid-argument", "invalid_file_ref");
      }
      try {
        const storage = getStorage();
        const bucket = storage.bucket();
        // fileRef is like "bee-temp/<uid>/<ts>/input.docx"
        const file = bucket.file(fileRef);
        const [buffer] = await file.download();
        const result = await mammoth.extractRawText({ buffer });
        let extracted = result.value;
        if (extracted.length > 30000) {
          extracted =
            extracted.slice(0, 30000) +
            "\n[Document truncated. Full document available to bee-worker.]";
        }
        userContent = extracted;
        if (textInput?.trim()) {
          userContent = `${textInput.trim()}\n\n--- Nội dung tài liệu ---\n${userContent}`;
        }
      } catch (err) {
        console.error("mammoth extraction failed:", err);
        userContent = textInput?.trim() || "[File upload — could not extract text. Please describe your request.]";
      }
    } else if (textInput?.trim()) {
      userContent = textInput.trim();
    } else {
      throw new HttpsError("invalid-argument", "text_input_or_file_required");
    }

    // Create session document
    const sessionRef = db.collection("bee-intake-sessions").doc();
    const sessionId = sessionRef.id;

    await sessionRef.set({
      uid,
      status: "active",
      fileRef: fileRef ?? null,
      originalTextInput: textInput ?? null,
      finalSpec: null,
      turnCount: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Add intro as first model message (seed, not sent to Gemini)
    await appendMessage(sessionId, "model", BEE_INTRO_MESSAGE, 0);

    // Now add the user's first message and get Gemini's response
    await appendMessage(sessionId, "user", userContent, 0);

    const gemini = getGemini();
    const convMessages: ConversationMessage[] = [
      { role: "user", parts: [{ text: userContent }] },
    ];

    const geminiResult = await callGemini(convMessages, gemini);

    await appendMessage(sessionId, "model", geminiResult.text, geminiResult.outputTokens);

    await sessionRef.update({
      turnCount: FieldValue.increment(1),
      totalInputTokens: FieldValue.increment(geminiResult.promptTokens),
      totalOutputTokens: FieldValue.increment(geminiResult.outputTokens),
      updatedAt: FieldValue.serverTimestamp(),
      ...(geminiResult.done
        ? { status: "complete", finalSpec: geminiResult.finalSpec }
        : {}),
    });

    return {
      sessionId,
      botMessage: geminiResult.text,
      done: geminiResult.done,
    };
  }
);

// ── beeIntakeTurn ──────────────────────────────────────────────────────────────

interface TurnInput {
  sessionId: string;
  userMessage: string;
}

interface TurnOutput {
  botMessage: string;
  done: boolean;
}

export const beeIntakeTurn = onCall<TurnInput, Promise<TurnOutput>>(
  { secrets: ["GEMINI_API_KEY"], timeoutSeconds: 120, cors: ["https://apps.darkstrawberry.com", "https://myapps-b31ea.web.app", "https://myapps-b31ea.firebaseapp.com", /localhost:\d+$/] },
  async (request) => {
    const uid = assertBeeAuth(request.auth?.uid);

    const { sessionId, userMessage } = request.data;
    if (!sessionId) throw new HttpsError("invalid-argument", "session_id_required");
    if (!userMessage?.trim()) throw new HttpsError("invalid-argument", "user_message_required");

    const sessionRef = db.collection("bee-intake-sessions").doc(sessionId);
    const sessionSnap = await sessionRef.get();
    if (!sessionSnap.exists) throw new HttpsError("not-found", "session_not_found");

    const session = sessionSnap.data()!;
    if (session.uid !== uid) throw new HttpsError("permission-denied", "session_not_owned");
    if (session.status !== "active") throw new HttpsError("failed-precondition", "session_not_active");

    // Turn limit check
    const forceFinal = session.turnCount >= 8;

    await appendMessage(sessionId, "user", userMessage.trim(), 0);

    // Build conversation history from Firestore — skip the synthetic intro message
    const storedMsgs = await getSessionMessages(sessionId);
    // Filter out the intro model message by matching content instead of index,
    // so the filter is robust even if ordering shifts.
    const convMessages: ConversationMessage[] = storedMsgs
      .filter((m) => !(m.role === "model" && m.content === BEE_INTRO_MESSAGE))
      .map((m) => ({
        role: m.role,
        parts: [{ text: m.content }],
      }));

    // Token budget check — inject a synthetic user turn into the in-memory
    // message list only (not persisted), appended after the real user message
    // so we never produce two consecutive user-role turns in Firestore.
    if (session.totalInputTokens >= 50000 || session.totalOutputTokens >= 5000) {
      const forceMsg =
        "Please provide your final specification now. The token budget has been reached — make reasonable assumptions for any remaining unclear points.";
      convMessages.push({ role: "user", parts: [{ text: forceMsg }] });
    }

    const gemini = getGemini();

    let geminiResult = await callGemini(convMessages, gemini);

    // If turn limit hit and not done, append forced instruction
    if (forceFinal && !geminiResult.done) {
      const forcePrompt =
        "Please provide your final specification now. Make reasonable assumptions for any unclear points.";
      const forceMessages: ConversationMessage[] = [
        ...convMessages,
        { role: "model", parts: [{ text: geminiResult.text }] },
        { role: "user", parts: [{ text: forcePrompt }] },
      ];
      geminiResult = await callGemini(forceMessages, gemini);
    }

    await appendMessage(sessionId, "model", geminiResult.text, geminiResult.outputTokens);

    await sessionRef.update({
      turnCount: FieldValue.increment(1),
      totalInputTokens: FieldValue.increment(geminiResult.promptTokens),
      totalOutputTokens: FieldValue.increment(geminiResult.outputTokens),
      updatedAt: FieldValue.serverTimestamp(),
      ...(geminiResult.done
        ? { status: "complete", finalSpec: geminiResult.finalSpec }
        : {}),
    });

    return {
      botMessage: geminiResult.text,
      done: geminiResult.done,
    };
  }
);

// ── beeIntakeSubmit ────────────────────────────────────────────────────────────

interface SubmitInput {
  sessionId: string;
}

interface SubmitOutput {
  issueUrl: string;
  issueNumber: number;
}

export const beeIntakeSubmit = onCall<SubmitInput, Promise<SubmitOutput>>(
  { secrets: ["GEMINI_API_KEY"], timeoutSeconds: 120, cors: ["https://apps.darkstrawberry.com", "https://myapps-b31ea.web.app", "https://myapps-b31ea.firebaseapp.com", /localhost:\d+$/] },
  async (request) => {
    const uid = assertBeeAuth(request.auth?.uid);

    const { sessionId } = request.data;
    if (!sessionId) throw new HttpsError("invalid-argument", "session_id_required");

    const sessionRef = db.collection("bee-intake-sessions").doc(sessionId);
    const sessionSnap = await sessionRef.get();
    if (!sessionSnap.exists) throw new HttpsError("not-found", "session_not_found");

    const session = sessionSnap.data()!;
    if (session.uid !== uid) throw new HttpsError("permission-denied", "session_not_owned");

    // Idempotency guard — if a GitHub issue was already filed for this session, return it immediately
    if (session.issueNumber) {
      return {
        issueUrl: session.issueUrl as string,
        issueNumber: session.issueNumber as number,
      };
    }

    if (!session.finalSpec) throw new HttpsError("failed-precondition", "intake_not_complete");

    const spec = session.finalSpec as Record<string, unknown>;
    const finalSpec = spec.final_spec as Record<string, unknown>;
    const clarifications = (spec.clarifications as Array<{ question: string; answer: string }>) ?? [];
    const summary = (spec.summary as string) ?? "";
    const originalRequest = (spec.original_request as string) ?? (session.originalTextInput ?? "");

    // Build issue body — backward-compatible with bee-worker parseIssueBody
    // Everything before \n---\n is the "question" portion
    let body = `## Request Summary\n${summary}\n\n`;
    body += `## Original Request\n${
      originalRequest.length > 2000
        ? originalRequest.slice(0, 2000) + "\n[truncated]"
        : originalRequest
    }\n\n`;

    if (clarifications.length > 0) {
      body += `## Clarification Q&A\n`;
      for (const c of clarifications) {
        body += `**Q:** ${c.question}\n**A:** ${c.answer}\n\n`;
      }
    }

    body += `## Final Specification\n`;
    body += `- **Task:** ${finalSpec.task ?? ""}\n`;
    body += `- **Audience:** ${finalSpec.audience ?? ""}\n`;
    body += `- **Format:** ${finalSpec.format ?? ""}\n`;
    body += `- **Language:** ${finalSpec.language ?? ""}\n`;
    body += `- **Length:** ${finalSpec.length ?? ""}\n`;
    body += `- **References:** ${finalSpec.references ?? ""}\n`;
    body += `- **Deadline:** ${finalSpec.deadline ?? "null"}\n`;
    body += `- **Notes:** ${finalSpec.notes ?? ""}\n\n`;

    body += `---\n_Intake session: ${sessionId} | Turns: ${session.turnCount} | Intake completed_`;

    // Append docx footer if file was uploaded (backward-compat with parseIssueBody).
    // Store only the session ID as a reference — the full GCS path is not written
    // to the issue body to avoid disclosing internal storage paths in GitHub.
    if (session.fileRef) {
      body += `\n---\ndocx: [attached — retrieve via session ${sessionId}]`;
    }

    // File GitHub Issue
    const token = githubToken.value();
    if (!token) throw new HttpsError("failed-precondition", "github_token_not_configured");

    const repoSlug = beeGithubRepo.value() || process.env.GITHUB_REPOSITORY || "";
    if (!repoSlug) throw new HttpsError("failed-precondition", "bee_github_repo_not_configured");
    const [owner, repo] = repoSlug.split("/");
    const octokit = new Octokit({ auth: token });

    const title = (summary || String(finalSpec.task ?? "Bee request")).slice(0, 100);

    const { data: issue } = await octokit.issues.create({
      owner,
      repo,
      title,
      body,
      labels: ["bee", "ready"],
    });

    await sessionRef.update({
      status: "complete",
      issueNumber: issue.number,
      issueUrl: issue.html_url,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      issueUrl: issue.html_url,
      issueNumber: issue.number,
    };
  }
);
