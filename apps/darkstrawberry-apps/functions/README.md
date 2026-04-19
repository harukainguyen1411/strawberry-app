# Dark Strawberry — Cloud Functions

Firebase Cloud Functions v2 (TypeScript) for the Dark Strawberry platform.

## Functions

| Function | Purpose |
|---|---|
| `dispatchNotification` | Firestore-triggered: sends notifications via Discord or email |
| `createBeeIssue` | Creates a GitHub Issue for a Bee request (legacy direct path) |
| `getBeeStatus` | Polls GitHub Issue status for a Bee job |
| `listBeeIssues` | Lists past Bee jobs |
| `beeIntakeStart` | Start a Gemini-powered intake conversation |
| `beeIntakeTurn` | Continue the intake conversation |
| `beeIntakeSubmit` | Finalize and file the GitHub Issue from an intake session |

---

## Local testing — Bee Gemini intake

### Prerequisites

- Node 20+
- Firebase CLI: `npm install -g firebase-tools`
- Firebase project: `myapps-b31ea`
- Logged in to Firebase CLI: `firebase login`

### 1. Get your Gemini API key

Either pull from Firebase Secret Manager:

```bash
firebase functions:secrets:access GEMINI_API_KEY --project myapps-b31ea
```

Or use the key you already have from Google AI Studio / GCP.

### 2. Install dependencies

```bash
# From repo root
cd apps/functions && npm install
cd ../myapps && npm install
```

### 3. Start the Firebase Emulator Suite

```bash
# From repo root — starts Functions, Firestore, Storage, Auth emulators
export GEMINI_API_KEY=<your-key-here>
firebase emulators:start --only functions,firestore,storage,auth --project myapps-b31ea
```

The emulator UI is available at http://localhost:4000.
Functions run at http://localhost:5001.

### 4. Start the frontend dev server (separate terminal)

```bash
cd apps/darkstrawberry-apps && npm run dev
```

### 5. Open the app

```
open http://localhost:5173
```

Log in as Haruka (`harukainguyen1411@gmail.com`), click Bee, fill in a request, and the intake chat will launch.

---

### Curl test — beeIntakeStart

You can verify the function works without the UI by calling it directly via curl against the emulator.

First get an ID token (easiest via the emulator Auth UI at http://localhost:4000/auth, create a user and copy the token), then:

```bash
curl -s -X POST \
  "http://localhost:5001/myapps-b31ea/us-central1/beeIntakeStart" \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "textInput": "Tôi cần viết một bài luận về biến đổi khí hậu cho giáo sư"
    }
  }' | python3 -m json.tool
```

Expected response shape:
```json
{
  "result": {
    "sessionId": "abc123...",
    "botMessage": "Mình thấy bạn muốn viết một bài luận về biến đổi khí hậu...",
    "done": false
  }
}
```

Note: callable functions require Firebase Auth tokens in production. In the emulator you can bypass auth by setting `BEE_SISTER_UIDS` to empty in your local `.env` file (already the default).

---

### Environment variables for local testing

Create `apps/functions/.env` (gitignored) for local emulator overrides:

```
GEMINI_API_KEY=your_key_here
GITHUB_TOKEN=your_github_pat
BEE_GITHUB_REPO=owner/strawberry-app
BEE_SISTER_UIDS=
DISCORD_WEBHOOK_URL=
```

The emulator automatically loads `.env` files from the functions directory.
