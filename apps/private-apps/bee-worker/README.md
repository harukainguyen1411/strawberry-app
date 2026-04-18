# bee-worker

Document-review agent worker. Polls GitHub issues (labeled `bee` + `ready`) for questions, invokes Claude Code headlessly, and uses `tools/comments.py` to inject OOXML comments into `.docx` files. Results are posted as issue comments.

## Architecture

```
GitHub Issue (bee+ready) ──► bee-worker ──► claude -p ──► comments.py ──► Storage ──► Issue Comment
```

Structurally identical to `apps/coder-worker/`. Runs as a systemd service on GCE (`scripts/gce/`) or as an NSSM service on Windows.

## Setup (GCE)

See `scripts/gce/setup-bee-vm.sh` and `scripts/gce/.env.example`.

## Setup (Windows / local)

1. `npm install && npm run build`
2. Copy `.env.example` to `.env` and fill in values.
3. `npm start`

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GITHUB_TOKEN` | yes | | GitHub PAT with issue read/write |
| `GITHUB_REPO` | no | `$GITHUB_REPOSITORY` | GitHub repo (owner/repo). Falls back to `GITHUB_REPOSITORY` env var if not set. |
| `BEE_STORAGE_BUCKET` | yes | | Firebase Storage bucket for docx |
| `BEE_POLL_INTERVAL_MS` | no | `30000` | Poll interval in ms |
| `BEE_CLAUDE_BIN` | no | `claude` | Claude CLI binary path |
| `BEE_JOB_TIMEOUT_MS` | no | `1500000` | Max Claude job duration |
| `BEE_WORK_DIR` | no | `/tmp/bee` (Linux) | Temp working directory |
| `BEE_SISTER_UID` | no | | Restrict to specific Firebase UID |
| `GOOGLE_APPLICATION_CREDENTIALS` | yes | | Firebase SA key path |

## Security

- Claude subprocess is restricted to job working directory via `--add-dir`.
- No `Bash` or `Edit` tools — see system-prompt.md.
- Runlock shared with coder-worker at `BEE_RUNLOCK_PATH`.
- Audit log written to `BEE_AUDIT_LOG_DIR` (outside writable tree).
