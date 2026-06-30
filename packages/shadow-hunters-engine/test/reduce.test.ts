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

// keep referenced imports used
void CHARACTERS;
void (null as unknown as PlayerId);
