// Test helpers for Shadow Hunters engine unit tests.
// Used by Task 7+ card handler tests; provides makeState, equip, and setDamage helpers.
//
// makeState builds a minimal valid GameState for a given number of players (default 3)
// with overrideable options. Players are assigned characters in order from the roster:
//   p0 → emi (Hunter), p1 → unknown (Shadow), p2 → allie (Neutral), p3 → franklin (Hunter),
//   p4 → vampire (Shadow), p5 → george (Hunter) ...
// Decks are populated with the full instanced card set and shuffled in a fixed order.
// All players start at area "church" (so they are in range of each other via pairing).

import { createGame } from "../src/setup.js";
import type { GameState, PlayerState, CardId, AreaId } from "../src/types.js";
import { WHITE } from "../src/data/cards.js";

// The default area we place all players in for tests (pair: cemetery).
const DEFAULT_AREA: AreaId = "church";

export interface MakeStateOptions {
  /** Player ids to use; default ["p0","p1","p2","p3"] (min 4 for createGame). */
  players?: string[];
  /** Damage overrides: { playerId: damage }. */
  damage?: Record<string, number>;
  /** Equipment overrides: { playerId: CardId[] }. */
  equipment?: Record<string, CardId[]>;
  /** Override the area for each player (default "church"). */
  areas?: Record<string, AreaId>;
  /** Override the revealed flag for specific players. */
  revealed?: Record<string, boolean>;
}

/**
 * Build a minimal GameState for card handler tests.
 *
 * All players are placed in "church" (paired with "cemetery") so they are
 * in combat range of each other. The decks are valid and contain all 16 cards
 * per deck. Damage, equipment, and area overrides are applied after setup.
 */
export function makeState(opts: MakeStateOptions = {}): GameState {
  const ids = opts.players ?? ["p0", "p1", "p2", "p3"];
  const state = createGame(ids, "test-helpers-seed");

  // Move all players to the default area (so card-range tests work out of the box).
  // Also apply the board so church ↔ cemetery pairing is available.
  // createGame randomises the board pairing, so we need to rebuild a fixed pairing
  // to make tests deterministic. We fix areas and pairing here.
  state.areas = [
    "church",
    "cemetery",
    "hermits_cabin",
    "underworld_gate",
    "weird_woods",
    "erstwhile_altar",
  ];
  state.pairing = {
    church: "cemetery",
    cemetery: "church",
    hermits_cabin: "underworld_gate",
    underworld_gate: "hermits_cabin",
    weird_woods: "erstwhile_altar",
    erstwhile_altar: "weird_woods",
  };

  // Place all players in the default area.
  for (const p of state.players) {
    p.area = DEFAULT_AREA;
  }

  // Apply per-player overrides.
  for (const p of state.players) {
    if (opts.damage?.[p.id] !== undefined) {
      p.damage = opts.damage[p.id]!;
    }
    if (opts.equipment?.[p.id] !== undefined) {
      p.equipment = [...opts.equipment[p.id]!];
    }
    if (opts.areas?.[p.id] !== undefined) {
      p.area = opts.areas[p.id]!;
    }
    if (opts.revealed?.[p.id] !== undefined) {
      p.revealed = opts.revealed[p.id]!;
    }
  }

  return state;
}

/**
 * Equip a card onto a player (adds the cardId to player.equipment).
 * Convenience for tests that need to set up equipment state before playing a card.
 */
export function equip(state: GameState, playerId: string, cardId: CardId): void {
  const p = state.players.find((pl) => pl.id === playerId);
  if (!p) throw new Error(`equip: player "${playerId}" not found`);
  p.equipment.push(cardId);
}

/**
 * Set a player's damage directly (bypasses damage.ts hooks — test setup only).
 * Use this only to initialise state; for testing the setDamage mechanic itself use
 * the white.ts handler or damage.ts directly.
 */
export function setDamageRaw(state: GameState, playerId: string, damage: number): void {
  const p = state.players.find((pl) => pl.id === playerId);
  if (!p) throw new Error(`setDamageRaw: player "${playerId}" not found`);
  p.damage = damage;
}

/**
 * Return the instanced card id for a White card by effectKey (first copy, index 0).
 * Convenience: `whiteCard("holy_water_of_healing")` → `"white:holy_water_of_healing#0"`.
 */
export function whiteCard(effectKey: string, copy = 0): CardId {
  const def = WHITE.find((d) => d.effectKey === effectKey);
  if (!def) throw new Error(`whiteCard: unknown effectKey "${effectKey}"`);
  return `white:${effectKey}#${copy}`;
}

/**
 * Place a card into a player's hand (test helper — lets us give a specific card to play).
 */
export function giveCard(state: GameState, playerId: string, cardId: CardId): void {
  const p = state.players.find((pl) => pl.id === playerId);
  if (!p) throw new Error(`giveCard: player "${playerId}" not found`);
  p.hand.push(cardId);
}

/**
 * Return a player state by id; throws if not found.
 */
export function getPlayer(state: GameState, playerId: string): PlayerState {
  const p = state.players.find((pl) => pl.id === playerId);
  if (!p) throw new Error(`getPlayer: player "${playerId}" not found`);
  return p;
}
