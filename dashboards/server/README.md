# dashboards/server

Express API server for the test-dashboard Cloud Run service — auth, ingestion, Firestore + GCS access.

## Local development

```sh
pnpm install
pnpm run build
pnpm run dev        # ts-node src/index.ts, port 3100
pnpm run test:unit  # vitest run --reporter=json
```

## Secrets

Secrets are stored as age-encrypted bundles under `secrets/encrypted/`. **Never run raw `age -d`** — use `tools/decrypt.sh` exclusively (CLAUDE.md rule 6). The pre-commit hook blocks violations.

### Encrypted bundles

| File | Environment |
|------|-------------|
| `secrets/encrypted/dashboards.prod.env.age` | Production |
| `secrets/encrypted/dashboards.staging.env.age` | Staging |

Each bundle contains: `INGEST_TOKEN`, `FIREBASE_PROJECT_ID`, `GCS_BUCKET`, `ALLOWED_UIDS`.

### Decrypting for local development

```sh
# Decrypt a single variable into secrets/ (plaintext stays in child env only)
cat secrets/encrypted/dashboards.staging.env.age | \
  tools/decrypt.sh --target secrets/dashboards.staging.env --var INGEST_TOKEN

# Decrypt and inject directly into a command without writing to disk
cat secrets/encrypted/dashboards.staging.env.age | \
  tools/decrypt.sh --target secrets/dashboards.staging.env --var INGEST_TOKEN \
    --exec -- node dist/index.js
```

`tools/decrypt.sh` writes the decrypted value atomically to a file under `secrets/` (gitignored) and never echoes plaintext to stdout or stderr. The `--exec` form injects the value into the child process env only — it never lands in the parent shell.

### Creating / rotating the env bundle

1. Generate a fresh `INGEST_TOKEN`: `openssl rand -hex 32`
2. Encrypt to the bundle (Duong only — requires `secrets/age-key.txt`):
   ```sh
   echo "INGEST_TOKEN=<value>" | age -r "$(cat secrets/recipients.txt)" \
     > secrets/encrypted/dashboards.staging.env.age
   ```
3. Update the prod bundle with the same token value.
4. Update the GH Actions secret `TEST_DASHBOARD_INGEST_TOKEN` to match.
5. Redeploy: `bash scripts/deploy/dashboards.sh --project myapps-b31ea`

## Environment variables (runtime)

| Variable | Description |
|----------|-------------|
| `INGEST_TOKEN` | 32-byte random bearer token for the `/api/runs` ingest endpoint |
| `FIREBASE_PROJECT_ID` | Firebase project ID for Firestore + Auth |
| `GCS_BUCKET` | GCS bucket name for artifact storage |
| `ALLOWED_UIDS` | Comma-separated Firebase UIDs allowed to access the dashboard |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to service account JSON (Cloud Run default / local key file) |
| `PORT` | HTTP port — Cloud Run injects this; defaults to `3100` locally |
