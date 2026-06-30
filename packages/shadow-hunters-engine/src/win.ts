// Win-condition evaluation and game-end wiring.
// Source of truth: ruleset.md
//   §2   — the game ends the INSTANT any win condition is met; multiple players
//          may win simultaneously.
//   §4   — Hunters win when all Shadows are dead; Shadows win when all Hunters are
//          dead. [RULING] v1 uses the rulebook's Hunter-elimination condition for
//          Shadows only — NO "≥3 Neutrals dead" clause. A faction member wins even
//          if their own character died earlier.
//   §4   — Neutral conditions: Allie (alive when the game ends), Bob (≥5 equipment),
//          Charles (his attack delivers the kill bringing total dead to ≥3),
//          Daniel (first to die, OR alive when the Hunters win).
//   §12.1 — win-check cadence: re-evaluate ALL conditions after every damage/death/
//           reveal. damage.ts runs this via a swappable hook (setWinCheckHook); the
//           reducer (Task 12) installs maybeEndGame as that hook.
//   §12.2 — deaths from one effect resolve simultaneously, then win is checked once;
//           ALL satisfied conditions win together.
//   §12.4 — Charles attribution: only his OWN attacks (incl. Bloody Feast) count for
//           the 3rd kill; ability/card kills do NOT. Read from state.lastKill (set in
//           damage.ts: { killer, deadCountAfter }). A multi-kill that crosses 3 counts.
//   §12.5 — Daniel timing: "first to die" = the prior dead count was 0 when he died
//           (he is first in deadOrder; co-first if simultaneous). "Survive while
//           Hunters win" requires Daniel ALIVE at the win-check.

import { CHARACTERS } from "./data/characters.js";
import type { GameState, GameEvent, PlayerId, Faction } from "./types.js";

/** Faction of a character id, via the static roster (§5). Throws on unknown ids. */
function factionOf(characterId: string): Faction {
  const def = CHARACTERS.find((c) => c.id === characterId);
  if (!def) throw new Error(`Unknown characterId "${characterId}"`);
  return def.faction;
}

/**
 * Count of players of a faction that are still alive. §4
 * Used to decide whether a side has been fully eliminated (count === 0).
 */
export function aliveByFaction(state: GameState, faction: Faction): number {
  return state.players.filter(
    (p) => p.alive && factionOf(p.characterId) === faction,
  ).length;
}

/** Does the game contain at least one player of this faction? (Neutrals: §3 scaling.) */
function factionInPlay(state: GameState, faction: Faction): boolean {
  return state.players.some((p) => factionOf(p.characterId) === faction);
}

/**
 * Evaluate ALL win conditions against the current state and return every satisfied
 * player id (§12.1, §12.2). Pure: reads state, mutates nothing.
 *
 * Structure — a win can only fire when the game actually ENDS (§2). Some conditions
 * are *terminal* (they end the game by themselves); others (Allie "alive at game
 * end", Daniel "survive while Hunters win") only realise as wins at the moment a
 * terminal condition fires. So we first detect terminal triggers; if none fire, the
 * game continues and we return []. If any fire, we collect all satisfied players —
 * terminal and piggyback alike — and they win together.
 *
 *   Terminal triggers:
 *     - Hunter win  : a Hunter side exists and all Shadows are dead.
 *     - Shadow win  : a Shadow side exists and all Hunters are dead.
 *     - Charles     : his OWN attack made deadCountAfter ≥ 3 (state.lastKill).
 *     - Bob         : possesses ≥ 5 equipment.
 *     - Daniel first: Daniel is first in deadOrder (prior dead count was 0).
 *
 *   Piggyback (only when the game is ending this evaluation):
 *     - Allie       : alive.
 *     - Daniel surv : alive AND the Hunters won this evaluation.
 */
export function evaluateWinners(state: GameState): PlayerId[] {
  // ── Terminal faction triggers (§4) ──────────────────────────────────────────
  // A side wins only if that side is actually in play (avoids a vacuous win in a
  // hypothetical faction-less game). With §3 scaling both sides always exist, but
  // the guard keeps the rule honest.
  const huntersWin =
    factionInPlay(state, "Hunter") && aliveByFaction(state, "Shadow") === 0;
  const shadowsWin =
    factionInPlay(state, "Shadow") && aliveByFaction(state, "Hunter") === 0;

  // ── Terminal Neutral triggers (§4, §12.4, §12.5) ─────────────────────────────
  // Charles: only his own attack counts; damage.ts records the crediting killer in
  // state.lastKill (null for card/ability kills, §11/§12.4).
  const charlesWinners = state.players
    .filter((p) => {
      if (p.characterId !== "charles") return false;
      const lk = state.lastKill;
      return lk != null && lk.killer === p.id && lk.deadCountAfter >= 3;
    })
    .map((p) => p.id);

  // Bob: possesses ≥ 5 equipment (§4).
  const bobWinners = state.players
    .filter((p) => p.characterId === "bob" && p.equipment.length >= 5)
    .map((p) => p.id);

  // Daniel "first to die": Daniel sits at index 0 of deadOrder (co-first allowed —
  // simultaneous deaths are appended together, but only index 0 is "first"; §12.5
  // ties are handled by the simultaneous-death batching upstream).
  const danielFirstWinners = state.players
    .filter((p) => p.characterId === "daniel" && state.deadOrder[0] === p.id)
    .map((p) => p.id);

  const gameEnds =
    huntersWin ||
    shadowsWin ||
    charlesWinners.length > 0 ||
    bobWinners.length > 0 ||
    danielFirstWinners.length > 0;

  if (!gameEnds) return [];

  // ── Collect all satisfied players (§12.2: all satisfied win together) ─────────
  const winners = new Set<PlayerId>();

  if (huntersWin) {
    // Every Hunter wins, even if dead (§4/§11).
    for (const p of state.players) {
      if (factionOf(p.characterId) === "Hunter") winners.add(p.id);
    }
  }
  if (shadowsWin) {
    for (const p of state.players) {
      if (factionOf(p.characterId) === "Shadow") winners.add(p.id);
    }
  }

  for (const id of charlesWinners) winners.add(id);
  for (const id of bobWinners) winners.add(id);
  for (const id of danielFirstWinners) winners.add(id);

  // Allie: alive when the game ends (§4). The game IS ending this evaluation.
  for (const p of state.players) {
    if (p.characterId === "allie" && p.alive) winners.add(p.id);
  }

  // Daniel "survive while Hunters win" (§12.5): alive AND Hunters won this eval.
  if (huntersWin) {
    for (const p of state.players) {
      if (p.characterId === "daniel" && p.alive) winners.add(p.id);
    }
  }

  // Stable order: by turnOrder so the result is deterministic.
  return state.turnOrder.filter((id) => winners.has(id));
}

/**
 * If a win condition is met, finalise the game: set state.winners + state.over and
 * push a GameWon event (once). Returns the emitted events ([] if nothing fired or the
 * game is already over). §2 §12.1
 *
 * Idempotent: a game already marked over never re-emits GameWon. This is the function
 * installed as damage.ts's win-check hook so death/damage/reveal can end the game
 * mid-step.
 */
export function maybeEndGame(state: GameState): GameEvent[] {
  if (state.over) return [];

  const winners = evaluateWinners(state);
  if (winners.length === 0) return [];

  state.winners = winners;
  state.over = true;

  const evt: GameEvent = { type: "GameWon", winners };
  state.log.push(evt);
  return [evt];
}
