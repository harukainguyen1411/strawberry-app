import {
  GoogleGenerativeAI,
  SchemaType,
} from "@google/generative-ai";
import { config } from "./config.js";

const MODEL_ID = process.env.GEMINI_MODEL ?? "gemini-2.5-flash-lite";

function buildTriageInstructions(app: string | null, type: string): string {
  let appContext: string;
  if (type === "new-app") {
    appContext =
      "This is a **new app proposal** channel. The user is requesting an entirely new application. " +
      "Extract the proposed app idea, name, and purpose. Check existing apps in the repo context for overlap.";
  } else if (app) {
    const typeLabel = type === "bug" ? "bug report" : "feature request";
    appContext =
      `This message is about the app **${app}**. ` +
      `The channel is specifically for ${typeLabel}s, so focus your analysis accordingly.`;
  } else {
    appContext = "This message is about the MyApps product.";
  }

  return `You are a triage bot.

${appContext}

When a user reports a problem or request in Discord, you analyze it and produce a structured GitHub issue.

Rules:
- Always output strict JSON matching the schema. No prose, no markdown fences.
- Use the triage-context.md vocabulary and label taxonomy exactly.
- If the message matches an existing open issue by intent (90% semantic overlap), set dupe_of_issue_number to that issue's number. Otherwise set it to null.
- If the message is completely off-topic (e.g. it's a meta-question about the agent system), set title to "__NOT_MYAPPS__" and body to a one-sentence explanation.
- Priority: p0 = data loss / auth broken, p1 = core feature broken, p2 = degraded experience, p3 = nice-to-have.
- Labels must be chosen only from the taxonomy defined in triage-context.md.
- title must be ≤80 characters.
- body should be GitHub-flavored markdown, concise but actionable.`;
}

export interface TriageVerdict {
  title: string;
  body: string;
  labels: string[];
  priority: "p0" | "p1" | "p2" | "p3";
  dupe_of_issue_number: number | null;
}

let _genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (!_genAI) {
    _genAI = new GoogleGenerativeAI(config.gemini.apiKey);
  }
  return _genAI;
}

export async function triage(
  message: string,
  context: string,
  app: string | null = null,
  type: string = "feature",
): Promise<TriageVerdict> {
  const genAI = getGenAI();
  const instructions = buildTriageInstructions(app, type);
  const model = genAI.getGenerativeModel({
    model: MODEL_ID,
    systemInstruction:
      context +
      "\n---\n# Instructions\n" +
      instructions,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          title: { type: SchemaType.STRING },
          body: { type: SchemaType.STRING },
          labels: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
          },
          priority: {
            type: SchemaType.STRING,
            enum: ["p0", "p1", "p2", "p3"],
          },
          dupe_of_issue_number: { type: SchemaType.INTEGER, nullable: true },
        },
        required: ["title", "body", "labels", "priority", "dupe_of_issue_number"],
      },
      temperature: 0.3,
    },
  });

  const result = await model.generateContent(message);
  const text = result.response.text();

  const verdict: TriageVerdict = JSON.parse(text);
  // Validate required fields
  if (!verdict.title || !verdict.body || !Array.isArray(verdict.labels) || !verdict.priority) {
    throw new Error("Gemini returned incomplete verdict: " + text);
  }
  return verdict;
}
