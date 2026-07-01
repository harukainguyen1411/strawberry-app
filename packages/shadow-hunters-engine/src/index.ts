// Public surface of @strawberry/shadow-hunters-engine.
// Source of truth: ruleset.md. The engine is pure, deterministic, and I/O-free.
//
// createGame(playerIds, seed) → initial GameState (§3).
// reduce(state, action)       → { state, events }; pure turn state machine (§8).
// legalActions(state, player) → exactly the actions allowed now (§8).
// project(state, viewerId)    → redacted per-player PlayerView (secrecy; §1/§11).

export const ENGINE_VERSION = "1.0.0";

export { createGame } from "./setup.js";
export { reduce, legalActions } from "./reduce.js";
export { project } from "./project.js";

// Public types for consumers (server / UI).
export type {
  GameState,
  Action,
  AreaChoice,
  GameEvent,
  PlayerState,
  PublicPlayer,
  PlayerView,
  PlayerId,
  CharacterId,
  CardId,
  AreaId,
  DeckKind,
  Faction,
  TurnPhase,
  DeckState,
} from "./types.js";
