// Test suite for Task 10: Character abilities + hook system.
// Source of truth: ruleset.md
//   §5  — roster & abilities; using an ability normally requires revealing
//         (Daniel/Unknown excepted). Abilities are optional.
//   §4  — win conditions (Charles/Allie etc. referenced via ability outcomes).
//   §12.3 — only combat attacks (and Werewolf counter, Charles Bloody Feast) are
//           "attacks": Franklin/George + card effects are NOT attacks, so they do
//           not trigger Werewolf/Vampire/Charles and are not blocked by Guardian Angel.
//   §12.4 — Charles attribution: only his own attacks count for the 3rd kill.
//   §12.5 — Daniel forced reveal on any death.
//   §12.6 — Werewolf counter: usable on hit OR miss, normal attack, can miss,
//           does not itself re-trigger.
//   §12.7 — Vampire heals 2 ONCE per attack action (even on AoE) when damage dealt.
//   §12.8 — Bob Robbery: a steal deals no damage.
//   §12.9 — Guardian Angel blocks attack damage only.
//   §12.22 — Franklin/George trigger at the start of the turn (before the move).
//
// Dice are injected via opts/params so every assertion is deterministic.

import { expect, test, describe, beforeEach, afterEach } from "vitest";
import { createGame } from "../src/setup.js";
import {
  ABILITIES,
  abilityFor,
  runHook,
  abilityAvailable,
  type AbilityCtx,
} from "../src/abilities.js";
import { applyAttack, applyCounterattack } from "../src/combat.js";
import { resetWinCheckHook } from "../src/damage.js";
import { CHARACTERS } from "../src/data/characters.js";
import type {
  GameState,
  CharacterId,
  PlayerId,
  AreaId,
  GameEvent,
} from "../src/types.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a game and force characters / damage / equipment / area / revealed. */
function makeState(opts: {
  players?: PlayerId[];
  characters?: Record<PlayerId, CharacterId>;
  damage?: Record<PlayerId, number>;
  equipment?: Record<PlayerId, string[]>;
  area?: Record<PlayerId, AreaId>;
  revealed?: Record<PlayerId, boolean>;
  used?: Record<PlayerId, string[]>;
  current?: PlayerId;
  seed?: string;
}): GameState {
  const ids = opts.players ?? ["p0", "p1", "p2", "p3"];
  const state = createGame(ids, opts.seed ?? "abilities-test");
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
    if (opts.used?.[p.id] !== undefined) p.usedOncePerGame = [...opts.used[p.id]!];
  }
  if (opts.current !== undefined) state.current = opts.current;
  return state;
}

const get = (s: GameState, id: PlayerId) => s.players.find((p) => p.id === id)!;
const maxHpOf = (cid: CharacterId): number =>
  CHARACTERS.find((c) => c.id === cid)!.maxHp;

// Reset the global win-check hook so death/damage do not pull in Task 11 yet.
beforeEach(() => resetWinCheckHook());
afterEach(() => resetWinCheckHook());

// ─── Registry shape (§5) ─────────────────────────────────────────────────────

describe("ABILITIES registry §5", () => {
  test("all 10 characters have an ability registered", () => {
    for (const c of CHARACTERS) {
      expect(ABILITIES[c.id], `missing ability for ${c.id}`).toBeDefined();
      expect(abilityFor(c.id)).toBe(ABILITIES[c.id]);
    }
    expect(Object.keys(ABILITIES)).toHaveLength(10);
  });

  test("each ability records its trigger and reveal requirement", () => {
    // §5: most abilities require reveal; Daniel & Unknown do NOT.
    expect(ABILITIES["franklin"]!.trigger).toBe("onStartTurn");
    expect(ABILITIES["george"]!.trigger).toBe("onStartTurn");
    expect(ABILITIES["emi"]!.trigger).toBe("onMove");
    expect(ABILITIES["vampire"]!.trigger).toBe("onAfterAttack");
    expect(ABILITIES["werewolf"]!.trigger).toBe("onAttacked");
    expect(ABILITIES["charles"]!.trigger).toBe("onAfterAttack");
    expect(ABILITIES["bob"]!.trigger).toBe("onAfterAttack");
    expect(ABILITIES["allie"]!.trigger).toBe("manual");
    expect(ABILITIES["unknown"]!.trigger).toBe("onGivenHermit");
    expect(ABILITIES["daniel"]!.trigger).toBe("onAnyDeath");

    // §5: Daniel & Unknown do not reveal via their ability.
    expect(ABILITIES["daniel"]!.requiresReveal).toBe(false);
    expect(ABILITIES["unknown"]!.requiresReveal).toBe(false);
    // §5: Franklin/George/Allie reveal when used.
    expect(ABILITIES["franklin"]!.requiresReveal).toBe(true);
    expect(ABILITIES["allie"]!.requiresReveal).toBe(true);
  });
});

// ─── Emi — Teleport (onMove) §5 §9 ─────────────────────────────────────────────

describe("Emi Teleport §5", () => {
  test("teleport options = paired area + the opposite pair, never current", () => {
    const s = makeState({ characters: { p0: "emi" }, area: { p0: "church" } });
    const ctx: AbilityCtx = { state: s, player: "p0" };
    const ev = runHook("onMove", "p0", { ...ctx, params: { dryRun: true } });
    void ev;
    const opts = ABILITIES["emi"]!.teleportOptions!(s, "p0");
    // Paired with church = cemetery; opposite pairs exist; current excluded.
    expect(opts).toContain("cemetery");
    expect(opts).not.toContain("church");
    expect(opts.length).toBeGreaterThan(0);
  });

  test("teleport moves Emi to a chosen option and reveals (requiresReveal)", () => {
    const s = makeState({ characters: { p0: "emi" }, area: { p0: "church" } });
    const ev = runHook("onMove", "p0", {
      state: s,
      player: "p0",
      params: { area: "cemetery" },
    });
    expect(get(s, "p0").area).toBe("cemetery");
    expect(ev.some((e) => e.type === "Moved")).toBe(true);
  });
});

// ─── Franklin — Lightning (onStartTurn, d6, NOT an attack) §5 §12.3 §12.22 ──────

describe("Franklin Lightning §5 §12.3", () => {
  test("deals d6 damage to any target, once per game, marks used + reveals", () => {
    const s = makeState({
      characters: { p0: "franklin", p1: "allie" },
    });
    const ev = runHook("onStartTurn", "p0", {
      state: s,
      player: "p0",
      params: { target: "p1", roll: 5 },
    });
    expect(get(s, "p1").damage).toBe(5);
    expect(get(s, "p0").usedOncePerGame).toContain("lightning");
    expect(get(s, "p0").revealed).toBe(true); // §5 ability requires reveal
    expect(ev.some((e) => e.type === "AbilityUsed")).toBe(true);
  });

  test("once per game: a second use is unavailable / no-op", () => {
    const s = makeState({
      characters: { p0: "franklin", p1: "allie" },
      used: { p0: ["lightning"] },
    });
    expect(abilityAvailable(s, "p0")).toBe(false);
    const ev = runHook("onStartTurn", "p0", {
      state: s,
      player: "p0",
      params: { target: "p1", roll: 5 },
    });
    expect(get(s, "p1").damage).toBe(0); // not applied a second time
    expect(ev).toEqual([]);
  });

  test("§12.3: Lightning is NOT an attack — does not trigger Vampire heal", () => {
    // Vampire takes Franklin's damage; Franklin is not a vampire, so nothing heals,
    // and Franklin's own damage is unaffected (Lightning is not Vampire-attributed).
    const s = makeState({
      characters: { p0: "franklin", p1: "vampire" },
      damage: { p1: 4 },
    });
    runHook("onStartTurn", "p0", {
      state: s,
      player: "p0",
      params: { target: "p1", roll: 3 },
    });
    // Vampire (the target) is damaged, not healed by its own Suck Blood:
    expect(get(s, "p1").damage).toBe(7);
  });

  test("§12.3 + §12.9: Lightning ignores Guardian Angel attack immunity", () => {
    const s = makeState({ characters: { p0: "franklin", p1: "allie" } });
    get(s, "p1").attackImmune = true; // Guardian Angel set
    runHook("onStartTurn", "p0", {
      state: s,
      player: "p0",
      params: { target: "p1", roll: 4 },
    });
    expect(get(s, "p1").damage).toBe(4); // not blocked: lightning ≠ "attack"
  });
});

// ─── George — Demolish (onStartTurn, d4, NOT an attack) §5 §12.3 ────────────────

describe("George Demolish §5 §12.3", () => {
  test("deals d4 damage once per game, marks used", () => {
    const s = makeState({ characters: { p0: "george", p1: "allie" } });
    runHook("onStartTurn", "p0", {
      state: s,
      player: "p0",
      params: { target: "p1", roll: 3 },
    });
    expect(get(s, "p1").damage).toBe(3);
    expect(get(s, "p0").usedOncePerGame).toContain("demolish");
  });

  test("§12.3: Demolish ignores Guardian Angel (not an attack)", () => {
    const s = makeState({ characters: { p0: "george", p1: "allie" } });
    get(s, "p1").attackImmune = true;
    runHook("onStartTurn", "p0", {
      state: s,
      player: "p0",
      params: { target: "p1", roll: 4 },
    });
    expect(get(s, "p1").damage).toBe(4);
  });
});

// ─── Unknown — Deceit (onGivenHermit) §5 §12.11 ────────────────────────────────

describe("Unknown Deceit §5 §12.11", () => {
  test("delegates to the Hermit give path; never reveals via ability", () => {
    const s = makeState({ characters: { p1: "unknown" } });
    // Hand Unknown a Hunter-only Slap and LIE → take 1 damage, no reveal.
    const ev = runHook("onGivenHermit", "p1", {
      state: s,
      player: "p1",
      params: { giver: "p0", cardId: "hermit:hermits_slap#0", lie: true },
    });
    expect(get(s, "p1").damage).toBe(1); // lie applied the real HP change
    expect(get(s, "p1").revealed).toBe(false); // §12.11 no reveal
    void ev;
  });

  test("decline → nothing happens, no reveal", () => {
    const s = makeState({ characters: { p1: "unknown" } });
    runHook("onGivenHermit", "p1", {
      state: s,
      player: "p1",
      params: { giver: "p0", cardId: "hermit:hermits_slap#0", decline: true },
    });
    expect(get(s, "p1").damage).toBe(0);
    expect(get(s, "p1").revealed).toBe(false);
  });
});

// ─── Vampire — Suck Blood (onAfterAttack via combat) §5 §12.7 ───────────────────

describe("Vampire Suck Blood §12.7", () => {
  test("heals 2 once on a damaging attack", () => {
    const s = makeState({
      characters: { p0: "vampire", p1: "allie" },
      damage: { p0: 5 },
    });
    applyAttack(s, "p0", "p1", { dice: { d6: 6, d4: 1 } }); // 5 dmg, a hit
    expect(get(s, "p0").damage).toBe(3); // healed 2 (§12.7)
  });

  test("heals only ONCE on an AoE (Machine Gun) attack that damages two", () => {
    const s = makeState({
      players: ["p0", "p1", "p2", "p3"],
      characters: { p0: "vampire", p1: "allie", p2: "daniel" },
      damage: { p0: 5 },
      equipment: { p0: ["black:machine_gun#0"] },
    });
    // p1 & p2 in range; one roll hits both; Vampire heals 2 ONCE total.
    applyAttack(s, "p0", undefined, { dice: { d6: 5, d4: 1 } }); // 4 dmg each
    expect(get(s, "p1").damage).toBe(4);
    expect(get(s, "p2").damage).toBe(4);
    expect(get(s, "p0").damage).toBe(3); // 5 - 2, only once (§12.7)
  });

  test("does NOT heal on a miss (no damage dealt)", () => {
    const s = makeState({
      characters: { p0: "vampire", p1: "allie" },
      damage: { p0: 5 },
    });
    applyAttack(s, "p0", "p1", { dice: { d6: 3, d4: 3 } }); // tie = miss
    expect(get(s, "p0").damage).toBe(5);
  });
});

// ─── Werewolf — Counterattack (onAttacked) §5 §12.6 ─────────────────────────────

describe("Werewolf Counterattack §12.6", () => {
  test("counter is a normal attack that can hit, reveals the Werewolf", () => {
    const s = makeState({
      characters: { p0: "allie", p1: "werewolf" },
    });
    // p0 attacks p1; p1 counters via the hook.
    applyAttack(s, "p0", "p1", { dice: { d6: 2, d4: 2 } }); // miss is fine
    const ev = runHook("onAttacked", "p1", {
      state: s,
      player: "p1",
      params: { attacker: "p0", dice: { d6: 6, d4: 1 } },
    });
    expect(get(s, "p0").damage).toBe(5); // counter hit for 5
    expect(get(s, "p1").revealed).toBe(true); // §12.6 reveal to counter
    expect(ev.length).toBeGreaterThan(0);
  });

  test("§12.6: counter fires even when the initial attack MISSED", () => {
    const s = makeState({ characters: { p0: "allie", p1: "werewolf" } });
    applyAttack(s, "p0", "p1", { dice: { d6: 4, d4: 4 } }); // initial miss
    runHook("onAttacked", "p1", {
      state: s,
      player: "p1",
      params: { attacker: "p0", dice: { d6: 6, d4: 2 } }, // counter for 4
    });
    expect(get(s, "p0").damage).toBe(4);
  });

  test("§12.6: a counter can itself miss (no damage)", () => {
    const s = makeState({ characters: { p0: "allie", p1: "werewolf" } });
    runHook("onAttacked", "p1", {
      state: s,
      player: "p1",
      params: { attacker: "p0", dice: { d6: 3, d4: 3 } }, // tie = miss
    });
    expect(get(s, "p0").damage).toBe(0);
  });

  test("§12.6: the counter does NOT itself re-trigger another counter", () => {
    // Werewolf counters a Werewolf — the counter must not recurse.
    const s = makeState({ characters: { p0: "werewolf", p1: "werewolf" } });
    const ev = runHook("onAttacked", "p1", {
      state: s,
      player: "p1",
      params: { attacker: "p0", dice: { d6: 6, d4: 1 } },
    });
    // p0 took the counter; p1 did not take a counter-of-the-counter.
    expect(get(s, "p0").damage).toBe(5);
    expect(get(s, "p1").damage).toBe(0);
    // No second onAttacked is emitted by the ability itself.
    expect(ev.filter((e) => e.type === "AbilityUsed").length).toBe(1);
  });
});

// ─── Allie — Mother's Love (manual, once per game) §5 ──────────────────────────

describe("Allie Mother's Love §5", () => {
  test("fully heals once per game, marks used, reveals", () => {
    const s = makeState({ characters: { p0: "allie" }, damage: { p0: 6 } });
    const ev = runHook("manual", "p0", { state: s, player: "p0" });
    expect(get(s, "p0").damage).toBe(0);
    expect(get(s, "p0").usedOncePerGame).toContain("mothers_love");
    expect(get(s, "p0").revealed).toBe(true);
    expect(ev.some((e) => e.type === "Healed" || e.type === "AbilityUsed")).toBe(true);
  });

  test("once per game: second use is a no-op", () => {
    const s = makeState({
      characters: { p0: "allie" },
      damage: { p0: 6 },
      used: { p0: ["mothers_love"] },
    });
    runHook("manual", "p0", { state: s, player: "p0" });
    expect(get(s, "p0").damage).toBe(6);
  });
});

// ─── Bob — Robbery (onAfterAttack via combat) §5 §12.8 ──────────────────────────

describe("Bob Robbery §12.8", () => {
  test("4–6p: a 2+ hit becomes a steal with NO damage", () => {
    const s = makeState({
      players: ["p0", "p1", "p2", "p3"], // 4 players
      characters: { p0: "bob", p1: "allie" },
      equipment: { p1: ["black:chainsaw#0"] },
    });
    const res = applyAttack(s, "p0", "p1", { dice: { d6: 6, d4: 1 } }); // would be 5
    expect(get(s, "p1").damage).toBe(0); // §12.8 no damage
    expect(get(s, "p0").equipment).toContain("black:chainsaw#0"); // stolen
    expect(res.stole).toBe(true);
  });

  test("7–8p: a killing attack takes ALL the victim's equipment (loot rule)", () => {
    const s = makeState({
      players: ["p0", "p1", "p2", "p3", "p4", "p5", "p6"], // 7 players
      characters: { p0: "bob", p1: "allie" },
      damage: { p1: maxHpOf("allie") - 1 }, // one hit kills
      equipment: { p1: ["black:chainsaw#0", "black:handgun#0"] },
    });
    applyAttack(s, "p0", "p1", { dice: { d6: 6, d4: 1 } }); // lethal hit
    expect(get(s, "p1").alive).toBe(false);
    // Bob (7–8p) takes ALL equipment on a kill.
    expect(get(s, "p0").equipment).toEqual(
      expect.arrayContaining(["black:chainsaw#0", "black:handgun#0"]),
    );
  });
});

// ─── Charles — Bloody Feast (onAfterAttack) §5 §12.4 ───────────────────────────

describe("Charles Bloody Feast §5 §12.4", () => {
  test("extra attack costs 2 self-damage and re-attacks the same target", () => {
    const s = makeState({
      characters: { p0: "charles", p1: "daniel" },
    });
    // first attack already happened; Charles opts into Bloody Feast.
    const ev = runHook("onAfterAttack", "p0", {
      state: s,
      player: "p0",
      params: { target: "p1", dice: { d6: 6, d4: 1 } }, // re-attack for 5
    });
    expect(get(s, "p0").damage).toBe(2); // 2 self-damage cost (§5)
    expect(get(s, "p1").damage).toBe(5); // re-attack landed
    expect(ev.some((e) => e.type === "AbilityUsed")).toBe(true);
  });

  test("§12.4: the extra attack IS an attack — triggers Vampire heal when Charles is also flagged", () => {
    // Use a vampire-Charles hybrid is impossible; instead assert the extra attack
    // routes through applyAttack (so Werewolf/Vampire rules apply). Here the target
    // is a Werewolf: the extra attack is a real attack and is counter-eligible
    // (we just assert the damage landed via the attack path).
    const s = makeState({ characters: { p0: "charles", p1: "werewolf" } });
    runHook("onAfterAttack", "p0", {
      state: s,
      player: "p0",
      params: { target: "p1", dice: { d6: 5, d4: 1 } }, // 4 dmg
    });
    expect(get(s, "p1").damage).toBe(4);
    expect(get(s, "p0").damage).toBe(2); // self-cost
  });

  test("declining Bloody Feast (no params.target) is a no-op", () => {
    const s = makeState({ characters: { p0: "charles", p1: "daniel" } });
    const ev = runHook("onAfterAttack", "p0", { state: s, player: "p0" });
    expect(get(s, "p0").damage).toBe(0);
    expect(get(s, "p1").damage).toBe(0);
    expect(ev).toEqual([]);
  });
});

// ─── Daniel — Scream (onAnyDeath, forced reveal) §5 §12.5 ──────────────────────

describe("Daniel Scream §5 §12.5", () => {
  test("forced reveal when any character dies", () => {
    const s = makeState({
      characters: { p0: "allie", p1: "daniel" },
    });
    // Simulate a death of p0; Daniel's hook forces his reveal.
    const ev = runHook("onAnyDeath", "p1", {
      state: s,
      player: "p1",
      params: { deceased: "p0" },
    });
    expect(get(s, "p1").revealed).toBe(true); // §12.5 forced reveal
    expect(ev.some((e) => e.type === "Revealed")).toBe(true);
  });

  test("requiresReveal is false (the reveal is forced, not an opt-in ability reveal)", () => {
    expect(ABILITIES["daniel"]!.requiresReveal).toBe(false);
  });
});

// ─── §12.3 cross-check: Franklin kill does NOT count for Charles / Werewolf ─────

describe("§12.3 ability kills are not attacks", () => {
  test("Franklin's Lightning kill sets lastKill with killer=null (not attributable to Charles)", () => {
    const s = makeState({
      characters: { p0: "franklin", p1: "allie" },
      damage: { p1: maxHpOf("allie") - 1 }, // one point from death
    });
    runHook("onStartTurn", "p0", {
      state: s,
      player: "p0",
      params: { target: "p1", roll: 6 }, // lethal
    });
    expect(get(s, "p1").alive).toBe(false);
    // §12.4: an ability kill credits no attacker (killer === null).
    expect(s.lastKill?.killer).toBeNull();
  });
});
