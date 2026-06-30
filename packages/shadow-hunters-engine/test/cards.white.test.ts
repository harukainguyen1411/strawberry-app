// Tests for White card handlers — Task 7.
// One test per White card per §6, using the makeState / helpers from test/helpers.ts.
// §6 White deck: 15 distinct effects (16 cards: holy_water_of_healing ×2, rest ×1).
// §12.9: Guardian Angel blocks attack-source damage only until next turn.
// §12.10: Concealed Knowledge grants one extra turn (pendingExtraTurns++).
// §12.12: First Aid sets damage to exactly 7 (absolute).

import { expect, test } from "vitest";
import { playCard } from "../src/cards/white.js";
import { makeState, whiteCard, equip, setDamageRaw, getPlayer } from "./helpers.js";
import { resetWinCheckHook, applyDamage } from "../src/damage.js";
import { CHARACTERS } from "../src/data/characters.js";

// Reset win-check hook before each test to keep tests isolated.
// (The hook is a module-level singleton; we don't want Task 11 side effects yet.)
import { beforeEach } from "vitest";
beforeEach(() => { resetWinCheckHook(); });

// ── Holy Water of Healing (×2): heal self 2 ──────────────────────────────────
// §6: "Single-use. Heal 2 of your own damage."
test("Holy Water of Healing heals player 2 damage", () => {
  const s = makeState({ damage: { p0: 5 } });
  playCard(s, "p0", whiteCard("holy_water_of_healing", 0));
  expect(getPlayer(s, "p0").damage).toBe(3);
});

test("Holy Water of Healing (copy 1) also heals 2", () => {
  const s = makeState({ damage: { p0: 3 } });
  playCard(s, "p0", whiteCard("holy_water_of_healing", 1));
  expect(getPlayer(s, "p0").damage).toBe(1);
});

test("Holy Water of Healing clamps at 0 (no negative damage)", () => {
  const s = makeState({ damage: { p0: 1 } });
  playCard(s, "p0", whiteCard("holy_water_of_healing", 0));
  expect(getPlayer(s, "p0").damage).toBe(0);
});

// ── Flare of Judgement (×1): every OTHER player takes 2 ──────────────────────
// §6: "Single-use. Every other character takes 2 damage (can hit allies)."
test("Flare of Judgement deals 2 to every other player, not the caster", () => {
  const s = makeState();
  playCard(s, "p0", whiteCard("flare_of_judgement"));
  expect(getPlayer(s, "p0").damage).toBe(0);   // caster unaffected
  expect(getPlayer(s, "p1").damage).toBe(2);
  expect(getPlayer(s, "p2").damage).toBe(2);
  expect(getPlayer(s, "p3").damage).toBe(2);
});

test("Flare of Judgement card moves to white discard after use", () => {
  const s = makeState();
  const cardId = whiteCard("flare_of_judgement");
  playCard(s, "p0", cardId);
  expect(s.decks.white.discard).toContain(cardId);
});

// ── First Aid (×1): set a character's damage to exactly 7 (§12.12) ───────────
// §6: "Single-use. Set one character's damage to exactly 7 (absolute)."
// §12.12: run death check after set — kills any char with maxHp ≤ 7.
test("First Aid sets target's damage to exactly 7", () => {
  const s = makeState({ damage: { p1: 3 } });
  playCard(s, "p0", whiteCard("first_aid"), { target: "p1" });
  expect(getPlayer(s, "p1").damage).toBe(7);
});

test("First Aid set-to-7 leaves Allie one below death (maxHp=8 → 7 < 8, stays alive)", () => {
  // §12.12: First Aid is an absolute set to 7; Allie's maxHp is 8 (the lowest in the
  // base roster), so 7 < 8 — Allie survives at exactly one damage from death.
  const s = makeState({ damage: { p1: 0 } });
  const allie = getPlayer(s, "p1");
  allie.characterId = "allie"; // maxHp 8 (rulebook-confirmed)
  playCard(s, "p0", whiteCard("first_aid"), { target: "p1" });
  expect(allie.damage).toBe(7);
  expect(allie.alive).toBe(true); // 7 < 8 → one below death
});

test("First Aid set-to-7 KILLS a character whose maxHp <= 7 (§12.12 death path)", () => {
  // §12.12: "kills any character with max HP <= 7". No BASE character has maxHp <= 7
  // (Allie at 8 is the lowest), so we exercise the death path with a synthetic
  // character override (maxHp 7). This drives the real First Aid handler →
  // setDamage(7) → checkDeath (7 >= 7) → die, asserting alive === false.
  const FRAGILE = {
    id: "fragile_test_char",
    name: "Fragile",
    faction: "Neutral" as const,
    maxHp: 7, // <= 7: set-to-7 is lethal
    ability: "(test-only synthetic character)",
    winCondition: "(test-only)",
  };
  CHARACTERS.push(FRAGILE);
  try {
    const s = makeState({ damage: { p1: 0 } });
    const victim = getPlayer(s, "p1");
    victim.characterId = FRAGILE.id; // maxHp 7
    playCard(s, "p0", whiteCard("first_aid"), { target: "p1" });
    expect(victim.damage).toBe(7); // set to exactly 7 (== maxHp)
    expect(victim.alive).toBe(false); // §12.12: 7 >= maxHp 7 → dead
    expect(s.deadOrder).toContain("p1"); // death was recorded through the death path
  } finally {
    // Restore the roster so other tests see only the 10 base characters.
    const idx = CHARACTERS.findIndex((c) => c.id === FRAGILE.id);
    if (idx !== -1) CHARACTERS.splice(idx, 1);
  }
});

// ── Concealed Knowledge (×1): extra turn (§12.10) ────────────────────────────
// §6: "Single-use. After this turn ends, immediately take one extra turn."
// §12.10: pendingExtraTurns++
test("Concealed Knowledge increments pendingExtraTurns by 1", () => {
  const s = makeState();
  expect(s.pendingExtraTurns).toBe(0);
  playCard(s, "p0", whiteCard("concealed_knowledge"));
  expect(s.pendingExtraTurns).toBe(1);
});

test("Concealed Knowledge discards to white discard", () => {
  const s = makeState();
  const cardId = whiteCard("concealed_knowledge");
  playCard(s, "p0", cardId);
  expect(s.decks.white.discard).toContain(cardId);
});

// ── Guardian Angel (×1): attack immunity until next turn (§12.9) ─────────────
// §6: "Single-use. You take no damage from attacks until your next turn."
// §12.9: blocks attack-source damage only; does NOT block cards/abilities.
// Implementation: sets player.attackImmune = true; damage.ts skips "attack" source.
test("Guardian Angel sets attackImmune flag on the player", () => {
  const s = makeState();
  expect(getPlayer(s, "p0").attackImmune).toBe(false);
  playCard(s, "p0", whiteCard("guardian_angel"));
  expect(getPlayer(s, "p0").attackImmune).toBe(true);
});

test("Guardian Angel: attack damage is blocked while flag is set", () => {
  const s = makeState();
  playCard(s, "p0", whiteCard("guardian_angel"));
  // applyDamage is imported at the top of the file (ESM static import).
  applyDamage(s, "p0", 3, "attack", null);
  expect(getPlayer(s, "p0").damage).toBe(0); // blocked by attackImmune §12.9
});

test("Guardian Angel: non-attack damage is NOT blocked", () => {
  const s = makeState();
  playCard(s, "p0", whiteCard("guardian_angel"));
  applyDamage(s, "p0", 3, "flare_of_judgement", null);
  expect(getPlayer(s, "p0").damage).toBe(3); // card source — not blocked §12.9
});

test("Guardian Angel card discards to white discard", () => {
  const s = makeState();
  const cardId = whiteCard("guardian_angel");
  playCard(s, "p0", cardId);
  expect(s.decks.white.discard).toContain(cardId);
});

// ── Disenchant Mirror (×1): force Shadow reveals except Unknown ───────────────
// §6: "Single-use. Any Shadow must reveal — except Unknown (may lie)."
test("Disenchant Mirror reveals all Shadow characters except Unknown", () => {
  const s = makeState();
  // Find which player is a Shadow character (vampire or werewolf, not unknown).
  const shadows = s.players.filter(
    (p) => ["vampire", "werewolf"].includes(p.characterId)
  );
  const unknownPlayer = s.players.find((p) => p.characterId === "unknown");

  // No one is revealed yet.
  for (const p of s.players) expect(p.revealed).toBe(false);

  playCard(s, "p0", whiteCard("disenchant_mirror"));

  // Shadows (non-Unknown) should now be revealed.
  for (const p of shadows) {
    expect(p.revealed).toBe(true);
  }
  // Unknown is NOT force-revealed (§6 exception).
  if (unknownPlayer) {
    expect(unknownPlayer.revealed).toBe(false);
  }
  // Hunters and Neutrals unaffected.
  const nonShadow = s.players.filter((p) => !["unknown", "vampire", "werewolf"].includes(p.characterId));
  for (const p of nonShadow) {
    expect(p.revealed).toBe(false);
  }
});

// ── Blessing (×1): heal another player d6 ─────────────────────────────────────
// §6: "Single-use. Choose another character; heal them by a d6 roll."
test("Blessing heals the target by EXACTLY the injected d6 (no caster self-damage)", () => {
  // §6: "heal them by a d6 roll." Inject a fixed d6 (mirrors Franklin's roll injection)
  // so the heal is exact, not just range-bounded. d6=4 on a target at 6 damage → 2 left.
  const s = makeState({ damage: { p0: 5, p1: 6 } });
  playCard(s, "p0", whiteCard("blessing"), { target: "p1", roll: 4 });
  expect(getPlayer(s, "p1").damage).toBe(2); // 6 − 4 = exactly 2
  expect(getPlayer(s, "p0").damage).toBe(5); // caster damage UNCHANGED (Blessing heals only the target)
});

test("Blessing with d6=6 fully heals a target at 6 damage (exact)", () => {
  const s = makeState({ damage: { p0: 5, p1: 6 } });
  playCard(s, "p0", whiteCard("blessing"), { target: "p1", roll: 6 });
  expect(getPlayer(s, "p1").damage).toBe(0); // 6 − 6 = exactly 0
  expect(getPlayer(s, "p0").damage).toBe(5); // caster unchanged
});

test("Blessing without an injected roll still heals within the d6 range and never touches the caster", () => {
  // Production path (no injected roll): rolls state.rng. We still pin the caster-unchanged
  // invariant and the [0,5] residual bound on a target that started at 6.
  const s = makeState({ damage: { p0: 5, p1: 6 } });
  playCard(s, "p0", whiteCard("blessing"), { target: "p1" });
  const remaining = getPlayer(s, "p1").damage;
  expect(remaining).toBeGreaterThanOrEqual(0);
  expect(remaining).toBeLessThanOrEqual(5);
  expect(getPlayer(s, "p0").damage).toBe(5); // caster damage unchanged
});

// ── Chocolate (×1): if name starts A/E/U, may reveal; if revealed, fully heal ─
// §6: "Single-use. If your name starts A/E/U, you may reveal; if revealed, fully heal."
// Emi starts with E, Allie starts with A, Unknown starts with U.
test("Chocolate fully heals a revealed Emi (name starts E, option=reveal)", () => {
  const s = makeState({ damage: { p0: 5 } });
  // Force p0 to be emi (name starts with E).
  const p0 = getPlayer(s, "p0");
  p0.characterId = "emi";
  // Player plays Chocolate and chooses to reveal.
  playCard(s, "p0", whiteCard("chocolate"), { option: "reveal" });
  // Emi qualifies (E), option=reveal → revealed + fully healed.
  expect(getPlayer(s, "p0").revealed).toBe(true);
  expect(getPlayer(s, "p0").damage).toBe(0);
});

test("Chocolate does nothing for a non-A/E/U unrevealed player", () => {
  const s = makeState({ damage: { p0: 4 } });
  // Force p0 to be franklin (name starts F).
  getPlayer(s, "p0").characterId = "franklin";
  playCard(s, "p0", whiteCard("chocolate"));
  // Not a qualifying name start → nothing.
  expect(getPlayer(s, "p0").damage).toBe(4);
});

test("Chocolate does nothing for A/E/U player who is not yet revealed (optional reveal not taken)", () => {
  // The card says "may reveal"; if not revealed after playing, the heal doesn't trigger.
  // playCard passes opts.option="reveal" to trigger the reveal; without it → nothing.
  const s = makeState({ damage: { p0: 4 } });
  getPlayer(s, "p0").characterId = "allie";
  // No option → player stays unrevealed → no heal.
  playCard(s, "p0", whiteCard("chocolate")); // no option: doesn't trigger reveal
  expect(getPlayer(s, "p0").damage).toBe(4);
});

test("Chocolate reveals and fully heals when option='reveal' for qualifying player", () => {
  const s = makeState({ damage: { p0: 6 } });
  getPlayer(s, "p0").characterId = "allie";
  playCard(s, "p0", whiteCard("chocolate"), { option: "reveal" });
  expect(getPlayer(s, "p0").revealed).toBe(true);
  expect(getPlayer(s, "p0").damage).toBe(0);
});

// ── Advent (×1): if Hunter, may reveal; if revealed, fully heal ───────────────
// §6: "Single-use. If you are a Hunter, you may reveal; if revealed, fully heal."
test("Advent fully heals a revealed Hunter (option='reveal')", () => {
  const s = makeState({ damage: { p0: 7 } });
  getPlayer(s, "p0").characterId = "franklin"; // Hunter
  playCard(s, "p0", whiteCard("advent"), { option: "reveal" });
  expect(getPlayer(s, "p0").revealed).toBe(true);
  expect(getPlayer(s, "p0").damage).toBe(0);
});

test("Advent does nothing for a Shadow player", () => {
  const s = makeState({ damage: { p0: 5 } });
  getPlayer(s, "p0").characterId = "vampire"; // Shadow
  playCard(s, "p0", whiteCard("advent"), { option: "reveal" });
  // Not a Hunter → no effect, not revealed.
  expect(getPlayer(s, "p0").damage).toBe(5);
});

test("Advent does nothing without option='reveal' even for a Hunter", () => {
  const s = makeState({ damage: { p0: 3 } });
  getPlayer(s, "p0").characterId = "emi";
  playCard(s, "p0", whiteCard("advent")); // no option
  expect(getPlayer(s, "p0").damage).toBe(3);
});

// ── Fortune Brooch (×1): equipment — immune to Weird Woods damage ─────────────
// §6: "Equipment. Immune to Weird Woods damage."
// An equipment card goes to player.equipment, not discarded.
test("Fortune Brooch equips onto the player (not discarded)", () => {
  const s = makeState();
  const cardId = whiteCard("fortune_brooch");
  playCard(s, "p0", cardId);
  expect(getPlayer(s, "p0").equipment).toContain(cardId);
  expect(s.decks.white.discard).not.toContain(cardId);
});

// ── Talisman (×1): equipment — immune to Spider/Bat/Dynamite ─────────────────
test("Talisman equips onto the player", () => {
  const s = makeState();
  const cardId = whiteCard("talisman");
  playCard(s, "p0", cardId);
  expect(getPlayer(s, "p0").equipment).toContain(cardId);
});

// ── Mystic Compass (×1): equipment ────────────────────────────────────────────
test("Mystic Compass equips onto the player", () => {
  const s = makeState();
  const cardId = whiteCard("mystic_compass");
  playCard(s, "p0", cardId);
  expect(getPlayer(s, "p0").equipment).toContain(cardId);
});

// ── Silver Rosary (×1): equipment ────────────────────────────────────────────
test("Silver Rosary equips onto the player", () => {
  const s = makeState();
  const cardId = whiteCard("silver_rosary");
  playCard(s, "p0", cardId);
  expect(getPlayer(s, "p0").equipment).toContain(cardId);
});

// ── Spear of Longinus (×1): equipment ────────────────────────────────────────
test("Spear of Longinus equips onto the player", () => {
  const s = makeState();
  const cardId = whiteCard("spear_of_longinus");
  playCard(s, "p0", cardId);
  expect(getPlayer(s, "p0").equipment).toContain(cardId);
});

// ── Holy Robe (×1): equipment ─────────────────────────────────────────────────
test("Holy Robe equips onto the player", () => {
  const s = makeState();
  const cardId = whiteCard("holy_robe");
  playCard(s, "p0", cardId);
  expect(getPlayer(s, "p0").equipment).toContain(cardId);
});

// ── Handler coverage: all 15 effectKeys are registered ───────────────────────
test("All 15 White effectKeys have a registered handler", async () => {
  const { WHITE_HANDLERS } = await import("../src/cards/white.js");
  const expectedKeys = [
    "holy_water_of_healing",
    "flare_of_judgement",
    "first_aid",
    "concealed_knowledge",
    "guardian_angel",
    "disenchant_mirror",
    "blessing",
    "chocolate",
    "advent",
    "fortune_brooch",
    "talisman",
    "mystic_compass",
    "silver_rosary",
    "spear_of_longinus",
    "holy_robe",
  ];
  for (const key of expectedKeys) {
    expect(WHITE_HANDLERS, `expected handler for "${key}"`).toHaveProperty(key);
  }
});
