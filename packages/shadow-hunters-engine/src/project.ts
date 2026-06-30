// Per-player view projection + secrecy redaction.
// Source of truth: ruleset.md §1 (a character's faction/ability/identity is
// exposed only when they reveal, are forced to reveal, or die) and §11 (death
// always reveals). This module is the single trust boundary that turns the full
// authoritative GameState into the redacted PlayerView a single client may see.
//
// SECRECY INVARIANT (hard, tested): project(state, viewerId) MUST NOT include
//  - any OTHER non-revealed, non-dead player's characterId or faction,
//  - state.rng (the seed lets a client predict every future die/shuffle),
//  - deck order (state.decks.*.draw lets a client predict every future draw).
// We build the view by an explicit allowlist (never spread PlayerState), so a
// newly added secret field on PlayerState cannot silently leak.

import { CHARACTERS } from "./data/characters.js";
import { legalActions } from "./reduce.js";
import type {
  CharacterId,
  Faction,
  GameState,
  PlayerId,
  PlayerView,
  PublicPlayer,
} from "./types.js";

/** Roster def for a character id (§5). Throws on unknown ids. */
function defOf(characterId: CharacterId) {
  const def = CHARACTERS.find((c) => c.id === characterId);
  if (!def) throw new Error(`Unknown characterId "${characterId}"`);
  return def;
}

/**
 * A player's identity is OPEN (characterId visible to all) once they are
 * revealed OR dead. Dead players are always face-up (§11: on death, reveal).
 * Everyone else is hidden — their characterId is redacted to null. §1 §11
 */
function isOpen(player: { revealed: boolean; alive: boolean }): boolean {
  return player.revealed || !player.alive;
}

/**
 * Project the full GameState down to what `viewerId` is allowed to see.
 *
 * Pure: reads `state`, allocates a fresh PlayerView, never mutates `state`.
 * The viewer learns:
 *  - their OWN role/HP/win-condition (`you`),
 *  - public per-player data for everyone (damage, alive, area, equipment,
 *    revealed) plus characterId ONLY for open players,
 *  - the public board (areas, pairing, current, phase, over, winners),
 *  - their own legalActions (`legal`),
 *  - the recent log tail (`recent`),
 *  - any Hermit's Prediction info shown specifically to THEM (`shownCards`).
 * It never learns state.rng, deck contents, or other hidden players' identities.
 */
export function project(state: GameState, viewerId: PlayerId): PlayerView {
  const me = state.players.find((p) => p.id === viewerId);
  if (!me) throw new Error(`Unknown viewer "${viewerId}"`);
  const myDef = defOf(me.characterId);

  // Public per-player data — explicit allowlist, NEVER a spread of PlayerState.
  // characterId is included only when the player is open (revealed or dead). §1 §11
  const players: PublicPlayer[] = state.players.map((p) => {
    const open = isOpen(p);
    const pub: PublicPlayer = {
      id: p.id,
      damage: p.damage,
      alive: p.alive,
      area: p.area,
      equipment: [...p.equipment], // copy so the view can't mutate state
      revealed: p.revealed,
      characterId: open ? p.characterId : null,
    };
    return pub;
  });

  // Hermit's Prediction is private to the giver: only the viewer's own row is
  // exposed; every other viewer gets an empty list, so a hidden recipient's
  // identity never leaks. §12.11
  const shownCards: CharacterId[] = [...(state.shownCards[viewerId] ?? [])];

  const you: PlayerView["you"] = {
    id: me.id,
    characterId: me.characterId,
    faction: myDef.faction as Faction,
    maxHp: myDef.maxHp,
    winCondition: myDef.winCondition,
  };

  return {
    you,
    players,
    areas: [...state.areas],
    pairing: { ...state.pairing },
    current: state.current,
    phase: state.phase,
    over: state.over,
    winners: [...state.winners],
    legal: legalActions(state, viewerId),
    recent: state.log.slice(-20),
    shownCards,
  };
}
