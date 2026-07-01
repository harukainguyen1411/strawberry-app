// Test suite for Task 6: Combat + equipment modifiers.
// Source of truth: ruleset.md
//   §10 — range (current area + its pair), damage = |d6−d4|, tie = miss,
//         multi-target rolls once, equipment modifiers stack.
//   §11 — death/loot (one equipment per victim on a multi-kill, §11 FAQ).
//   §6  — Chainsaw/Butcher/Axe +1; Holy Robe ±1; Spear +2 (Hunter reveal, hit);
//         Handgun range; Machine Gun single-roll-to-all; Masamune d4-only never-miss.
//   §12.3 — only combat attacks are "attacks" (Vampire/Werewolf gate on this).
//   §12.6 — Werewolf counter is a separate action; normal attack; can miss; no re-trigger.
//   §12.7 — Vampire heals 2 once per attack action (even on AoE) when it dealt damage.
//   §12.8 — Bob Robbery (4–6p): a 2+ hit becomes a steal (no damage).
//   §12.14 — equipment active at declaration; kill-transfers affect only later attacks.
//
// Dice are injected via opts.dice so every assertion is deterministic
// (production omits opts and rolls from state.rng).

import { expect, test, describe } from "vitest";
import { createGame } from "../src/setup.js";
import {
  attackTargetsInRange,
  computeDamage,
  applyAttack,
  applyCounterattack,
} from "../src/combat.js";
import { CHARACTERS } from "../src/data/characters.js";
import type { GameState, CharacterId, PlayerId, AreaId } from "../src/types.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a game and force characters / damage / equipment / area / revealed. */
function makeState(opts: {
  players?: PlayerId[];
  characters?: Record<PlayerId, CharacterId>;
  damage?: Record<PlayerId, number>;
  equipment?: Record<PlayerId, string[]>;
  area?: Record<PlayerId, AreaId>;
  revealed?: Record<PlayerId, boolean>;
  current?: PlayerId;
  seed?: string;
}): GameState {
  const ids = opts.players ?? ["p0", "p1", "p2", "p3"];
  const state = createGame(ids, opts.seed ?? "combat-test");
  for (const p of state.players) {
    if (opts.characters?.[p.id] !== undefined) p.characterId = opts.characters[p.id]!;
    if (opts.damage?.[p.id] !== undefined) p.damage = opts.damage[p.id]!;
    if (opts.equipment?.[p.id] !== undefined) p.equipment = [...opts.equipment[p.id]!];
    if (opts.area?.[p.id] !== undefined) p.area = opts.area[p.id]!;
    if (opts.revealed?.[p.id] !== undefined) p.revealed = opts.revealed[p.id]!;
  }
  if (opts.current !== undefined) state.current = opts.current;
  return state;
}

const maxHpOf = (cid: CharacterId): number =>
  CHARACTERS.find((c) => c.id === cid)!.maxHp;

/** Find the area paired with the given one in the (random) board layout. */
const pairOf = (s: GameState, a: AreaId): AreaId => s.pairing[a]!;

/** Find any third area that is neither `a` nor its pair (out of range). */
function outOfRangeArea(s: GameState, a: AreaId): AreaId {
  const pair = pairOf(s, a);
  return s.areas.find((x) => x !== a && x !== pair)!;
}

// ─── Range (§10) ───────────────────────────────────────────────────────────────

describe("attackTargetsInRange §10", () => {
  test("targets a player on the same area", () => {
    const here: AreaId = "church";
    const s = makeState({ area: { p0: here, p1: here } });
    expect(attackTargetsInRange(s, "p0")).toContain("p1");
  });

  test("targets a player on the paired area", () => {
    const here: AreaId = "church";
    const s = makeState({ area: { p0: here } });
    const paired = pairOf(s, here);
    s.players[1]!.area = paired;
    expect(attackTargetsInRange(s, "p0")).toContain("p1");
  });

  test("does NOT target a player out of range (different pair)", () => {
    const here: AreaId = "church";
    const s = makeState({ area: { p0: here } });
    s.players[1]!.area = outOfRangeArea(s, here);
    expect(attackTargetsInRange(s, "p0")).not.toContain("p1");
  });

  test("never targets self, dead players, or unplaced (null-area) players", () => {
    const here: AreaId = "church";
    const s = makeState({ area: { p0: here, p1: here, p2: here } });
    s.players[2]!.alive = false; // dead
    s.players[3]!.area = null; // unplaced
    const targets = attackTargetsInRange(s, "p0");
    expect(targets).not.toContain("p0");
    expect(targets).not.toContain("p2");
    expect(targets).not.toContain("p3");
    expect(targets).toContain("p1");
  });

  test("Handgun expands range to every area except the attacker's own pair (§6)", () => {
    const here: AreaId = "church";
    const s = makeState({
      area: { p0: here },
      equipment: { p0: ["black:handgun#0"] },
    });
    const pair = pairOf(s, here);
    const far = s.areas.filter((x) => x !== here && x !== pair);
    s.players[1]!.area = far[0]!;
    s.players[2]!.area = far[1]!;
    s.players[3]!.area = pair; // attacker's own pair → excluded by Handgun
    const targets = attackTargetsInRange(s, "p0");
    expect(targets).toContain("p1");
    expect(targets).toContain("p2");
    expect(targets).not.toContain("p3");
  });
});

// ─── Damage formula (§10) ───────────────────────────────────────────────────────

describe("computeDamage §10", () => {
  const base = (d6: number, d4: number, opts: Parameters<typeof makeState>[0] = {}): number => {
    const here: AreaId = "church";
    const s = makeState({ area: { p0: here, p1: here }, ...opts });
    return computeDamage(s, "p0", "p1", { d6, d4 }).final;
  };

  test("damage = |d6 − d4|", () => {
    expect(base(6, 2)).toBe(4);
    expect(base(2, 6)).toBe(4);
    expect(base(5, 1)).toBe(4);
    expect(base(3, 4)).toBe(1);
  });

  test("tie = miss (0 damage)", () => {
    expect(base(4, 4)).toBe(0);
    expect(base(1, 1)).toBe(0);
  });

  test("Chainsaw/Butcher/Axe each +1, and they STACK (only on a hit)", () => {
    const here: AreaId = "church";
    const s = makeState({
      area: { p0: here, p1: here },
      equipment: { p0: ["black:chainsaw#0", "black:butcher_knife#0", "black:rusted_broad_axe#0"] },
    });
    // base |6-2| = 4, +3 from three blades = 7
    expect(computeDamage(s, "p0", "p1", { d6: 6, d4: 2 }).final).toBe(7);
    // a miss (tie) stays 0 — +1 mods do NOT turn a miss into a hit
    expect(computeDamage(s, "p0", "p1", { d6: 4, d4: 4 }).final).toBe(0);
  });

  test("Holy Robe reduces the attacker's outgoing damage by 1", () => {
    expect(base(6, 2, { equipment: { p0: ["white:holy_robe#0"] } })).toBe(3); // 4 - 1
  });

  test("Holy Robe reduces the defender's incoming damage by 1", () => {
    expect(base(6, 2, { equipment: { p1: ["white:holy_robe#0"] } })).toBe(3); // 4 - 1
  });

  test("Holy Robe both directions stack (−1 attacker, −1 defender)", () => {
    expect(
      base(6, 2, { equipment: { p0: ["white:holy_robe#0"], p1: ["white:holy_robe#0"] } }),
    ).toBe(2); // 4 - 1 - 1
  });

  test("Spear of Longinus +2 only when attacker is a revealed Hunter and the attack hits (§6)", () => {
    const here: AreaId = "church";
    const eq = { p0: ["white:spear_of_longinus#0"] };
    const hunterRevealed = makeState({
      area: { p0: here, p1: here },
      characters: { p0: "george" },
      revealed: { p0: true },
      equipment: eq,
    });
    expect(computeDamage(hunterRevealed, "p0", "p1", { d6: 6, d4: 2 }).final).toBe(6); // 4 + 2
    // Hunter but NOT revealed → no bonus
    const hunterHidden = makeState({
      area: { p0: here, p1: here },
      characters: { p0: "george" },
      revealed: { p0: false },
      equipment: eq,
    });
    expect(computeDamage(hunterHidden, "p0", "p1", { d6: 6, d4: 2 }).final).toBe(4);
    // Non-Hunter revealed → no bonus
    const nonHunter = makeState({
      area: { p0: here, p1: here },
      characters: { p0: "vampire" },
      revealed: { p0: true },
      equipment: eq,
    });
    expect(computeDamage(nonHunter, "p0", "p1", { d6: 6, d4: 2 }).final).toBe(4);
    // Hunter + revealed but a MISS → no +2 (Spear needs a damaging attack)
    expect(computeDamage(hunterRevealed, "p0", "p1", { d6: 4, d4: 4 }).final).toBe(0);
  });

  test("Cursed Sword Masamune uses ONLY the d4 as damage and never misses (§6)", () => {
    const here: AreaId = "church";
    const s = makeState({
      area: { p0: here, p1: here },
      equipment: { p0: ["black:cursed_sword_masamune#0"] },
    });
    // d4=3 → damage 3 regardless of d6
    expect(computeDamage(s, "p0", "p1", { d6: 6, d4: 3 }).final).toBe(3);
    // d6==d4 would normally miss, but Masamune never misses: d4=4 → 4
    expect(computeDamage(s, "p0", "p1", { d6: 4, d4: 4 }).final).toBe(4);
    // +modifiers still apply: Masamune + Chainsaw, d4=1 → 1 + 1 = 2
    const s2 = makeState({
      area: { p0: here, p1: here },
      equipment: { p0: ["black:cursed_sword_masamune#0", "black:chainsaw#0"] },
    });
    expect(computeDamage(s2, "p0", "p1", { d6: 1, d4: 1 }).final).toBe(2);
  });
});

// ─── applyAttack: single target (§10, §11) ──────────────────────────────────────

describe("applyAttack single target §10", () => {
  test("a hit applies damage to the target via the damage track", () => {
    const here: AreaId = "church";
    const s = makeState({
      area: { p0: here, p1: here },
      characters: { p1: "george" }, // maxHp 14
      damage: { p1: 0 },
    });
    const res = applyAttack(s, "p0", "p1", { dice: { d6: 6, d4: 2 } });
    expect(res.damage).toBe(4);
    expect(s.players[1]!.damage).toBe(4);
  });

  test("a miss applies no damage", () => {
    const here: AreaId = "church";
    const s = makeState({
      area: { p0: here, p1: here },
      characters: { p1: "george" },
      damage: { p1: 0 },
    });
    const res = applyAttack(s, "p0", "p1", { dice: { d6: 3, d4: 3 } });
    expect(res.damage).toBe(0);
    expect(s.players[1]!.damage).toBe(0);
  });

  test("attacking an out-of-range target throws (illegal)", () => {
    const here: AreaId = "church";
    const s = makeState({ area: { p0: here } });
    s.players[1]!.area = outOfRangeArea(s, here);
    expect(() => applyAttack(s, "p0", "p1", { dice: { d6: 6, d4: 2 } })).toThrow();
  });
});

// ─── Multi-target / Machine Gun (§10, §11 FAQ) ──────────────────────────────────

describe("Machine Gun multi-target §10 §11FAQ", () => {
  test("rolls ONCE and applies the same damage to every target in range", () => {
    const here: AreaId = "church";
    const s = makeState({
      players: ["p0", "p1", "p2", "p3"],
      area: { p0: here, p1: here, p2: here, p3: here },
      characters: { p1: "george", p2: "george", p3: "george" },
      damage: { p1: 0, p2: 0, p3: 0 },
      equipment: { p0: ["black:machine_gun#0"] },
    });
    const res = applyAttack(s, "p0", undefined, { dice: { d6: 6, d4: 2 } });
    expect(res.damage).toBe(4);
    expect(s.players[1]!.damage).toBe(4);
    expect(s.players[2]!.damage).toBe(4);
    expect(s.players[3]!.damage).toBe(4);
  });

  test("a multi-kill yields one looted equipment per victim (§11 FAQ)", () => {
    const here: AreaId = "church";
    const s = makeState({
      players: ["p0", "p1", "p2", "p3"],
      area: { p0: here, p1: here, p2: here }, // p3 parked out of range below
      characters: { p0: "george", p1: "allie", p2: "allie" }, // allie maxHp 8
      damage: { p1: 7, p2: 7 }, // 1 from death; any hit >=1 kills
      equipment: {
        p0: ["black:machine_gun#0"],
        p1: ["white:talisman#0"],
        p2: ["white:fortune_brooch#0"],
      },
    });
    s.players[3]!.area = outOfRangeArea(s, here); // not a Machine Gun target
    const res = applyAttack(s, "p0", undefined, { dice: { d6: 6, d4: 2 } }); // 4 dmg, kills both
    expect(res.damage).toBe(4);
    expect(s.players[1]!.alive).toBe(false);
    expect(s.players[2]!.alive).toBe(false);
    // Attacker looted exactly one equipment per victim (§11 FAQ), plus kept its gun.
    expect(s.players[0]!.equipment).toContain("white:talisman#0");
    expect(s.players[0]!.equipment).toContain("white:fortune_brooch#0");
    expect(s.players[0]!.equipment).toContain("black:machine_gun#0");
  });
});

// ─── Vampire Suck Blood (§12.7) ─────────────────────────────────────────────────

describe("Vampire Suck Blood §12.7", () => {
  test("heals 2 once when an attack deals damage", () => {
    const here: AreaId = "church";
    const s = makeState({
      area: { p0: here, p1: here },
      characters: { p0: "vampire", p1: "george" },
      damage: { p0: 5, p1: 0 },
    });
    applyAttack(s, "p0", "p1", { dice: { d6: 6, d4: 2 } }); // hit
    expect(s.players[0]!.damage).toBe(3); // 5 - 2
  });

  test("heals only ONCE on a multi-target (AoE) attack even if several are damaged (§12.7)", () => {
    const here: AreaId = "church";
    const s = makeState({
      players: ["p0", "p1", "p2", "p3"],
      area: { p0: here, p1: here, p2: here }, // p3 parked out of range below
      characters: { p0: "vampire", p1: "george", p2: "george" },
      damage: { p0: 5, p1: 0, p2: 0 },
      equipment: { p0: ["black:machine_gun#0"] },
    });
    s.players[3]!.area = outOfRangeArea(s, here);
    applyAttack(s, "p0", undefined, { dice: { d6: 6, d4: 2 } }); // hits both
    expect(s.players[0]!.damage).toBe(3); // healed 2 total, not 2 per target
  });

  test("does NOT heal when the attack misses (no damage dealt)", () => {
    const here: AreaId = "church";
    const s = makeState({
      area: { p0: here, p1: here },
      characters: { p0: "vampire", p1: "george" },
      damage: { p0: 5, p1: 0 },
    });
    applyAttack(s, "p0", "p1", { dice: { d6: 3, d4: 3 } }); // miss
    expect(s.players[0]!.damage).toBe(5); // unchanged
  });
});

// ─── Bob Robbery (§12.8) ─────────────────────────────────────────────────────────

describe("Bob Robbery §12.8 (4–6p)", () => {
  test("a 2+ would-be hit becomes a steal of 1 equipment with NO damage", () => {
    const here: AreaId = "church";
    const s = makeState({
      players: ["p0", "p1", "p2", "p3"], // 4 players → 4–6p Robbery clause
      area: { p0: here, p1: here },
      characters: { p0: "bob", p1: "george" },
      damage: { p1: 0 },
      equipment: { p1: ["white:holy_robe#0", "black:chainsaw#0"] },
    });
    const res = applyAttack(s, "p0", "p1", { dice: { d6: 6, d4: 2 } }); // base 4 → would-be 2+
    expect(res.stole).toBe(true);
    expect(res.damage).toBe(0); // §12.8: a steal deals no damage
    expect(s.players[1]!.damage).toBe(0);
    expect(s.players[0]!.equipment.length).toBe(1); // Bob took one
    expect(s.players[1]!.equipment.length).toBe(1); // target lost one
  });

  test("a would-be hit of less than 2 does NOT trigger Robbery (deals damage normally)", () => {
    const here: AreaId = "church";
    const s = makeState({
      players: ["p0", "p1", "p2", "p3"],
      area: { p0: here, p1: here },
      characters: { p0: "bob", p1: "george" },
      damage: { p1: 0 },
      equipment: { p1: ["black:chainsaw#0"] },
    });
    const res = applyAttack(s, "p0", "p1", { dice: { d6: 4, d4: 3 } }); // base 1
    expect(res.stole).toBeFalsy();
    expect(res.damage).toBe(1);
    expect(s.players[1]!.damage).toBe(1);
    expect(s.players[1]!.equipment.length).toBe(1); // not stolen
  });

  test("the 4–6p steal triggers no damage-on-hit effects (no Vampire-style heal etc.)", () => {
    // Bob is Neutral, but assert the no-damage invariant directly: target untouched.
    const here: AreaId = "church";
    const s = makeState({
      players: ["p0", "p1", "p2", "p3"],
      area: { p0: here, p1: here },
      characters: { p0: "bob", p1: "george" },
      damage: { p1: 6 },
      equipment: { p1: ["black:chainsaw#0"] },
    });
    applyAttack(s, "p0", "p1", { dice: { d6: 6, d4: 2 } });
    expect(s.players[1]!.damage).toBe(6); // no extra damage from the steal
    expect(s.players[1]!.alive).toBe(true);
  });
});

// ─── Werewolf Counterattack (§12.6) ─────────────────────────────────────────────

describe("Werewolf Counterattack §12.6", () => {
  test("counter is a separate normal attack back at the original attacker (hit)", () => {
    const here: AreaId = "church";
    const s = makeState({
      area: { p0: here, p1: here },
      characters: { p0: "george", p1: "werewolf" },
      damage: { p0: 0, p1: 0 },
    });
    applyAttack(s, "p0", "p1", { dice: { d6: 6, d4: 2 } }); // initial attack resolves
    const counter = applyCounterattack(s, "p1", "p0", { dice: { d6: 5, d4: 1 } }); // |5-1| = 4
    expect(counter.damage).toBe(4);
    expect(s.players[0]!.damage).toBe(4);
  });

  test("the counterattack can itself miss (it is a normal attack)", () => {
    const here: AreaId = "church";
    const s = makeState({
      area: { p0: here, p1: here },
      characters: { p0: "george", p1: "werewolf" },
      damage: { p0: 0, p1: 0 },
    });
    const counter = applyCounterattack(s, "p1", "p0", { dice: { d6: 3, d4: 3 } }); // tie → miss
    expect(counter.damage).toBe(0);
    expect(s.players[0]!.damage).toBe(0);
  });

  test("a revealing counter reveals the Werewolf (§12.6)", () => {
    const here: AreaId = "church";
    const s = makeState({
      area: { p0: here, p1: here },
      characters: { p0: "george", p1: "werewolf" },
      damage: { p0: 0, p1: 0 },
      revealed: { p1: false },
    });
    applyCounterattack(s, "p1", "p0", { dice: { d6: 5, d4: 1 } });
    expect(s.players[1]!.revealed).toBe(true);
  });

  test("the Werewolf's own equipment modifiers apply to its counter", () => {
    const here: AreaId = "church";
    const s = makeState({
      area: { p0: here, p1: here },
      characters: { p0: "george", p1: "werewolf" },
      damage: { p0: 0, p1: 0 },
      equipment: { p1: ["black:chainsaw#0"] },
    });
    const counter = applyCounterattack(s, "p1", "p0", { dice: { d6: 5, d4: 1 } }); // 4 + 1 = 5
    expect(counter.damage).toBe(5);
    expect(s.players[0]!.damage).toBe(5);
  });
});

// keep maxHpOf referenced (used implicitly in death-threshold reasoning above)
void maxHpOf;
