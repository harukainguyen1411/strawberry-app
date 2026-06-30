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
  GameEvent,
  GameState,
  PlayerId,
  PlayerView,
  PublicPlayer,
} from "./types.js";

/** How many trailing log events a viewer's `recent` tail holds (after redaction). §1 */
const RECENT_TAIL = 20;

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
 * True when `evt` is an IDENTITY-TELL about a player who is hidden to `viewerId`.
 * Such an event must be OMITTED from that viewer's `recent` tail (§1 secrecy).
 *
 * Two events leak a hidden player's character by inference:
 *  - Healed{source:"suck_blood"}: only the Vampire's Suck Blood passive heals with
 *    this source (§12.7), so its mere presence names the subject as the Vampire.
 *  - EquipmentTaken{via:"robbery"}: Bob's 4–6p Robbery combat-steal (§5/§12.8) — a
 *    mid-combat steal with NO Damaged sibling, unique to Bob.
 *
 * The subject is the event's `player` (the actor/beneficiary). The event is a tell
 * only when that subject is NOT open to the viewer: the viewer themselves and any
 * viewer to whom the subject is revealed/dead still see it. Other event kinds — and
 * plain (untagged) steals/heals — are never redacted.
 */
function isHiddenIdentityTell(
  evt: GameEvent,
  viewerId: PlayerId,
  openTo: (playerId: PlayerId) => boolean,
): boolean {
  let subject: PlayerId;
  if (evt.type === "Healed" && evt.source === "suck_blood") {
    subject = evt.player;
  } else if (evt.type === "EquipmentTaken" && evt.via === "robbery") {
    subject = evt.player;
  } else {
    return false; // not a tell
  }
  // The owner always sees their own tell; anyone the subject is open to sees it too.
  return subject !== viewerId && !openTo(subject);
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

  // Per-viewer recent tail: drop identity-tell events about players still hidden to
  // this viewer (Vampire suck_blood heal, Bob robbery steal), then keep the last
  // RECENT_TAIL survivors — so a viewer still sees a full tail of events they may
  // legitimately know about, not a tail thinned by another player's redacted tells. §1
  const openByPlayer = new Map<PlayerId, boolean>(
    state.players.map((p) => [p.id, isOpen(p)]),
  );
  const openTo = (playerId: PlayerId): boolean => openByPlayer.get(playerId) ?? false;
  const recent = state.log
    .filter((evt) => !isHiddenIdentityTell(evt, viewerId, openTo))
    .slice(-RECENT_TAIL);

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
    recent,
    shownCards,
  };
}
