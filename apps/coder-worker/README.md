# coder-worker

Local Windows coder agent. Polls GitHub for open issues labeled `myapps` + `ready`, invokes Claude Code headlessly to implement them, and opens a PR for human review.

## Architecture

```
poll loop (60s)
  → fetchReadyIssues()          # issues with myapps+ready, not bot-in-progress
  → atomicLabelSwap(ready → bot-in-progress)
  → createBranch(bot/issue-{n})
  → acquireRunlock()            # shared with Bee worker
  → runClaude(-p, stream-json)  # Max plan, Duong's local login
  → release runlock
  → commitAndPush()
  → createPr(bot-authored label)
  → atomicLabelSwap(bot-in-progress → bot-pr-opened)
  → commentOnIssue(PR URL)
```

Duong reviews the PR + Firebase preview URL and merges manually.

## Setup (Windows)

1. Install [NSSM](https://nssm.cc/download) — add to PATH
2. Copy `.env.example` to `.env`, fill in `GITHUB_TOKEN` (use `secrets/github-triage-pat.txt`)
3. Ensure `claude` CLI is on PATH and logged in under Duong's Max plan account
4. Run as Administrator:
   ```powershell
   powershell -ExecutionPolicy Bypass -File apps\coder-worker\scripts\windows\install-service.ps1
   ```

## Runlock

Shares `%USERPROFILE%\.claude-runlock\claude.lock` with the Bee worker via `proper-lockfile`. Only one Claude invocation runs at a time across both workers.

## Labels used

| Label | Meaning |
|---|---|
| `myapps` + `ready` | Issue is queued for the bot |
| `bot-in-progress` | Bot is currently working on this issue |
| `bot-pr-opened` | PR was opened; waiting for human review |
| `bot-authored` | Applied to the PR itself |

## System prompt

Lives at `.github/coder-agent/system.md` in the repo root. Scopes Claude to `apps/darkstrawberry-apps/` only.
