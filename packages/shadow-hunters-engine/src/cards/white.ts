// White card handlers for the Shadow Hunters engine.
// Source of truth: ruleset.md §6 (White deck), §12.9, §12.10, §12.12.
//
// Each handler is keyed by effectKey (matches CardDef.effectKey in data/cards.ts).
// playCard(state, playerId, cardId, opts?) looks up the def, runs the handler,
// then routes the card to player.equipment or white discard.
//
// §6 White deck: 16 cards, 15 distinct effectKeys:
//   holy_water_of_healing ×2, rest ×1.
//
// Equipment cards: fortune_brooch, talisman, mystic_compass, silver_rosary,
//   spear_of_longinus, holy_robe → go to player.equipment, NEVER discarded.
// Single-use cards: everything else → discarded to white discard after resolution.

import { applyHeal, applyDamage, setDamage, reveal, withWinCheckBatch } from "../damage.js";
import { WHITE } from "../data/cards.js";
import { CHARACTERS } from "../data/characters.js";
import { rollD6 } from "../rng.js";
import type { GameState, GameEvent, PlayerId, CardId } from "../types.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlayCardOpts {
  /** Target player id (for cards that need a target: First Aid, Blessing). */
  target?: PlayerId;
  /**
   * Option string for conditional cards:
   *   - Chocolate / Advent: pass "reveal" to trigger the reveal-and-heal branch.
   */
  option?: string;
  /**
   * Injected d6 roll for deterministic tests (Blessing). Mirrors the `roll`
   * injection used by Franklin's Lightning ability (abilities.ts AbilityCtx.params.roll)
   * and the `dice` injection in black.ts. When provided, the handler uses this value
   * instead of rolling state.rng. Production omits it (rolls from state.rng).
   */
  roll?: number;
}

type HandlerCtx = {
  state: GameState;
  caster: PlayerId;
  cardId: CardId;
  opts: PlayCardOpts;
};

type WhiteHandler = (ctx: HandlerCtx) => GameEvent[];

// ─── Utility ─────────────────────────────────────────────────────────────────

function getPlayer(state: GameState, id: PlayerId) {
  const p = state.players.find((pl) => pl.id === id);
  if (!p) throw new Error(`white.ts: player "${id}" not found`);
  return p;
}

function maxHpOf(characterId: string): number {
  const def = CHARACTERS.find((c) => c.id === characterId);
  if (!def) throw new Error(`white.ts: unknown character "${characterId}"`);
  return def.maxHp;
}

function nameStartsAEU(characterId: string): boolean {
  const def = CHARACTERS.find((c) => c.id === characterId);
  if (!def) return false;
  const first = def.name[0]?.toUpperCase();
  return first === "A" || first === "E" || first === "U";
}

function factionOf(characterId: string): string {
  const def = CHARACTERS.find((c) => c.id === characterId);
  if (!def) throw new Error(`white.ts: unknown character "${characterId}"`);
  return def.faction;
}

// ─── Handlers ────────────────────────────────────────────────────────────────

/**
 * Holy Water of Healing (×2)
 * §6: "Single-use. Heal 2 of your own damage."
 */
const holyWaterOfHealing: WhiteHandler = ({ state, caster }) => {
  return applyHeal(state, caster, 2, "holy_water_of_healing");
};

/**
 * Flare of Judgement (×1)
 * §6: "Single-use. Every other character takes 2 damage (can hit allies)."
 * Source is "flare_of_judgement" (not "attack") — §12.3: card effects are not attacks.
 */
const flareOfJudgement: WhiteHandler = ({ state, caster }) => {
  // §12.2: Flare is ONE effect — every OTHER character takes 2 SIMULTANEOUSLY. Snapshot
  // the affected set up front, then resolve inside a win-check batch so all deaths apply
  // before the game can end; the win-check runs once at the close and ALL satisfied
  // conditions win together. No mid-loop `state.over` break (that let a co-victim wrongly
  // survive and win when the first death ended the game).
  const affected = state.players
    .filter((p) => p.id !== caster && p.alive)
    .map((p) => p.id);

  return withWinCheckBatch(state, () => {
    const events: GameEvent[] = [];
    for (const id of affected) {
      events.push(...applyDamage(state, id, 2, "flare_of_judgement", null));
    }
    return events;
  });
};

/**
 * First Aid (×1)
 * §6: "Single-use. Set one character's damage to exactly 7 (absolute)."
 * §12.12: absolute set to 7 then death check (kills any char with maxHp ≤ 7).
 * Requires opts.target.
 */
const firstAid: WhiteHandler = ({ state, opts }) => {
  if (!opts.target) throw new Error("First Aid requires a target");
  return setDamage(state, opts.target, 7, "first_aid");
};

/**
 * Concealed Knowledge (×1)
 * §6: "Single-use. After this turn ends, immediately take one extra turn."
 * §12.10: pendingExtraTurns++.
 */
const concealedKnowledge: WhiteHandler = ({ state }) => {
  state.pendingExtraTurns += 1;
  return [];
};

/**
 * Guardian Angel (×1)
 * §6: "Single-use. You take no damage from attacks until your next turn."
 * §12.9: blocks "attack" source damage only. damage.ts checks attackImmune flag.
 * reduce.ts clears attackImmune at the start of the protected player's next turn.
 */
const guardianAngel: WhiteHandler = ({ state, caster }) => {
  const p = getPlayer(state, caster);
  p.attackImmune = true; // §12.9: damage.ts skips "attack" source when true
  return [];
};

/**
 * Disenchant Mirror (×1)
 * §6: "Single-use. Any Shadow must reveal — except Unknown (may lie)."
 * Triggers the normal reveal mechanic (idempotent, emits Revealed once).
 * Unknown (faction Shadow, id "unknown") is explicitly excepted. §12.11
 */
const disenchantMirror: WhiteHandler = ({ state }) => {
  const events: GameEvent[] = [];
  for (const p of state.players) {
    if (!p.alive) continue;
    if (factionOf(p.characterId) !== "Shadow") continue;
    if (p.characterId === "unknown") continue; // §6 exception: Unknown may lie
    events.push(...reveal(state, p.id));
    if (state.over) break;
  }
  return events;
};

/**
 * Blessing (×1)
 * §6: "Single-use. Choose another character; heal them by a d6 roll."
 * Requires opts.target (must differ from caster; enforced at the reduce layer).
 */
const blessing: WhiteHandler = ({ state, opts }) => {
  if (!opts.target) throw new Error("Blessing requires a target");
  // Injected d6 for deterministic tests (mirrors Franklin's roll injection); else roll state.rng.
  const roll = opts.roll ?? rollD6(state.rng);
  return applyHeal(state, opts.target, roll, "blessing");
};

/**
 * Chocolate (×1)
 * §6: "Single-use. If your name starts A/E/U, you may reveal; if revealed, fully heal."
 * The reveal is optional; the player passes opts.option = "reveal" to trigger it.
 * If the name doesn't qualify, nothing happens regardless of the option.
 */
const chocolate: WhiteHandler = ({ state, caster, opts }) => {
  const p = getPlayer(state, caster);
  if (!nameStartsAEU(p.characterId)) return []; // does not qualify
  if (opts.option !== "reveal") return []; // player chose not to reveal
  const events: GameEvent[] = [];
  // Reveal if not already.
  if (!p.revealed) {
    events.push(...reveal(state, caster));
  }
  // If now revealed (or was already), fully heal (set damage to 0).
  if (p.revealed && p.alive) {
    events.push(...applyHeal(state, caster, p.damage, "chocolate"));
  }
  return events;
};

/**
 * Advent (×1)
 * §6: "Single-use. If you are a Hunter, you may reveal; if revealed, fully heal."
 * Same reveal-optional pattern as Chocolate; qualifying faction = Hunter only.
 */
const advent: WhiteHandler = ({ state, caster, opts }) => {
  const p = getPlayer(state, caster);
  if (factionOf(p.characterId) !== "Hunter") return []; // not a Hunter
  if (opts.option !== "reveal") return []; // player chose not to reveal
  const events: GameEvent[] = [];
  if (!p.revealed) {
    events.push(...reveal(state, caster));
  }
  if (p.revealed && p.alive) {
    events.push(...applyHeal(state, caster, p.damage, "advent"));
  }
  return events;
};

// ─── Equipment handlers (equip to player; routing happens in playCard) ────────

/** Equipment cards: the handler only validates / emits; routing is in playCard. */
const equipHandler: WhiteHandler = () => [];

// ─── Handler registry ─────────────────────────────────────────────────────────

/** All 15 White effectKey handlers. */
export const WHITE_HANDLERS: Record<string, WhiteHandler> = {
  holy_water_of_healing: holyWaterOfHealing,
  flare_of_judgement: flareOfJudgement,
  first_aid: firstAid,
  concealed_knowledge: concealedKnowledge,
  guardian_angel: guardianAngel,
  disenchant_mirror: disenchantMirror,
  blessing: blessing,
  chocolate: chocolate,
  advent: advent,
  // Equipment cards — the equip routing is handled by playCard.
  fortune_brooch: equipHandler,
  talisman: equipHandler,
  mystic_compass: equipHandler,
  silver_rosary: equipHandler,
  spear_of_longinus: equipHandler,
  holy_robe: equipHandler,
};

// ─── playCard ─────────────────────────────────────────────────────────────────

/**
 * Resolve a White card: run the handler, then route the card to equipment or discard.
 *
 * @param state   — mutated in place (same pattern as damage.ts / combat.ts).
 * @param caster  — the PlayerId playing the card.
 * @param cardId  — instanced card id (e.g. "white:holy_water_of_healing#0").
 * @param opts    — optional target / option for conditional cards.
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
  const match = /^white:([^#]+)/.exec(cardId);
  if (!match) throw new Error(`playCard: invalid white card id "${cardId}"`);
  const effectKey = match[1]!;

  // Look up the card definition to determine kind (single / equipment).
  const def = WHITE.find((d) => d.effectKey === effectKey);
  if (!def) throw new Error(`playCard: unknown white effectKey "${effectKey}"`);

  // Look up and run the handler.
  const handler = WHITE_HANDLERS[effectKey];
  if (!handler) throw new Error(`playCard: no handler for white effectKey "${effectKey}"`);

  const events = handler({ state, caster, cardId, opts });

  // Route the card: equipment → player.equipment; single-use → white discard.
  // §6: "Equipment cards stay face-up in front of the owner."
  if (def.kind === "equipment") {
    const p = getPlayer(state, caster);
    p.equipment.push(cardId);
  } else {
    // §6: "Single-use cards resolve then discard face-up."
    state.decks.white.discard.push(cardId);
  }

  return events;
}
