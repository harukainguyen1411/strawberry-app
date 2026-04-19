# discord-relay — MyApps triage bot

A thin Discord bot that listens to one channel, triages every message with **Gemini 2.0 Flash**, and files a structured **GitHub issue** in the Strawberry monorepo tagged `myapps`. Replies in Discord with the issue URL.

See the plan: `plans/proposed/2026-04-03-discord-cli-integration.md`

---

## Architecture

```
Discord message
  → sanitize
  → Gemini 2.0 Flash (context: apps/darkstrawberry-apps/ + open issues)
  → GitHub REST API (new issue or comment on dupe)
  → Discord reply with issue URL
```

- No Claude in the path. No filesystem event bus.
- Runs as a single long-lived Node process. NSSM supervision on Windows keeps it running and restarts on failure.

---

## Quickstart (local dev)

### Prerequisites

- Node 20+
- `git` and `gh` CLI authenticated to the Strawberry repo
- Credentials (see env vars below)

### Install

```bash
cd apps/discord-relay
npm install
```

### Env vars

Create `apps/discord-relay/.env` (gitignored):

```env
DISCORD_BOT_TOKEN=...       # Discord bot token
GEMINI_API_KEY=...          # Google AI Studio API key
GITHUB_TOKEN=...            # GitHub PAT with repo:issues scope
TRIAGE_DISCORD_CHANNEL_ID=... # Discord channel ID to watch

# Optional
TRIAGE_TARGET_SUBTREE=apps/darkstrawberry-apps   # Subtree to dump as context (default: apps/darkstrawberry-apps)
TRIAGE_TARGET_LABEL=myapps          # Label applied to every filed issue (default: myapps)
TRIAGE_CONTEXT_REFRESH_HOURS=6      # Context cache TTL (default: 6)
TRIAGE_DAILY_QUOTA=1000             # Max Gemini calls per UTC day (default: 1000)
LOG_PATH=var/log/triage.jsonl       # JSONL log file (optional, stdout if unset)
PORT=8080                           # Health server port (default: 8080)
```

### Run

```bash
# Development (watch mode, requires tsx)
npm run dev

# Production build + run
npm run build
npm start
```

### Smoke test

Verify the context + Gemini pipeline without hitting Discord or GitHub:

```bash
GEMINI_API_KEY=... TRIAGE_DISCORD_CHANNEL_ID=dummy DISCORD_BOT_TOKEN=dummy GITHUB_TOKEN=dummy \
  npx tsx scripts/smoke.ts
```

Expected output: a JSON verdict for "The Vietnamese date picker in the signup flow is broken on Safari."

### Health check

```
GET http://localhost:8080/health
```

Returns `{ discord_connected, last_gemini_ok_age_s, last_github_ok_age_s, gemini_calls_today, quota_remaining, context_cache_age_s, ok }`.

---

## Windows install (production)

Runs as an NSSM-supervised Windows service on Duong's always-on machine.

### Prerequisites

- Node 20+ on PATH
- [NSSM](https://nssm.cc/download) on PATH
- Secrets in `secrets/` directory:
  - `secrets/gemini-api-key.txt`
  - `secrets/discord-bot-token.txt`
  - `secrets/github-triage-pat.txt`

### Install as a service

```powershell
# Run as Administrator
powershell -ExecutionPolicy Bypass -File apps\discord-relay\scripts\windows\install-discord-relay.ps1
```

The script builds the app, registers `StrawberryDiscordRelay` as an auto-start service with log rotation and restart-on-failure, then starts it. Logs land in `apps/discord-relay/logs/`.

### Run via Git Bash (one-off or dev)

```bash
bash apps/discord-relay/scripts/start-windows.sh
```

Reads secrets directly from `secrets/*.txt`, exports env vars, runs `npm start`.

### Quota persistence

Quota state (`var/quota-state.json`) persists across restarts because it is written to the local filesystem — no cloud storage needed.

---

## File layout

```
apps/discord-relay/
├── src/
│   ├── index.ts          Entry point — boots client and health server
│   ├── config.ts         Env var validation and typed config object
│   ├── discord-bot.ts    discord.js client, messageCreate handler
│   ├── context.ts        Context cache (repo dump + open issues)
│   ├── gemini.ts         Gemini 2.0 Flash call with strict JSON schema
│   ├── github.ts         Octokit — file issue or comment on dupe
│   ├── quota.ts          Daily Gemini quota + per-minute rate limiter
│   ├── health.ts         Express /health endpoint
│   └── log.ts            JSONL triage log
├── scripts/
│   ├── smoke.ts          Smoke test — context + Gemini, no Discord/GitHub
│   ├── start-windows.sh  Git Bash launcher — reads secrets/*.txt, runs npm start
│   └── windows/
│       └── install-discord-relay.ps1  NSSM service installer (run as Administrator)
├── Dockerfile
├── package.json
├── tsconfig.json
└── README.md
```

---

## Context file

`apps/darkstrawberry-apps/triage-context.md` is the hand-written MyApps product overview at the top of Gemini's system prompt. Duong maintains it. Changes take effect on the next context refresh (6h by default) or immediately via `GET /webhook/github-push`.
