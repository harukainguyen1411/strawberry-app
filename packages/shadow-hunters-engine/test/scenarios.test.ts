// Task 14: full-game scenario tests — end-to-end determinism + per-step secrecy.
// Source of truth: ruleset.md
//   §2  — the game ends the INSTANT any win condition is met; multiple players may win
//         simultaneously.
//   §4  — Hunters win when all Shadows are dead; Shadows win when all Hunters are dead
//         (a faction member wins even if their own character died earlier); Bob (Neutral)
//         wins on possessing 5+ Equipment.
//   §1/§11 — secrecy: a hidden player's faction/ability/identity is exposed only on
//         reveal/death. assertSecrecy enforces this after EVERY reduce, for every viewer.
//
// Three scripted full games, each on a FIXED seed (so the seeded rng — rng.ts — drives
// identical rolls/shuffles every run) reaching a DIFFERENT terminal win path:
//   1. 4p Hunters-win  — a fully scripted, literal action list (HUNTERS_SCRIPT) folded
//      through runScript; both Shadows are eliminated, asserting the exact winners.
//   2. 6p Neutral-win  — Bob (Neutral) reaches 5+ Equipment and wins outright while both
//      factions still have living members; reached via the legalActions driver (Task 14
//      sanctioned fallback) — a REAL engine win-state with exact winners asserted.
//   3. 8p Shadows-win  — all three Hunters are eliminated; all three Shadows win (incl.
//      the two whose characters died, §4); reached via the driver (fallback).
//
// Every scenario also asserts DETERMINISM: re-running the SAME (seed, ids, actions) yields
// identical winners + end-state.
//
// FALLBACK NOTE (Task 14): scenarios 2 and 3 use driveToWin (the legalActions driver) to
// reach completion rather than a hand-seeded literal action list. The win is produced by
// the ENGINE (state.over / state.winners), the test asserts the winners' exact ids +
// faction, and a determinism re-run replays the driver's captured action list through
// runScript to prove the literal list is reproducible. Scenario 1 ships the required fully
// scripted (literal) win.

import { describe, expect, test } from "vitest";
import {
  runScript,
  driveToWin,
  aggressivePolicy,
  assertSecrecy,
  factionOf,
  characterOf,
} from "./script.js";
import { createGame } from "../src/setup.js";
import type { Action, Faction, GameState, PlayerId } from "../src/types.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ids = (n: number): string[] => Array.from({ length: n }, (_, i) => `p${i}`);

/** Distinct factions among a set of winner ids (for "<faction>-only" assertions). */
function winnerFactions(state: GameState, winners: PlayerId[]): Faction[] {
  return [...new Set(winners.map((w) => factionOf(characterOf(state, w))))];
}

/** Alive count of a faction (mirrors win.ts aliveByFaction for end-state assertions). §4 */
function aliveOf(state: GameState, faction: Faction): number {
  return state.players.filter((p) => p.alive && factionOf(p.characterId) === faction).length;
}

// ─── Scenario 1: 4-player Hunters-win (fully scripted, literal action list) ──────
//
// Seed "4p-0" deals: p0=werewolf(Shadow), p1=unknown(Shadow), p2=george(Hunter),
// p3=franklin(Hunter). The scripted action list below drives a full game in which both
// Shadows (p0, p1) are eliminated, so the two Hunters win (§4). The list is LITERAL —
// fixed text, not generated at test time — and runScript re-derives every roll/shuffle
// from the seed, so the exact winners are reproducible on every run.

const HUNTERS_SEED = "4p-0";
const HUNTERS_IDS = ids(4);

const HUNTERS_SCRIPT: Action[] = [
  { type: "RollMove", player: "p0" },
  { type: "ResolveArea", player: "p0" },
  { type: "EndTurn", player: "p0" },
  { type: "RollMove", player: "p1" },
  { type: "ResolveArea", player: "p1" },
  { type: "EndTurn", player: "p1" },
  { type: "RollMove", player: "p2" },
  { type: "ResolveArea", player: "p2" },
  { type: "Attack", player: "p2", target: "p0" },
  { type: "EndTurn", player: "p2" },
  { type: "RollMove", player: "p3" },
  { type: "ResolveArea", player: "p3" },
  { type: "Attack", player: "p3", target: "p0" },
  { type: "EndTurn", player: "p3" },
  { type: "RollMove", player: "p3" },
  { type: "ResolveArea", player: "p3" },
  { type: "Attack", player: "p3", target: "p1" },
  { type: "EndTurn", player: "p3" },
  { type: "RollMove", player: "p0" },
  { type: "ResolveArea", player: "p0" },
  { type: "Attack", player: "p0", target: "p1" },
  { type: "EndTurn", player: "p0" },
  { type: "RollMove", player: "p1" },
  { type: "MoveTo", player: "p1", area: "erstwhile_altar" },
  { type: "ResolveArea", player: "p1" },
  { type: "EndTurn", player: "p1" },
  { type: "RollMove", player: "p2" },
  { type: "MoveTo", player: "p2", area: "erstwhile_altar" },
  { type: "ResolveArea", player: "p2" },
  { type: "Attack", player: "p2", target: "p1" },
  { type: "EndTurn", player: "p2" },
  { type: "RollMove", player: "p3" },
  { type: "ResolveArea", player: "p3" },
  { type: "Attack", player: "p3", target: "p1" },
  { type: "EndTurn", player: "p3" },
  { type: "RollMove", player: "p0" },
  { type: "ResolveArea", player: "p0" },
  { type: "EndTurn", player: "p0" },
  { type: "RollMove", player: "p1" },
  { type: "ResolveArea", player: "p1" },
  { type: "EndTurn", player: "p1" },
  { type: "RollMove", player: "p2" },
  { type: "ResolveArea", player: "p2" },
  { type: "Attack", player: "p2", target: "p1" },
  { type: "EndTurn", player: "p2" },
  { type: "RollMove", player: "p3" },
  { type: "ResolveArea", player: "p3" },
  { type: "EndTurn", player: "p3" },
  { type: "RollMove", player: "p0" },
  { type: "ResolveArea", player: "p0" },
  { type: "Attack", player: "p0", target: "p1" },
  { type: "EndTurn", player: "p0" },
  { type: "RollMove", player: "p1" },
  { type: "ResolveArea", player: "p1" },
  { type: "Attack", player: "p1", target: "p3" },
  { type: "EndTurn", player: "p1" },
  { type: "RollMove", player: "p2" },
  { type: "ResolveArea", player: "p2" },
  { type: "EndTurn", player: "p2" },
  { type: "RollMove", player: "p3" },
  { type: "ResolveArea", player: "p3" },
  { type: "Attack", player: "p3", target: "p0" },
  { type: "EndTurn", player: "p3" },
  { type: "RollMove", player: "p0" },
  { type: "ResolveArea", player: "p0" },
  { type: "Attack", player: "p0", target: "p1" },
  { type: "EndTurn", player: "p0" },
  { type: "RollMove", player: "p1" },
  { type: "MoveTo", player: "p1", area: "erstwhile_altar" },
  { type: "ResolveArea", player: "p1" },
  { type: "Attack", player: "p1", target: "p0" },
  { type: "EndTurn", player: "p1" },
  { type: "RollMove", player: "p2" },
  { type: "ResolveArea", player: "p2" },
  { type: "Attack", player: "p2", target: "p3" },
  { type: "EndTurn", player: "p2" },
  { type: "RollMove", player: "p3" },
  { type: "ResolveArea", player: "p3" },
  { type: "EndTurn", player: "p3" },
  { type: "RollMove", player: "p0" },
  { type: "ResolveArea", player: "p0" },
  { type: "Attack", player: "p0", target: "p2" },
  { type: "EndTurn", player: "p0" },
  { type: "RollMove", player: "p1" },
  { type: "ResolveArea", player: "p1" },
  { type: "Attack", player: "p1", target: "p3" },
  { type: "EndTurn", player: "p1" },
  { type: "RollMove", player: "p2" },
  { type: "ResolveArea", player: "p2" },
  { type: "Attack", player: "p2", target: "p1" },
  { type: "EndTurn", player: "p2" },
  { type: "RollMove", player: "p3" },
  { type: "ResolveArea", player: "p3" },
  { type: "Attack", player: "p3", target: "p0" },
  { type: "EndTurn", player: "p3" },
  { type: "RollMove", player: "p0" },
  { type: "ResolveArea", player: "p0" },
  { type: "EndTurn", player: "p0" },
  { type: "RollMove", player: "p1" },
  { type: "ResolveArea", player: "p1" },
  { type: "Attack", player: "p1", target: "p3" },
  { type: "EndTurn", player: "p1" },
  { type: "RollMove", player: "p2" },
  { type: "ResolveArea", player: "p2" },
  { type: "Attack", player: "p2", target: "p1" },
  { type: "EndTurn", player: "p2" },
  { type: "RollMove", player: "p3" },
  { type: "ResolveArea", player: "p3" },
  { type: "EndTurn", player: "p3" },
  { type: "RollMove", player: "p0" },
  { type: "ResolveArea", player: "p0" },
  { type: "Attack", player: "p0", target: "p3" },
  { type: "EndTurn", player: "p0" },
  { type: "RollMove", player: "p2" },
  { type: "MoveTo", player: "p2", area: "erstwhile_altar" },
  { type: "ResolveArea", player: "p2" },
  { type: "EndTurn", player: "p2" },
  { type: "RollMove", player: "p3" },
  { type: "ResolveArea", player: "p3" },
  { type: "Attack", player: "p3", target: "p0" },
  { type: "EndTurn", player: "p3" },
  { type: "RollMove", player: "p0" },
  { type: "ResolveArea", player: "p0" },
  { type: "Attack", player: "p0", target: "p2" },
  { type: "EndTurn", player: "p0" },
  { type: "RollMove", player: "p2" },
  { type: "ResolveArea", player: "p2" },
  { type: "Attack", player: "p2", target: "p0" },
  { type: "EndTurn", player: "p2" },
  { type: "RollMove", player: "p3" },
  { type: "ResolveArea", player: "p3" },
  { type: "EndTurn", player: "p3" },
  { type: "RollMove", player: "p0" },
  { type: "ResolveArea", player: "p0" },
  { type: "Attack", player: "p0", target: "p3" },
  { type: "EndTurn", player: "p0" },
  { type: "RollMove", player: "p0" },
  { type: "ResolveArea", player: "p0" },
  { type: "EndTurn", player: "p0" },
  { type: "RollMove", player: "p2" },
  { type: "ResolveArea", player: "p2" },
  { type: "Attack", player: "p2", target: "p0" },
  { type: "EndTurn", player: "p2" },
  { type: "RollMove", player: "p3" },
  { type: "ResolveArea", player: "p3" },
  { type: "Attack", player: "p3", target: "p0" },
];

describe("Scenario 1 — 4p Hunters-win (fully scripted)", () => {
  test("the scripted action list eliminates both Shadows; Hunters win (§4)", () => {
    const { state } = runScript(HUNTERS_SEED, HUNTERS_IDS, HUNTERS_SCRIPT);

    // The expected deal for this fixed seed (sanity-anchors the scenario).
    expect(characterOf(state, "p0")).toBe("werewolf");
    expect(characterOf(state, "p1")).toBe("unknown");
    expect(characterOf(state, "p2")).toBe("george");
    expect(characterOf(state, "p3")).toBe("franklin");

    // Terminal state: game over, exact winners, Hunter-elimination end-state (§2/§4).
    expect(state.over).toBe(true);
    expect(state.winners).toEqual(["p2", "p3"]);
    expect(winnerFactions(state, state.winners)).toEqual(["Hunter"]);
    expect(aliveOf(state, "Shadow")).toBe(0); // all Shadows dead → Hunters win (§4)
    expect(aliveOf(state, "Hunter")).toBe(2);
    // A GameWon event was emitted exactly once with these winners (§2).
    const won = state.log.filter((e) => e.type === "GameWon");
    expect(won).toHaveLength(1);
    expect(won[0]).toEqual({ type: "GameWon", winners: ["p2", "p3"] });
  });

  test("determinism — re-running the same seed + script yields identical winners", () => {
    const a = runScript(HUNTERS_SEED, HUNTERS_IDS, HUNTERS_SCRIPT, { checkSecrecy: false });
    const b = runScript(HUNTERS_SEED, HUNTERS_IDS, HUNTERS_SCRIPT, { checkSecrecy: false });
    expect(a.state.winners).toEqual(b.state.winners);
    expect(a.state.winners).toEqual(["p2", "p3"]);
    // Full end-state equality (damage, alive, deadOrder) — bit-for-bit reproducible.
    expect(JSON.stringify(a.state)).toEqual(JSON.stringify(b.state));
  });

  test("a different seed with the SAME script does NOT reach this same outcome (script is seed-bound)", () => {
    // Sanity: the scripted win is genuinely seed-dependent, not a script that wins on any
    // deal. A different seed deals different characters, so the same action list either
    // throws on an illegal action or ends elsewhere — never silently the same win.
    let threwOrDiffered = false;
    try {
      const { state } = runScript("4p-DIFFERENT", HUNTERS_IDS, HUNTERS_SCRIPT, {
        checkSecrecy: false,
      });
      // If it ran to completion, the winners must differ from the seed-bound result OR
      // the game did not even end — either way it is not the identical scripted outcome.
      threwOrDiffered =
        !state.over || JSON.stringify(state.winners) !== JSON.stringify(["p2", "p3"]) ||
        characterOf(state, "p0") !== "werewolf";
    } catch {
      threwOrDiffered = true; // an illegal action under a different deal — expected.
    }
    expect(threwOrDiffered).toBe(true);
  });
});

// ─── Scenario 2: 6-player Neutral-win (Bob 5+ Equipment) ─────────────────────────
//
// Seed "6p-0" deals: p0=daniel(Neutral), p1=vampire(Shadow), p2=werewolf(Shadow),
// p3=bob(Neutral), p4=george(Hunter), p5=franklin(Hunter). Driven via legalActions to
// completion: Bob (p3) accumulates 5 Equipment (area draws + Erstwhile Altar steals +
// loot) and wins OUTRIGHT (§4) while both factions still have living members — a genuine
// standalone Neutral win that pre-empts either faction elimination.

const NEUTRAL_SEED = "6p-0";
const NEUTRAL_IDS = ids(6);

describe("Scenario 2 — 6p Neutral-win (Bob, driver fallback)", () => {
  test("Bob reaches 5+ Equipment and wins as a Neutral (§4)", () => {
    const { state, actions } = driveToWin(NEUTRAL_SEED, NEUTRAL_IDS, aggressivePolicy);

    expect(characterOf(state, "p3")).toBe("bob");

    expect(state.over).toBe(true);
    expect(state.winners).toEqual(["p3"]);
    expect(winnerFactions(state, state.winners)).toEqual(["Neutral"]);

    // Bob's terminal condition: possess 5+ Equipment (§4).
    const bob = state.players.find((p) => p.id === "p3")!;
    expect(bob.equipment.length).toBeGreaterThanOrEqual(5);
    expect(bob.alive).toBe(true);

    // The win pre-empts a faction win: both factions still have living members.
    expect(aliveOf(state, "Hunter")).toBeGreaterThan(0);
    expect(aliveOf(state, "Shadow")).toBeGreaterThan(0);

    // The driver produced a non-empty, replayable action list.
    expect(actions.length).toBeGreaterThan(0);
  });

  test("determinism — replaying the driver's captured action list reproduces the win", () => {
    const first = driveToWin(NEUTRAL_SEED, NEUTRAL_IDS, aggressivePolicy);
    // Replay the EXACT captured list through runScript (also re-asserts secrecy per step).
    const replay = runScript(NEUTRAL_SEED, NEUTRAL_IDS, first.actions);
    expect(replay.state.winners).toEqual(first.state.winners);
    expect(replay.state.winners).toEqual(["p3"]);
    expect(JSON.stringify(replay.state)).toEqual(JSON.stringify(first.state));
  });
});

// ─── Scenario 3: 8-player Shadows-win (all Hunters eliminated) ───────────────────
//
// Seed "8p-3" deals 3 Hunters (p4=franklin, p6=george, p7=emi), 3 Shadows (p1=vampire,
// p3=unknown, p5=werewolf), 2 Neutrals (p0=allie, p2=daniel). Driven to completion: every
// Hunter is killed, so ALL three Shadows win — including p1 and p3 whose characters died
// earlier (§4: a faction member wins even if their own character died).

const SHADOWS_SEED = "8p-3";
const SHADOWS_IDS = ids(8);

describe("Scenario 3 — 8p Shadows-win (driver fallback)", () => {
  test("all Hunters are eliminated; all three Shadows win (§4)", () => {
    const { state, actions } = driveToWin(SHADOWS_SEED, SHADOWS_IDS, aggressivePolicy);

    expect(characterOf(state, "p1")).toBe("vampire");
    expect(characterOf(state, "p3")).toBe("unknown");
    expect(characterOf(state, "p5")).toBe("werewolf");

    expect(state.over).toBe(true);
    expect(state.winners).toEqual(["p1", "p3", "p5"]);
    expect(winnerFactions(state, state.winners)).toEqual(["Shadow"]);

    // Shadow-elimination win: no Hunter left alive (§4).
    expect(aliveOf(state, "Hunter")).toBe(0);
    // Dead Shadows still win (§4) — p1 and p3 died but are winners.
    const p1 = state.players.find((p) => p.id === "p1")!;
    const p3 = state.players.find((p) => p.id === "p3")!;
    expect(p1.alive).toBe(false);
    expect(p3.alive).toBe(false);
    expect(state.winners).toContain("p1");
    expect(state.winners).toContain("p3");

    expect(actions.length).toBeGreaterThan(0);
  });

  test("determinism — replaying the driver's captured action list reproduces the win", () => {
    const first = driveToWin(SHADOWS_SEED, SHADOWS_IDS, aggressivePolicy);
    const replay = runScript(SHADOWS_SEED, SHADOWS_IDS, first.actions);
    expect(replay.state.winners).toEqual(first.state.winners);
    expect(replay.state.winners).toEqual(["p1", "p3", "p5"]);
    expect(JSON.stringify(replay.state)).toEqual(JSON.stringify(first.state));
  });
});

// ─── Cross-cutting: the secrecy invariant holds across a whole game ──────────────
//
// runScript / driveToWin already call assertSecrecy after every reduce; this explicit
// test documents the "no secret leaks across a whole game" criterion (§1/§11) and also
// checks the initial freshly-dealt state (before any action) leaks nothing.

describe("Secrecy invariant across whole games (§1/§11)", () => {
  test("initial dealt state leaks no hidden identity / rng / deck order, for every viewer", () => {
    for (const [seed, n] of [["4p-0", 4], ["6p-0", 6], ["8p-3", 8]] as const) {
      const g = createGame(ids(n), seed);
      // Nobody is revealed at deal time, so every other player is hidden.
      assertSecrecy(g);
    }
  });

  test("driving each scenario to completion never trips the per-step secrecy assertion", () => {
    // These re-run with secrecy checks ON (the default), so any leak at ANY mid-game state
    // throws inside assertSecrecy and fails the test.
    expect(() => runScript(HUNTERS_SEED, HUNTERS_IDS, HUNTERS_SCRIPT)).not.toThrow();
    expect(() => driveToWin(NEUTRAL_SEED, NEUTRAL_IDS, aggressivePolicy)).not.toThrow();
    expect(() => driveToWin(SHADOWS_SEED, SHADOWS_IDS, aggressivePolicy)).not.toThrow();
  });
});
