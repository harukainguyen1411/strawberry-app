# JSONL format reference

Internal documentation of the `~/.claude/projects/**/*.jsonl` record shape that
`phase-scan.mjs` depends on. Confirmed against raspberry session transcripts on
2026-05-02; if Claude Code changes the format, this doc must be updated and
`phase-scan.mjs` along with it.

---

## Overview

Each session maps to one primary JSONL file at:

```
~/.claude/projects/<escaped-project-path>/<sessionId>.jsonl
```

Where `<escaped-project-path>` is the absolute project directory with `/` replaced
by `-` (e.g., `/Users/duongntd99/Documents/Personal/raspberry` →
`-Users-duongntd99-Documents-Personal-raspberry`).

Each line in the file is a standalone JSON object (one record per line).
Records are written chronologically.

---

## Record types

### `user`

A user turn. `isMeta: true` records are internal harness messages (local command
caveats, system injections); ignore them when parsing phase signals. Real user
messages have `isMeta` absent or `false`.

```json
{
  "parentUuid": "11b1005c-ddf4-4ba4-856f-b6a6b62bf737",
  "isSidechain": false,
  "promptId": "71ab5f99-874b-4599-9fd6-243bac26a247",
  "type": "user",
  "message": {
    "role": "user",
    "content": "In plans and spec we currently have all the plans linear, I want that at least once they're finished, they would be sorted into a view with the project as the folder, and then all the plans fold in there"
  },
  "uuid": "062e6f01-69e0-4e58-af17-cd69aa79a377",
  "timestamp": "2026-05-02T08:03:10.577Z",
  "permissionMode": "auto",
  "userType": "external",
  "entrypoint": "cli",
  "cwd": "/Users/duongntd99/Documents/Personal/raspberry",
  "sessionId": "233df82d-07f6-4c17-beec-b664d9620c31",
  "version": "2.1.126",
  "gitBranch": "main"
}
```

Key fields for `phase-scan.mjs`:
- `cwd` — used for project attribution (§4 of the spec).
- `sessionId` — matches the JSONL filename.
- `isSidechain` — `false` for parent session records.
- `isMeta` — if `true`, skip for phase signal purposes.

---

### `assistant` (with usage)

An assistant turn. Contains `message.usage` with token counts.

```json
{
  "parentUuid": "d077b31d-45bb-49a0-9f97-3c10c579248d",
  "isSidechain": false,
  "message": {
    "model": "claude-opus-4-7",
    "id": "msg_01Ps3tLogD3e5q2kThsioZL8",
    "type": "message",
    "role": "assistant",
    "content": [
      {
        "type": "thinking",
        "thinking": "",
        "signature": "<…redacted…>"
      }
    ],
    "stop_reason": "tool_use",
    "stop_sequence": null,
    "stop_details": null,
    "usage": {
      "input_tokens": 6,
      "cache_creation_input_tokens": 44308,
      "cache_read_input_tokens": 0,
      "output_tokens": 229,
      "server_tool_use": {
        "web_search_requests": 0,
        "web_fetch_requests": 0
      },
      "service_tier": "standard",
      "cache_creation": {
        "ephemeral_1h_input_tokens": 44308,
        "ephemeral_5m_input_tokens": 0
      },
      "inference_geo": "",
      "iterations": [
        {
          "input_tokens": 6,
          "output_tokens": 229,
          "cache_read_input_tokens": 0,
          "cache_creation_input_tokens": 44308,
          "cache_creation": {
            "ephemeral_5m_input_tokens": 0,
            "ephemeral_1h_input_tokens": 44308
          },
          "type": "message"
        }
      ],
      "speed": "standard"
    },
    "diagnostics": null
  },
  "requestId": "req_011CadL8ZA5znawk5WGoBHDN",
  "type": "assistant",
  "uuid": "5ce636d1-d7b7-40e6-abc0-bf28da25fed9",
  "timestamp": "2026-05-02T07:15:25.733Z",
  "userType": "external",
  "entrypoint": "cli",
  "cwd": "/Users/duongntd99/Documents/Personal/raspberry",
  "sessionId": "486bfbcf-c52f-458c-926e-c38fb8b3b473",
  "version": "2.1.126",
  "gitBranch": "main"
}
```

Key fields for `phase-scan.mjs`:
- `type` — `"assistant"` to identify assistant turns.
- `message.usage.input_tokens` — direct input tokens.
- `message.usage.output_tokens` — direct output tokens.
- `message.usage.cache_read_input_tokens` — cache-read tokens.
- `message.usage.cache_creation_input_tokens` — cache-creation tokens (counts as input cost).
- `message.content` — array of content blocks; scan for `type: "tool_use"` entries to detect skills and subagent dispatches.
- `timestamp` — used for duration calculation (gap between consecutive assistant messages, capped at `IDLE_CAP_SEC`).
- `isSidechain` — `false` for parent session records.

---

### `system` (turn_duration)

A harness housekeeping record. Not a user or assistant message. Skip for phase
attribution.

```json
{
  "parentUuid": "5472abe0-b7df-4dad-81ef-c066db4b0efd",
  "isSidechain": false,
  "type": "system",
  "subtype": "turn_duration",
  "durationMs": 112585,
  "messageCount": 87,
  "timestamp": "2026-05-02T08:05:03.234Z",
  "uuid": "c431e501-e29b-4dae-b2e2-a8c5a73323ca",
  "isMeta": false,
  "sessionId": "233df82d-07f6-4c17-beec-b664d9620c31"
}
```

---

### Skill tool call

Emitted as an `assistant` record whose `message.content` array contains a
`type: "tool_use"` block with `name: "Skill"`.

**Verbatim example** (from session `233df82d`, 2026-05-02):

```json
{
  "parentUuid": "800548af-ee70-43b6-8353-86e3b5bfd5eb",
  "isSidechain": false,
  "message": {
    "model": "claude-opus-4-7",
    "id": "msg_01UW9PJ9NJuCRvoriHrxzkGk",
    "type": "message",
    "role": "assistant",
    "content": [
      {
        "type": "tool_use",
        "id": "toolu_01MbPPoghDgpFRttu7d3zCMU",
        "name": "Skill",
        "input": {
          "skill": "superpowers-extended-cc:brainstorm"
        },
        "caller": {
          "type": "direct"
        }
      }
    ],
    "stop_reason": "tool_use",
    "stop_sequence": null,
    "stop_details": null,
    "usage": {
      "input_tokens": 1,
      "cache_creation_input_tokens": 14412,
      "cache_read_input_tokens": 51341,
      "output_tokens": 1238
    },
    "diagnostics": null
  },
  "requestId": "req_011CadPp6b8ahRHDDtramLiL",
  "type": "assistant",
  "uuid": "a9af336a-f70f-4e42-a44f-1723bbdb50ec",
  "timestamp": "2026-05-02T08:04:02.285Z",
  "sessionId": "233df82d-07f6-4c17-beec-b664d9620c31",
  "version": "2.1.126",
  "gitBranch": "main"
}
```

**Active skill name extracted from:**
```
record.message.content[i].input.skill
```
where `record.message.content[i].name === "Skill"`.

**Notes:**
- The `input` object has exactly one key: `"skill"` (a string). No separate `args` or `plugin` keys were observed in any real session.
- The skill value uses `plugin:skill-name` format for namespaced skills (e.g., `"superpowers-extended-cc:brainstorming"`) and a bare name for built-in skills.
- The same skill name can appear with or without a trailing slug variant (`"brainstorm"` vs. `"brainstorming"` — both appear in real transcripts for the same skill; treat both as the same phase bucket per spec §6).
- The Skill tool result is recorded in a subsequent `user` record with `toolUseResult.commandName` equal to the launched skill, but `phase-scan.mjs` only needs the tool call side (the `assistant` record) to update `currentSkill`.

---

### Agent tool call (subagent dispatch)

Emitted as an `assistant` record whose `message.content` array contains a
`type: "tool_use"` block with `name: "Agent"`.

> **Note:** The tool name in JSONL is `"Agent"`, **not** `"Task"`. The in-conversation
> system reminder refers to task management tools (`TaskCreate`, `TaskUpdate`, etc.) —
> those are separate native tools. Subagent dispatch uses the `Agent` tool.

**Verbatim example** (from session `5532da3f`, 2026-05-02):

```json
{
  "parentUuid": "339f0cf8-bb4d-48d9-811f-0aae2d54bb85",
  "isSidechain": false,
  "message": {
    "model": "claude-opus-4-7",
    "id": "msg_01Yb3QUb5NeYfUfTQG5c44HL",
    "type": "message",
    "role": "assistant",
    "content": [
      {
        "type": "tool_use",
        "id": "toolu_01CySuvDk1zAARSUSSasTDQ4",
        "name": "Agent",
        "input": {
          "description": "Promote plan draft → active",
          "subagent_type": "general-purpose",
          "model": "sonnet",
          "prompt": "You are doing one delegated task in the raspberry repo: a plan-lifecycle promotion (draft → active) via `git mv` + commit. <…redacted…>"
        },
        "caller": {
          "type": "direct"
        }
      }
    ],
    "stop_reason": "tool_use",
    "usage": {
      "input_tokens": 5,
      "cache_creation_input_tokens": 5266,
      "cache_read_input_tokens": 84027,
      "output_tokens": 1273
    }
  },
  "attributionSkill": "superpowers-extended-cc:subagent-driven-development",
  "attributionPlugin": "superpowers-extended-cc",
  "type": "assistant",
  "uuid": "885b50f1-b1c9-481a-b9cd-4d7f31ae3471",
  "timestamp": "2026-05-02T08:09:10.000Z",
  "sessionId": "5532da3f-427f-45d3-8a89-7e9864f9736e",
  "version": "2.1.126",
  "gitBranch": "main"
}
```

**Subagent type extracted from:**
```
record.message.content[i].input.subagent_type
```
where `record.message.content[i].name === "Agent"`.

**Known `subagent_type` values observed:**
- `"general-purpose"` — general Sonnet dispatch (Implement / Finish / etc.)
- `"code-reviewer"` — code review subagent (Review)

**Additional note:** `record.attributionSkill` (a top-level field on the outer
record, not inside `message`) records the skill that was active when the Agent
tool was called. This is a convenience field; `phase-scan.mjs` should derive
the phase from `currentSkill` (tracked from Skill tool calls) rather than from
`attributionSkill`, to stay consistent across records that lack this field.

---

### Agent tool result (back in parent JSONL)

When the subagent finishes, a `user` record is written to the **parent** JSONL
with `type: "tool_result"` in its content. The result content is a two-element
array: the subagent's text output plus a harness summary line.

```json
{
  "parentUuid": "885b50f1-b1c9-481a-b9cd-4d7f31ae3471",
  "isSidechain": false,
  "promptId": "040714e3-c862-4747-b0a0-fa97e5186407",
  "type": "user",
  "message": {
    "role": "user",
    "content": [
      {
        "tool_use_id": "toolu_01CySuvDk1zAARSUSSasTDQ4",
        "type": "tool_result",
        "content": [
          {
            "type": "text",
            "text": "Done. Commit `4edc895` — both files moved from `draft/` to `active/`, no content changes, no AI attribution."
          },
          {
            "type": "text",
            "text": "agentId: a6c0036b021f4eb8e (use SendMessage with to: 'a6c0036b021f4eb8e' to continue this agent)\n<usage>total_tokens: 16646\ntool_uses: 3\nduration_ms: 20730</usage>"
          }
        ]
      }
    ]
  },
  "uuid": "8162b790-edf0-4d96-81a7-6a7cbd5c94c0",
  "timestamp": "2026-05-02T08:09:52.238Z",
  "toolUseResult": {
    "status": "completed",
    "prompt": "<…redacted…>",
    "agentId": "a6c0036b021f4eb8e",
    "agentType": "general-purpose",
    "content": [ { "type": "text", "text": "Done. <…>" } ],
    "totalDurationMs": 20730,
    "totalTokens": 16646
  },
  "sessionId": "5532da3f-427f-45d3-8a89-7e9864f9736e"
}
```

The `toolUseResult.agentId` value links to the sidechain file (see below).

---

## Subagent sidechain

**Encoding: SEPARATE FILE** — subagent dispatches write a dedicated sidechain
JSONL file. They are **not** inlined as tool results in the parent JSONL.
The parent JSONL only receives a brief summary `tool_result` record (shown above).

### File location

```
~/.claude/projects/<escaped-project-path>/<sessionId>/subagents/agent-<agentId>.jsonl
~/.claude/projects/<escaped-project-path>/<sessionId>/subagents/agent-<agentId>.meta.json
```

Where `<agentId>` is a hex string like `a6c0036b021f4eb8e`.

**Example directory listing for session `5532da3f`:**
```
~/.claude/projects/-Users-duongntd99-Documents-Personal-raspberry/
  5532da3f-427f-45d3-8a89-7e9864f9736e.jsonl          ← parent JSONL
  5532da3f-427f-45d3-8a89-7e9864f9736e/
    subagents/
      agent-a6c0036b021f4eb8e.jsonl
      agent-a6c0036b021f4eb8e.meta.json
      agent-a8e3f251dfe956728.jsonl
      agent-a8e3f251dfe956728.meta.json
```

### Linking mechanism

Three fields tie parent to sidechain:

| Field | Where | Value |
|---|---|---|
| `agentId` | sidechain first record | e.g. `"a6c0036b021f4eb8e"` |
| `sessionId` | sidechain records | **same as parent** `sessionId` |
| `toolUseResult.agentId` | parent `tool_result` user record | same hex string |

The sidechain filename pattern is `agent-<agentId>.jsonl`. To walk all
sidechains for a session: find `<sessionId>/subagents/agent-*.jsonl`.

### Sidechain record shape

Sidechain records have the same structure as parent records except:
- `isSidechain: true`
- `agentId` field present (identifies which subagent wrote this record)
- `parentUuid: null` for the first record (no parent within the sidechain chain)
- `sessionId` still matches the parent session ID

**First record of sidechain `agent-a6c0036b021f4eb8e.jsonl`:**

```json
{
  "parentUuid": null,
  "isSidechain": true,
  "promptId": "040714e3-c862-4747-b0a0-fa97e5186407",
  "agentId": "a6c0036b021f4eb8e",
  "type": "user",
  "message": {
    "role": "user",
    "content": "You are doing one delegated task in the raspberry repo: a plan-lifecycle promotion (draft → active) via `git mv` + commit. <…redacted…>"
  },
  "uuid": "d538c4c2-11cd-48e3-b722-6b2bcab060e1",
  "timestamp": "2026-05-02T08:09:52.000Z",
  "sessionId": "5532da3f-427f-45d3-8a89-7e9864f9736e",
  "version": "2.1.122"
}
```

**Sidechain assistant record (with attributionAgent):**

```json
{
  "parentUuid": "d538c4c2-11cd-48e3-b722-6b2bcab060e1",
  "isSidechain": true,
  "agentId": "a6c0036b021f4eb8e",
  "message": {
    "model": "claude-haiku-4-5-20251001",
    "role": "assistant",
    "content": [ { "type": "text", "text": "I'll run these commands in the raspberry directory." } ],
    "usage": {
      "input_tokens": 3,
      "cache_creation_input_tokens": 1885,
      "cache_read_input_tokens": 49476,
      "output_tokens": 1
    }
  },
  "attributionAgent": "general-purpose",
  "attributionSkill": "superpowers-extended-cc:subagent-driven-development",
  "attributionPlugin": "superpowers-extended-cc",
  "type": "assistant",
  "sessionId": "5532da3f-427f-45d3-8a89-7e9864f9736e"
}
```

### meta.json

The companion `.meta.json` file is a tiny descriptor:

```json
{
  "agentType": "general-purpose",
  "description": "Move plan active → done"
}
```

### Implication for `phase-scan.mjs`

`phase-scan.mjs` must:
1. Parse the parent JSONL to detect `Agent` tool calls and update `currentSkill`.
2. After processing the parent, glob `<sessionId>/subagents/agent-*.jsonl` and
   process each sidechain file, attributing its assistant-message tokens to the
   same `sessionId` with the phase derived from `mapSubagentTypeToPhase(subagent_type, currentSkill)`.
3. The sidechain's `promptId` matches the parent's `promptId` at dispatch time —
   this can be used to correlate timing, but is not required for phase attribution.

---

## Key path summary

| Value needed | Key path |
|---|---|
| Active skill name | `record.message.content[i].input.skill` (where `content[i].name === "Skill"`) |
| Subagent type | `record.message.content[i].input.subagent_type` (where `content[i].name === "Agent"`) |
| Input tokens | `record.message.usage.input_tokens` |
| Output tokens | `record.message.usage.output_tokens` |
| Cache read tokens | `record.message.usage.cache_read_input_tokens` |
| Cache creation tokens | `record.message.usage.cache_creation_input_tokens` |
| Timestamp | `record.timestamp` (ISO 8601) |
| Session ID | `record.sessionId` |
| CWD | `record.cwd` |
| Is sidechain | `record.isSidechain` |
| Agent ID (sidechain) | `record.agentId` |
| Agent ID (parent result) | `record.toolUseResult.agentId` |
| Is meta record | `record.isMeta` (if `true`, skip) |

---

## Glob patterns for `phase-scan.mjs`

```
# All parent session JSONLs for a project
~/.claude/projects/<escaped-path>/*.jsonl

# All sidechain JSONLs for one session
~/.claude/projects/<escaped-path>/<sessionId>/subagents/agent-*.jsonl

# Distinguish parent JSONL from sidechain: isSidechain === false
# Distinguish sidechain JSONL from parent: isSidechain === true
```

The `<escaped-path>` for raspberry is:
`-Users-duongntd99-Documents-Personal-raspberry`
