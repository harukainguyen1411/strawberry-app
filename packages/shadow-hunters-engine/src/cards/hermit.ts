// Hermit card handlers for the Shadow Hunters engine.
// Source of truth: ruleset.md §6 (Hermit deck), §12.11.
//
// Hermit cards are drawn at Hermit's Cabin (or Underworld Gate), read secretly
// by the drawer, then handed face-down to a chosen player. The recipient resolves
// the card against their OWN identity (faction / HP). If the condition does not
// match, "nothing happens" (no state change). Resolved cards discard FACE-DOWN to
// the hermit discard pile (§6: "resolved Hermit cards discard face-down").
//
// §6 Hermit deck: 16 cards, 12 distinct effectKeys:
//   hermits_blackmail ×2, hermits_anger ×2, hermits_greed ×2, hermits_slap ×2,
//   hermits_aid ×1, hermits_nurturance ×1, hermits_huddle ×1, hermits_spell ×1,
//   hermits_exorcism ×1, hermits_bully ×1, hermits_tough_lesson_of_love ×1,
//   hermits_prediction ×1.
//
// §12.11 Unknown Deceit:
//   When given a Hermit card, Unknown may:
//     - Lie (opts.lie=true): apply the card effect AS IF the condition matched,
//       without revealing. Unknown bears the real HP change (selling the lie).
//     - Decline (opts.decline=true): "Nothing happens" — no state change, no reveal.
//   Hermit's Prediction is ALWAYS resolved truthfully; lie/decline have no effect.
//
// Aid / Nurturance / Huddle full-health note (§6):
//   If the recipient is at 0 damage, the heal-1 branch takes 1 damage instead.

import { applyDamage, applyHeal } from "../damage.js";
import { HERMIT } from "../data/cards.js";
import { CHARACTERS } from "../data/characters.js";
import type { GameState, GameEvent, PlayerId, CardId } from "../types.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GiveHermitOpts {
  /**
   * §12.11 Unknown only: apply the card effect AS IF the identity condition
   * matched, without revealing. Ignored for Hermit's Prediction.
   */
  lie?: boolean;
  /**
   * §12.11 Unknown only: say "Nothing happens", skipping the effect entirely,
   * without revealing. Ignored for Hermit's Prediction.
   */
  decline?: boolean;
}

type HandlerCtx = {
  state: GameState;
  giver: PlayerId;
  recipient: PlayerId;
  cardId: CardId;
  opts: GiveHermitOpts;
};

type HermitHandler = (ctx: HandlerCtx) => GameEvent[];

// ─── Utility ──────────────────────────────────────────────────────────────────

function getPlayer(state: GameState, id: PlayerId) {
  const p = state.players.find((pl) => pl.id === id);
  if (!p) throw new Error(`hermit.ts: player "${id}" not found`);
  return p;
}

function factionOf(characterId: string): string {
  const def = CHARACTERS.find((c) => c.id === characterId);
  if (!def) throw new Error(`hermit.ts: unknown character "${characterId}"`);
  return def.faction;
}

function maxHpOf(characterId: string): number {
  const def = CHARACTERS.find((c) => c.id === characterId);
  if (!def) throw new Error(`hermit.ts: unknown character "${characterId}"`);
  return def.maxHp;
}

/**
 * Evaluate whether the recipient's identity satisfies the card condition.
 * Returns the resolved faction string to compare against.
 * For Unknown with opts.lie=true, we short-circuit — the caller handles
 * the "as if condition matched" branch directly.
 */
function resolveFaction(state: GameState, recipientId: PlayerId): string {
  const p = getPlayer(state, recipientId);
  return factionOf(p.characterId);
}

// ─── Equipment transfer helper ─────────────────────────────────────────────────

/**
 * Transfer the recipient's first equipment to the giver, or if none, deal 1 damage.
 * Used by Blackmail / Anger / Greed (§6: "give 1 equipment to giver, or take 1 damage").
 */
function equipOrDamage(state: GameState, giver: PlayerId, recipient: PlayerId, source: string): GameEvent[] {
  const recipientPlayer = getPlayer(state, recipient);
  const giverPlayer = getPlayer(state, giver);

  if (recipientPlayer.equipment.length > 0) {
    // Give the first equipment card to the giver.
    const card = recipientPlayer.equipment[0]!;
    recipientPlayer.equipment = recipientPlayer.equipment.slice(1);
    giverPlayer.equipment.push(card);
    const evt: GameEvent = {
      type: "EquipmentTaken",
      player: giver,
      from: recipient,
      card,
    };
    state.log.push(evt);
    return [evt];
  } else {
    // No equipment → recipient takes 1 damage.
    return applyDamage(state, recipient, 1, source, null);
  }
}

// ─── Heal-or-damage helper for Aid / Nurturance / Huddle ──────────────────────

/**
 * §6 full-health note: if at 0 damage, take 1 instead of healing 1.
 * §6: "heal 1 (if at 0 damage, take 1 instead)".
 */
function healOneOrTakeOne(state: GameState, recipientId: PlayerId, source: string): GameEvent[] {
  const p = getPlayer(state, recipientId);
  if (p.damage === 0) {
    // Full health → take 1 damage instead. §6 full-health note.
    return applyDamage(state, recipientId, 1, source, null);
  } else {
    return applyHeal(state, recipientId, 1, source);
  }
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

/**
 * Hermit's Blackmail (×2)
 * §6: "If Neutral or Hunter: give 1 equipment to the giver, or take 1 damage."
 */
const hermitsBlackmail: HermitHandler = ({ state, giver, recipient }) => {
  const faction = resolveFaction(state, recipient);
  if (faction !== "Neutral" && faction !== "Hunter") return []; // §6: condition not met
  return equipOrDamage(state, giver, recipient, "hermits_blackmail");
};

/**
 * Hermit's Anger (×2)
 * §6: "If Shadow or Hunter: give 1 equipment to the giver, or take 1 damage."
 */
const hermitsAnger: HermitHandler = ({ state, giver, recipient }) => {
  const faction = resolveFaction(state, recipient);
  if (faction !== "Shadow" && faction !== "Hunter") return [];
  return equipOrDamage(state, giver, recipient, "hermits_anger");
};

/**
 * Hermit's Greed (×2)
 * §6: "If Neutral or Shadow: give 1 equipment to the giver, or take 1 damage."
 */
const hermitsGreed: HermitHandler = ({ state, giver, recipient }) => {
  const faction = resolveFaction(state, recipient);
  if (faction !== "Neutral" && faction !== "Shadow") return [];
  return equipOrDamage(state, giver, recipient, "hermits_greed");
};

/**
 * Hermit's Slap (×2)
 * §6: "If Hunter: take 1 damage."
 */
const hermitsSlap: HermitHandler = ({ state, recipient }) => {
  const faction = resolveFaction(state, recipient);
  if (faction !== "Hunter") return [];
  return applyDamage(state, recipient, 1, "hermits_slap", null);
};

/**
 * Hermit's Aid (×1)
 * §6: "If Hunter: heal 1 (if at 0 damage, take 1 instead)."
 * §6 full-health note: heal 1; if at 0 damage, take 1 instead.
 */
const hermitsAid: HermitHandler = ({ state, recipient }) => {
  const faction = resolveFaction(state, recipient);
  if (faction !== "Hunter") return [];
  return healOneOrTakeOne(state, recipient, "hermits_aid");
};

/**
 * Hermit's Nurturance (×1)
 * §6: "If Neutral: heal 1 (if at 0 damage, take 1 instead)."
 */
const hermitsNurturance: HermitHandler = ({ state, recipient }) => {
  const faction = resolveFaction(state, recipient);
  if (faction !== "Neutral") return [];
  return healOneOrTakeOne(state, recipient, "hermits_nurturance");
};

/**
 * Hermit's Huddle (×1)
 * §6: "If Shadow: heal 1 (if at 0 damage, take 1 instead)."
 */
const hermitsHuddle: HermitHandler = ({ state, recipient }) => {
  const faction = resolveFaction(state, recipient);
  if (faction !== "Shadow") return [];
  return healOneOrTakeOne(state, recipient, "hermits_huddle");
};

/**
 * Hermit's Spell (×1)
 * §6: "If Shadow: take 1 damage."
 */
const hermitsSpell: HermitHandler = ({ state, recipient }) => {
  const faction = resolveFaction(state, recipient);
  if (faction !== "Shadow") return [];
  return applyDamage(state, recipient, 1, "hermits_spell", null);
};

/**
 * Hermit's Exorcism (×1)
 * §6: "If Shadow: take 2 damage."
 */
const hermitsExorcism: HermitHandler = ({ state, recipient }) => {
  const faction = resolveFaction(state, recipient);
  if (faction !== "Shadow") return [];
  return applyDamage(state, recipient, 2, "hermits_exorcism", null);
};

/**
 * Hermit's Bully (×1)
 * §6: "If max HP ≤ 11: take 1 damage."
 * Keyed on recipient's max HP, not faction.
 */
const hermitsBully: HermitHandler = ({ state, recipient }) => {
  const p = getPlayer(state, recipient);
  const maxHp = maxHpOf(p.characterId);
  if (maxHp > 11) return []; // §6: condition not met
  return applyDamage(state, recipient, 1, "hermits_bully", null);
};

/**
 * Hermit's Tough Lesson of Love (×1)
 * §6: "If max HP ≥ 12: take 2 damage."
 */
const hermitsToughLessonOfLove: HermitHandler = ({ state, recipient }) => {
  const p = getPlayer(state, recipient);
  const maxHp = maxHpOf(p.characterId);
  if (maxHp < 12) return []; // §6: condition not met
  return applyDamage(state, recipient, 2, "hermits_tough_lesson_of_love", null);
};

/**
 * Hermit's Prediction (×1)
 * §6 / §12.11: "Privately show your character card to the giver (always resolves; no damage)."
 * Writes to state.shownCards[giver] with the recipient's characterId.
 * Cannot be faked by Unknown — the actual character card is always shown. §12.11
 * Does NOT publicly reveal the recipient.
 */
const hermitsPrediction: HermitHandler = ({ state, giver, recipient }) => {
  const p = getPlayer(state, recipient);
  // Initialise giver's shownCards array if absent (should exist from createGame,
  // but guard here for safety in tests that manually build state).
  if (!state.shownCards[giver]) {
    state.shownCards[giver] = [];
  }
  // Write the recipient's real characterId to the giver's private knowledge.
  // §12.11: "shows the actual card and cannot be faked."
  state.shownCards[giver]!.push(p.characterId);
  // No events emitted — this is a private information transfer, not a public reveal.
  return [];
};

// ─── Handler registry ──────────────────────────────────────────────────────────

/** All 12 Hermit effectKey handlers. */
const HERMIT_HANDLERS: Record<string, HermitHandler> = {
  hermits_blackmail: hermitsBlackmail,
  hermits_anger: hermitsAnger,
  hermits_greed: hermitsGreed,
  hermits_slap: hermitsSlap,
  hermits_aid: hermitsAid,
  hermits_nurturance: hermitsNurturance,
  hermits_huddle: hermitsHuddle,
  hermits_spell: hermitsSpell,
  hermits_exorcism: hermitsExorcism,
  hermits_bully: hermitsBully,
  hermits_tough_lesson_of_love: hermitsToughLessonOfLove,
  hermits_prediction: hermitsPrediction,
};

// ─── giveHermit ───────────────────────────────────────────────────────────────

/**
 * Resolve a Hermit card given by the giver to the recipient.
 *
 * §6: Recipient resolves the card against their own identity.
 * §12.11: Unknown (characterId "unknown") may lie or decline:
 *   - opts.lie=true  → apply the effect regardless of condition match (no reveal).
 *   - opts.decline=true → nothing happens (no reveal).
 *   - Hermit's Prediction is immune to lie/decline; always resolves truthfully.
 *
 * Resolved Hermit cards discard face-down to hermit discard (§6).
 *
 * @param state      — mutated in place.
 * @param giver      — the PlayerId who drew and handed the card.
 * @param recipient  — the PlayerId who receives and resolves the card.
 * @param cardId     — instanced card id (e.g. "hermit:hermits_slap#0").
 * @param opts       — Unknown's optional lie/decline overrides.
 * @returns          — the events produced (also pushed to state.log inside helpers).
 */
export function giveHermit(
  state: GameState,
  giver: PlayerId,
  recipient: PlayerId,
  cardId: CardId,
  opts: GiveHermitOpts,
): GameEvent[] {
  // Parse the effectKey from the card id. Form: "hermit:<effectKey>#<copy>".
  const match = /^hermit:([^#]+)/.exec(cardId);
  if (!match) throw new Error(`giveHermit: invalid hermit card id "${cardId}"`);
  const effectKey = match[1]!;

  // Verify the card is in the Hermit data.
  const def = HERMIT.find((d) => d.effectKey === effectKey);
  if (!def) throw new Error(`giveHermit: unknown hermit effectKey "${effectKey}"`);

  // Look up the handler.
  const handler = HERMIT_HANDLERS[effectKey];
  if (!handler) throw new Error(`giveHermit: no handler for hermit effectKey "${effectKey}"`);

  const recipientPlayer = getPlayer(state, recipient);

  let events: GameEvent[];

  // §12.11 Hermit's Prediction: always resolves truthfully; lie/decline have no effect.
  if (effectKey === "hermits_prediction") {
    events = handler({ state, giver, recipient, cardId, opts });
  } else if (recipientPlayer.characterId === "unknown" && opts.decline) {
    // §12.11: Unknown declines → "Nothing happens", no reveal.
    events = [];
  } else if (recipientPlayer.characterId === "unknown" && opts.lie) {
    // §12.11: Unknown lies → apply the effect AS IF the condition matched.
    // We bypass the normal condition check by temporarily faking the faction.
    // We do this by calling the handler with a special flag: we swap in a
    // fake characterId for condition evaluation only.
    // Implementation: call a condition-bypassing version using a dedicated path.
    events = applyHermitEffectForced(state, giver, recipient, effectKey, cardId, opts);
  } else {
    // Normal resolution: evaluate the condition against the recipient's real identity.
    events = handler({ state, giver, recipient, cardId, opts });
  }

  // §6: Resolved Hermit cards discard FACE-DOWN to hermit discard.
  state.decks.hermit.discard.push(cardId);

  return events;
}

// ─── Unknown lie path ─────────────────────────────────────────────────────────

/**
 * Apply a Hermit card effect as if the condition matched, bypassing the identity
 * check. Used for Unknown's lie (§12.11 opts.lie=true).
 *
 * For faction-conditional cards (Blackmail/Anger/Greed/Slap/Aid/Nurturance/Huddle/
 * Spell/Exorcism), we directly run the underlying mechanic.
 * For HP-conditional cards (Bully/Tough Lesson), we use the real HP — Unknown
 * cannot change their own max HP.
 *
 * §12.11: "you may lie about your identity to trigger it … without revealing."
 * The lie applies the REAL HP change (selling the lie).
 */
function applyHermitEffectForced(
  state: GameState,
  giver: PlayerId,
  recipient: PlayerId,
  effectKey: string,
  cardId: CardId,
  opts: GiveHermitOpts,
): GameEvent[] {
  void cardId; // used for context only; not needed here
  switch (effectKey) {
    // Faction-conditional: give equipment or take 1 damage.
    case "hermits_blackmail":
    case "hermits_anger":
    case "hermits_greed":
      return equipOrDamage(state, giver, recipient, effectKey);

    // Hunter-only: take 1 damage.
    case "hermits_slap":
      return applyDamage(state, recipient, 1, effectKey, null);

    // Heal-or-take-one: faction-conditional.
    case "hermits_aid":
    case "hermits_nurturance":
    case "hermits_huddle":
      return healOneOrTakeOne(state, recipient, effectKey);

    // Shadow-only: take 1 damage.
    case "hermits_spell":
      return applyDamage(state, recipient, 1, effectKey, null);

    // Shadow-only: take 2 damage.
    case "hermits_exorcism":
      return applyDamage(state, recipient, 2, effectKey, null);

    // HP-conditional — lie doesn't change actual HP; run normal handler.
    case "hermits_bully": {
      const handler = HERMIT_HANDLERS[effectKey]!;
      return handler({ state, giver, recipient, cardId: `hermit:${effectKey}#0`, opts });
    }
    case "hermits_tough_lesson_of_love": {
      const handler = HERMIT_HANDLERS[effectKey]!;
      return handler({ state, giver, recipient, cardId: `hermit:${effectKey}#0`, opts });
    }

    // Prediction cannot be forced / is handled separately.
    case "hermits_prediction": {
      const handler = HERMIT_HANDLERS[effectKey]!;
      return handler({ state, giver, recipient, cardId: `hermit:${effectKey}#0`, opts });
    }

    default:
      throw new Error(`applyHermitEffectForced: unhandled effectKey "${effectKey}"`);
  }
}
