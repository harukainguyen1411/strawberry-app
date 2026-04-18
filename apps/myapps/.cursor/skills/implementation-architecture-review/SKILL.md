---
name: implementation-architecture-review
description: Before implementing tasks or features, evaluates whether the approach makes sense, considers frontend vs backend placement, and advises better solutions rather than building mediocre or broken implementations. Use when implementing features, tasks, or when the user asks for implementation advice or best practices.
---

# Implementation & Architecture Review

When implementing a task, feature, or change, **pause before coding** to assess fit-for-purpose and placement. Prefer advising a better path over shipping something mediocre or brittle.

## When to Apply

- User asks to implement a feature, task, or "build X"
- You are about to add logic that touches security, heavy compute, or external systems
- The request implies "do it in the app" but the nature of the work suggests otherwise

## Before Implementing: Quick Check

1. **Does it belong in the frontend?**
   - UI, client-side state, forms, client-side validation, routing → frontend is appropriate.
   - Secrets, heavy computation, durable workflows, system-to-system calls, or anything that must run when the user is offline → question frontend-only.

2. **Would a frontend-only solution be mediocre or broken?**
   - Examples: API keys in the client, sensitive logic in the browser, scraping/aggregation from the client, long-running jobs, or "works on my machine" behavior that depends on the user’s environment.

3. **If yes** → **advise first**. Do not build the fragile version. Propose the better option (e.g. backend service, serverless function, existing SaaS).

## Frontend vs Backend (and other options)

| Prefer frontend when | Prefer backend / service when |
|----------------------|--------------------------------|
| Pure UI and UX flows | Secrets, API keys, tokens |
| Client-side validation and local state | Server-side validation, authorization, audit |
| Offline-first or local-only features | Calls to third-party APIs you must protect or orchestrate |
| Light, non-sensitive transforms | Heavy compute, batch jobs, workflows |
| Reading public, CORS-friendly APIs | Writing or reading from protected/sensitive systems |

**Other options to suggest (when relevant):**
- Dedicated backend or API service
- Serverless/edge function (e.g. Vercel, Cloudflare, Firebase Functions)
- Managed service or SaaS that already does the job
- Background worker or queue for long-running work

## How to Advise

When the right move is **not** “build it all in the frontend”:

1. **State clearly** that a frontend-only implementation would be fragile, insecure, or not fit for purpose.
2. **Explain why** in one or two sentences (e.g. “API keys would be exposed,” “this needs to run on a schedule,” “results must be consistent and authoritative”).
3. **Propose the best feasible option** for their context:
   - If they have backend infra: “Implement X in your backend and expose an endpoint; the frontend should only call that.”
   - If they don’t: “Use a serverless function / managed service / external API that…”
   - If scope is unclear: “For a quick prototype you could…; for production you’ll need…”
4. **Offer next steps**: e.g. “I can draft the backend contract (request/response) and the frontend call, or outline the serverless function.”

Do **not**:
- Build the insecure or brittle version “because they asked for it” without flagging it.
- Assume “they only have a frontend” unless they’ve said so; you can still recommend backend or external services.

## Red Flags → Pause and Advise

- **Secrets or keys** used in browser or in client-side config.
- **Heavy or long-running work** (big transforms, batch processing, crawling) in the client.
- **Third-party API calls** that require server-side auth, IP allowlisting, or usage limits.
- **“Run this script in the app”** for something that’s really a cron job or pipeline step.
- **Sensitive or regulated data** handled or decided only in the frontend.
- **Consistency or audit** requirements that imply a single source of truth on the server.

When you see these, **advise and suggest the right layer** before writing implementation code.

## Example Responses

**User:** “Add real-time stock prices by calling the Alpha Vantage API from the React app.”

**Response:**  
“Calling Alpha Vantage directly from the browser would require putting your API key in client code, so it would be exposed. Better approach: add a small backend (e.g. Cloud Function or API route) that holds the key and calls Alpha Vantage; the frontend only calls your backend. I can outline the backend endpoint and the frontend call, or the exact serverless function, depending on your stack.”

---

**User:** “Implement a weekly report that aggregates data from our DB and sends an email.”

**Response:**  
“This is a scheduled, server-side workflow: it should run in a backend or serverless job, not inside the frontend. Options: (1) cron-triggered Cloud Function / Lambda, (2) existing job runner in your backend, or (3) a tool like Zapier/Make if you want no code. I can sketch the job logic and what the frontend would need (e.g. ‘request report’ button that enqueues the job) if you tell me which option you use.”

---

**User:** “Build a feature that lets users upload a CSV and we run our ML model on it.”

**Response:**  
“Running the ML model in the browser is only viable if it’s lightweight and you’re okay with device limits. If the model is heavy or needs GPU/server resources, it should run in a backend or ML service. The frontend should: upload the file, call your backend, and display results. I can help design the upload API and the polling/result flow, and keep the actual model execution on the server.”

## Summary

- **Before implementing:** ask “frontend-only or not?” and “would frontend-only be mediocre or broken?”
- **If it would be:** advise instead of building the bad version; suggest backend, serverless, or external service, and offer concrete next steps.
- **If it’s a fit for frontend:** implement with normal best practices (validation, error handling, structure).
