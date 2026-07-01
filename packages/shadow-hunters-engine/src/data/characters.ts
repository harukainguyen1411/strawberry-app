// Static character roster data for the Shadow Hunters base game.
// Source of truth: ruleset.md §5 (roster & abilities) and §4 (win conditions).
// HP values: Allie=8 [RULEBOOK]; others [COMMUNITY] — see ruleset.md §14.

import type { CharacterId, Faction } from "../types.js";

export interface CharacterDef {
  id: CharacterId;
  name: string;
  faction: Faction;
  maxHp: number;
  ability: string;       // short mechanical summary, original wording per §5
  winCondition: string;  // per §4
}

// §5: 10 base characters (Hunters 3, Shadows 3, Neutrals 4)
export const CHARACTERS: CharacterDef[] = [
  // ── Hunters ─────────────────────────────────────────────────────────────────
  {
    id: "emi",
    name: "Emi",
    faction: "Hunter",
    maxHp: 10, // [COMMUNITY]
    ability:
      "Teleport. On your move, instead of rolling, move to the Area paired with your current one, OR the closest Area in the opposite pair.",
    winCondition: "All Shadow characters are dead.", // §4 Hunter win
  },
  {
    id: "franklin",
    name: "Franklin",
    faction: "Hunter",
    maxHp: 12, // [COMMUNITY]
    ability:
      "Lightning. Once per game, at the start of your turn, choose any character and deal damage = one d6 roll.",
    winCondition: "All Shadow characters are dead.",
  },
  {
    id: "george",
    name: "George",
    faction: "Hunter",
    maxHp: 14, // [COMMUNITY]
    ability:
      "Demolish. Once per game, at the start of your turn, choose any character and deal damage = one d4 roll.",
    winCondition: "All Shadow characters are dead.",
  },
  // ── Shadows ──────────────────────────────────────────────────────────────────
  {
    id: "unknown",
    name: "Unknown",
    faction: "Shadow",
    maxHp: 11, // [COMMUNITY]
    ability:
      "Deceit. When given a Hermit card, you may lie about your identity to trigger it, or say \"Nothing happens\" — without revealing.",
    winCondition: "All Hunter characters are dead.", // §4 Shadow win
  },
  {
    id: "vampire",
    name: "Vampire",
    faction: "Shadow",
    maxHp: 13, // [COMMUNITY]
    ability:
      "Suck Blood. When you attack and deal damage, immediately heal 2 of your own damage.",
    winCondition: "All Hunter characters are dead.",
  },
  {
    id: "werewolf",
    name: "Werewolf",
    faction: "Shadow",
    maxHp: 14, // [COMMUNITY]
    ability:
      "Counterattack. When attacked, you may counterattack immediately after the initial attack resolves (may reveal to do so).",
    winCondition: "All Hunter characters are dead.",
  },
  // ── Neutrals ─────────────────────────────────────────────────────────────────
  {
    id: "allie",
    name: "Allie",
    faction: "Neutral",
    maxHp: 8, // [RULEBOOK]
    ability: "Mother's Love. Once per game, fully heal your damage (set to 0).",
    winCondition: "Be alive when the game ends.", // §4 Allie win
  },
  {
    id: "bob",
    name: "Bob",
    faction: "Neutral",
    maxHp: 10, // [COMMUNITY]
    ability:
      "Robbery. 4–6 players: if you would deal 2+ attack damage, instead take 1 Equipment of your choice from the target (no damage). 7–8 players: if your attack kills, take all the victim's Equipment.",
    winCondition: "Possess 5+ Equipment cards.", // §4 Bob win
  },
  {
    id: "charles",
    name: "Charles",
    faction: "Neutral",
    maxHp: 11, // [COMMUNITY]
    ability:
      "Bloody Feast. After you attack, you may deal 2 damage to yourself to attack the same character again.",
    winCondition:
      "Be the player whose attack delivers the kill that brings the total dead to 3+.", // §4 Charles win
  },
  {
    id: "daniel",
    name: "Daniel",
    faction: "Neutral",
    maxHp: 13, // [COMMUNITY]
    ability:
      "Scream. You are forced to reveal when any character dies; you may not reveal at any other time.",
    winCondition:
      "Be the first character to die, OR survive while the Hunters win.", // §4 Daniel win
  },
];
