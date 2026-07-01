// Tests for Black card handlers — Task 8.
// One test per Black card per §6, using the makeState / helpers from test/helpers.ts.
// §6 Black deck: 13 distinct effectKeys (16 cards):
//   vampire_bat ×3, moody_goblin ×2, rest ×1.
//
// Sources:
//   §6  — Black deck card definitions.
//   §12.2 — simultaneous deaths from single effect.
//   §12.13 — mutual-damage ordering: Bloodthirsty Spider / Spiritual Doll (target first, win checks between).
//   Immunity guards (Talisman → vampire_bat / bloodthirsty_spider / dynamite;
//                    Fortune Brooch → weird_woods only — no Black card is "weird_woods").

import { expect, test, beforeEach } from "vitest";
import { playCard } from "../src/cards/black.js";
import { makeState, equip, setDamageRaw, getPlayer } from "./helpers.js";
import { resetWinCheckHook } from "../src/damage.js";
import { BLACK } from "../src/data/cards.js";

// Helper: instanced card id for a Black card by effectKey.
function blackCard(effectKey: string, copy = 0): string {
  const def = BLACK.find((d) => d.effectKey === effectKey);
  if (!def) throw new Error(`blackCard: unknown effectKey "${effectKey}"`);
  return `black:${effectKey}#${copy}`;
}

// Reset the win-check hook before each test for isolation.
beforeEach(() => { resetWinCheckHook(); });

// ── Vampire Bat (×3): target +2 damage, caster heal 1 ────────────────────────
// §6: "Single-use. A target takes 2; you heal 1."
test("Vampire Bat deals 2 to target and heals caster 1", () => {
  const s = makeState({ damage: { p0: 3, p1: 4 } });
  playCard(s, "p0", blackCard("vampire_bat", 0), { target: "p1" });
  expect(getPlayer(s, "p1").damage).toBe(6);
  expect(getPlayer(s, "p0").damage).toBe(2); // healed 1: 3 - 1 = 2
});

test("Vampire Bat (copy 1) works identically", () => {
  const s = makeState({ damage: { p0: 5, p1: 0 } });
  playCard(s, "p0", blackCard("vampire_bat", 1), { target: "p1" });
  expect(getPlayer(s, "p1").damage).toBe(2);
  expect(getPlayer(s, "p0").damage).toBe(4); // healed 1
});

test("Vampire Bat (copy 2) works identically", () => {
  const s = makeState({ damage: { p0: 0, p1: 0 } });
  playCard(s, "p0", blackCard("vampire_bat", 2), { target: "p1" });
  expect(getPlayer(s, "p1").damage).toBe(2);
  expect(getPlayer(s, "p0").damage).toBe(0); // already at 0, heal clamps
});

test("Vampire Bat is blocked by Talisman on target (§6 immunity)", () => {
  const s = makeState({ damage: { p0: 3, p1: 0 } });
  equip(s, "p1", "white:talisman#0");
  playCard(s, "p0", blackCard("vampire_bat", 0), { target: "p1" });
  // Talisman blocks vampire_bat source — no damage to p1.
  expect(getPlayer(s, "p1").damage).toBe(0);
  // Caster self-heal still applies (only target immunity is blocked, not self-heal).
  // Self heal source is "vampire_bat_self" — NOT talisman-blocked.
  expect(getPlayer(s, "p0").damage).toBe(2); // 3 - 1 = 2
});

test("Vampire Bat moves to black discard after use", () => {
  const s = makeState();
  const cardId = blackCard("vampire_bat", 0);
  playCard(s, "p0", cardId, { target: "p1" });
  expect(s.decks.black.discard).toContain(cardId);
});

// ── Moody Goblin (×2): take one equipment from any character ─────────────────
// §6: "Single-use. Take one equipment from a character and equip it."
test("Moody Goblin steals equipment from target and equips to caster", () => {
  const s = makeState();
  equip(s, "p1", "black:chainsaw#0");
  playCard(s, "p0", blackCard("moody_goblin", 0), { target: "p1" });
  expect(getPlayer(s, "p0").equipment).toContain("black:chainsaw#0");
  expect(getPlayer(s, "p1").equipment).not.toContain("black:chainsaw#0");
});

test("Moody Goblin does nothing if target has no equipment", () => {
  const s = makeState();
  // p1 has no equipment.
  const beforeP0Eq = [...getPlayer(s, "p0").equipment];
  playCard(s, "p0", blackCard("moody_goblin", 0), { target: "p1" });
  expect(getPlayer(s, "p0").equipment).toEqual(beforeP0Eq);
});

test("Moody Goblin (copy 1) works identically", () => {
  const s = makeState();
  equip(s, "p2", "black:handgun#0");
  playCard(s, "p0", blackCard("moody_goblin", 1), { target: "p2" });
  expect(getPlayer(s, "p0").equipment).toContain("black:handgun#0");
});

test("Moody Goblin moves to black discard after use", () => {
  const s = makeState();
  const cardId = blackCard("moody_goblin", 0);
  playCard(s, "p0", cardId, { target: "p1" });
  expect(s.decks.black.discard).toContain(cardId);
});

// ── Bloodthirsty Spider (×1): target 2 then caster 2 (§12.13) ────────────────
// §6: "Single-use. Target takes 2, then you take 2 (target first)."
// §12.13: apply sub-damages in stated order (target first, then self), with death+win checks after each.
test("Bloodthirsty Spider deals 2 to target then 2 to caster", () => {
  const s = makeState({ damage: { p0: 0, p1: 0 } });
  playCard(s, "p0", blackCard("bloodthirsty_spider"), { target: "p1" });
  expect(getPlayer(s, "p1").damage).toBe(2); // target first
  expect(getPlayer(s, "p0").damage).toBe(2); // then caster
});

test("Bloodthirsty Spider: target damage is applied before self-damage (order matters for near-death)", () => {
  // p1 has 0 damage left before dying (maxHp - current = 0 would die). Here we just
  // verify that the target event appears before the self-event in the log.
  const s = makeState({ damage: { p0: 0, p1: 0 } });
  playCard(s, "p0", blackCard("bloodthirsty_spider"), { target: "p1" });
  const damagedEvents = s.log.filter((e) => e.type === "Damaged");
  // The first Damaged event should be p1 (target), then p0 (self).
  expect(damagedEvents[0]).toMatchObject({ type: "Damaged", player: "p1" });
  expect(damagedEvents[1]).toMatchObject({ type: "Damaged", player: "p0" });
});

test("Bloodthirsty Spider: target is blocked by Talisman (§6 immunity)", () => {
  const s = makeState({ damage: { p0: 0, p1: 0 } });
  equip(s, "p1", "white:talisman#0");
  playCard(s, "p0", blackCard("bloodthirsty_spider"), { target: "p1" });
  expect(getPlayer(s, "p1").damage).toBe(0); // talisman blocks bloodthirsty_spider
  expect(getPlayer(s, "p0").damage).toBe(2); // self-damage still applies
});

test("Bloodthirsty Spider moves to black discard after use", () => {
  const s = makeState();
  const cardId = blackCard("bloodthirsty_spider");
  playCard(s, "p0", cardId, { target: "p1" });
  expect(s.decks.black.discard).toContain(cardId);
});

// ── Spiritual Doll (×1): roll d6: 1–4 → target 3; 5–6 → caster 3 (§12.13) ───
// §6: "Single-use. Roll d6: 1–4 → target takes 3; 5–6 → you take 3."
test("Spiritual Doll: d6 roll determines who takes 3 damage", () => {
  const s = makeState({ damage: { p0: 0, p1: 0 } });
  playCard(s, "p0", blackCard("spiritual_doll"), { target: "p1" });
  // One of them should have taken 3 damage; the other is unchanged.
  const p0dmg = getPlayer(s, "p0").damage;
  const p1dmg = getPlayer(s, "p1").damage;
  expect(p0dmg + p1dmg).toBe(3);
  expect([p0dmg, p1dmg]).toContain(3);
});

test("Spiritual Doll: seeded RNG produces the same outcome twice (determinism)", () => {
  // Create two states with the same seed (test-helpers-seed) and same rng advancement.
  const s1 = makeState({ damage: { p0: 0, p1: 0 } });
  const s2 = makeState({ damage: { p0: 0, p1: 0 } });
  // Both states should have the same rng state after makeState.
  playCard(s1, "p0", blackCard("spiritual_doll"), { target: "p1" });
  playCard(s2, "p0", blackCard("spiritual_doll"), { target: "p1" });
  expect(getPlayer(s1, "p0").damage).toBe(getPlayer(s2, "p0").damage);
  expect(getPlayer(s1, "p1").damage).toBe(getPlayer(s2, "p1").damage);
});

test("Spiritual Doll moves to black discard after use", () => {
  const s = makeState();
  const cardId = blackCard("spiritual_doll");
  playCard(s, "p0", cardId, { target: "p1" });
  expect(s.decks.black.discard).toContain(cardId);
});

// ── Dynamite (×1): AoE in rolled area; total 7 = nothing (§6, §12.2) ────────
// §6: "Single-use. Roll d6+d4; every character in matching area takes 3 (total 7 = nothing)."
// AoE uses combat/area helpers: every player whose .area matches the rolled area.
test("Dynamite with total=7 does nothing to anyone", () => {
  const s = makeState({ damage: { p0: 0, p1: 0, p2: 0, p3: 0 } });
  // We inject dice {d6:3, d4:4} = 7 → nothing.
  playCard(s, "p0", blackCard("dynamite"), { dice: { d6: 3, d4: 4 } });
  for (const p of s.players) {
    expect(p.damage).toBe(0);
  }
});

test("Dynamite with total=6 deals 3 to everyone in church", () => {
  // All players are in "church" (makeState default area).
  const s = makeState({ damage: { p0: 0, p1: 0, p2: 0, p3: 0 } });
  // church is at dice total 6 (§7). Inject {d6: 2, d4: 4} = 6.
  playCard(s, "p0", blackCard("dynamite"), { dice: { d6: 2, d4: 4 } });
  for (const p of s.players) {
    expect(p.damage).toBe(3);
  }
});

test("Dynamite only hits players in the matched area, not others", () => {
  // p0, p1 in church; p2, p3 in weird_woods. Roll 6 → church.
  const s = makeState({ areas: { p2: "weird_woods", p3: "weird_woods" } });
  playCard(s, "p0", blackCard("dynamite"), { dice: { d6: 2, d4: 4 } }); // total=6 = church
  expect(getPlayer(s, "p0").damage).toBe(3);
  expect(getPlayer(s, "p1").damage).toBe(3);
  expect(getPlayer(s, "p2").damage).toBe(0);
  expect(getPlayer(s, "p3").damage).toBe(0);
});

test("Dynamite is blocked by Talisman (§6 immunity)", () => {
  const s = makeState({ damage: { p0: 0, p1: 0, p2: 0, p3: 0 } });
  equip(s, "p1", "white:talisman#0");
  // Roll 6 → church, all in church.
  playCard(s, "p0", blackCard("dynamite"), { dice: { d6: 2, d4: 4 } });
  expect(getPlayer(s, "p0").damage).toBe(3);
  expect(getPlayer(s, "p1").damage).toBe(0); // talisman blocks
  expect(getPlayer(s, "p2").damage).toBe(3);
  expect(getPlayer(s, "p3").damage).toBe(3);
});

test("Dynamite moves to black discard after use", () => {
  const s = makeState();
  const cardId = blackCard("dynamite");
  // Total 7 = nothing, but card still discards.
  playCard(s, "p0", cardId, { dice: { d6: 3, d4: 4 } });
  expect(s.decks.black.discard).toContain(cardId);
});

// ── Banana Peel (×1): give equipment or self 1 damage ────────────────────────
// §6: "Single-use. Give one of your equipment to a character; if none, take 1 damage."
test("Banana Peel gives caster's equipment to target when caster has one", () => {
  const s = makeState();
  equip(s, "p0", "black:chainsaw#0");
  playCard(s, "p0", blackCard("banana_peel"), { target: "p1" });
  expect(getPlayer(s, "p0").equipment).not.toContain("black:chainsaw#0");
  expect(getPlayer(s, "p1").equipment).toContain("black:chainsaw#0");
});

test("Banana Peel deals 1 damage to caster when caster has no equipment", () => {
  const s = makeState({ damage: { p0: 0 } });
  // p0 has no equipment.
  playCard(s, "p0", blackCard("banana_peel"), { target: "p1" });
  expect(getPlayer(s, "p0").damage).toBe(1);
});

test("Banana Peel moves to black discard after use", () => {
  const s = makeState();
  const cardId = blackCard("banana_peel");
  playCard(s, "p0", cardId, { target: "p1" }); // no equipment → self 1
  expect(s.decks.black.discard).toContain(cardId);
});

// ── Diabolic Ritual (×1): Shadow reveal + full heal ──────────────────────────
// §6: "Single-use. If you are a Shadow, you may reveal; if revealed, fully heal."
test("Diabolic Ritual fully heals a Shadow who chooses to reveal (option='reveal')", () => {
  const s = makeState({ damage: { p0: 8 } });
  getPlayer(s, "p0").characterId = "vampire"; // Shadow
  playCard(s, "p0", blackCard("diabolic_ritual"), { option: "reveal" });
  expect(getPlayer(s, "p0").revealed).toBe(true);
  expect(getPlayer(s, "p0").damage).toBe(0);
});

test("Diabolic Ritual does nothing for a non-Shadow player even with option='reveal'", () => {
  const s = makeState({ damage: { p0: 5 } });
  getPlayer(s, "p0").characterId = "emi"; // Hunter
  playCard(s, "p0", blackCard("diabolic_ritual"), { option: "reveal" });
  expect(getPlayer(s, "p0").damage).toBe(5);
  expect(getPlayer(s, "p0").revealed).toBe(false);
});

test("Diabolic Ritual does nothing without option='reveal' even for a Shadow", () => {
  const s = makeState({ damage: { p0: 5 } });
  getPlayer(s, "p0").characterId = "werewolf"; // Shadow
  playCard(s, "p0", blackCard("diabolic_ritual")); // no option
  expect(getPlayer(s, "p0").damage).toBe(5);
});

test("Diabolic Ritual moves to black discard after use", () => {
  const s = makeState();
  const cardId = blackCard("diabolic_ritual");
  playCard(s, "p0", cardId);
  expect(s.decks.black.discard).toContain(cardId);
});

// ── Chainsaw (×1): equipment — successful attacks +1 ─────────────────────────
// §6 / §10: "Equipment. Successful attacks +1 (stacks)."
test("Chainsaw equips onto the player (not discarded)", () => {
  const s = makeState();
  const cardId = blackCard("chainsaw");
  playCard(s, "p0", cardId);
  expect(getPlayer(s, "p0").equipment).toContain(cardId);
  expect(s.decks.black.discard).not.toContain(cardId);
});

// ── Butcher Knife (×1): equipment — successful attacks +1 ────────────────────
test("Butcher Knife equips onto the player", () => {
  const s = makeState();
  const cardId = blackCard("butcher_knife");
  playCard(s, "p0", cardId);
  expect(getPlayer(s, "p0").equipment).toContain(cardId);
});

// ── Rusted Broad Axe (×1): equipment — successful attacks +1 ─────────────────
test("Rusted Broad Axe equips onto the player", () => {
  const s = makeState();
  const cardId = blackCard("rusted_broad_axe");
  playCard(s, "p0", cardId);
  expect(getPlayer(s, "p0").equipment).toContain(cardId);
});

// ── Machine Gun (×1): equipment — roll once, apply to all in range ────────────
test("Machine Gun equips onto the player", () => {
  const s = makeState();
  const cardId = blackCard("machine_gun");
  playCard(s, "p0", cardId);
  expect(getPlayer(s, "p0").equipment).toContain(cardId);
});

// ── Handgun (×1): equipment — range is every area except own pair ─────────────
test("Handgun equips onto the player", () => {
  const s = makeState();
  const cardId = blackCard("handgun");
  playCard(s, "p0", cardId);
  expect(getPlayer(s, "p0").equipment).toContain(cardId);
});

// ── Cursed Sword Masamune (×1): equipment — must attack; d4 only; never misses ─
test("Cursed Sword Masamune equips onto the player", () => {
  const s = makeState();
  const cardId = blackCard("cursed_sword_masamune");
  playCard(s, "p0", cardId);
  expect(getPlayer(s, "p0").equipment).toContain(cardId);
});

// ── Handler coverage: all 13 distinct effectKeys are registered ───────────────
test("All 13 Black effectKeys have a registered handler", async () => {
  const { BLACK_HANDLERS } = await import("../src/cards/black.js");
  const expectedKeys = [
    "vampire_bat",
    "moody_goblin",
    "bloodthirsty_spider",
    "spiritual_doll",
    "dynamite",
    "banana_peel",
    "diabolic_ritual",
    "chainsaw",
    "butcher_knife",
    "rusted_broad_axe",
    "machine_gun",
    "handgun",
    "cursed_sword_masamune",
  ];
  for (const key of expectedKeys) {
    expect(BLACK_HANDLERS, `expected handler for "${key}"`).toHaveProperty(key);
  }
});
