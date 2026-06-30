# @strawberry/shadow-hunters-engine

Pure, deterministic, I/O-free TypeScript rules engine for the **Shadow Hunters** base game (Z-Man Games, designer Yasutaka Ikeda).

**Source of truth:** all rule numbers, card effects, character abilities, and ambiguity rulings are encoded from [`projects/personal/shadow-hunters/ruleset.md`](../../../../raspberry/projects/personal/shadow-hunters/ruleset.md) in the raspberry planning repo. Every handler and data file cites the relevant `§` section. Do not invent rule values; the ruleset document wins on any conflict.

---

## Public API

```ts
import { createGame, reduce, legalActions, project } from "@strawberry/shadow-hunters-engine";
```

### `createGame(playerIds, seed)`

```ts
function createGame(playerIds: string[], seed: string): GameState
```

Builds the initial `GameState` for a game with 4–8 players. Throws on invalid player counts.

- Deals characters according to the §3 faction-scaling table (4p: 2H/2S/0N … 8p: 3H/3S/2N).
- Shuffles White, Black, and Hermit decks separately; pairs the 6 areas randomly in `[0,1][2,3][4,5]` order (§3).
- Every player starts with `revealed=false`, `area=null`, `damage=0`.
- The initial `current` player is `playerIds[0]` and the first phase is `"move"`.

**Determinism:** identical `(playerIds, seed)` always produces byte-identical `GameState`. The seed string is hashed (FNV-1a) into the 32-bit mulberry32 PRNG state stored inside `GameState.rng`. All dice, shuffles, and deck operations advance that single value, so any sequence of `reduce` calls on the returned state is fully reproducible.

---

### `reduce(state, action)`

```ts
function reduce(
  state: GameState,
  action: Action,
): { state: GameState; events: GameEvent[] }
```

The single pure reducer. It:

1. Deep-clones the input `GameState` (never mutates the argument).
2. Validates `action` against `legalActions(state, action.player)` — throws `Error` on any illegal action. The server relies on this as its authorisation gate.
3. Dispatches to the appropriate module (`movement.ts`, `combat.ts`, `damage.ts`, `cards/`, `abilities.ts`) based on the current `phase` and action type.
4. After every mutation runs a win-condition check (`win.ts` §12.1) and, on game-end, sets `state.over = true` and `state.winners`.
5. Returns `{ state, events }` where `events` is the delta appended this call (a slice of the new `state.log`).

**Turn structure (§8):** `move` → `area` → `attack` → `EndTurn` advances `current` (skipping dead players, §12.17). Consuming a Concealed Knowledge card sets `pendingExtraTurns++`; the same player takes a full extra turn before play passes (§12.10).

**Out-of-band actions allowed at any time:** `Reveal` (except Daniel / Unknown, §5); Werewolf `Counterattack` (only after being attacked, §12.6); Franklin / George `UseAbility` at the start of their turn (§12.22).

---

### `legalActions(state, playerId)`

```ts
function legalActions(state: GameState, playerId: string): Action[]
```

Returns **exactly** the actions the named player is allowed to perform right now. UI and the server both call this; the server also verifies it inside `reduce` before applying any action.

Guarantees:
- Out-of-turn players receive an empty array (or `[Counterattack]` / `[Reveal]` when eligible).
- In-range attack targets (§10) are computed from the current area and its pair; Handgun expands range; Machine Gun targets all in range.
- `Reveal` is omitted for Daniel (forced reveal only) and Unknown.
- `UseAbility` is omitted when the ability is once-per-game and already spent (`usedOncePerGame`), or when the game is over.

---

### `project(state, viewerId)`

```ts
function project(state: GameState, viewerId: string): PlayerView
```

Redacts the full authoritative `GameState` to the `PlayerView` a single client may see.

**Secrecy invariants (hard-tested):**

- `view.players[i].characterId` is `null` for any player who is neither revealed nor dead. A client cannot learn another player's faction, character, or HP threshold from the view.
- `state.rng` (the PRNG seed) is **never** included. Leaking it would let a client predict all future dice rolls and draws.
- Deck draw order (`state.decks.*.draw`) is **never** included. Leaking it would let a client predict the next card.
- `state.shownCards` (Hermit's Prediction) is filtered: only entries where `viewerId` is the giver are visible (§6 Hermit table / §12.11).

The view is built from an explicit allowlist — no `PlayerState` spread — so a newly added secret field on `PlayerState` cannot silently leak.

**Included in the view:**
- `you` — your own `characterId`, `faction`, `maxHp`, and `winCondition`.
- `players` — public board state for all players (damage, alive, area, equipment, revealed; `characterId` only when revealed or dead).
- `areas`, `pairing`, `current`, `phase`, `over`, `winners`.
- `legal` — `legalActions(state, viewerId)` computed inline.
- `recent` — the last 20 events from `state.log` (for animation).

---

## Determinism guarantee

Given a fixed `(playerIds, seed)` and a fixed sequence of `Action` objects, `reduce` produces the **same** `GameState` on every run, on every machine, across JavaScript engine restarts.

- All randomness flows through the single `GameState.rng` value (mulberry32, seeded at `createGame`). No `Math.random()`, no `Date.now()`, no I/O.
- `reduce` is pure: it clones state before mutating; the input is unchanged and safe to cache.
- Test suite (`test/scenarios.test.ts`) runs three full fixed-seed scripted games (4p Hunters-win, 6p Neutral-win, 8p Shadows-win) and asserts byte-identical `winners` + end-state on every run.

---

## Secrecy guarantee

The `project` function is the only trust boundary between the server's authoritative `GameState` and any client. The server must:

1. Call `project(state, viewerId)` before transmitting state to each viewer.
2. Never send the raw `GameState` or any field not present in `PlayerView`.

The test suite (`test/project.test.ts`) asserts the secrecy invariant after every `reduce` step in a full game:
- For each viewer, `JSON.stringify(project(state, viewer))` does not contain any other non-revealed player's `characterId`.
- `JSON.stringify` of the view does not contain `"rng"` or the raw seed.

---

## Architecture overview

```
createGame(playerIds, seed)
  └─ GameState (pure data; includes rng, decks, players, log, …)

reduce(state, action) → { state, events }
  ├─ legalActions()          validate before dispatch
  ├─ movement.ts (§9)        RollMove / MoveTo / Emi / Compass
  ├─ area dispatch (§7)      ResolveArea for each of the 6 areas
  │    ├─ cards/white.ts     Church / Underworld Gate draw
  │    ├─ cards/black.ts     Cemetery draw
  │    └─ cards/hermit.ts    Hermit's Cabin give
  ├─ combat.ts (§10)         Attack / Counterattack / equipment modifiers
  ├─ damage.ts (§11)         applyDamage / applyHeal / death / loot / reveal
  ├─ abilities.ts (§5/§12)   hook system (onStartTurn, onMove, onAfterAttack, …)
  ├─ win.ts (§4/§12.1–2)     evaluateWinners / maybeEndGame
  └─ project.ts              per-player view redaction

project(state, viewerId) → PlayerView
```

---

## Running

```sh
# From the monorepo root or the worktree root:
npm test -w @strawberry/shadow-hunters-engine       # run Vitest suite (343 tests)
npm run build -w @strawberry/shadow-hunters-engine  # emit dist/ via tsc
npm run typecheck -w @strawberry/shadow-hunters-engine  # type-check without emit
```

---

## Ruleset linkage

All game rules, card effects, character abilities, HP values, and ambiguity rulings are in the canonical ruleset document:

```
projects/personal/shadow-hunters/ruleset.md
```

Every source file in `src/` cites the relevant `§` section. If a rule value differs between this code and that document, the document wins. The 22 `[RULING]` entries in §12 of that document are each tested explicitly in the corresponding `test/*.test.ts` file.
