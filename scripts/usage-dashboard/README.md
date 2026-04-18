# usage-dashboard scripts

Pipeline scripts for the Strawberry Usage Dashboard.

| Script | Purpose |
|--------|---------|
| `generate-roster.mjs` | Parse `agent-network.md` and write `roster.json` |
| `agent-scan.mjs` | Scan JSONL transcripts and emit `agents.json` (T2) |
| `merge.mjs` | Join ccusage output with `agents.json`, write `data.json` (T3) |
| `build.sh` | Orchestrator: runs all of the above in order (T4) |
| `refresh-server.mjs` | Local HTTP helper enabling the in-page Refresh button (T5) |
| `sbu.sh` | One-command entry point: build + open (T6) |

## Quick start

```sh
# Regenerate roster from agent-network.md
npm --prefix dashboards/usage-dashboard run roster

# Full rebuild (requires ccusage on PATH)
bash scripts/usage-dashboard/build.sh
```
