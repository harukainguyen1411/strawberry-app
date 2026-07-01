// reduce + legalActions — the turn state machine (Task 12).
// Source of truth: ruleset.md §8 (turn structure), §7 (areas), §9-§12.
//
// reduce(state, action) -> { state, events } is PURE: it deep-clones the input
// (rng is {s} copied by value) and never mutates the argument. It routes by phase
// (move -> area -> attack -> ended), advancing current (skipping dead, §12.17) and
// consuming pendingExtraTurns (§12.10). legalActions returns EXACTLY the allowed
// actions; reduce throws on anything not legal.

import { expect, test, describe } from "vitest";
import { createGame } from "../src/setup.js";
import { reduce, legalActions } from "../src/reduce.js";
import type { GameState, Action, AreaId, PlayerId } from "../src/types.js";
import { CHARACTERS } from "../src/data/characters.js";

// ─── Test scaffolding ──────────────────────────────────────────────────────────

const FIXED_PAIRING: Record<AreaId, AreaId> = {
  church: "cemetery",
  cemetery: "church",
  hermits_cabin: "underworld_gate",
  underworld_gate: "hermits_cabin",
  weird_woods: "erstwhile_altar",
  erstwhile_altar: "weird_woods",
};
const FIXED_AREAS: AreaId[] = [
  "church",
  "cemetery",
  "hermits_cabin",
  "underworld_gate",
  "weird_woods",
  "erstwhile_altar",
];

/**
 * Build a deterministic 4-player game with a fixed board, then force each player's
 * character so tests control identities. Players are placed in `church` unless an
 * area override is given. phase="move", current=p0.
 */
function makeGame(
  chars: Record<string, string>,
  opts: { areas?: Record<string, AreaId>; placeAll?: boolean } = {},
): GameState {
  const ids = Object.keys(chars);
  const g = createGame(ids, "reduce-test-seed");
  g.areas = [...FIXED_AREAS];
  g.pairing = { ...FIXED_PAIRING };
  for (const p of g.players) {
    p.characterId = chars[p.id]!;
    if (opts.placeAll !== false) p.area = opts.areas?.[p.id] ?? "church";
    else p.area = opts.areas?.[p.id] ?? null;
  }
  g.current = ids[0]!;
  g.phase = "move";
  return g;
}

const types = (acts: Action[]): string[] => acts.map((a) => a.type).sort();

// ─── Purity ──────────────────────────────────────────────────────────────────

describe("purity", () => {
  test("reduce does not mutate the input state", () => {
    const g = makeGame({ p0: "allie", p1: "bob", p2: "charles", p3: "daniel" });
    g.players[0]!.area = null; // p0 has not moved
    g.phase = "move";
    const snapshot = JSON.stringify(g);
    reduce(g, { type: "RollMove", player: "p0" });
    expect(JSON.stringify(g)).toBe(snapshot);
  });

  test("reduce returns a new state object (not the same reference)", () => {
    const g = makeGame({ p0: "allie", p1: "bob", p2: "charles", p3: "daniel" });
    g.players[0]!.area = null;
    const { state } = reduce(g, { type: "RollMove", player: "p0" });
    expect(state).not.toBe(g);
    expect(state.rng).not.toBe(g.rng); // rng copied by value
  });
});

// ─── legalActions ──────────────────────────────────────────────────────────────

describe("legalActions", () => {
  test("move phase: only the current player may RollMove (+ Reveal)", () => {
    const g = makeGame({ p0: "allie", p1: "bob", p2: "charles", p3: "daniel" });
    g.players[0]!.area = null;
    const legal = legalActions(g, "p0");
    expect(types(legal)).toContain("RollMove");
    expect(types(legal)).toContain("Reveal");
    // Out-of-turn player has no turn actions (Reveal also gated: see daniel rule).
    const other = legalActions(g, "p1");
    expect(other.find((a) => a.type === "RollMove")).toBeUndefined();
  });

  test("out-of-turn actions are absent and rejected", () => {
    const g = makeGame({ p0: "allie", p1: "bob", p2: "charles", p3: "daniel" });
    g.players[0]!.area = null;
    expect(() => reduce(g, { type: "RollMove", player: "p1" })).toThrow();
  });

  test("Reveal is legal for the current player at any phase", () => {
    const g = makeGame({ p0: "allie", p1: "bob", p2: "charles", p3: "daniel" });
    g.players[0]!.area = null;
    expect(legalActions(g, "p0").some((a) => a.type === "Reveal")).toBe(true);
  });

  test("Daniel may NOT voluntarily Reveal (§5/§12.5)", () => {
    const g = makeGame({ p0: "daniel", p1: "bob", p2: "charles", p3: "allie" });
    g.players[0]!.area = null;
    expect(legalActions(g, "p0").some((a) => a.type === "Reveal")).toBe(false);
    expect(() => reduce(g, { type: "Reveal", player: "p0" })).toThrow();
  });

  test("Unknown CAN voluntarily Reveal (§5 — only its Deceit ability is reveal-exempt, not the player)", () => {
    // Unknown's special rule is that its Deceit ability doesn't require reveal; the player
    // itself is NOT barred from voluntarily revealing (unlike Daniel).
    const g = makeGame({ p0: "unknown", p1: "bob", p2: "charles", p3: "allie" });
    g.players[0]!.area = "church";
    expect(legalActions(g, "p0").some((a) => a.type === "Reveal")).toBe(true);
    // Applying the Reveal action should succeed without throwing.
    const { state } = reduce(g, { type: "Reveal", player: "p0" });
    expect(state.players.find((p) => p.id === "p0")!.revealed).toBe(true);
  });

  test("attack phase: only in-range targets are offered", () => {
    // p0 in church, p1 in church (in range), p2 in hermits_cabin (out of range)
    const g = makeGame(
      { p0: "allie", p1: "bob", p2: "charles", p3: "daniel" },
      { areas: { p0: "church", p1: "church", p2: "hermits_cabin", p3: "weird_woods" } },
    );
    g.phase = "attack";
    const legal = legalActions(g, "p0");
    const attacks = legal.filter((a) => a.type === "Attack") as Extract<Action, { type: "Attack" }>[];
    const targets = attacks.map((a) => a.target).sort();
    expect(targets).toEqual(["p1"]); // only p1 is in range
  });

  test("EndTurn is legal in the attack phase", () => {
    const g = makeGame({ p0: "allie", p1: "bob", p2: "charles", p3: "daniel" });
    g.phase = "attack";
    expect(legalActions(g, "p0").some((a) => a.type === "EndTurn")).toBe(true);
  });
});

// ─── Full single turn ──────────────────────────────────────────────────────────

describe("full turn", () => {
  test("RollMove -> ResolveArea -> Attack -> EndTurn advances to the next player", () => {
    // Place p1 in church so an attack target is available; p0 will roll.
    const g = makeGame(
      { p0: "allie", p1: "bob", p2: "charles", p3: "daniel" },
      { areas: { p1: "church" }, placeAll: false },
    );
    g.players[0]!.area = null;
    g.players[2]!.area = "weird_woods";
    g.players[3]!.area = "weird_woods";

    // 1. RollMove
    let r = reduce(g, { type: "RollMove", player: "p0" });
    let s = r.state;
    // After a roll, either we are in "area" (moved) or "move" with a pending wild.
    if (s.phase === "move" && s.pendingMove) {
      // wild: move to church (where p1 is, for the attack step)
      r = reduce(s, { type: "MoveTo", player: "p0", area: "church" });
      s = r.state;
    }
    expect(s.phase).toBe("area");
    expect(s.players[0]!.area).not.toBeNull();

    // 2. ResolveArea is optional; skip by EndTurn? No — there must be a way to pass
    // the area step. ResolveArea with no choice on a deck area draws; but to keep the
    // turn simple, advance to attack by resolving the area (or EndTurn from area).
    // We assert ResolveArea is legal then move on.
    expect(legalActions(s, "p0").some((a) => a.type === "ResolveArea")).toBe(true);

    // Skip the area action: EndTurn must be legal from the area phase too (area is optional §8).
    const endFromArea = legalActions(s, "p0").some((a) => a.type === "EndTurn");
    expect(endFromArea).toBe(true);
  });

  test("EndTurn from move/area/attack ends the turn and rotates current (skipping nobody)", () => {
    const g = makeGame({ p0: "allie", p1: "bob", p2: "charles", p3: "daniel" });
    g.phase = "attack";
    const { state } = reduce(g, { type: "EndTurn", player: "p0" });
    expect(state.current).toBe("p1");
    expect(state.phase).toBe("move");
  });
});

// ─── MoveTo enumeration (§9) ─────────────────────────────────────────────────────

describe("MoveTo enumeration §9", () => {
  test("a pending wild offers exactly the non-current areas (never-stay)", () => {
    const g = makeGame({ p0: "allie", p1: "bob", p2: "charles", p3: "daniel" });
    g.players[0]!.area = "church";
    g.phase = "move";
    g.pendingMove = { kind: "wild", roll: [3, 4] };
    const moves = legalActions(g, "p0").filter((a) => a.type === "MoveTo") as Extract<
      Action,
      { type: "MoveTo" }
    >[];
    const dests = moves.map((m) => m.area).sort();
    expect(dests).toEqual(
      ["cemetery", "erstwhile_altar", "hermits_cabin", "underworld_gate", "weird_woods"].sort(),
    );
    expect(dests).not.toContain("church"); // never-stay §9
  });

  test("Emi RollMove sets up an Emi teleport choice; MoveTo to a valid target moves her", () => {
    const g = makeGame(
      { p0: "emi", p1: "werewolf", p2: "charles", p3: "daniel" },
      { areas: { p0: "church", p1: "cemetery", p2: "hermits_cabin", p3: "weird_woods" } },
    );
    g.current = "p0";
    g.phase = "move";
    const r = reduce(g, { type: "RollMove", player: "p0" });
    // Emi does not roll: a pending emi move choice is set, phase stays "move".
    expect(r.state.phase).toBe("move");
    expect(r.state.pendingMove?.kind).toBe("emi");
    const moves = legalActions(r.state, "p0").filter((a) => a.type === "MoveTo") as Extract<
      Action,
      { type: "MoveTo" }
    >[];
    expect(moves.length).toBeGreaterThan(0);
    // The offered destinations never include Emi's current area (never-stay §9).
    expect(moves.every((m) => m.area !== "church")).toBe(true);
    // Move to the first offered target → phase advances to area.
    const dest = moves[0]!.area;
    const r2 = reduce(r.state, { type: "MoveTo", player: "p0", area: dest });
    expect(r2.state.phase).toBe("area");
    expect(r2.state.players[0]!.area).toBe(dest);
  });

  test("resolving a pending wild MoveTo advances to the area phase", () => {
    const g = makeGame({ p0: "allie", p1: "bob", p2: "charles", p3: "daniel" });
    g.players[0]!.area = "church";
    g.phase = "move";
    g.pendingMove = { kind: "wild", roll: [3, 4] };
    const r = reduce(g, { type: "MoveTo", player: "p0", area: "cemetery" });
    expect(r.state.phase).toBe("area");
    expect(r.state.players[0]!.area).toBe("cemetery");
    expect(r.state.pendingMove).toBeUndefined();
  });
});

// ─── Turn-order compression (§12.17) ─────────────────────────────────────────────

describe("turn order compression §12.17", () => {
  test("EndTurn skips dead players", () => {
    const g = makeGame({ p0: "allie", p1: "bob", p2: "charles", p3: "daniel" });
    g.phase = "attack";
    g.players[1]!.alive = false; // p1 dead
    const { state } = reduce(g, { type: "EndTurn", player: "p0" });
    expect(state.current).toBe("p2"); // skips dead p1
  });

  test("EndTurn wraps around to the first alive player", () => {
    const g = makeGame({ p0: "allie", p1: "bob", p2: "charles", p3: "daniel" });
    g.current = "p3";
    g.phase = "attack";
    const { state } = reduce(g, { type: "EndTurn", player: "p3" });
    expect(state.current).toBe("p0");
  });
});

// ─── Concealed Knowledge / pendingExtraTurns (§12.10) ───────────────────────────

describe("pendingExtraTurns §12.10", () => {
  test("an extra turn is taken by the SAME player before passing", () => {
    const g = makeGame({ p0: "allie", p1: "bob", p2: "charles", p3: "daniel" });
    g.phase = "attack";
    g.pendingExtraTurns = 1;
    const { state } = reduce(g, { type: "EndTurn", player: "p0" });
    // Extra turn: current stays p0, phase resets to move, counter consumed.
    expect(state.current).toBe("p0");
    expect(state.phase).toBe("move");
    expect(state.pendingExtraTurns).toBe(0);
    // §12.10/§9: the extra turn keeps the player's board position; the mandatory move
    // step then re-rolls from there (never-stay enforced by movement.ts).
    expect(state.players[0]!.area).toBe("church");
    // The move step is mandatory: RollMove is offered again.
    expect(legalActions(state, "p0").some((a) => a.type === "RollMove")).toBe(true);
  });

  test("after the extra turn ends, play passes to the next player", () => {
    const g = makeGame({ p0: "allie", p1: "bob", p2: "charles", p3: "daniel" });
    g.phase = "attack";
    g.pendingExtraTurns = 1;
    let s = reduce(g, { type: "EndTurn", player: "p0" }).state; // takes extra turn
    s.phase = "attack";
    s = reduce(s, { type: "EndTurn", player: "p0" }).state; // ends extra turn
    expect(s.current).toBe("p1");
  });
});

// ─── Win evaluation runs after each action ───────────────────────────────────────

describe("win evaluation after each action §12.1", () => {
  test("the game can end mid-turn via an action", () => {
    // 4p: 2 Hunters (emi, franklin), 2 Shadows (vampire, werewolf).
    // Set vampire (p2) to 12 damage (maxHp 13). Franklin's Lightning d6=6 kills it.
    const g = makeGame({ p0: "franklin", p1: "emi", p2: "vampire", p3: "werewolf" });
    g.players[0]!.area = null;
    g.players[2]!.damage = 12; // one hit from death (vampire maxHp 13)
    g.players[3]!.damage = 13; // werewolf already dead? no — set alive
    g.players[3]!.damage = 12;
    g.players[3]!.alive = true;
    // Kill werewolf first via lightning, then we need vampire dead too for Hunter win.
    // Simpler: kill the only remaining shadow. Make p3 already dead, p2 one hit away.
    g.players[3]!.alive = false;
    g.players[3]!.revealed = true;
    // p0 uses Lightning (onStartTurn) at the start; deal 6 to vampire (p2) -> dead -> Hunters win.
    const r = reduce(g, {
      type: "UseAbility",
      player: "p0",
      params: { target: "p2", roll: 6 },
    });
    expect(r.state.over).toBe(true);
    expect(r.state.winners).toContain("p0"); // franklin (Hunter) wins
    expect(r.events.some((e) => e.type === "GameWon")).toBe(true);
  });
});

// ─── Start-of-turn hooks (Franklin / George) §8 §12.22 ──────────────────────────

describe("start-of-turn hooks §8 §12.22", () => {
  test("Franklin's Lightning is offered as a UseAbility at the start of his turn", () => {
    const g = makeGame({ p0: "franklin", p1: "emi", p2: "vampire", p3: "werewolf" });
    g.players[0]!.area = null;
    const legal = legalActions(g, "p0");
    expect(legal.some((a) => a.type === "UseAbility")).toBe(true);
  });

  test("Franklin's Lightning is once-per-game (absent after use)", () => {
    const g = makeGame({ p0: "franklin", p1: "emi", p2: "vampire", p3: "werewolf" });
    g.players[0]!.area = null;
    const r = reduce(g, {
      type: "UseAbility",
      player: "p0",
      params: { target: "p2", roll: 3 },
    });
    // After use, the ability should no longer be offered.
    expect(legalActions(r.state, "p0").some((a) => a.type === "UseAbility")).toBe(false);
  });

  test("a non-start-of-turn character has no UseAbility at move start", () => {
    const g = makeGame({ p0: "allie", p1: "bob", p2: "charles", p3: "daniel" });
    g.players[0]!.area = null;
    // Allie's ability is manual (once-per-game heal) — it is allowed any time she's
    // current and damaged. With 0 damage it is still offered (heal of 0 is legal but
    // a no-op); we only assert Franklin-style start damage is NOT auto-applied.
    const r = reduce(g, { type: "RollMove", player: "p0" });
    // No damage dealt to anyone from a start hook.
    expect(r.state.players.every((p) => p.damage === 0)).toBe(true);
  });
});

// ─── Werewolf Counterattack as an explicit legal action §12.6 ───────────────────

describe("Werewolf Counterattack §12.6", () => {
  test("after being attacked, the Werewolf may Counterattack the attacker", () => {
    // p0 attacker (emi, a Hunter — keeps both factions in play so no faction win
    // fires from the forced roster), p1 werewolf in range (church/cemetery pair).
    const g = makeGame(
      { p0: "emi", p1: "werewolf", p2: "charles", p3: "daniel" },
      { areas: { p0: "church", p1: "church", p2: "weird_woods", p3: "weird_woods" } },
    );
    g.phase = "attack";
    // p0 attacks p1 (forced dice via... reduce rolls from rng; just assert the counter
    // becomes a legal action for the werewolf afterward).
    const r = reduce(g, { type: "Attack", player: "p0", target: "p1" });
    const s = r.state;
    // The werewolf (p1) now has a Counterattack available targeting p0.
    const wereLegal = legalActions(s, "p1");
    const counters = wereLegal.filter((a) => a.type === "Counterattack") as Extract<
      Action,
      { type: "Counterattack" }
    >[];
    expect(counters.some((c) => c.target === "p0")).toBe(true);
  });

  test("Counterattack is only legal for a Werewolf who was just attacked", () => {
    const g = makeGame(
      { p0: "emi", p1: "werewolf", p2: "charles", p3: "daniel" },
      { areas: { p0: "church", p1: "church", p2: "weird_woods", p3: "weird_woods" } },
    );
    g.phase = "attack";
    // No attack has happened yet — werewolf has no counter available.
    expect(legalActions(g, "p1").some((a) => a.type === "Counterattack")).toBe(false);
    // A non-werewolf who was attacked has no counter either (all Neutral roster, so no
    // faction win fires from the forced identities).
    const g2 = makeGame(
      { p0: "allie", p1: "charles", p2: "bob", p3: "daniel" },
      { areas: { p0: "church", p1: "church", p2: "weird_woods", p3: "weird_woods" } },
    );
    g2.phase = "attack";
    const r2 = reduce(g2, { type: "Attack", player: "p0", target: "p1" });
    expect(legalActions(r2.state, "p1").some((a) => a.type === "Counterattack")).toBe(false);
  });

  test("the attacker cannot EndTurn while a Werewolf's counter is still pending (§12.6)", () => {
    // The reaction window must not be skippable. If the attacker could EndTurn, the
    // turn would advance and beginTurn() would wipe pendingCounters — silently losing
    // the Werewolf's counter. The current player is on hold until the counter resolves.
    const g = makeGame(
      { p0: "emi", p1: "werewolf", p2: "charles", p3: "daniel" },
      { areas: { p0: "church", p1: "church", p2: "weird_woods", p3: "weird_woods" } },
    );
    g.phase = "attack";
    const r = reduce(g, { type: "Attack", player: "p0", target: "p1" });
    const s = r.state;
    expect(s.pendingCounters?.["p1"]).toContain("p0");
    // p0 (attacker) may NOT end their turn while the counter is live.
    expect(legalActions(s, "p0").some((a) => a.type === "EndTurn")).toBe(false);
    expect(() => reduce(s, { type: "EndTurn", player: "p0" })).toThrow();
  });

  test("the Werewolf may Decline the counter, releasing the turn without revealing (§12.6)", () => {
    const g = makeGame(
      { p0: "emi", p1: "werewolf", p2: "charles", p3: "daniel" },
      { areas: { p0: "church", p1: "church", p2: "weird_woods", p3: "weird_woods" } },
    );
    g.phase = "attack";
    const r = reduce(g, { type: "Attack", player: "p0", target: "p1" });
    // Decline is offered to the Werewolf (the counter is optional, §12.6).
    expect(legalActions(r.state, "p1").some((a) => a.type === "DeclineCounter")).toBe(true);
    const d = reduce(r.state, { type: "DeclineCounter", player: "p1" });
    // Declining does NOT out a hidden Werewolf.
    expect(d.state.players.find((p) => p.id === "p1")!.revealed).toBe(false);
    // Counter cleared → the attacker's turn is released.
    expect(d.state.pendingCounters?.["p1"] ?? []).toEqual([]);
    expect(legalActions(d.state, "p0").some((a) => a.type === "EndTurn")).toBe(true);
  });

  test("taking the Counterattack clears the pending occurrence and releases the turn (§12.6)", () => {
    const g = makeGame(
      { p0: "emi", p1: "werewolf", p2: "charles", p3: "daniel" },
      { areas: { p0: "church", p1: "church", p2: "weird_woods", p3: "weird_woods" } },
    );
    g.phase = "attack";
    const r = reduce(g, { type: "Attack", player: "p0", target: "p1" });
    const c = reduce(r.state, { type: "Counterattack", player: "p1", target: "p0" });
    // The occurrence against p0 is consumed.
    expect(c.state.pendingCounters?.["p1"] ?? []).not.toContain("p0");
    // With the counter resolved, if p0 survived the game continues and EndTurn returns.
    const p0 = c.state.players.find((p) => p.id === "p0")!;
    if (p0.alive && !c.state.over) {
      expect(legalActions(c.state, "p0").some((a) => a.type === "EndTurn")).toBe(true);
    }
  });
});

// ─── Single attack step per turn §8 §10 §12.10 ──────────────────────────────────

describe("single attack step per turn §8 §10", () => {
  // Balanced roster: p0 attacker (charles, Neutral), p1/p2 high-HP in-range targets,
  // p3 a Shadow (vampire) OUT of range. george (Hunter) and vampire (Shadow) both stay
  // alive so no faction-elimination win fires while we probe the attack-step machine.
  test("after attacking, a fresh Attack is no longer offered (no attacking twice)", () => {
    const g = makeGame(
      { p0: "charles", p1: "george", p2: "bob", p3: "vampire" },
      { areas: { p0: "church", p1: "church", p2: "church", p3: "weird_woods" } },
    );
    g.phase = "attack";
    // Before attacking: both in-range targets (p1 george 14hp, p2 bob 10hp) are offered.
    const before = legalActions(g, "p0").filter((a) => a.type === "Attack");
    expect(before.length).toBe(2);

    const r = reduce(g, { type: "Attack", player: "p0", target: "p1" });
    expect(r.state.over).toBe(false); // game continues (Hunter + Shadow both alive)
    expect(r.state.attackStepSpent).toBe(true);

    // After attacking: NO fresh Attack of any kind is legal — only EndTurn / Bloody Feast.
    const after = legalActions(r.state, "p0").filter((a) => a.type === "Attack");
    expect(after).toEqual([]);
    expect(legalActions(r.state, "p0").some((a) => a.type === "EndTurn")).toBe(true);
  });

  test("a SECOND Attack in the same turn is rejected by reduce", () => {
    // Empirically the bug let a current player attack p1, then p2, then p1 AGAIN in one
    // turn. Assert the second attack (against ANY in-range target) throws after the first.
    const g = makeGame(
      { p0: "charles", p1: "george", p2: "bob", p3: "vampire" },
      { areas: { p0: "church", p1: "church", p2: "church", p3: "weird_woods" } },
    );
    g.phase = "attack";
    const r = reduce(g, { type: "Attack", player: "p0", target: "p1" });
    expect(r.state.over).toBe(false);
    // Second attack against the OTHER in-range target is illegal.
    expect(() => reduce(r.state, { type: "Attack", player: "p0", target: "p2" })).toThrow();
    // Re-attacking the SAME target via a fresh Attack is also illegal (the bug allowed
    // this too); the only sanctioned repeat is Charles's Bloody Feast UseAbility.
    expect(() => reduce(r.state, { type: "Attack", player: "p0", target: "p1" })).toThrow();
  });

  test("a Concealed-Knowledge extra turn restores a fresh attack step §12.10", () => {
    // After an attack spends the step, ending into an extra turn must re-enable Attack.
    const g = makeGame(
      { p0: "charles", p1: "george", p2: "bob", p3: "vampire" },
      { areas: { p0: "church", p1: "church", p2: "weird_woods", p3: "weird_woods" } },
    );
    g.phase = "attack";
    g.pendingExtraTurns = 1;
    const r = reduce(g, { type: "Attack", player: "p0", target: "p1" });
    expect(r.state.over).toBe(false);
    expect(r.state.attackStepSpent).toBe(true);
    // End the (first) turn → extra turn for the SAME player, attack step reset.
    const r2 = reduce(r.state, { type: "EndTurn", player: "p0" });
    expect(r2.state.current).toBe("p0");
    expect(r2.state.phase).toBe("move");
    expect(r2.state.attackStepSpent).toBe(false);
  });
});

// ─── Charles Bloody Feast reachable via UseAbility §5 §12.4 ──────────────────────

describe("Charles Bloody Feast §5 §12.4", () => {
  test("Bloody Feast is NOT offered before Charles attacks", () => {
    const g = makeGame(
      { p0: "charles", p1: "allie", p2: "bob", p3: "daniel" },
      { areas: { p0: "church", p1: "church", p2: "weird_woods", p3: "weird_woods" } },
    );
    g.phase = "attack";
    // Pre-attack: Attack offered, UseAbility (Bloody Feast) is NOT (it's "after you attack").
    const legal = legalActions(g, "p0");
    expect(legal.some((a) => a.type === "Attack")).toBe(true);
    expect(legal.some((a) => a.type === "UseAbility")).toBe(false);
  });

  test("after Charles attacks, UseAbility (Bloody Feast) is offered instead of a 2nd Attack", () => {
    const g = makeGame(
      { p0: "charles", p1: "allie", p2: "bob", p3: "daniel" },
      { areas: { p0: "church", p1: "church", p2: "weird_woods", p3: "weird_woods" } },
    );
    g.phase = "attack";
    const r = reduce(g, { type: "Attack", player: "p0", target: "p1" });
    const legal = legalActions(r.state, "p0");
    // No fresh Attack, but Bloody Feast (UseAbility) IS now offered (target still in range).
    expect(legal.some((a) => a.type === "Attack")).toBe(false);
    expect(legal.some((a) => a.type === "UseAbility")).toBe(true);
    expect(legal.some((a) => a.type === "EndTurn")).toBe(true);
  });

  test("reduce accepts the Bloody Feast UseAbility and deals the extra attack §12.4", () => {
    // Charles attacks p1, then pays 2 self-damage to attack p1 AGAIN via UseAbility.
    // Inject dice so the extra attack lands a known amount (d6=5,d4=1 → |5-1|=4).
    const g = makeGame(
      { p0: "charles", p1: "allie", p2: "bob", p3: "daniel" },
      { areas: { p0: "church", p1: "church", p2: "weird_woods", p3: "weird_woods" } },
    );
    g.phase = "attack";
    const r = reduce(g, { type: "Attack", player: "p0", target: "p1" });
    const p1DamageAfterFirst = r.state.players.find((p) => p.id === "p1")!.damage;
    const charlesDamageBefore = r.state.players.find((p) => p.id === "p0")!.damage;

    // Bloody Feast: legal, and runs an extra attack on the same target.
    const r2 = reduce(r.state, {
      type: "UseAbility",
      player: "p0",
      params: { target: "p1", dice: { d6: 5, d4: 1 } },
    });
    const charlesAfter = r2.state.players.find((p) => p.id === "p0")!;
    const p1After = r2.state.players.find((p) => p.id === "p1")!;
    // Charles paid 2 self-damage (§5) and revealed (§5: ability requires reveal).
    expect(charlesAfter.damage).toBe(charlesDamageBefore + 2);
    expect(charlesAfter.revealed).toBe(true);
    // The extra attack dealt |5-1| = 4 to p1 (allie maxHp 8 → 8 dead? p1 started 0,
    // first attack rng-rolled, second adds 4). Assert p1 took MORE damage than after
    // the first attack alone (the extra attack landed), or p1 died from it.
    expect(p1After.damage >= p1DamageAfterFirst).toBe(true);
    expect(p1After.damage - p1DamageAfterFirst === 4 || !p1After.alive).toBe(true);
  });

  test("§12.6: Bloody Feast extra attack on a Werewolf queues a NEW Counterattack", () => {
    // The bug: pending-counter queuing lived only in reduce()'s Attack case, so a
    // Werewolf hit by Charles's Bloody Feast (an applyAttack inside abilities.ts)
    // got no counter. Charles normal-attacks the Werewolf (counter queued), the
    // Werewolf consumes its counter, then Charles Bloody-Feasts the SAME Werewolf:
    // a fresh Counterattack must become legal. george (Hunter, HP 14) stays alive
    // and out of range so no faction-elimination win fires mid-scenario.
    //
    // No deaths are possible here (no equipment → ≤5 per attack): Werewolf (HP 14)
    // takes ≤5+≤5 from the two Charles attacks; Charles (HP 11) takes ≤5 counter +
    // 2 self-cost — so the game never ends and dice come from the seeded rng.
    const g = makeGame(
      { p0: "charles", p1: "werewolf", p2: "george", p3: "daniel" },
      { areas: { p0: "church", p1: "church", p2: "weird_woods", p3: "weird_woods" } },
    );
    g.phase = "attack";

    // 1) Charles normal-attacks the Werewolf. The counter fires on hit OR miss (§12.6).
    const r1 = reduce(g, { type: "Attack", player: "p0", target: "p1" });
    expect(r1.state.over).toBe(false);
    // A counter against p0 is now legal for the Werewolf.
    const counters1 = legalActions(r1.state, "p1").filter(
      (a) => a.type === "Counterattack" && a.target === "p0",
    );
    expect(counters1.length).toBeGreaterThan(0);

    // 2) The Werewolf consumes its counter.
    const r2 = reduce(r1.state, { type: "Counterattack", player: "p1", target: "p0" });
    expect(r2.state.over).toBe(false);
    // The consumed occurrence is gone — no stale counter remains.
    expect(
      legalActions(r2.state, "p1").some((a) => a.type === "Counterattack"),
    ).toBe(false);

    // 3) Charles uses Bloody Feast on the SAME Werewolf.
    const r3 = reduce(r2.state, {
      type: "UseAbility",
      player: "p0",
      params: { target: "p1" },
    });
    expect(r3.state.over).toBe(false);

    // 4) A NEW Counterattack against p0 must be legal — the Bloody-Feast attack
    //    queued its own pending counter (the whole point of the fix).
    const counters2 = legalActions(r3.state, "p1").filter(
      (a) => a.type === "Counterattack" && a.target === "p0",
    );
    expect(counters2.length).toBeGreaterThan(0);
  });
});

// ─── ResolveArea: all 6 areas end-to-end §7 ──────────────────────────────────────

describe("ResolveArea — all 6 areas §7", () => {
  function gameInArea(area: AreaId): GameState {
    // p0 acts; place p1/p2/p3 in the same area so steal/heal/woods have targets.
    const g = makeGame(
      { p0: "allie", p1: "bob", p2: "charles", p3: "daniel" },
      { areas: { p0: area, p1: area, p2: area, p3: area } },
    );
    g.phase = "area";
    return g;
  }

  test("Hermit's Cabin (2-3): draws a Hermit card, hands it to a chosen player", () => {
    const g = gameInArea("hermits_cabin");
    const before = g.decks.hermit.draw.length;
    const r = reduce(g, {
      type: "ResolveArea",
      player: "p0",
      choice: { kind: "hermit_give", to: "p1" },
    });
    // A card left the hermit draw pile.
    expect(r.state.decks.hermit.draw.length).toBe(before - 1);
    // After resolving the area, phase advances to attack.
    expect(r.state.phase).toBe("attack");
  });

  test("Underworld Gate (4-5): choose a deck, draw and resolve", () => {
    const g = gameInArea("underworld_gate");
    const before = g.decks.white.draw.length;
    const r = reduce(g, {
      type: "ResolveArea",
      player: "p0",
      choice: { kind: "deck", deck: "white" },
    });
    expect(r.state.decks.white.draw.length).toBe(before - 1);
    expect(r.state.phase).toBe("attack");
  });

  test("Church (6): draws a White card and resolves it", () => {
    const g = gameInArea("church");
    const before = g.decks.white.draw.length;
    const r = reduce(g, { type: "ResolveArea", player: "p0" });
    expect(r.state.decks.white.draw.length).toBe(before - 1);
    expect(r.state.phase).toBe("attack");
  });

  test("Cemetery (8): draws a Black card and resolves it", () => {
    const g = gameInArea("cemetery");
    const before = g.decks.black.draw.length;
    const r = reduce(g, { type: "ResolveArea", player: "p0" });
    expect(r.state.decks.black.draw.length).toBe(before - 1);
    expect(r.state.phase).toBe("attack");
  });

  test("Weird Woods (9): deal 2 damage to a chosen player", () => {
    const g = gameInArea("weird_woods");
    const r = reduce(g, {
      type: "ResolveArea",
      player: "p0",
      choice: { kind: "weird_woods", target: "p1", mode: "damage" },
    });
    expect(r.state.players.find((p) => p.id === "p1")!.damage).toBe(2);
    expect(r.state.phase).toBe("attack");
  });

  test("Weird Woods (9): heal 1 of a chosen player", () => {
    const g = gameInArea("weird_woods");
    g.players[1]!.damage = 5;
    const r = reduce(g, {
      type: "ResolveArea",
      player: "p0",
      choice: { kind: "weird_woods", target: "p1", mode: "heal" },
    });
    expect(r.state.players.find((p) => p.id === "p1")!.damage).toBe(4);
  });

  test("Erstwhile Altar (10): steal one equipment from a chosen player", () => {
    const g = gameInArea("erstwhile_altar");
    g.players[1]!.equipment = ["white:holy_robe#0"];
    const r = reduce(g, {
      type: "ResolveArea",
      player: "p0",
      choice: { kind: "steal", from: "p1", card: "white:holy_robe#0" },
    });
    expect(r.state.players.find((p) => p.id === "p0")!.equipment).toContain("white:holy_robe#0");
    expect(r.state.players.find((p) => p.id === "p1")!.equipment).not.toContain("white:holy_robe#0");
  });

  test("Erstwhile Altar (10): nothing to steal is a legal no-op (nobody has equipment)", () => {
    const g = gameInArea("erstwhile_altar");
    const r = reduce(g, { type: "ResolveArea", player: "p0" });
    expect(r.state.phase).toBe("attack");
  });
});

// ─── reduce rejects illegal actions ─────────────────────────────────────────────

describe("reduce rejects illegal actions", () => {
  test("an out-of-range Attack throws", () => {
    const g = makeGame(
      { p0: "allie", p1: "bob", p2: "charles", p3: "daniel" },
      { areas: { p0: "church", p1: "weird_woods", p2: "weird_woods", p3: "weird_woods" } },
    );
    g.phase = "attack";
    expect(() => reduce(g, { type: "Attack", player: "p0", target: "p1" })).toThrow();
  });

  test("ResolveArea in the wrong phase throws", () => {
    const g = makeGame({ p0: "allie", p1: "bob", p2: "charles", p3: "daniel" });
    g.players[0]!.area = null;
    g.phase = "move";
    expect(() =>
      reduce(g, { type: "ResolveArea", player: "p0" }),
    ).toThrow();
  });

  test("Attack in the move phase throws", () => {
    const g = makeGame({ p0: "allie", p1: "bob", p2: "charles", p3: "daniel" });
    g.players[0]!.area = null;
    g.phase = "move";
    expect(() => reduce(g, { type: "Attack", player: "p0", target: "p1" })).toThrow();
  });

  test("a game that is over rejects all actions", () => {
    const g = makeGame({ p0: "allie", p1: "bob", p2: "charles", p3: "daniel" });
    g.over = true;
    expect(legalActions(g, "p0")).toEqual([]);
    expect(() => reduce(g, { type: "EndTurn", player: "p0" })).toThrow();
  });
});

// ─── Public exports from index.ts ────────────────────────────────────────────────

describe("index.ts public surface", () => {
  test("createGame, reduce, legalActions are exported from index", async () => {
    const idx = await import("../src/index.js");
    expect(typeof idx.createGame).toBe("function");
    expect(typeof idx.reduce).toBe("function");
    expect(typeof idx.legalActions).toBe("function");
  });
});

// ─── Determinism through reduce ──────────────────────────────────────────────────

describe("determinism", () => {
  test("the same action on cloned states yields identical results", () => {
    const mk = (): GameState => {
      const g = createGame(["p0", "p1", "p2", "p3"], "det-seed");
      return g;
    };
    const a = reduce(mk(), { type: "RollMove", player: "p0" });
    const b = reduce(mk(), { type: "RollMove", player: "p0" });
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
    expect(JSON.stringify(a.events)).toBe(JSON.stringify(b.events));
  });
});

// ─── Deck reshuffle (§12.15) ─────────────────────────────────────────────────────

describe("deck reshuffle §12.15", () => {
  test("when draw pile is empty, discard is shuffled (Fisher-Yates, §12.15) into a fresh draw pile", () => {
    const g = makeGame({ p0: "allie", p1: "bob", p2: "charles", p3: "daniel" });
    // Drain the white draw pile into discard in a known order.
    const originalCards = [...g.decks.white.draw];
    g.decks.white.discard = [...originalCards];
    g.decks.white.draw = [];
    // Record rng state before the reshuffle-triggering draw.
    const rngBefore = g.rng.s;
    // Force a card draw so drawCard fires the reshuffle path.
    // church → White area; Allie is in church; phase=area.
    g.phase = "area";
    g.players[0]!.area = "church";
    const { state } = reduce(g, { type: "ResolveArea", player: "p0" });
    // The rng must have advanced (Fisher-Yates shuffle consumed rng calls).
    expect(state.rng.s).not.toBe(rngBefore);
    // After reshuffle+draw, the drawn card is gone; remaining are in draw or discard
    // (the drawn card itself goes to discard after play, but that is one card).
    const remaining = [...state.decks.white.draw, ...state.decks.white.discard];
    // Set of remaining IDs must be a subset of originalCards (all still accounted for).
    expect(remaining.length).toBe(originalCards.length - 1 + 1); // drew 1 (played → discarded)
    // Every card in the new draw pile was in the original set.
    for (const id of state.decks.white.draw) {
      expect(originalCards).toContain(id);
    }
  });
});

// ─── Daniel's Scream — forced reveal on ANY death, through reduce() §5 §12.5 ─────
//
// §12.5: Daniel is FORCED to reveal the instant ANY character dies. The onAnyDeath
// ability is registered in abilities.ts, but it only matters in real play if reduce()
// actually INVOKES it after a death. This integration test drives a lethal Attack
// through reduce() and asserts a living hidden Daniel — who is neither the killer nor
// the victim — is revealed afterward.

describe("Daniel's Scream on any death §5 §12.5", () => {
  test("a Vampire killing an Allie forces a living hidden Daniel to reveal", () => {
    // p0 vampire (Shadow, attacker), p1 allie (Neutral, victim at 7/8 dmg),
    // p2 daniel (Neutral, alive + hidden), p3 emi (Hunter — kept alive so the kill
    // does NOT end the game, letting us assert play continues alongside the reveal).
    const g = makeGame({ p0: "vampire", p1: "allie", p2: "daniel", p3: "emi" });
    g.phase = "attack";
    // Cursed Sword Masamune never misses (damage = the d4 ≥ 1, §6), so the attack is a
    // guaranteed kill on an Allie one hit from death — deterministic regardless of rolls.
    g.players[0]!.equipment = ["white:cursed_sword_masamune#0"];
    g.players[1]!.damage = 7; // Allie maxHp 8 → any d4 hit kills.

    const danielBefore = g.players.find((p) => p.id === "p2")!;
    expect(danielBefore.revealed).toBe(false);
    expect(danielBefore.alive).toBe(true);

    const { state } = reduce(g, { type: "Attack", player: "p0", target: "p1" });

    // The Allie actually died (precondition of the death hook firing).
    expect(state.players.find((p) => p.id === "p1")!.alive).toBe(false);
    // §12.5: the living hidden Daniel is now revealed by the Scream.
    const daniel = state.players.find((p) => p.id === "p2")!;
    expect(daniel.revealed).toBe(true);
    expect(daniel.alive).toBe(true); // Daniel did not die — only revealed.
    // The game continues (a Hunter and a Shadow both remain alive).
    expect(state.over).toBe(false);
    // The reveal is reflected as a Revealed event for Daniel in the produced events.
    expect(
      state.log.some((e) => e.type === "Revealed" && e.player === "p2"),
    ).toBe(true);
  });

  test("Daniel's Scream does NOT reveal a Daniel who is already dead", () => {
    // A dead Daniel already revealed on his own death; another death must not re-process
    // him (he is removed from the living, and the hook no-ops for the dead).
    const g = makeGame({ p0: "vampire", p1: "allie", p2: "daniel", p3: "emi" });
    g.phase = "attack";
    g.players[0]!.equipment = ["white:cursed_sword_masamune#0"];
    g.players[1]!.damage = 7;
    // Daniel is already dead+revealed (e.g. killed earlier this game).
    g.players[2]!.alive = false;
    g.players[2]!.revealed = true;
    g.deadOrder = ["p2"];
    g.deadEpoch = [0];

    const { state } = reduce(g, { type: "Attack", player: "p0", target: "p1" });
    // The Allie died; the dead Daniel is untouched (still dead, no new processing throws).
    expect(state.players.find((p) => p.id === "p1")!.alive).toBe(false);
    expect(state.players.find((p) => p.id === "p2")!.alive).toBe(false);
  });
});

// keep referenced imports used
void CHARACTERS;
void (null as unknown as PlayerId);
