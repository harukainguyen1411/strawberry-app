// Game setup: createGame — deterministic deal, shuffle, and area pairing.
// Source of truth: ruleset.md §3 (setup & player-count scaling), §4, §6, §7.

import { makeRng, shuffle } from "./rng.js";
import { CHARACTERS } from "./data/characters.js";
import { WHITE, BLACK, HERMIT } from "./data/cards.js";
import { AREAS } from "./data/areas.js";
import type { GameState, PlayerState, DeckKind, DeckState, AreaId } from "./types.js";

// §3: faction composition per player count [RULEBOOK]
const SCALING: Record<number, { Hunter: number; Shadow: number; Neutral: number }> = {
  4: { Hunter: 2, Shadow: 2, Neutral: 0 },
  5: { Hunter: 2, Shadow: 2, Neutral: 1 },
  6: { Hunter: 2, Shadow: 2, Neutral: 2 },
  7: { Hunter: 2, Shadow: 2, Neutral: 3 },
  8: { Hunter: 3, Shadow: 3, Neutral: 2 },
};

/**
 * Build instanced card ids from a deck definition.
 * Each physical copy gets a unique id: "<deck>:<effectKey>#<copy-index>".
 * §6: 16 White, 16 Black, 16 Hermit cards.
 */
function buildDeckIds(deckKind: DeckKind): string[] {
  const defs = deckKind === "white" ? WHITE : deckKind === "black" ? BLACK : HERMIT;
  const ids: string[] = [];
  for (const def of defs) {
    for (let i = 0; i < def.count; i++) {
      ids.push(`${deckKind}:${def.effectKey}#${i}`);
    }
  }
  return ids;
}

/**
 * Create a fully initialised GameState from player ids and a seed.
 * The same (playerIds, seed) pair always produces the same state (deterministic).
 *
 * §3: validate player count; split characters by faction, shuffle, deal per SCALING;
 * shuffle each card deck; shuffle AREAS and pair [0,1],[2,3],[4,5].
 */
export function createGame(playerIds: readonly string[], seed: string): GameState {
  const n = playerIds.length;
  if (n < 4 || n > 8) {
    throw new RangeError(`Shadow Hunters requires 4–8 players; got ${n}. §3`);
  }

  const rng = makeRng(seed);

  // ── Character deal (§3 step 4) ─────────────────────────────────────────────
  const scale = SCALING[n]!;

  const hunters = shuffle(
    CHARACTERS.filter((c) => c.faction === "Hunter"),
    rng,
  ).slice(0, scale.Hunter);

  const shadows = shuffle(
    CHARACTERS.filter((c) => c.faction === "Shadow"),
    rng,
  ).slice(0, scale.Shadow);

  const neutrals = shuffle(
    CHARACTERS.filter((c) => c.faction === "Neutral"),
    rng,
  ).slice(0, scale.Neutral);

  // Combine factions, shuffle once more, deal one per player (§3 step 4)
  const dealt = shuffle([...hunters, ...shadows, ...neutrals], rng);

  const players: PlayerState[] = playerIds.map((id, i) => ({
    id,
    characterId: dealt[i]!.id,
    damage: 0,
    revealed: false,
    alive: true,
    area: null,
    equipment: [],
    hand: [],
    usedOncePerGame: [],
    attackImmune: false,   // set by Guardian Angel (§6 §12.9); cleared at turn start
  }));

  // ── Deck construction (§3 step 2, §6) ──────────────────────────────────────
  const buildDeck = (kind: DeckKind): DeckState => ({
    draw: shuffle(buildDeckIds(kind), rng),
    discard: [],
  });

  const decks: Record<DeckKind, DeckState> = {
    white: buildDeck("white"),
    black: buildDeck("black"),
    hermit: buildDeck("hermit"),
  };

  // ── Board setup: shuffle areas, pair [0,1][2,3][4,5] (§3 step 1) ───────────
  // §7: areas sit in 3 random pairs; the pairing defines attack range [RULEBOOK]
  const boardAreas = shuffle([...AREAS], rng) as AreaId[];

  // Build bidirectional pairing from consecutive pairs
  const pairing = {} as Record<AreaId, AreaId>;
  for (let i = 0; i < boardAreas.length; i += 2) {
    const a = boardAreas[i]!;
    const b = boardAreas[i + 1]!;
    pairing[a] = b;
    pairing[b] = a;
  }

  // ── shownCards: one empty entry per player (Hermit's Prediction, §12.11) ───
  const shownCards: Record<string, string[]> = {};
  for (const id of playerIds) {
    shownCards[id] = [];
  }

  return {
    players,
    turnOrder: [...playerIds],  // clockwise order; §3 step 5 (first player = playerIds[0])
    current: playerIds[0]!,
    phase: "move",
    areas: boardAreas,
    pairing,
    decks,
    rng,
    deadOrder: [],
    deadEpoch: [],
    nextDeathEpoch: 0,   // §12.2: per-state death-epoch counter (deterministic across runs)
    lastKill: null,
    winners: [],
    over: false,
    pendingExtraTurns: 0,
    shownCards,
    log: [],
    pendingMove: undefined,
  };
}
