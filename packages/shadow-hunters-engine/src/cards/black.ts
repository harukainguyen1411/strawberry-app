// Black card handlers for the Shadow Hunters engine.
// Source of truth: ruleset.md §6 (Black deck), §12.2, §12.13.
//
// Each handler is keyed by effectKey (matches CardDef.effectKey in data/cards.ts).
// playCard(state, playerId, cardId, opts?) looks up the def, runs the handler,
// then routes the card to player.equipment or black discard.
//
// §6 Black deck: 16 cards, 13 distinct effectKeys:
//   vampire_bat ×3, moody_goblin ×2, rest ×1.
//
// Equipment cards: chainsaw, butcher_knife, rusted_broad_axe, machine_gun,
//   handgun, cursed_sword_masamune → go to player.equipment, NEVER discarded.
// Single-use cards: everything else → discarded to black discard after resolution.
//
// Immunity guards (§6, damage.ts enforces by source):
//   Talisman blocks: bloodthirsty_spider / vampire_bat / dynamite
//   Fortune Brooch blocks: weird_woods only (no Black card maps to "weird_woods" source)
//
// §12.13: Bloodthirsty Spider / Spiritual Doll — target-first ordering with
//   death+win checks after each sub-damage.
// §12.2: Dynamite AoE deaths are simultaneous; win-check once after all.

import { applyDamage, applyHeal } from "../damage.js";
import { BLACK } from "../data/cards.js";
import { CHARACTERS } from "../data/characters.js";
import { AREA_BY_DICE } from "../data/areas.js";
import { rollD6, rollD4 } from "../rng.js";
import type { GameState, GameEvent, PlayerId, CardId } from "../types.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlayCardOpts {
  /** Target player id (for cards that need a target). */
  target?: PlayerId;
  /**
   * Option string for conditional cards:
   *   - Diabolic Ritual: pass "reveal" to trigger the reveal-and-heal branch.
   */
  option?: string;
  /**
   * Injected dice for deterministic tests (Spiritual Doll, Dynamite).
   * Shape mirrors CombatDice from combat.ts but is not imported to avoid cycles.
   */
  dice?: { d6: number; d4: number };
}

type HandlerCtx = {
  state: GameState;
  caster: PlayerId;
  cardId: CardId;
  opts: PlayCardOpts;
};

type BlackHandler = (ctx: HandlerCtx) => GameEvent[];

// ─── Utility ─────────────────────────────────────────────────────────────────

function getPlayer(state: GameState, id: PlayerId) {
  const p = state.players.find((pl) => pl.id === id);
  if (!p) throw new Error(`black.ts: player "${id}" not found`);
  return p;
}

function factionOf(characterId: string): string {
  const def = CHARACTERS.find((c) => c.id === characterId);
  if (!def) throw new Error(`black.ts: unknown character "${characterId}"`);
  return def.faction;
}

// ─── Handlers ────────────────────────────────────────────────────────────────

/**
 * Vampire Bat (×3)
 * §6: "Single-use. A target takes 2; you heal 1."
 * Source "vampire_bat" is blocked by Talisman (§6 immunity in damage.ts).
 * The self-heal uses a distinct source so it is NOT blocked by the target's Talisman.
 */
const vampireBat: BlackHandler = ({ state, caster, opts }) => {
  if (!opts.target) throw new Error("Vampire Bat requires a target");
  const events: GameEvent[] = [];
  // Target takes 2 (source "vampire_bat" — talisman blocks this).
  events.push(...applyDamage(state, opts.target, 2, "vampire_bat", null));
  // Caster heals 1 (self-heal is a distinct source, not blocked by talisman).
  events.push(...applyHeal(state, caster, 1, "vampire_bat_self"));
  return events;
};

/**
 * Moody Goblin (×2)
 * §6: "Single-use. Take one equipment from a character and equip it."
 * Takes the first equipment of the target (deterministic). If target has none, does nothing.
 */
const moodyGoblin: BlackHandler = ({ state, caster, opts }) => {
  if (!opts.target) throw new Error("Moody Goblin requires a target");
  const target = getPlayer(state, opts.target);
  const casterPlayer = getPlayer(state, caster);

  if (target.equipment.length === 0) return []; // nothing to take

  const card = target.equipment[0]!;
  target.equipment = target.equipment.slice(1);
  casterPlayer.equipment.push(card);

  const evt: GameEvent = {
    type: "EquipmentTaken",
    player: caster,
    from: opts.target,
    card,
  };
  state.log.push(evt);
  return [evt];
};

/**
 * Bloodthirsty Spider (×1)
 * §6: "Single-use. Target takes 2, then you take 2 (target first)."
 * §12.13: apply sub-damages in stated order (target first, then self), with
 *   death+win checks after each sub-damage. If game ends mid-effect, stop.
 * Source "bloodthirsty_spider" is blocked by Talisman on the TARGET (§6).
 * The caster's self-damage uses "bloodthirsty_spider_self" (not talisman-blocked).
 */
const bloodthirstySpider: BlackHandler = ({ state, caster, opts }) => {
  if (!opts.target) throw new Error("Bloodthirsty Spider requires a target");
  const events: GameEvent[] = [];

  // Step 1: target takes 2 (source blocked by Talisman). §12.13 target-first.
  events.push(...applyDamage(state, opts.target, 2, "bloodthirsty_spider", null));
  if (state.over) return events; // game may end after target damage (§12.1/§12.13)

  // Step 2: caster takes 2 (self-damage, not talisman-blocked). §12.13 self-second.
  events.push(...applyDamage(state, caster, 2, "bloodthirsty_spider_self", null));
  return events;
};

/**
 * Spiritual Doll (×1)
 * §6: "Single-use. Roll d6: 1–4 → target takes 3; 5–6 → you take 3."
 * §12.13: single roll determines who suffers; the losing sub-damage is the only one applied,
 *   so there is no ordering ambiguity here (only one player is ever damaged).
 * Source is "spiritual_doll" (not talisman-blocked per §6 — Talisman blocks only
 *   Bloodthirsty Spider / Vampire Bat / Dynamite per the ruleset).
 */
const spiritualDoll: BlackHandler = ({ state, caster, opts }) => {
  if (!opts.target) throw new Error("Spiritual Doll requires a target");

  // Roll d6 using injected dice (for tests) or the state RNG.
  const d6 = opts.dice ? opts.dice.d6 : rollD6(state.rng);

  if (d6 <= 4) {
    // 1–4: target takes 3.
    return applyDamage(state, opts.target, 3, "spiritual_doll", null);
  } else {
    // 5–6: caster takes 3.
    return applyDamage(state, caster, 3, "spiritual_doll_self", null);
  }
};

/**
 * Dynamite (×1)
 * §6: "Single-use. Roll d6+d4; every character in the matching area takes 3
 *   (total 7 = nothing)."
 * §12.2: AoE deaths from a single effect are simultaneous; win-check runs after all.
 * Source "dynamite" is blocked by Talisman (§6 immunity in damage.ts).
 * Uses AREA_BY_DICE (§7) to map the roll to an area. A roll of 7 maps to "wild",
 * which means no area → no damage (as per §6 "total 7 = nothing").
 */
const dynamite: BlackHandler = ({ state, opts }) => {
  // Roll d6+d4 using injected dice (for tests) or the state RNG.
  const d6 = opts.dice ? opts.dice.d6 : rollD6(state.rng);
  const d4 = opts.dice ? opts.dice.d4 : rollD4(state.rng);
  const total = d6 + d4;

  // §6: total 7 = nothing (the "wild" entry means no area match). §7
  const areaResult = AREA_BY_DICE[total];
  if (!areaResult || areaResult === "wild") return []; // total 7 = nothing

  const targetArea = areaResult;
  const events: GameEvent[] = [];

  // Every character in the matching area takes 3. Collect targets first to handle
  // simultaneous deaths correctly (§12.2): we resolve all, then let winCheck run.
  for (const p of state.players) {
    if (!p.alive) continue;
    if (p.area !== targetArea) continue;
    events.push(...applyDamage(state, p.id, 3, "dynamite", null));
    if (state.over) break; // §12.1: game may end mid-AoE
  }
  return events;
};

/**
 * Banana Peel (×1)
 * §6: "Single-use. Give one of your equipment to a character; if none, take 1 damage."
 * Gives the caster's first equipment (deterministic default) to the target.
 * If the caster has no equipment, caster takes 1 damage instead.
 */
const bananaPeel: BlackHandler = ({ state, caster, opts }) => {
  if (!opts.target) throw new Error("Banana Peel requires a target");
  const casterPlayer = getPlayer(state, caster);

  if (casterPlayer.equipment.length === 0) {
    // Caster has no equipment → take 1 damage. §6
    return applyDamage(state, caster, 1, "banana_peel_self", null);
  }

  // Give the first equipment to the target.
  const card = casterPlayer.equipment[0]!;
  casterPlayer.equipment = casterPlayer.equipment.slice(1);
  const targetPlayer = getPlayer(state, opts.target);
  targetPlayer.equipment.push(card);

  const evt: GameEvent = {
    type: "CardGiven",
    from: caster,
    to: opts.target,
    card,
  };
  state.log.push(evt);
  return [evt];
};

/**
 * Diabolic Ritual (×1)
 * §6: "Single-use. If you are a Shadow, you may reveal; if revealed, fully heal."
 * The reveal is optional; the player passes opts.option = "reveal" to trigger it.
 * If the caster is not a Shadow, nothing happens regardless of the option.
 * Mirrors the pattern of Advent / Chocolate in white.ts.
 */
const diabolicRitual: BlackHandler = ({ state, caster, opts }) => {
  const p = getPlayer(state, caster);
  if (factionOf(p.characterId) !== "Shadow") return []; // not a Shadow
  if (opts.option !== "reveal") return []; // player chose not to reveal

  const events: GameEvent[] = [];

  // Reveal if not already (idempotent).
  if (!p.revealed) {
    p.revealed = true;
    const revealEvt: GameEvent = {
      type: "Revealed",
      player: caster,
      characterId: p.characterId,
    };
    events.push(revealEvt);
    state.log.push(revealEvt);
  }

  // If now revealed and alive, fully heal.
  if (p.revealed && p.alive) {
    events.push(...applyHeal(state, caster, p.damage, "diabolic_ritual"));
  }

  return events;
};

// ─── Equipment handlers (equip to player; routing happens in playCard) ────────

/** Equipment cards: the handler only validates / emits; routing is in playCard. */
const equipHandler: BlackHandler = () => [];

// ─── Handler registry ─────────────────────────────────────────────────────────

/** All 13 Black effectKey handlers. */
export const BLACK_HANDLERS: Record<string, BlackHandler> = {
  vampire_bat: vampireBat,
  moody_goblin: moodyGoblin,
  bloodthirsty_spider: bloodthirstySpider,
  spiritual_doll: spiritualDoll,
  dynamite: dynamite,
  banana_peel: bananaPeel,
  diabolic_ritual: diabolicRitual,
  // Equipment cards — equip routing is handled by playCard.
  chainsaw: equipHandler,
  butcher_knife: equipHandler,
  rusted_broad_axe: equipHandler,
  machine_gun: equipHandler,
  handgun: equipHandler,
  cursed_sword_masamune: equipHandler,
};

// ─── playCard ─────────────────────────────────────────────────────────────────

/**
 * Resolve a Black card: run the handler, then route the card to equipment or discard.
 *
 * @param state   — mutated in place (same pattern as damage.ts / combat.ts).
 * @param caster  — the PlayerId playing the card.
 * @param cardId  — instanced card id (e.g. "black:vampire_bat#0").
 * @param opts    — optional target / option / dice for conditional/AoE cards.
 * @returns       — the events produced (also pushed to state.log inside handlers).
 */
export function playCard(
  state: GameState,
  caster: PlayerId,
  cardId: CardId,
  opts: PlayCardOpts = {},
): GameEvent[] {
  // Resolve the effectKey from the card id.
  // Card id form: "<deck>:<effectKey>#<copy>".
  const match = /^black:([^#]+)/.exec(cardId);
  if (!match) throw new Error(`playCard: invalid black card id "${cardId}"`);
  const effectKey = match[1]!;

  // Look up the card definition to determine kind (single / equipment).
  const def = BLACK.find((d) => d.effectKey === effectKey);
  if (!def) throw new Error(`playCard: unknown black effectKey "${effectKey}"`);

  // Look up and run the handler.
  const handler = BLACK_HANDLERS[effectKey];
  if (!handler) throw new Error(`playCard: no handler for black effectKey "${effectKey}"`);

  const events = handler({ state, caster, cardId, opts });

  // Route the card: equipment → player.equipment; single-use → black discard.
  // §6: "Equipment cards stay face-up in front of the owner."
  if (def.kind === "equipment") {
    const p = getPlayer(state, caster);
    p.equipment.push(cardId);
  } else {
    // §6: "Single-use cards resolve then discard face-up."
    state.decks.black.discard.push(cardId);
  }

  return events;
}
