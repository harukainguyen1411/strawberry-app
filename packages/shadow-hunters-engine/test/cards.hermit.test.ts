// Hermit card handler tests for the Shadow Hunters engine.
// Source of truth: ruleset.md §6 (Hermit deck), §12.11.
//
// Each Hermit card is handed face-down to a chosen recipient who resolves it
// against their own identity (faction / HP). If the condition doesn't match,
// "nothing happens". Resolved cards discard face-down to hermit discard (§6).
//
// Unknown (§12.11): may lie about identity (apply the real HP change) or
// decline ("nothing happens") without revealing. Prediction cannot be faked.
//
// 12 distinct effectKeys, 16 total cards:
//   hermits_blackmail ×2, hermits_anger ×2, hermits_greed ×2,
//   hermits_slap ×2, hermits_aid ×1, hermits_nurturance ×1,
//   hermits_huddle ×1, hermits_spell ×1, hermits_exorcism ×1,
//   hermits_bully ×1, hermits_tough_lesson_of_love ×1, hermits_prediction ×1

import { expect, test, beforeEach } from "vitest";
import { giveHermit } from "../src/cards/hermit.js";
import { makeState, getPlayer } from "./helpers.js";
import { resetWinCheckHook } from "../src/damage.js";

// Reset win-check hook before each test for isolation.
beforeEach(() => { resetWinCheckHook(); });

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hermitCard(effectKey: string, copy = 0): string {
  return `hermit:${effectKey}#${copy}`;
}

/**
 * Build a 4-player state with explicit character assignments so tests are
 * faction-deterministic regardless of which characters the seed dealt.
 * We always override:
 *   p0 → emi     (Hunter, maxHp=10)
 *   p1 → unknown (Shadow, maxHp=11)
 *   p2 → allie   (Neutral, maxHp=8)
 *   p3 → franklin (Hunter, maxHp=12)
 */
function makeHermitState(opts: Parameters<typeof makeState>[0] = {}) {
  const s = makeState({ players: ["p0", "p1", "p2", "p3"], ...opts });
  // Force deterministic character assignments for faction-dependent cards.
  getPlayer(s, "p0").characterId = "emi";      // Hunter, maxHp=10
  getPlayer(s, "p1").characterId = "unknown";  // Shadow, maxHp=11
  getPlayer(s, "p2").characterId = "allie";    // Neutral, maxHp=8
  getPlayer(s, "p3").characterId = "franklin"; // Hunter, maxHp=12
  return s;
}

// ─── Hermit's Blackmail ×2 — "If Neutral or Hunter: give 1 equipment to giver, or take 1 damage" ──

test("Hermit's Blackmail — Hunter recipient with equipment gives it to giver", () => {
  // p0 = emi (Hunter), p3 = franklin (Hunter) is the giver.
  const equip = "white:holy_robe#0";
  const s = makeHermitState({ equipment: { p0: [equip] } });
  giveHermit(s, "p3", "p0", hermitCard("hermits_blackmail"), {});
  // p0 gave their equipment to p3.
  expect(getPlayer(s, "p0").equipment).toHaveLength(0);
  expect(getPlayer(s, "p3").equipment).toContain(equip);
  expect(getPlayer(s, "p0").damage).toBe(0); // no damage taken
  // Card discarded face-down to hermit discard.
  expect(s.decks.hermit.discard).toContain(hermitCard("hermits_blackmail"));
});

test("Hermit's Blackmail — Hunter recipient with no equipment takes 1 damage", () => {
  const s = makeHermitState();
  giveHermit(s, "p3", "p0", hermitCard("hermits_blackmail"), {});
  expect(getPlayer(s, "p0").damage).toBe(1);
});

test("Hermit's Blackmail — Neutral recipient (Allie) takes 1 damage when no equipment", () => {
  const s = makeHermitState();
  giveHermit(s, "p3", "p2", hermitCard("hermits_blackmail"), {});
  expect(getPlayer(s, "p2").damage).toBe(1);
});

test("Hermit's Blackmail — Shadow recipient (Unknown) nothing happens (Shadow doesn't match)", () => {
  // p1 = unknown (Shadow) — Blackmail is for Neutral or Hunter, so Shadow doesn't match.
  const s = makeHermitState();
  const damageBefore = getPlayer(s, "p1").damage;
  giveHermit(s, "p0", "p1", hermitCard("hermits_blackmail"), {});
  expect(getPlayer(s, "p1").damage).toBe(damageBefore); // no change
});

// ─── Hermit's Anger ×2 — "If Shadow or Hunter: give 1 equipment to giver, or take 1 damage" ──

test("Hermit's Anger — Hunter recipient with equipment gives it to giver", () => {
  const equip = "black:chainsaw#0";
  const s = makeHermitState({ equipment: { p0: [equip] } });
  giveHermit(s, "p3", "p0", hermitCard("hermits_anger"), {});
  expect(getPlayer(s, "p0").equipment).toHaveLength(0);
  expect(getPlayer(s, "p3").equipment).toContain(equip);
});

test("Hermit's Anger — Shadow recipient (Unknown) with no equipment takes 1 damage", () => {
  const s = makeHermitState();
  giveHermit(s, "p0", "p1", hermitCard("hermits_anger"), {});
  expect(getPlayer(s, "p1").damage).toBe(1);
});

test("Hermit's Anger — Neutral recipient (Allie) nothing happens", () => {
  const s = makeHermitState();
  const damageBefore = getPlayer(s, "p2").damage;
  giveHermit(s, "p0", "p2", hermitCard("hermits_anger"), {});
  expect(getPlayer(s, "p2").damage).toBe(damageBefore);
});

// ─── Hermit's Greed ×2 — "If Neutral or Shadow: give 1 equipment to giver, or take 1 damage" ──

test("Hermit's Greed — Neutral recipient (Allie) with no equipment takes 1 damage", () => {
  const s = makeHermitState();
  giveHermit(s, "p0", "p2", hermitCard("hermits_greed"), {});
  expect(getPlayer(s, "p2").damage).toBe(1);
});

test("Hermit's Greed — Shadow recipient (Unknown) with equipment gives it", () => {
  const equip = "white:talisman#0";
  const s = makeHermitState({ equipment: { p1: [equip] } });
  giveHermit(s, "p0", "p1", hermitCard("hermits_greed"), {});
  expect(getPlayer(s, "p1").equipment).toHaveLength(0);
  expect(getPlayer(s, "p0").equipment).toContain(equip);
});

test("Hermit's Greed — Hunter recipient (Emi) nothing happens", () => {
  const s = makeHermitState();
  const damageBefore = getPlayer(s, "p0").damage;
  giveHermit(s, "p3", "p0", hermitCard("hermits_greed"), {});
  expect(getPlayer(s, "p0").damage).toBe(damageBefore);
});

// ─── Hermit's Slap ×2 — "If Hunter: take 1 damage" ──────────────────────────

test("Hermit's Slap — Hunter recipient (Emi) takes 1 damage", () => {
  const s = makeHermitState();
  giveHermit(s, "p3", "p0", hermitCard("hermits_slap"), {});
  expect(getPlayer(s, "p0").damage).toBe(1);
});

test("Hermit's Slap — Shadow recipient (Unknown) nothing happens", () => {
  const s = makeHermitState();
  giveHermit(s, "p0", "p1", hermitCard("hermits_slap"), {});
  expect(getPlayer(s, "p1").damage).toBe(0);
});

test("Hermit's Slap — Neutral recipient (Allie) nothing happens", () => {
  const s = makeHermitState();
  giveHermit(s, "p0", "p2", hermitCard("hermits_slap"), {});
  expect(getPlayer(s, "p2").damage).toBe(0);
});

// ─── Hermit's Aid ×1 — "If Hunter: heal 1 (if at 0 damage, take 1 instead)" ──

test("Hermit's Aid — Hunter (Emi) with damage > 0 heals 1", () => {
  const s = makeHermitState({ damage: { p0: 3 } });
  giveHermit(s, "p3", "p0", hermitCard("hermits_aid"), {});
  expect(getPlayer(s, "p0").damage).toBe(2);
});

test("Hermit's Aid — Hunter (Emi) at 0 damage takes 1 instead (§6 full-health note)", () => {
  // §6: "if at 0 damage, take 1 instead"
  const s = makeHermitState({ damage: { p0: 0 } });
  giveHermit(s, "p3", "p0", hermitCard("hermits_aid"), {});
  expect(getPlayer(s, "p0").damage).toBe(1);
});

test("Hermit's Aid — Shadow recipient (Unknown) nothing happens", () => {
  const s = makeHermitState({ damage: { p1: 3 } });
  giveHermit(s, "p0", "p1", hermitCard("hermits_aid"), {});
  expect(getPlayer(s, "p1").damage).toBe(3);
});

test("Hermit's Aid — Neutral recipient (Allie) nothing happens", () => {
  const s = makeHermitState({ damage: { p2: 2 } });
  giveHermit(s, "p0", "p2", hermitCard("hermits_aid"), {});
  expect(getPlayer(s, "p2").damage).toBe(2);
});

// ─── Hermit's Nurturance ×1 — "If Neutral: heal 1 (if at 0 damage, take 1 instead)" ──

test("Hermit's Nurturance — Neutral (Allie) with damage > 0 heals 1", () => {
  const s = makeHermitState({ damage: { p2: 4 } });
  giveHermit(s, "p0", "p2", hermitCard("hermits_nurturance"), {});
  expect(getPlayer(s, "p2").damage).toBe(3);
});

test("Hermit's Nurturance — Neutral (Allie) at 0 damage takes 1 instead", () => {
  const s = makeHermitState({ damage: { p2: 0 } });
  giveHermit(s, "p0", "p2", hermitCard("hermits_nurturance"), {});
  expect(getPlayer(s, "p2").damage).toBe(1);
});

test("Hermit's Nurturance — Hunter recipient (Emi) nothing happens", () => {
  const s = makeHermitState({ damage: { p0: 2 } });
  giveHermit(s, "p2", "p0", hermitCard("hermits_nurturance"), {});
  expect(getPlayer(s, "p0").damage).toBe(2);
});

test("Hermit's Nurturance — Shadow recipient (Unknown) nothing happens", () => {
  const s = makeHermitState({ damage: { p1: 5 } });
  giveHermit(s, "p0", "p1", hermitCard("hermits_nurturance"), {});
  expect(getPlayer(s, "p1").damage).toBe(5);
});

// ─── Hermit's Huddle ×1 — "If Shadow: heal 1 (if at 0 damage, take 1 instead)" ──

test("Hermit's Huddle — Shadow (Unknown) with damage > 0 heals 1", () => {
  const s = makeHermitState({ damage: { p1: 6 } });
  giveHermit(s, "p0", "p1", hermitCard("hermits_huddle"), {});
  expect(getPlayer(s, "p1").damage).toBe(5);
});

test("Hermit's Huddle — Shadow (Unknown) at 0 damage takes 1 instead", () => {
  const s = makeHermitState({ damage: { p1: 0 } });
  giveHermit(s, "p0", "p1", hermitCard("hermits_huddle"), {});
  expect(getPlayer(s, "p1").damage).toBe(1);
});

test("Hermit's Huddle — Hunter recipient (Emi) nothing happens", () => {
  const s = makeHermitState({ damage: { p0: 2 } });
  giveHermit(s, "p1", "p0", hermitCard("hermits_huddle"), {});
  expect(getPlayer(s, "p0").damage).toBe(2);
});

test("Hermit's Huddle — Neutral recipient (Allie) nothing happens", () => {
  const s = makeHermitState({ damage: { p2: 1 } });
  giveHermit(s, "p0", "p2", hermitCard("hermits_huddle"), {});
  expect(getPlayer(s, "p2").damage).toBe(1);
});

// ─── Hermit's Spell ×1 — "If Shadow: take 1 damage" ─────────────────────────

test("Hermit's Spell — Shadow (Unknown) takes 1 damage", () => {
  const s = makeHermitState();
  giveHermit(s, "p0", "p1", hermitCard("hermits_spell"), {});
  expect(getPlayer(s, "p1").damage).toBe(1);
});

test("Hermit's Spell — Hunter recipient (Emi) nothing happens", () => {
  const s = makeHermitState();
  giveHermit(s, "p1", "p0", hermitCard("hermits_spell"), {});
  expect(getPlayer(s, "p0").damage).toBe(0);
});

test("Hermit's Spell — Neutral recipient (Allie) nothing happens", () => {
  const s = makeHermitState();
  giveHermit(s, "p0", "p2", hermitCard("hermits_spell"), {});
  expect(getPlayer(s, "p2").damage).toBe(0);
});

// ─── Hermit's Exorcism ×1 — "If Shadow: take 2 damage" ──────────────────────

test("Hermit's Exorcism — Shadow (Unknown) takes 2 damage", () => {
  const s = makeHermitState();
  giveHermit(s, "p0", "p1", hermitCard("hermits_exorcism"), {});
  expect(getPlayer(s, "p1").damage).toBe(2);
});

test("Hermit's Exorcism — Hunter recipient (Emi) nothing happens", () => {
  const s = makeHermitState();
  giveHermit(s, "p1", "p0", hermitCard("hermits_exorcism"), {});
  expect(getPlayer(s, "p0").damage).toBe(0);
});

test("Hermit's Exorcism — Neutral recipient (Allie) nothing happens", () => {
  const s = makeHermitState();
  giveHermit(s, "p0", "p2", hermitCard("hermits_exorcism"), {});
  expect(getPlayer(s, "p2").damage).toBe(0);
});

// ─── Hermit's Bully ×1 — "If max HP ≤ 11: take 1 damage" ────────────────────

test("Hermit's Bully — Emi (maxHp=10 ≤ 11) takes 1 damage", () => {
  const s = makeHermitState();
  giveHermit(s, "p3", "p0", hermitCard("hermits_bully"), {});
  expect(getPlayer(s, "p0").damage).toBe(1);
});

test("Hermit's Bully — Unknown (maxHp=11 ≤ 11) takes 1 damage", () => {
  const s = makeHermitState();
  giveHermit(s, "p0", "p1", hermitCard("hermits_bully"), {});
  expect(getPlayer(s, "p1").damage).toBe(1);
});

test("Hermit's Bully — Allie (maxHp=8 ≤ 11) takes 1 damage", () => {
  const s = makeHermitState();
  giveHermit(s, "p0", "p2", hermitCard("hermits_bully"), {});
  expect(getPlayer(s, "p2").damage).toBe(1);
});

test("Hermit's Bully — Franklin (maxHp=12 > 11) nothing happens", () => {
  const s = makeHermitState();
  giveHermit(s, "p0", "p3", hermitCard("hermits_bully"), {});
  expect(getPlayer(s, "p3").damage).toBe(0);
});

// ─── Hermit's Tough Lesson of Love ×1 — "If max HP ≥ 12: take 2 damage" ──────

test("Hermit's Tough Lesson of Love — Franklin (maxHp=12 ≥ 12) takes 2 damage", () => {
  const s = makeHermitState();
  giveHermit(s, "p0", "p3", hermitCard("hermits_tough_lesson_of_love"), {});
  expect(getPlayer(s, "p3").damage).toBe(2);
});

test("Hermit's Tough Lesson of Love — Emi (maxHp=10 < 12) nothing happens", () => {
  const s = makeHermitState();
  giveHermit(s, "p3", "p0", hermitCard("hermits_tough_lesson_of_love"), {});
  expect(getPlayer(s, "p0").damage).toBe(0);
});

test("Hermit's Tough Lesson of Love — Unknown (maxHp=11 < 12) nothing happens", () => {
  const s = makeHermitState();
  giveHermit(s, "p0", "p1", hermitCard("hermits_tough_lesson_of_love"), {});
  expect(getPlayer(s, "p1").damage).toBe(0);
});

test("Hermit's Tough Lesson of Love — Allie (maxHp=8 < 12) nothing happens", () => {
  const s = makeHermitState();
  giveHermit(s, "p0", "p2", hermitCard("hermits_tough_lesson_of_love"), {});
  expect(getPlayer(s, "p2").damage).toBe(0);
});

// ─── Hermit's Prediction ×1 — "Privately show your character card to the giver" ──

test("Hermit's Prediction — writes shownCards[giver] with recipient's characterId (§12.11)", () => {
  // §6 / §12.11: Prediction shows actual character card to giver (always resolves).
  const s = makeHermitState();
  // p3 (franklin) is giver; p1 (unknown) is recipient.
  giveHermit(s, "p3", "p1", hermitCard("hermits_prediction"), {});
  // Giver p3 now knows p1's character.
  expect(s.shownCards["p3"]).toBeDefined();
  expect(s.shownCards["p3"]).toContain("unknown");
  // Recipient p1 is NOT publicly revealed.
  expect(getPlayer(s, "p1").revealed).toBe(false);
  // No damage or heal.
  expect(getPlayer(s, "p1").damage).toBe(0);
});

test("Hermit's Prediction — appends to existing shownCards if giver already has seen others", () => {
  const s = makeHermitState();
  // Give p0 some prior knowledge.
  s.shownCards["p0"] = ["allie"];
  giveHermit(s, "p0", "p1", hermitCard("hermits_prediction"), {});
  expect(s.shownCards["p0"]).toContain("allie");
  expect(s.shownCards["p0"]).toContain("unknown");
});

test("Hermit's Prediction — no damage change to recipient", () => {
  const s = makeHermitState({ damage: { p1: 3 } });
  giveHermit(s, "p0", "p1", hermitCard("hermits_prediction"), {});
  expect(getPlayer(s, "p1").damage).toBe(3);
});

// ─── Card discard — resolved Hermit cards go to hermit discard face-down (§6) ─

test("All Hermit single-use cards discard to hermit discard after resolution", () => {
  // Test with Hermit's Slap on a Hunter (p0=emi).
  const s = makeHermitState();
  const cardId = hermitCard("hermits_slap");
  giveHermit(s, "p3", "p0", cardId, {});
  expect(s.decks.hermit.discard).toContain(cardId);
});

test("Hermit's Prediction discards to hermit discard", () => {
  const s = makeHermitState();
  const cardId = hermitCard("hermits_prediction");
  giveHermit(s, "p3", "p1", cardId, {});
  expect(s.decks.hermit.discard).toContain(cardId);
});

test("Non-matching card also discards to hermit discard", () => {
  // Shadow recipient on Hermit's Slap (Hunter-only) → nothing happens but card still discards.
  const s = makeHermitState();
  const cardId = hermitCard("hermits_slap");
  giveHermit(s, "p0", "p1", cardId, {});
  expect(s.decks.hermit.discard).toContain(cardId);
});

// ─── Unknown (§12.11) — may lie about identity or decline without revealing ────

test("Unknown lying on Hermit's Slap (Hunter card) — opts.lie=true applies damage", () => {
  // p1 = unknown (Shadow). Slap targets Hunters. Unknown lies → takes 1 damage.
  // §12.11: "you may lie about your identity to trigger it"
  const s = makeHermitState();
  giveHermit(s, "p0", "p1", hermitCard("hermits_slap"), { lie: true });
  expect(getPlayer(s, "p1").damage).toBe(1);
  // Unknown should NOT be publicly revealed.
  expect(getPlayer(s, "p1").revealed).toBe(false);
});

test("Unknown declining Hermit's Slap — opts.decline=true nothing happens, no reveal", () => {
  // §12.11: Unknown may say "Nothing happens" without revealing.
  const s = makeHermitState();
  giveHermit(s, "p0", "p1", hermitCard("hermits_slap"), { decline: true });
  expect(getPlayer(s, "p1").damage).toBe(0);
  expect(getPlayer(s, "p1").revealed).toBe(false);
});

test("Unknown lying on Hermit's Nurturance (Neutral card) — heals 1 at damage > 0", () => {
  // p1 = unknown (Shadow). Nurturance targets Neutrals. Unknown lies → heals 1.
  const s = makeHermitState({ damage: { p1: 5 } });
  giveHermit(s, "p0", "p1", hermitCard("hermits_nurturance"), { lie: true });
  expect(getPlayer(s, "p1").damage).toBe(4);
  expect(getPlayer(s, "p1").revealed).toBe(false);
});

test("Unknown lying on heal card at 0 damage — takes 1 instead (§6 full-health note)", () => {
  // Unknown lies about being Neutral to trigger Nurturance at 0 HP → takes 1.
  const s = makeHermitState({ damage: { p1: 0 } });
  giveHermit(s, "p0", "p1", hermitCard("hermits_nurturance"), { lie: true });
  expect(getPlayer(s, "p1").damage).toBe(1);
});

test("Unknown cannot fake Hermit's Prediction — actual characterId always shown (§12.11)", () => {
  // §12.11: "Hermit's Prediction shows the actual card and cannot be faked."
  // Regardless of lie/decline opts, Prediction always writes the real characterId.
  const s = makeHermitState();
  giveHermit(s, "p0", "p1", hermitCard("hermits_prediction"), { lie: true });
  expect(s.shownCards["p0"]).toContain("unknown"); // real identity shown
});

test("Unknown declining Prediction — card still resolves and shows real identity (§12.11)", () => {
  // "decline" cannot suppress Prediction — it always reveals to the giver.
  const s = makeHermitState();
  giveHermit(s, "p0", "p1", hermitCard("hermits_prediction"), { decline: true });
  expect(s.shownCards["p0"]).toContain("unknown");
  expect(getPlayer(s, "p1").revealed).toBe(false); // not publicly revealed
});

// ─── Equipment-give branch — first equipment transferred ──────────────────────

test("Hermit's Blackmail — Neutral (Allie) with multiple equipment gives first one to giver", () => {
  const equip1 = "white:fortune_brooch#0";
  const equip2 = "black:chainsaw#0";
  const s = makeHermitState({ equipment: { p2: [equip1, equip2] } });
  giveHermit(s, "p0", "p2", hermitCard("hermits_blackmail"), {});
  // Gives first equipment (equip1) to giver p0.
  expect(getPlayer(s, "p2").equipment).not.toContain(equip1);
  expect(getPlayer(s, "p0").equipment).toContain(equip1);
  // equip2 stays with recipient.
  expect(getPlayer(s, "p2").equipment).toContain(equip2);
  expect(getPlayer(s, "p2").damage).toBe(0); // no damage
});

test("Hermit's Greed — Shadow (Unknown) with equipment gives first to giver", () => {
  const equip = "black:handgun#0";
  const s = makeHermitState({ equipment: { p1: [equip] } });
  giveHermit(s, "p0", "p1", hermitCard("hermits_greed"), {});
  expect(getPlayer(s, "p1").equipment).toHaveLength(0);
  expect(getPlayer(s, "p0").equipment).toContain(equip);
});

// ─── Events emitted ────────────────────────────────────────────────────────────

test("Hermit's Slap emits a Damaged event on Hunter", () => {
  const s = makeHermitState();
  const events = giveHermit(s, "p3", "p0", hermitCard("hermits_slap"), {});
  const damageEvts = events.filter((e) => e.type === "Damaged");
  expect(damageEvts).toHaveLength(1);
});

test("Hermit's Slap emits no events on Shadow (no match)", () => {
  const s = makeHermitState();
  const events = giveHermit(s, "p0", "p1", hermitCard("hermits_slap"), {});
  expect(events).toHaveLength(0);
});

test("Hermit's Blackmail give emits EquipmentTaken or CardGiven event", () => {
  const equip = "white:talisman#0";
  const s = makeHermitState({ equipment: { p0: [equip] } });
  const events = giveHermit(s, "p3", "p0", hermitCard("hermits_blackmail"), {});
  const xferEvts = events.filter(
    (e) => e.type === "EquipmentTaken" || e.type === "CardGiven",
  );
  expect(xferEvts.length).toBeGreaterThan(0);
});

test("Hermit's Aid emits a Healed event on Hunter with damage", () => {
  const s = makeHermitState({ damage: { p0: 4 } });
  const events = giveHermit(s, "p3", "p0", hermitCard("hermits_aid"), {});
  const healEvts = events.filter((e) => e.type === "Healed");
  expect(healEvts).toHaveLength(1);
});
