import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const TRIAGE_PROMPT = `You are a triage assistant for a personal apps project. Given a Discord suggestion post, extract structured information.

Respond with ONLY valid JSON (no markdown fences). Use this schema:
{
  "rejected": false,
  "category": "bug" | "feature" | "enhancement" | "question",
  "targetApp": "string — which app this targets, e.g. 'myapps', 'contributor-bot', or 'unknown'",
  "title": "string — clean, concise issue title",
  "description": "string — what the user wants",
  "acceptanceCriteria": ["string — testable criteria"],
  "feasibility": "low" | "medium" | "high"
}

If the suggestion is spam, nonsensical, or completely out of scope, respond with:
{
  "rejected": true,
  "reason": "string — why it was rejected"
}

Only reject if truly invalid. Be generous with interpretation.`;

const MAX_INPUT_LENGTH = 4000;

function sanitizeInput(text) {
  return text.replace(/[`*_~|]/g, "").slice(0, MAX_INPUT_LENGTH);
}

export async function triage(title, content) {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash-lite-preview-06-17",
  });

  const safeTitle = sanitizeInput(title);
  const safeContent = sanitizeInput(content);

  const result = await model.generateContent(
    `${TRIAGE_PROMPT}\n\n---\n\n**Title:** ${safeTitle}\n\n**Content:**\n${safeContent}`
  );

  const text = result.response.text().trim();

  let parsed;
  try {
    // Strip markdown fences if Gemini wraps the response
    const cleaned = text.replace(/^```json?\n?/, "").replace(/\n?```$/, "");
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Triage LLM returned invalid JSON: ${text.slice(0, 200)}`);
  }

  if (!parsed.rejected) {
    parsed.issueBody = formatIssueBody(parsed);
  }

  return parsed;
}

function formatIssueBody(t) {
  const criteria = t.acceptanceCriteria
    .map((c) => `- [ ] ${c}`)
    .join("\n");

  return `## Description

${t.description}

## Target App
${t.targetApp}

## Category
${t.category}

## Acceptance Criteria
${criteria}

## Feasibility
${t.feasibility}

---
_Auto-triaged by the contributor pipeline._`;
}
