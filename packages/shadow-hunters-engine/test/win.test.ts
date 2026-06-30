// Test suite for Task 11: Win conditions + cadence.
// Source of truth: ruleset.md
//   §2  — the game ends the INSTANT any win condition is met; multiple players may win.
//   §4  — faction wins (Hunters: all Shadows dead; Shadows: all Hunters dead — NO
//         Neutral-count clause in v1); a faction member wins even if they died earlier.
//   §4  — Neutral conditions: Allie (alive at game end), Bob (>=5 equipment),
//         Charles (lands the kill bringing total dead to >=3), Daniel (first to die
//         OR alive when Hunters win).
//   §12.1 — win-check cadence: re-evaluate ALL win conditions after every
//           damage/death/reveal; a card/ability kill can end the game mid-turn.
//   §12.2 — simultaneous deaths from one effect → win-check once → ALL satisfied win.
//   §12.4 — Charles attribution: only his OWN attacks (incl. Bloody Feast) count for
//           the 3rd kill; ability/card kills do NOT count.
//   §12.5 — Daniel timing: "first to die" = died when prior dead count was 0; "survive
//           while Hunters win" requires Daniel alive at the win-check.
//
// evaluateWinners is a pure query; maybeEndGame mutates winners/over and pushes GameWon.

import { expect, test, describe, beforeEach, afterEach } from "vitest";
import { createGame } from "../src/setup.js";
import { evaluateWinners, maybeEndGame } from "../src/win.js";
import { applyAttack } from "../src/combat.js";
import { applyDamage, resetWinCheckHook, setWinCheckHook } from "../src/damage.js";
import { playCard as playBlack } from "../src/cards/black.js";
import { playCard as playWhite } from "../src/cards/white.js";
import type {
  GameState,
  CharacterId,
  PlayerId,
  AreaId,
} from "../src/types.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a game and force characters / damage / equipment / area / revealed / alive. */
function makeState(opts: {
  players?: PlayerId[];
  characters?: Record<PlayerId, CharacterId>;
  damage?: Record<PlayerId, number>;
  equipment?: Record<PlayerId, string[]>;
  area?: Record<PlayerId, AreaId>;
  revealed?: Record<PlayerId, boolean>;
  alive?: Record<PlayerId, boolean>;
  seed?: string;
}): GameState {
  const ids = opts.players ?? ["p0", "p1", "p2", "p3"];
  const state = createGame(ids, opts.seed ?? "win-test");
  // Fix a deterministic board: church ↔ cemetery so test players are in range.
  state.areas = [
    "church",
    "cemetery",
    "hermits_cabin",
    "underworld_gate",
    "weird_woods",
    "erstwhile_altar",
  ];
  state.pairing = {
    church: "cemetery",
    cemetery: "church",
    hermits_cabin: "underworld_gate",
    underworld_gate: "hermits_cabin",
    weird_woods: "erstwhile_altar",
    erstwhile_altar: "weird_woods",
  };
  for (const p of state.players) {
    p.area = "church";
    if (opts.characters?.[p.id] !== undefined) p.characterId = opts.characters[p.id]!;
    if (opts.damage?.[p.id] !== undefined) p.damage = opts.damage[p.id]!;
    if (opts.equipment?.[p.id] !== undefined) p.equipment = [...opts.equipment[p.id]!];
    if (opts.area?.[p.id] !== undefined) p.area = opts.area[p.id]!;
    if (opts.revealed?.[p.id] !== undefined) p.revealed = opts.revealed[p.id]!;
    if (opts.alive?.[p.id] !== undefined) p.alive = opts.alive[p.id]!;
  }
  return state;
}

const get = (s: GameState, id: PlayerId) => s.players.find((p) => p.id === id)!;

// Reset the global win-check hook so combat/damage do not also fire maybeEndGame
// unless a test explicitly installs it.
beforeEach(() => resetWinCheckHook());
afterEach(() => resetWinCheckHook());

// ─── Faction wins (§4) ─────────────────────────────────────────────────────────

describe("faction wins (§4)", () => {
  test("Hunters win when all Shadows are dead (no Neutral-count clause)", () => {
    // p0,p1 Hunters; p2,p3 Shadows. Kill both Shadows.
    const s = makeState({
      characters: { p0: "emi", p1: "franklin", p2: "unknown", p3: "vampire" },
      alive: { p2: false, p3: false },
    });
    const winners = evaluateWinners(s);
    expect(winners.sort()).toEqual(["p0", "p1"]);
  });

  test("Shadows win when all Hunters are dead", () => {
    const s = makeState({
      characters: { p0: "emi", p1: "franklin", p2: "unknown", p3: "vampire" },
      alive: { p0: false, p1: false },
    });
    const winners = evaluateWinners(s);
    expect(winners.sort()).toEqual(["p2", "p3"]);
  });

  test("no faction win while one Shadow and one Hunter still live", () => {
    const s = makeState({
      characters: { p0: "emi", p1: "franklin", p2: "unknown", p3: "vampire" },
      alive: { p1: false, p3: false }, // one of each side still alive
    });
    expect(evaluateWinners(s)).toEqual([]);
  });

  test("a faction member wins even if they died earlier (§4/§11)", () => {
    // Both Shadows dead → Hunters win; one Hunter (p1) is also dead but still wins.
    const s = makeState({
      characters: { p0: "emi", p1: "franklin", p2: "unknown", p3: "vampire" },
      alive: { p1: false, p2: false, p3: false },
    });
    const winners = evaluateWinners(s);
    expect(winners).toContain("p1"); // dead Hunter still wins
    expect(winners.sort()).toEqual(["p0", "p1"]);
  });
});

// ─── Allie: alive when the game ends (§4) ───────────────────────────────────────

describe("Allie — alive when the game ends (§4)", () => {
  test("Allie wins (simultaneously with the faction) when alive at game end", () => {
    // p0,p1 Hunters; p2,p3 Shadows (both dead → Hunters win); p4 Allie alive.
    const s = makeState({
      players: ["p0", "p1", "p2", "p3", "p4"],
      characters: { p0: "emi", p1: "franklin", p2: "unknown", p3: "vampire", p4: "allie" },
      alive: { p2: false, p3: false },
    });
    const winners = evaluateWinners(s);
    expect(winners.sort()).toEqual(["p0", "p1", "p4"]);
  });

  test("Allie does NOT win if dead when the game ends", () => {
    const s = makeState({
      players: ["p0", "p1", "p2", "p3", "p4"],
      characters: { p0: "emi", p1: "franklin", p2: "unknown", p3: "vampire", p4: "allie" },
      alive: { p2: false, p3: false, p4: false },
    });
    const winners = evaluateWinners(s);
    expect(winners).not.toContain("p4");
    expect(winners.sort()).toEqual(["p0", "p1"]);
  });

  test("Allie alone (no terminal condition) does not end the game", () => {
    // Allie alive but no faction/Neutral terminal trigger → game continues.
    const s = makeState({
      players: ["p0", "p1", "p2", "p3", "p4"],
      characters: { p0: "emi", p1: "franklin", p2: "unknown", p3: "vampire", p4: "allie" },
    });
    expect(evaluateWinners(s)).toEqual([]);
  });
});

// ─── Bob: 5+ equipment (§4) ──────────────────────────────────────────────────────

describe("Bob — possess 5+ equipment (§4)", () => {
  test("Bob wins with exactly 5 equipment", () => {
    const s = makeState({
      players: ["p0", "p1", "p2", "p3", "p4"],
      characters: { p0: "emi", p1: "franklin", p2: "unknown", p3: "vampire", p4: "bob" },
      equipment: {
        p4: [
          "white:holy_robe#0",
          "white:chainsaw#0",
          "white:handgun#0",
          "black:butcher_knife#0",
          "black:machine_gun#0",
        ],
      },
    });
    expect(evaluateWinners(s)).toContain("p4");
  });

  test("Bob does not win with 4 equipment", () => {
    const s = makeState({
      players: ["p0", "p1", "p2", "p3", "p4"],
      characters: { p0: "emi", p1: "franklin", p2: "unknown", p3: "vampire", p4: "bob" },
      equipment: {
        p4: [
          "white:holy_robe#0",
          "white:chainsaw#0",
          "white:handgun#0",
          "black:butcher_knife#0",
        ],
      },
    });
    expect(evaluateWinners(s)).toEqual([]);
  });
});

// ─── Charles: lands the kill bringing total dead to 3+ (§4, §12.4) ──────────────

describe("Charles — lands the 3rd kill via his own attack (§12.4)", () => {
  test("Charles wins when his own attack brings the dead count to 3", () => {
    // Two players already dead; Charles (p0) attacks p4 to deliver the 3rd kill.
    const s = makeState({
      players: ["p0", "p1", "p2", "p3", "p4"],
      characters: {
        p0: "charles",
        p1: "emi",
        p2: "franklin",
        p3: "unknown",
        p4: "vampire",
      },
      // p4 vampire maxHp 13; pre-damage to 11 so a 2-damage attack kills.
      damage: { p4: 11 },
      alive: { p1: false, p3: false }, // 2 already dead (deadOrder set below)
    });
    s.deadOrder = ["p1", "p3"];
    // Charles attacks p4; force dice for a 2-damage hit (|d6 6 - d4 4| = 2).
    applyAttack(s, "p0", "p4", { dice: { d6: 6, d4: 4 } });

    expect(get(s, "p4").alive).toBe(false);
    expect(s.deadOrder.length).toBe(3);
    expect(s.lastKill).toEqual({ killer: "p0", deadCountAfter: 3 });

    const winners = evaluateWinners(s);
    expect(winners).toContain("p0");
  });

  test("Charles does NOT win when an ability/card kill (not his attack) lands the 3rd", () => {
    // Two already dead; the 3rd kill is delivered by a card-source death (killer p0=Charles
    // is NOT credited because it is not an attack — applyDamage with source 'dynamite').
    const s = makeState({
      players: ["p0", "p1", "p2", "p3", "p4"],
      characters: {
        p0: "charles",
        p1: "emi",
        p2: "franklin",
        p3: "unknown",
        p4: "vampire",
      },
      damage: { p4: 11 },
      alive: { p1: false, p3: false },
    });
    s.deadOrder = ["p1", "p3"];
    // A card kill: killer is null (card/AoE death, §11), source is not "attack".
    applyDamage(s, "p4", 2, "dynamite", null);

    expect(get(s, "p4").alive).toBe(false);
    expect(s.deadOrder.length).toBe(3);
    // lastKill.killer is null (no attacker credited) → Charles does NOT win.
    expect(s.lastKill?.killer).toBeNull();
    expect(evaluateWinners(s)).not.toContain("p0");
  });

  test("a kill by Charles that does NOT reach 3 dead is not a Charles win", () => {
    const s = makeState({
      players: ["p0", "p1", "p2", "p3", "p4"],
      characters: {
        p0: "charles",
        p1: "emi",
        p2: "franklin",
        p3: "unknown",
        p4: "vampire",
      },
      damage: { p4: 11 },
      alive: { p1: false }, // only 1 already dead
    });
    s.deadOrder = ["p1"];
    applyAttack(s, "p0", "p4", { dice: { d6: 6, d4: 4 } });

    expect(s.deadOrder.length).toBe(2); // 2 dead, not 3
    expect(s.lastKill).toEqual({ killer: "p0", deadCountAfter: 2 });
    expect(evaluateWinners(s)).not.toContain("p0");
  });
});

// ─── Daniel (§4, §12.5) ─────────────────────────────────────────────────────────

describe("Daniel — first to die OR alive when Hunters win (§12.5)", () => {
  test("Daniel wins by being the first to die", () => {
    // Daniel (p4) is first in deadOrder.
    const s = makeState({
      players: ["p0", "p1", "p2", "p3", "p4"],
      characters: { p0: "emi", p1: "franklin", p2: "unknown", p3: "vampire", p4: "daniel" },
      alive: { p4: false },
    });
    s.deadOrder = ["p4"];
    expect(evaluateWinners(s)).toContain("p4");
  });

  test("Daniel does NOT win on first-to-die if another died first", () => {
    const s = makeState({
      players: ["p0", "p1", "p2", "p3", "p4"],
      characters: { p0: "emi", p1: "franklin", p2: "unknown", p3: "vampire", p4: "daniel" },
      alive: { p3: false, p4: false },
    });
    s.deadOrder = ["p3", "p4"]; // p3 died first, not Daniel
    // No faction win here (one Shadow p2 still alive), so Daniel has no win.
    expect(evaluateWinners(s)).not.toContain("p4");
  });

  test("Daniel wins by surviving while the Hunters win", () => {
    // Both Shadows dead → Hunters win; Daniel (p4) alive and did not die first.
    const s = makeState({
      players: ["p0", "p1", "p2", "p3", "p4"],
      characters: { p0: "emi", p1: "franklin", p2: "unknown", p3: "vampire", p4: "daniel" },
      alive: { p2: false, p3: false },
    });
    s.deadOrder = ["p2", "p3"]; // a Shadow died first, not Daniel
    const winners = evaluateWinners(s);
    expect(winners).toContain("p4"); // Daniel alive + Hunters won
    expect(winners.sort()).toEqual(["p0", "p1", "p4"]);
  });

  test("Daniel does NOT win when Shadows win and he merely survived", () => {
    // Both Hunters dead → Shadows win; Daniel alive but his survive-clause is
    // Hunters-specific, and he did not die first → no Daniel win.
    const s = makeState({
      players: ["p0", "p1", "p2", "p3", "p4"],
      characters: { p0: "emi", p1: "franklin", p2: "unknown", p3: "vampire", p4: "daniel" },
      alive: { p0: false, p1: false },
    });
    s.deadOrder = ["p0", "p1"]; // a Hunter died first
    const winners = evaluateWinners(s);
    expect(winners).not.toContain("p4");
    expect(winners.sort()).toEqual(["p2", "p3"]);
  });
});

// ─── Single-death satisfying two conditions (§12.1) ─────────────────────────────
// NOTE: this is the SINGLE-death/two-conditions case (one target, p3) — handled by the
// pure evaluateWinners. It is NOT the §12.2 multi-victim batch (that lives below).

describe("a single kill satisfying two conditions (§12.1)", () => {
  test("one kill on one target can satisfy two conditions → both win together", () => {
    // p0 (alive) + p1 (dead earlier) are Hunters; p2,p3 are Shadows; p4 is Charles.
    // Pre-state: p1 (Hunter) and p2 (Shadow) already dead → 2 dead.
    // Charles (p4) attacks the LAST Shadow p3, delivering the 3rd kill: this both
    // (a) leaves all Shadows dead → Hunters win, and (b) makes deadCountAfter=3 by
    // Charles's own attack → Charles wins. Both fire from one (single-target) event.
    const s = makeState({
      players: ["p0", "p1", "p2", "p3", "p4"],
      characters: {
        p0: "emi",
        p1: "franklin",
        p2: "unknown",
        p3: "vampire",
        p4: "charles",
      },
      damage: { p3: 11 }, // vampire maxHp 13 → a 2-damage attack kills
      alive: { p1: false, p2: false }, // a Hunter and a Shadow already dead
    });
    s.deadOrder = ["p2", "p1"]; // 2 already dead; Daniel not in play

    applyAttack(s, "p4", "p3", { dice: { d6: 6, d4: 4 } });
    expect(get(s, "p3").alive).toBe(false);
    expect(s.deadOrder.length).toBe(3);
    expect(s.lastKill).toEqual({ killer: "p4", deadCountAfter: 3 });

    const winners = evaluateWinners(s);
    // Hunters p0 (alive) + p1 (dead) win; Charles p4 wins; all Shadows dead.
    expect(winners.sort()).toEqual(["p0", "p1", "p4"]);
  });
});

// ─── §12.2: one effect kills MULTIPLE players SIMULTANEOUSLY ──────────────────────
// These drive the REAL AoE paths (Dynamite, Flare, Machine Gun) with the win-check hook
// wired (as the reducer wires it). The plan Step 1 calls for "a simultaneous double-kill
// that satisfies two conditions → both win" — i.e. ONE effect killing TWO players. The
// pre-fix code fired the per-death win-check after the FIRST death, ended the game, and
// short-circuited the AoE loop (`if (state.over) break`) so the SECOND victim never took
// its (simultaneous) damage — leaving it wrongly alive and a winner. Each test below is a
// REGRESSION GUARD: it FAILS on the unfixed wiring and passes only with §12.2 batching.

describe("simultaneous multi-death from one effect (§12.2)", () => {
  test("Dynamite killing the last Shadow AND Allie together → Allie is DEAD and does NOT win", () => {
    // p0,p1 Hunters; p2 the last alive Shadow; p4 Allie; p3 a Shadow already dead.
    // Dynamite hits the shared area, killing p2 (→ all Shadows dead → Hunters win) AND
    // Allie together. §12.2: the deaths are simultaneous, so Allie must NOT be alive at
    // the single win-check — she dies and LOSES. (Pre-fix: the p2 death ended the game
    // before Allie's damage applied, so Allie stayed alive and wrongly won.)
    const s = makeState({
      players: ["p0", "p1", "p2", "p3", "p4"],
      characters: { p0: "emi", p1: "franklin", p2: "unknown", p3: "vampire", p4: "allie" },
      damage: { p2: 9, p4: 6 }, // unknown maxHp 11, allie maxHp 8 → 3 dmg kills both
      alive: { p3: false }, // one Shadow already dead
    });
    s.deadOrder = ["p3"];
    s.deadEpoch = [0];
    setWinCheckHook(maybeEndGame);

    // Dynamite: dice total 6 → church (everyone's area in makeState). Caster p0.
    playBlack(s, "p0", "black:dynamite#0", { dice: { d6: 3, d4: 3 }, target: "p0" });

    expect(get(s, "p2").alive).toBe(false); // last Shadow dead → Hunters win
    expect(get(s, "p4").alive).toBe(false); // §12.2: Allie died SIMULTANEOUSLY
    expect(s.over).toBe(true);
    expect(s.winners).not.toContain("p4"); // dead Allie does NOT win
    expect(s.winners.sort()).toEqual(["p0", "p1"]); // only the Hunters
  });

  test("Flare double-kill: last Shadow + a Charles-3rd-kill victim — Hunters win, NOT a dead-Allie-style survivor", () => {
    // Flare (every OTHER character takes 2) is fired by Charles. It kills BOTH the last
    // Shadow (→ Hunters win) and Allie together. §12.2: one effect, one win-check; Allie
    // is dead → loses. Flare is a CARD (not an attack), so it credits no Charles kill.
    const s = makeState({
      players: ["p0", "p1", "p2", "p3", "p4"],
      characters: { p0: "emi", p1: "franklin", p2: "unknown", p3: "vampire", p4: "allie" },
      damage: { p2: 10, p4: 7 }, // unknown maxHp 11, allie maxHp 8 → 2 dmg kills both
      alive: { p3: false },
    });
    s.deadOrder = ["p3"];
    s.deadEpoch = [0];
    setWinCheckHook(maybeEndGame);

    // p1 (Hunter, Franklin) casts Flare; every other character takes 2.
    playWhite(s, "p1", "white:flare_of_judgement#0");

    expect(get(s, "p2").alive).toBe(false); // last Shadow dead
    expect(get(s, "p4").alive).toBe(false); // §12.2: Allie died simultaneously
    expect(s.over).toBe(true);
    expect(s.winners).not.toContain("p4");
    expect(s.winners.sort()).toEqual(["p0", "p1"]); // Hunters only
  });

  test("Daniel co-first: dies in the SAME one-effect batch as the game's first death → first-to-die win (§12.5)", () => {
    // No prior deaths. Dynamite is the game's FIRST death event and kills TWO players at
    // once: a Shadow (p2) and Daniel (p4). Daniel is the 2nd-processed victim of the one
    // effect, so pre-fix he landed at deadOrder[1] and was denied first-to-die. §12.2 +
    // §12.5: both die simultaneously in the first death epoch → Daniel is CO-FIRST and wins.
    const s = makeState({
      players: ["p0", "p1", "p2", "p3", "p4"],
      characters: { p0: "emi", p1: "franklin", p2: "unknown", p3: "vampire", p4: "daniel" },
      damage: { p2: 9, p4: 11 }, // unknown maxHp 11, daniel maxHp 13 → 3 dmg kills both
      // p3 (the other Shadow) is OUT of the blast so the game does NOT end on a faction win;
      // Daniel's win must come from first-to-die alone.
      area: { p3: "weird_woods" },
    });
    setWinCheckHook(maybeEndGame);

    playBlack(s, "p0", "black:dynamite#0", { dice: { d6: 3, d4: 3 }, target: "p0" });

    expect(get(s, "p2").alive).toBe(false);
    expect(get(s, "p4").alive).toBe(false);
    // Daniel is the 2nd entry in deadOrder but shares the first death epoch with p2.
    expect(s.deadOrder.indexOf("p4")).toBeGreaterThan(0);
    const idx = s.deadOrder.indexOf("p4");
    expect(s.deadEpoch[idx]).toBe(s.deadEpoch[0]); // same (first) epoch → co-first
    expect(s.winners).toContain("p4"); // §12.5 co-first: Daniel wins first-to-die
  });

  test("a one-effect batch checks win ONCE: a single GameWon is emitted for a double-kill", () => {
    // The batch must collapse to ONE win-check (and one GameWon) even though two deaths
    // occur, per §12.2 ("win conditions are checked once").
    const s = makeState({
      players: ["p0", "p1", "p2", "p3", "p4"],
      characters: { p0: "emi", p1: "franklin", p2: "unknown", p3: "vampire", p4: "allie" },
      damage: { p2: 9, p4: 6 },
      alive: { p3: false },
    });
    s.deadOrder = ["p3"];
    s.deadEpoch = [0];
    setWinCheckHook(maybeEndGame);

    playBlack(s, "p0", "black:dynamite#0", { dice: { d6: 3, d4: 3 }, target: "p0" });

    expect(s.log.filter((e) => e.type === "GameWon").length).toBe(1);
  });
});

// ─── maybeEndGame: wiring (§2, §12.1) ───────────────────────────────────────────

describe("maybeEndGame — sets winners/over and pushes GameWon", () => {
  test("sets winners + over and emits GameWon when a condition is met", () => {
    const s = makeState({
      characters: { p0: "emi", p1: "franklin", p2: "unknown", p3: "vampire" },
      alive: { p2: false, p3: false },
    });
    const events = maybeEndGame(s);
    expect(s.over).toBe(true);
    expect(s.winners.sort()).toEqual(["p0", "p1"]);
    expect(events).toEqual([{ type: "GameWon", winners: s.winners }]);
    // logged once
    expect(s.log.filter((e) => e.type === "GameWon").length).toBe(1);
  });

  test("no GameWon and over stays false when nothing is satisfied", () => {
    const s = makeState({
      characters: { p0: "emi", p1: "franklin", p2: "unknown", p3: "vampire" },
    });
    const events = maybeEndGame(s);
    expect(s.over).toBe(false);
    expect(s.winners).toEqual([]);
    expect(events).toEqual([]);
  });

  test("idempotent: a second call does not re-emit GameWon", () => {
    const s = makeState({
      characters: { p0: "emi", p1: "franklin", p2: "unknown", p3: "vampire" },
      alive: { p2: false, p3: false },
    });
    maybeEndGame(s);
    const again = maybeEndGame(s);
    expect(again).toEqual([]);
    expect(s.log.filter((e) => e.type === "GameWon").length).toBe(1);
  });

  test("when wired as the damage win-check hook, an attack-kill ends the game mid-step (§12.1)", () => {
    // Install maybeEndGame as the hook; the lethal attack should end the game.
    const s = makeState({
      characters: { p0: "emi", p1: "franklin", p2: "unknown", p3: "vampire" },
      damage: { p2: 9, p3: 11 }, // unknown maxHp 11 → 2 dmg kills; vampire 13 already low
      alive: { p3: false }, // one Shadow already dead
    });
    s.deadOrder = ["p3"];
    setWinCheckHook(maybeEndGame);
    // Hunter p0 attacks the last Shadow p2 (2 dmg → dead → all Shadows dead → Hunters win).
    applyAttack(s, "p0", "p2", { dice: { d6: 6, d4: 4 } });
    expect(s.over).toBe(true);
    expect(s.winners.sort()).toEqual(["p0", "p1"]);
  });
});
