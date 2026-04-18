import crypto from "crypto";
import type { Express, Request, Response } from "express";
import { config } from "../config.js";
import { postPreview } from "../discord/postPreview.js";

interface PreviewReadyPayload {
  kind: "preview_ready";
  pr_number: number;
  pr_url: string;
  pr_title: string;
  preview_url: string;
  repo: string;
  discord_channel_id: string;
  discord_user_id: string;
  discord_message_id: string;
}

function verifyHmac(secret: string, body: string, signature: string): boolean {
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");
  if (expected.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export function registerGithubWebhook(app: Express): void {
  const secret = config.webhook?.secret;
  if (!secret) {
    console.log("DISCORD_RELAY_WEBHOOK_SECRET not set — GitHub webhook endpoint disabled.");
    return;
  }

  app.post("/hooks/github", async (req: Request, res: Response) => {
    const signature = req.headers["x-strawberry-signature"] as string | undefined;
    const rawBody = JSON.stringify(req.body);

    if (!signature || !verifyHmac(secret, rawBody, signature)) {
      res.status(401).json({ error: "Invalid signature" });
      return;
    }

    const payload = req.body as PreviewReadyPayload;

    try {
      switch (payload.kind) {
        case "preview_ready":
          await postPreview(payload);
          res.json({ ok: true });
          break;
        default:
          res.status(400).json({ error: `Unknown kind: ${(payload as any).kind}` });
      }
    } catch (err) {
      console.error("Webhook handler error:", err);
      res.status(500).json({ error: "Internal error" });
    }
  });

  console.log("GitHub webhook endpoint registered at POST /hooks/github");
}
