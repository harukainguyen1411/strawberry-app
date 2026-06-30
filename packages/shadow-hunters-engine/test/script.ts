// Scenario-test driver (Task 14).
// Source of truth: ruleset.md — the engine's own public surface (createGame/reduce/
// legalActions/project) is exercised end-to-end; nothing here reimplements a rule.
//
// runScript(seed, playerIds, actions) folds reduce() over a fixed action list against a
// fixed seed and returns the final GameState. Because all randomness lives in the seeded
// rng threaded through GameState (rng.ts), the SAME (seed, playerIds, actions) triple
// ALWAYS produces the same state — this is the determinism the scenario tests assert.
//
// driveToWin(seed, playerIds, policy) plays a real game to completion by repeatedly
// taking ONE legal action (chosen by `policy`) for the current actor, until the game ends
// or a step cap is hit. It is the sanctioned fallback (Task 14 note) for configs whose
// fully hand-authored win is too costly to seed by hand: it still reaches a REAL engine
// win-state (state.over / state.winners), and the caller asserts the faction of the
// winners. Every step runs assertSecrecy so the "no secret leaks across a whole game"
// invariant (§1/§11) holds after every reduce, not just at the end.

import { expect } from "vitest";
import { createGame } from "../src/setup.js";
import { reduce, legalActions } from "../src/reduce.js";
import { project } from "../src/project.js";
import { resetWinCheckHook } from "../src/damage.js";
import { CHARACTERS } from "../src/data/characters.js";
import type {
  Action,
  GameEvent,
  GameState,
  PlayerId,
  Faction,
} from "../src/types.js";

/** Faction of a character id via the static roster (§5). Throws on unknown ids. */
export function factionOf(characterId: string): Faction {
  const def = CHARACTERS.find((c) => c.id === characterId);
  if (!def) throw new Error(`factionOf: unknown character "${characterId}"`);
  return def.faction;
}

/** The character id dealt to a player in a given state (§3 deal). */
export function characterOf(state: GameState, playerId: PlayerId): string {
  const p = state.players.find((pl) => pl.id === playerId);
  if (!p) throw new Error(`characterOf: player "${playerId}" not found`);
  return p.characterId;
}

/**
 * SECRECY INVARIANT (§1/§11), asserted after EVERY reduce in a scenario. For every
 * viewer, project(state, viewer) must NOT serialize:
 *   - the rng seed (a client could predict every future die/shuffle),
 *   - deck order (a client could predict every future draw),
 *   - any OTHER still-hidden (not revealed, still alive) player's characterId.
 * This mirrors the project.test.ts secrecy test but runs it continuously through a whole
 * game so a leak that only appears in a mid-game state is caught.
 *
 * The check is FIELD-AWARE rather than a blunt substring scan, because a character id can
 * legitimately appear as a SUBSTRING of unrelated public data (e.g. the card effectKey
 * "vampire_bat" contains "vampire"; an equipment/card id like "black:vampire_bat#0" is
 * public). So a raw substring scan would false-positive. Instead we assert the specific
 * places a hidden identity could actually leak:
 *   - players[].characterId : MUST be null for every hidden OTHER player.
 *   - recent[] events of type Revealed/Died : MUST NOT name a hidden OTHER player (those
 *     events only fire once a player is open, so their presence for a hidden player would
 *     itself be the leak).
 * The viewer's OWN role (`you`) and `shownCards` (Hermit's Prediction, §12.11, private to
 * the giver and already redacted to [] for every other viewer) are EXPECTED to carry
 * identities and are not scanned.
 */
export function assertSecrecy(state: GameState): void {
  for (const viewer of state.players) {
    const view = project(state, viewer.id);
    const json = JSON.stringify(view);
    // No rng seed / deck order anywhere in the view.
    expect(json).not.toContain('"rng"');
    expect(json).not.toContain('"decks"');
    expect(json).not.toContain('"draw"');
    expect(json).not.toContain(String(state.rng.s));

    const hiddenOthers = new Set(
      state.players
        .filter((o) => o.id !== viewer.id && !o.revealed && o.alive)
        .map((o) => o.id),
    );

    // 1) No hidden OTHER player's characterId is exposed in the public roster.
    for (const pub of view.players) {
      if (pub.id === viewer.id) continue;
      if (hiddenOthers.has(pub.id)) {
        expect(pub.characterId).toBeNull();
      }
    }

    // 2) No Revealed/Died event in the recent log names a still-hidden OTHER player
    //    (such an event would only exist for an open player — its presence is the leak).
    for (const evt of view.recent) {
      if (evt.type === "Revealed" || evt.type === "Died") {
        expect(hiddenOthers.has(evt.player)).toBe(false);
      }
    }
  }
}

/**
 * Fold an action list through reduce against a fixed seed. Returns the final GameState
 * plus every event produced (in order). Deterministic by construction: the same
 * (seed, playerIds, actions) triple always yields the same result.
 *
 * If `checkSecrecy` is true (default), assertSecrecy runs on the INITIAL state and after
 * EVERY reduce — the "no secret leaks across a whole game" invariant. Set it false only
 * for a pure determinism re-run where the invariant was already proven on the first pass.
 */
export function runScript(
  seed: string,
  playerIds: readonly string[],
  actions: readonly Action[],
  opts: { checkSecrecy?: boolean } = {},
): { state: GameState; events: GameEvent[] } {
  // Reset damage.ts's win-check hook for test isolation (matches the codebase's
  // beforeEach(resetWinCheckHook) convention; reduce re-installs maybeEndGame on every
  // call, so the hook is restored anyway). The §12.2 death-epoch counter now lives ON the
  // state (state.nextDeathEpoch, init 0 in createGame) — so a fresh createGame already
  // starts each run from epoch 0 and is bit-for-bit reproducible WITHOUT a reset.
  resetWinCheckHook();
  const checkSecrecy = opts.checkSecrecy ?? true;
  let state = createGame(playerIds, seed);
  const events: GameEvent[] = [];
  if (checkSecrecy) assertSecrecy(state);

  for (const action of actions) {
    const res = reduce(state, action);
    state = res.state;
    events.push(...res.events);
    if (checkSecrecy) assertSecrecy(state);
  }
  return { state, events };
}

/** A policy picks ONE action from the legal set for the acting player (or null to pass). */
export type Policy = (state: GameState, legal: Action[]) => Action | null;

/**
 * Drive a real game to completion by repeatedly applying ONE legal action (chosen by
 * `policy`) for whichever player has legal actions, until the game ends or `maxSteps` is
 * reached. Returns the final state, the actions taken (so a determinism re-run can replay
 * the EXACT same list through runScript), and every event.
 *
 * The actor each step is the current player when they have legal actions; otherwise the
 * first other player with a legal action (covers out-of-band Reveal / Werewolf
 * Counterattack). assertSecrecy runs after every reduce.
 *
 * This is the sanctioned Task-14 fallback for reaching a real win-state when a fully
 * hand-seeded action list is impractical: the winners are produced by the engine, not by
 * the test, and the test asserts their faction.
 */
export function driveToWin(
  seed: string,
  playerIds: readonly string[],
  policy: Policy,
  maxSteps = 4000,
): { state: GameState; actions: Action[]; events: GameEvent[] } {
  // Reset the win-check hook for test isolation (see the note in runScript). The
  // death-epoch counter lives on state.nextDeathEpoch (init 0 in createGame), so each run
  // is bit-for-bit reproducible on its own; the captured `actions` replay through
  // runScript to produce an identical state.
  resetWinCheckHook();
  let state = createGame(playerIds, seed);
  const taken: Action[] = [];
  const events: GameEvent[] = [];
  assertSecrecy(state);

  for (let step = 0; step < maxSteps && !state.over; step++) {
    // Find an actor with at least one legal action: current player first, then others.
    const order: PlayerId[] = [
      state.current,
      ...state.players.map((p) => p.id).filter((id) => id !== state.current),
    ];
    let chosen: Action | null = null;
    for (const actorId of order) {
      const legal = legalActions(state, actorId);
      if (legal.length === 0) continue;
      const pick = policy(state, legal);
      if (pick) {
        chosen = pick;
        break;
      }
    }
    if (!chosen) {
      throw new Error(
        `driveToWin: no policy action at step ${step} (current=${state.current}, phase=${state.phase})`,
      );
    }
    const res = reduce(state, chosen);
    state = res.state;
    taken.push(chosen);
    events.push(...res.events);
    assertSecrecy(state);
  }

  if (!state.over) {
    throw new Error(`driveToWin: game did not end within ${maxSteps} steps`);
  }
  return { state, actions: taken, events };
}

/**
 * An aggressive policy: prefer to advance the turn toward kills.
 *   1. Attack the first in-range target (drives faction eliminations).
 *   2. Otherwise RollMove / MoveTo (the first offered destination) to keep moving.
 *   3. Otherwise ResolveArea / EndTurn to progress the phase.
 *   4. Skip out-of-band UseAbility/Reveal/Counterattack for the BASE driver (kept simple
 *      and fully deterministic); a scenario may pass a richer policy if it needs them.
 * Returns null when only out-of-band actions remain for a non-current player (so the
 * driver moves on to the current player).
 */
export function aggressivePolicy(state: GameState, legal: Action[]): Action | null {
  const attack = legal.find((a) => a.type === "Attack");
  if (attack) return attack;
  const move = legal.find((a) => a.type === "RollMove" || a.type === "MoveTo");
  if (move) return move;
  const area = legal.find((a) => a.type === "ResolveArea");
  if (area) return area;
  const end = legal.find((a) => a.type === "EndTurn");
  if (end) return end;
  // Only out-of-band actions (Reveal / Counterattack / UseAbility) remain — let the
  // driver advance to another actor rather than firing them here.
  return null;
}
