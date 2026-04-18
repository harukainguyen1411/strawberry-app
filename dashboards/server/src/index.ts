import express from "express";
import { corsMiddleware } from "./middleware/cors";
import { v1Router } from "./api/v1/index.js";

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3100;

app.use(express.json());
app.use(corsMiddleware);

app.use("/api/v1", v1Router);

app.get("/api/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

// Reserve /monitoring/* namespace per ADR §10 — test-dashboard catch-all must not claim it.
app.use("/monitoring", (_req, res) => {
  res.status(404).json({ error: { code: "NOT_FOUND", message: "monitoring frontend not yet available" } });
});

app.listen(PORT, () => {
  console.log(`dashboards-server listening on port ${PORT}`);
});

export default app;
