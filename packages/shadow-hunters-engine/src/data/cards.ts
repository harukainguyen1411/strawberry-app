// Static card data for the Shadow Hunters base game.
// Source of truth: ruleset.md §6 (card decks, 16/16/16).
// Per-card counts are [COMMUNITY]; logic does not depend on exact duplicate counts.

import type { DeckKind } from "../types.js";

export interface CardDef {
  id: string;           // stable, dash-case identity (no spaces, no #)
  deck: DeckKind;
  name: string;
  count: number;        // number of physical copies in the deck
  kind: "single" | "equipment";
  effectKey: string;    // what handlers register against (same as id for now)
}

// ── White deck — Church (§6, §7) ─────────────────────────────────────────────
// Total: 2 + 1×14 = 16  [COMMUNITY]
export const WHITE: CardDef[] = [
  {
    id: "holy_water_of_healing",
    deck: "white",
    name: "Holy Water of Healing",
    count: 2,
    kind: "single",
    effectKey: "holy_water_of_healing",
  },
  {
    id: "flare_of_judgement",
    deck: "white",
    name: "Flare of Judgement",
    count: 1,
    kind: "single",
    effectKey: "flare_of_judgement",
  },
  {
    id: "first_aid",
    deck: "white",
    name: "First Aid",
    count: 1,
    kind: "single",
    effectKey: "first_aid",
    // §12.12: absolute set to 7 then death check
  },
  {
    id: "concealed_knowledge",
    deck: "white",
    name: "Concealed Knowledge",
    count: 1,
    kind: "single",
    effectKey: "concealed_knowledge",
    // §12.10: grants one full extra turn after current turn ends
  },
  {
    id: "guardian_angel",
    deck: "white",
    name: "Guardian Angel",
    count: 1,
    kind: "single",
    effectKey: "guardian_angel",
    // §12.9: immunity from attacks only until next turn
  },
  {
    id: "disenchant_mirror",
    deck: "white",
    name: "Disenchant Mirror",
    count: 1,
    kind: "single",
    effectKey: "disenchant_mirror",
    // §6: any Shadow must reveal — except Unknown (may lie)
  },
  {
    id: "blessing",
    deck: "white",
    name: "Blessing",
    count: 1,
    kind: "single",
    effectKey: "blessing",
    // §6: choose another character; heal them by a d6 roll
  },
  {
    id: "chocolate",
    deck: "white",
    name: "Chocolate",
    count: 1,
    kind: "single",
    effectKey: "chocolate",
    // §6: if name starts A/E/U, may reveal; if revealed, fully heal
  },
  {
    id: "advent",
    deck: "white",
    name: "Advent",
    count: 1,
    kind: "single",
    effectKey: "advent",
    // §6: if Hunter, may reveal; if revealed, fully heal
  },
  // ── White equipment cards ─────────────────────────────────────────────────
  {
    id: "fortune_brooch",
    deck: "white",
    name: "Fortune Brooch",
    count: 1,
    kind: "equipment",
    effectKey: "fortune_brooch",
    // §6: immune to Weird Woods damage
  },
  {
    id: "talisman",
    deck: "white",
    name: "Talisman",
    count: 1,
    kind: "equipment",
    effectKey: "talisman",
    // §6: immune to Black cards Bloodthirsty Spider, Vampire Bat, Dynamite
  },
  {
    id: "mystic_compass",
    deck: "white",
    name: "Mystic Compass",
    count: 1,
    kind: "equipment",
    effectKey: "mystic_compass",
    // §6: on move, roll twice, choose (optional; §9)
  },
  {
    id: "silver_rosary",
    deck: "white",
    name: "Silver Rosary",
    count: 1,
    kind: "equipment",
    effectKey: "silver_rosary",
    // §6 / §11: on a kill by your attack, take all victim's equipment
  },
  {
    id: "spear_of_longinus",
    deck: "white",
    name: "Spear of Longinus",
    count: 1,
    kind: "equipment",
    effectKey: "spear_of_longinus",
    // §6 / §10: Hunter only — on a damaging attack may reveal for +2 damage
  },
  {
    id: "holy_robe",
    deck: "white",
    name: "Holy Robe",
    count: 1,
    kind: "equipment",
    effectKey: "holy_robe",
    // §6 / §10: attacks deal -1; incoming attack damage -1 (stacks, §10)
  },
];

// ── Black deck — Cemetery (§6, §7) ───────────────────────────────────────────
// Total: 3 + 2 + 1×11 = 16  [COMMUNITY]
export const BLACK: CardDef[] = [
  {
    id: "vampire_bat",
    deck: "black",
    name: "Vampire Bat",
    count: 3,
    kind: "single",
    effectKey: "vampire_bat",
    // §6: target +2 damage; self heal 1
  },
  {
    id: "moody_goblin",
    deck: "black",
    name: "Moody Goblin",
    count: 2,
    kind: "single",
    effectKey: "moody_goblin",
    // §6: take one equipment from any character and equip it
  },
  {
    id: "bloodthirsty_spider",
    deck: "black",
    name: "Bloodthirsty Spider",
    count: 1,
    kind: "single",
    effectKey: "bloodthirsty_spider",
    // §6 / §12.13: target takes 2, then you take 2 (target first, win checks between)
  },
  {
    id: "spiritual_doll",
    deck: "black",
    name: "Spiritual Doll",
    count: 1,
    kind: "single",
    effectKey: "spiritual_doll",
    // §6 / §12.13: roll d6: 1–4 → target takes 3; 5–6 → you take 3
  },
  {
    id: "dynamite",
    deck: "black",
    name: "Dynamite",
    count: 1,
    kind: "single",
    effectKey: "dynamite",
    // §6 / §12.2: roll d6+d4; every char in matching area takes 3; total 7 = nothing
  },
  {
    id: "banana_peel",
    deck: "black",
    name: "Banana Peel",
    count: 1,
    kind: "single",
    effectKey: "banana_peel",
    // §6: give one equipment to a character; if none, take 1 damage
  },
  {
    id: "diabolic_ritual",
    deck: "black",
    name: "Diabolic Ritual",
    count: 1,
    kind: "single",
    effectKey: "diabolic_ritual",
    // §6: if Shadow, may reveal; if revealed, fully heal
  },
  // ── Black equipment cards ─────────────────────────────────────────────────
  {
    id: "chainsaw",
    deck: "black",
    name: "Chainsaw",
    count: 1,
    kind: "equipment",
    effectKey: "chainsaw",
    // §6 / §10: successful attacks +1 (stacks)
  },
  {
    id: "butcher_knife",
    deck: "black",
    name: "Butcher Knife",
    count: 1,
    kind: "equipment",
    effectKey: "butcher_knife",
    // §6 / §10: successful attacks +1 (stacks)
  },
  {
    id: "rusted_broad_axe",
    deck: "black",
    name: "Rusted Broad Axe",
    count: 1,
    kind: "equipment",
    effectKey: "rusted_broad_axe",
    // §6 / §10: successful attacks +1 (stacks)
  },
  {
    id: "machine_gun",
    deck: "black",
    name: "Machine Gun",
    count: 1,
    kind: "equipment",
    effectKey: "machine_gun",
    // §6 / §10 / §12.2: on attack, roll once, apply to all valid targets in range
  },
  {
    id: "handgun",
    deck: "black",
    name: "Handgun",
    count: 1,
    kind: "equipment",
    effectKey: "handgun",
    // §6 / §10: attack range = every area except your own pair
  },
  {
    id: "cursed_sword_masamune",
    deck: "black",
    name: "Cursed Sword Masamune",
    count: 1,
    kind: "equipment",
    effectKey: "cursed_sword_masamune",
    // §6 / §10: must attack if able; roll only d4 (never misses); +modifiers apply
  },
];

// ── Hermit deck — Hermit's Cabin (§6, §7) ────────────────────────────────────
// Resolved against recipient's identity; face-down discard (§6).
// Total: 2+2+2+2+1+1+1+1+1+1+1+1 = 16  [COMMUNITY]
export const HERMIT: CardDef[] = [
  {
    id: "hermits_blackmail",
    deck: "hermit",
    name: "Hermit's Blackmail",
    count: 2,
    kind: "single",
    effectKey: "hermits_blackmail",
    // §6: if Neutral or Hunter: give 1 equipment to giver, or take 1 damage
  },
  {
    id: "hermits_anger",
    deck: "hermit",
    name: "Hermit's Anger",
    count: 2,
    kind: "single",
    effectKey: "hermits_anger",
    // §6: if Shadow or Hunter: give 1 equipment to giver, or take 1 damage
  },
  {
    id: "hermits_greed",
    deck: "hermit",
    name: "Hermit's Greed",
    count: 2,
    kind: "single",
    effectKey: "hermits_greed",
    // §6: if Neutral or Shadow: give 1 equipment to giver, or take 1 damage
  },
  {
    id: "hermits_slap",
    deck: "hermit",
    name: "Hermit's Slap",
    count: 2,
    kind: "single",
    effectKey: "hermits_slap",
    // §6: if Hunter: take 1 damage
  },
  {
    id: "hermits_aid",
    deck: "hermit",
    name: "Hermit's Aid",
    count: 1,
    kind: "single",
    effectKey: "hermits_aid",
    // §6: if Hunter: heal 1 (if at 0 damage, take 1 instead)
  },
  {
    id: "hermits_nurturance",
    deck: "hermit",
    name: "Hermit's Nurturance",
    count: 1,
    kind: "single",
    effectKey: "hermits_nurturance",
    // §6: if Neutral: heal 1 (if at 0 damage, take 1 instead)
  },
  {
    id: "hermits_huddle",
    deck: "hermit",
    name: "Hermit's Huddle",
    count: 1,
    kind: "single",
    effectKey: "hermits_huddle",
    // §6: if Shadow: heal 1 (if at 0 damage, take 1 instead)
  },
  {
    id: "hermits_spell",
    deck: "hermit",
    name: "Hermit's Spell",
    count: 1,
    kind: "single",
    effectKey: "hermits_spell",
    // §6: if Shadow: take 1 damage
  },
  {
    id: "hermits_exorcism",
    deck: "hermit",
    name: "Hermit's Exorcism",
    count: 1,
    kind: "single",
    effectKey: "hermits_exorcism",
    // §6: if Shadow: take 2 damage
  },
  {
    id: "hermits_bully",
    deck: "hermit",
    name: "Hermit's Bully",
    count: 1,
    kind: "single",
    effectKey: "hermits_bully",
    // §6: if max HP ≤ 11: take 1 damage
  },
  {
    id: "hermits_tough_lesson_of_love",
    deck: "hermit",
    name: "Hermit's Tough Lesson of Love",
    count: 1,
    kind: "single",
    effectKey: "hermits_tough_lesson_of_love",
    // §6: if max HP ≥ 12: take 2 damage
  },
  {
    id: "hermits_prediction",
    deck: "hermit",
    name: "Hermit's Prediction",
    count: 1,
    kind: "single",
    effectKey: "hermits_prediction",
    // §6 / §12.11: privately show character card to giver (always resolves; no damage)
  },
];
