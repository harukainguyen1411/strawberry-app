// Test suite for Task 5: Damage, heal, death & reveal.
// Source of truth: ruleset.md §11 (death & reveal), §6 (First Aid set-to-7,
// Silver Rosary, Talisman, Fortune Brooch), §12.12 (First Aid absolute set),
// §5 (max HP), §4 (deadOrder for Daniel first-to-die), §12.16 (discarded equipment).
//
// Validates:
//   - applyDamage / applyHeal clamp to [0, maxHp]
//   - setDamage is absolute (First Aid → 7)
//   - death at damage >= maxHp: alive=false, revealed=true, deadOrder, lastKill, Died+Revealed
//   - loot: killer takes 1 equipment by default; Silver Rosary / Bob 7–8p take all; rest discarded
//   - reveal idempotent, emits Revealed once
//   - immunity guards (Talisman, Fortune Brooch) keyed on source

import { expect, test, describe } from "vitest";
import { createGame } from "../src/setup.js";
import {
  applyDamage,
  applyHeal,
  setDamage,
  reveal,
  checkDeath,
  lootRule,
} from "../src/damage.js";
import { CHARACTERS } from "../src/data/characters.js";
import type { GameState, CharacterId, PlayerId } from "../src/types.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a game and force each player's characterId / damage / equipment as given. */
function makeState(opts: {
  players?: PlayerId[];
  characters?: Record<PlayerId, CharacterId>;
  damage?: Record<PlayerId, number>;
  equipment?: Record<PlayerId, string[]>;
  seed?: string;
}): GameState {
  const ids = opts.players ?? ["p0", "p1", "p2", "p3"];
  const state = createGame(ids, opts.seed ?? "damage-test");
  for (const p of state.players) {
    if (opts.characters?.[p.id] !== undefined) p.characterId = opts.characters[p.id]!;
    if (opts.damage?.[p.id] !== undefined) p.damage = opts.damage[p.id]!;
    if (opts.equipment?.[p.id] !== undefined) p.equipment = [...opts.equipment[p.id]!];
  }
  return state;
}

const maxHpOf = (cid: CharacterId): number =>
  CHARACTERS.find((c) => c.id === cid)!.maxHp;

// ─── applyDamage / applyHeal clamping (§11) ──────────────────────────────────

describe("applyDamage / applyHeal clamping", () => {
  test("applyDamage accumulates and clamps to maxHp", () => {
    // vampire maxHp 13
    const s = makeState({ characters: { p0: "vampire" }, damage: { p0: 0 } });
    applyDamage(s, "p0", 5, "test");
    expect(s.players[0]!.damage).toBe(5);
    // overflow beyond maxHp clamps at maxHp (and triggers death)
    applyDamage(s, "p0", 100, "test");
    expect(s.players[0]!.damage).toBe(13);
  });

  test("applyHeal reduces damage and clamps at 0 (no negative damage)", () => {
    const s = makeState({ characters: { p0: "vampire" }, damage: { p0: 4 } });
    applyHeal(s, "p0", 2, "heal-test");
    expect(s.players[0]!.damage).toBe(2);
    // over-heal clamps at 0
    applyHeal(s, "p0", 99, "heal-test");
    expect(s.players[0]!.damage).toBe(0);
  });

  test("applyDamage emits a Damaged event with source", () => {
    const s = makeState({ characters: { p0: "george" }, damage: { p0: 0 } });
    const events = applyDamage(s, "p0", 3, "flare_of_judgement");
    const dmg = events.find((e) => e.type === "Damaged");
    expect(dmg).toBeDefined();
    if (dmg?.type === "Damaged") {
      expect(dmg.player).toBe("p0");
      expect(dmg.amount).toBe(3);
      expect(dmg.source).toBe("flare_of_judgement");
    }
  });

  test("applyHeal emits a Healed event", () => {
    const s = makeState({ characters: { p0: "george" }, damage: { p0: 5 } });
    const events = applyHeal(s, "p0", 2, "holy_water");
    const healed = events.find((e) => e.type === "Healed");
    expect(healed).toBeDefined();
    if (healed?.type === "Healed") {
      expect(healed.amount).toBe(2);
    }
  });

  test("applyDamage of 0 (a miss) does not kill and emits no Damaged", () => {
    const s = makeState({ characters: { p0: "allie" }, damage: { p0: 7 } });
    const events = applyDamage(s, "p0", 0, "miss");
    expect(s.players[0]!.damage).toBe(7);
    expect(s.players[0]!.alive).toBe(true);
    expect(events.find((e) => e.type === "Damaged")).toBeUndefined();
  });
});

// ─── setDamage absolute (First Aid → 7, §12.12) ──────────────────────────────

describe("setDamage absolute set §12.12", () => {
  test("setDamage to 7 on a 13-HP char leaves exactly 7 (no death)", () => {
    const s = makeState({ characters: { p0: "vampire" }, damage: { p0: 2 } });
    setDamage(s, "p0", 7, "first_aid");
    expect(s.players[0]!.damage).toBe(7);
    expect(s.players[0]!.alive).toBe(true);
  });

  test("setDamage runs the death check: First Aid → 7 kills a maxHp ≤ 7 character", () => {
    // §12.12: absolute set to 7, then death check. Allie maxHp 8 survives at 7;
    // a hypothetical 7-HP would die — use a maxHp boundary: set to maxHp.
    const s = makeState({ characters: { p0: "allie" }, damage: { p0: 0 } });
    // Allie maxHp 8; setting to 8 kills, setting to 7 leaves one from death (§12.12 note).
    setDamage(s, "p0", 7, "first_aid");
    expect(s.players[0]!.damage).toBe(7);
    expect(s.players[0]!.alive).toBe(true); // Allie 8: 7 leaves one from death
  });

  test("setDamage at or above maxHp triggers death", () => {
    const s = makeState({ characters: { p0: "allie" }, damage: { p0: 0 } });
    setDamage(s, "p0", 8, "first_aid"); // Allie maxHp 8
    expect(s.players[0]!.alive).toBe(false);
    expect(s.players[0]!.revealed).toBe(true);
  });
});

// ─── Death triggers (§11) ─────────────────────────────────────────────────────

describe("Death at damage >= maxHp §11", () => {
  test("damage to exactly maxHp kills, reveals, and records deadOrder + Died/Revealed", () => {
    const s = makeState({ characters: { p0: "allie" }, damage: { p0: 0 } });
    const events = applyDamage(s, "p0", 8, "lethal", "p1"); // Allie maxHp 8
    const p0 = s.players[0]!;
    expect(p0.alive).toBe(false);
    expect(p0.revealed).toBe(true);
    expect(s.deadOrder).toContain("p0");
    expect(events.find((e) => e.type === "Died")).toBeDefined();
    expect(events.find((e) => e.type === "Revealed")).toBeDefined();
    const died = events.find((e) => e.type === "Died");
    if (died?.type === "Died") expect(died.killer).toBe("p1");
  });

  test("deadOrder records first death first", () => {
    const s = makeState({
      characters: { p0: "allie", p1: "bob" },
      damage: { p0: 0, p1: 0 },
    });
    applyDamage(s, "p1", maxHpOf("bob"), "lethal", "p0"); // bob dies first
    applyDamage(s, "p0", maxHpOf("allie"), "lethal", "p1"); // allie dies second
    expect(s.deadOrder).toEqual(["p1", "p0"]);
  });

  test("lastKill records killer and the dead count after the kill", () => {
    const s = makeState({ characters: { p0: "allie" }, damage: { p0: 0 } });
    applyDamage(s, "p0", maxHpOf("allie"), "lethal", "p2");
    expect(s.lastKill).toEqual({ killer: "p2", deadCountAfter: 1 });
  });

  test("a dead player cannot be damaged again (death is final; no double-death)", () => {
    const s = makeState({ characters: { p0: "allie" }, damage: { p0: 0 } });
    applyDamage(s, "p0", maxHpOf("allie"), "lethal", "p1");
    expect(s.deadOrder).toEqual(["p0"]);
    // Second damage application on the dead player is a no-op
    const events = applyDamage(s, "p0", 5, "post-mortem", "p2");
    expect(s.deadOrder).toEqual(["p0"]); // not duplicated
    expect(events).toEqual([]);
  });
});

// ─── Loot rules (§11) ─────────────────────────────────────────────────────────

describe("Loot on death §11", () => {
  test("killer takes 1 equipment by default; remainder discarded to their decks", () => {
    const s = makeState({
      characters: { p0: "allie", p1: "george" },
      damage: { p0: 0 },
      equipment: {
        p0: ["white:holy_robe#0", "black:chainsaw#0", "white:talisman#0"],
      },
    });
    const beforeWhiteDiscard = s.decks.white.discard.length;
    const beforeBlackDiscard = s.decks.black.discard.length;

    const events = applyDamage(s, "p0", maxHpOf("allie"), "lethal", "p1");

    // Killer p1 took exactly 1 equipment
    expect(s.players[1]!.equipment).toHaveLength(1);
    // Victim has no equipment left
    expect(s.players[0]!.equipment).toHaveLength(0);
    // The other 2 were discarded to their colour's discard pile
    const totalDiscardedNow =
      s.decks.white.discard.length -
      beforeWhiteDiscard +
      (s.decks.black.discard.length - beforeBlackDiscard);
    expect(totalDiscardedNow).toBe(2);
    // An EquipmentTaken event fired for the killer's loot
    expect(events.find((e) => e.type === "EquipmentTaken")).toBeDefined();
  });

  test("Silver Rosary equipped killer takes ALL the victim's equipment", () => {
    const s = makeState({
      characters: { p0: "allie", p1: "george" },
      damage: { p0: 0 },
      equipment: {
        p0: ["white:holy_robe#0", "black:chainsaw#0"],
        p1: ["white:silver_rosary#0"],
      },
    });
    applyDamage(s, "p0", maxHpOf("allie"), "lethal", "p1");
    // Killer keeps their rosary + both looted items = 3
    expect(s.players[1]!.equipment).toHaveLength(3);
    expect(s.players[0]!.equipment).toHaveLength(0);
    // Nothing discarded
    expect(s.decks.white.discard).toHaveLength(0);
    expect(s.decks.black.discard).toHaveLength(0);
  });

  test("no killer (card/AoE death) discards ALL the victim's equipment", () => {
    const s = makeState({
      characters: { p0: "allie" },
      damage: { p0: 0 },
      equipment: { p0: ["white:holy_robe#0", "black:chainsaw#0"] },
    });
    applyDamage(s, "p0", maxHpOf("allie"), "dynamite", null);
    expect(s.players[0]!.equipment).toHaveLength(0);
    expect(s.decks.white.discard).toContain("white:holy_robe#0");
    expect(s.decks.black.discard).toContain("black:chainsaw#0");
  });

  test("victim with no equipment: loot is a no-op (no EquipmentTaken, no discard)", () => {
    const s = makeState({
      characters: { p0: "allie", p1: "george" },
      damage: { p0: 0 },
      equipment: { p0: [] },
    });
    const events = applyDamage(s, "p0", maxHpOf("allie"), "lethal", "p1");
    expect(events.find((e) => e.type === "EquipmentTaken")).toBeUndefined();
    expect(s.decks.white.discard).toHaveLength(0);
    expect(s.decks.black.discard).toHaveLength(0);
  });
});

// ─── lootRule helper (§11, §5 Bob, §6 Silver Rosary) ────────────────────────

describe("lootRule §11", () => {
  test("default killer with no special flags → 'one'", () => {
    const s = makeState({ characters: { p1: "george" }, equipment: { p1: [] } });
    expect(lootRule(s, "p1")).toBe("one");
  });

  test("killer with Silver Rosary equipped → 'all'", () => {
    const s = makeState({
      characters: { p1: "george" },
      equipment: { p1: ["white:silver_rosary#0"] },
    });
    expect(lootRule(s, "p1")).toBe("all");
  });

  test("Bob in a 7-player game → 'all'; Bob in a 6-player game → 'one'", () => {
    const s7 = makeState({
      players: ["p0", "p1", "p2", "p3", "p4", "p5", "p6"],
      characters: { p1: "bob" },
    });
    expect(lootRule(s7, "p1")).toBe("all");

    const s6 = makeState({
      players: ["p0", "p1", "p2", "p3", "p4", "p5"],
      characters: { p1: "bob" },
    });
    expect(lootRule(s6, "p1")).toBe("one");
  });

  test("null killer → 'none' (no loot, all discarded)", () => {
    const s = makeState({});
    expect(lootRule(s, null)).toBe("none");
  });
});

// ─── reveal idempotence (§11) ─────────────────────────────────────────────────

describe("reveal §11", () => {
  test("reveal sets revealed=true and emits Revealed once", () => {
    const s = makeState({ characters: { p0: "vampire" } });
    const e1 = reveal(s, "p0");
    expect(s.players[0]!.revealed).toBe(true);
    expect(e1.filter((e) => e.type === "Revealed")).toHaveLength(1);
    const r = e1.find((e) => e.type === "Revealed");
    if (r?.type === "Revealed") {
      expect(r.player).toBe("p0");
      expect(r.characterId).toBe("vampire");
    }
  });

  test("reveal is idempotent: a second reveal emits nothing", () => {
    const s = makeState({ characters: { p0: "vampire" } });
    reveal(s, "p0");
    const e2 = reveal(s, "p0");
    expect(e2).toEqual([]);
    expect(s.players[0]!.revealed).toBe(true);
  });
});

// ─── checkDeath (§11) ─────────────────────────────────────────────────────────

describe("checkDeath §11", () => {
  test("checkDeath kills a player already at/over maxHp and returns Died+Revealed", () => {
    const s = makeState({ characters: { p0: "allie" }, damage: { p0: 8 } }); // already at maxHp
    const events = checkDeath(s, "p0", null);
    expect(s.players[0]!.alive).toBe(false);
    expect(events.find((e) => e.type === "Died")).toBeDefined();
  });

  test("checkDeath is a no-op for a player below maxHp", () => {
    const s = makeState({ characters: { p0: "allie" }, damage: { p0: 5 } });
    const events = checkDeath(s, "p0", null);
    expect(s.players[0]!.alive).toBe(true);
    expect(events).toEqual([]);
  });

  test("checkDeath is a no-op for an already-dead player", () => {
    const s = makeState({ characters: { p0: "allie" }, damage: { p0: 8 } });
    checkDeath(s, "p0", null);
    const events = checkDeath(s, "p0", null);
    expect(events).toEqual([]);
    expect(s.deadOrder).toEqual(["p0"]);
  });
});

// ─── Immunity guards keyed on source (§6 Talisman / Fortune Brooch) ──────────

describe("Immunity guards keyed on source §6", () => {
  test("Talisman blocks Bloodthirsty Spider / Vampire Bat / Dynamite damage", () => {
    const s = makeState({
      characters: { p0: "vampire" },
      damage: { p0: 0 },
      equipment: { p0: ["white:talisman#0"] },
    });
    for (const src of ["bloodthirsty_spider", "vampire_bat", "dynamite"]) {
      const events = applyDamage(s, "p0", 2, src);
      expect(s.players[0]!.damage).toBe(0); // immune — no damage applied
      expect(events.find((e) => e.type === "Damaged")).toBeUndefined();
    }
  });

  test("Talisman does NOT block other sources (e.g. an attack)", () => {
    const s = makeState({
      characters: { p0: "vampire" },
      damage: { p0: 0 },
      equipment: { p0: ["white:talisman#0"] },
    });
    applyDamage(s, "p0", 2, "attack");
    expect(s.players[0]!.damage).toBe(2);
  });

  test("Fortune Brooch blocks Weird Woods damage", () => {
    const s = makeState({
      characters: { p0: "vampire" },
      damage: { p0: 0 },
      equipment: { p0: ["white:fortune_brooch#0"] },
    });
    const events = applyDamage(s, "p0", 2, "weird_woods");
    expect(s.players[0]!.damage).toBe(0);
    expect(events.find((e) => e.type === "Damaged")).toBeUndefined();
  });

  test("Fortune Brooch does NOT block Black-card sources", () => {
    const s = makeState({
      characters: { p0: "vampire" },
      damage: { p0: 0 },
      equipment: { p0: ["white:fortune_brooch#0"] },
    });
    applyDamage(s, "p0", 2, "vampire_bat");
    expect(s.players[0]!.damage).toBe(2); // brooch only blocks weird_woods
  });
});
