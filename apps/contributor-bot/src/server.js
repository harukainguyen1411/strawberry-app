import express from "express";
import crypto from "node:crypto";
import { postPipelineResult, postMergeStatus } from "./notifications.js";

const WEBHOOK_SECRET = process.env.BOT_WEBHOOK_SECRET;

function verifySignature(req, res, next) {
  if (!WEBHOOK_SECRET) {
    return res.status(503).json({ error: "Webhook secret not configured" });
  }

  const sig = req.headers["x-webhook-signature"];
  const expected = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(req.rawBody)
    .digest("hex");

  if (sig !== expected) {
    return res.status(401).json({ error: "Invalid signature" });
  }
  next();
}

export function startServer(client) {
  const app = express();
  app.use(express.json({
    verify: (req, _res, buf) => { req.rawBody = buf; },
  }));

  // Called by GHA after contributor-pipeline completes
  app.post("/pipeline-result", verifySignature, async (req, res) => {
    const { prUrl, previewUrl, prNumber, issueTitle, discordThreadId, branch } =
      req.body;

    if (!prUrl || !previewUrl) {
      return res.status(400).json({ error: "Missing prUrl or previewUrl" });
    }

    try {
      await postPipelineResult(client, {
        prUrl,
        previewUrl,
        prNumber,
        issueTitle,
        discordThreadId,
        branch,
      });
      res.json({ ok: true });
    } catch (err) {
      console.error("Pipeline result error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Called by GHA on PR merge
  app.post("/merge-status", verifySignature, async (req, res) => {
    const { prNumber, discordThreadId, issueTitle } = req.body;

    try {
      await postMergeStatus(client, { prNumber, discordThreadId, issueTitle });
      res.json({ ok: true });
    } catch (err) {
      console.error("Merge status error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/health", (_req, res) => res.json({ ok: true }));

  const port = process.env.BOT_PORT || 3847;
  app.listen(port, () => console.log(`Bot HTTP server on port ${port}`));
}
