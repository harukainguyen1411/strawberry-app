// Task 3 tests: createGame setup + scaling
// Source of truth: ruleset.md §3 (setup & player-count scaling)

import { expect, test } from "vitest";
import { createGame } from "../src/setup.js";
import { CHARACTERS } from "../src/data/characters.js";

const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i}`);
const factionOf = (cid: string) => CHARACTERS.find((c) => c.id === cid)!.faction;

// §3 scaling table: Hunters / Shadows / Neutrals per player count
test.each([
  [4, 2, 2, 0],
  [5, 2, 2, 1],
  [6, 2, 2, 2],
  [7, 2, 2, 3],
  [8, 3, 3, 2],
])("%i players deal H/S/N = %i/%i/%i", (n, h, s, neu) => {
  const g = createGame(ids(n), "seed");
  const factions = g.players.map((p) => factionOf(p.characterId));
  expect(factions.filter((x) => x === "Hunter").length).toBe(h);
  expect(factions.filter((x) => x === "Shadow").length).toBe(s);
  expect(factions.filter((x) => x === "Neutral").length).toBe(neu);
});

// Same (playerIds, seed) → identical state (deterministic)
test("deterministic: same seed + players produces identical state", () => {
  expect(createGame(ids(6), "x")).toEqual(createGame(ids(6), "x"));
});

// Different seeds → different deals (probabilistic sanity check)
test("different seeds produce different deals", () => {
  const a = createGame(ids(6), "seed-a");
  const b = createGame(ids(6), "seed-b");
  const aChars = a.players.map((p) => p.characterId).join(",");
  const bChars = b.players.map((p) => p.characterId).join(",");
  // It is astronomically unlikely they match; treat as a smoke check
  expect(aChars).not.toBe(bChars);
});

// Every player starts with revealed=false, area=null, damage=0, alive=true
test("all players start hidden, off-board, undamaged, alive", () => {
  const g = createGame(ids(6), "init");
  for (const p of g.players) {
    expect(p.revealed).toBe(false);
    expect(p.area).toBeNull();
    expect(p.damage).toBe(0);
    expect(p.alive).toBe(true);
    expect(p.equipment).toEqual([]);
    expect(p.hand).toEqual([]);
    expect(p.usedOncePerGame).toEqual([]);
  }
});

// Deck card ids are instanced: one id per physical copy, no duplicates across draw piles
test("instanced deck ids: no duplicate card ids across all three draw piles", () => {
  const g = createGame(ids(6), "deck-check");
  const allIds = [
    ...g.decks.white.draw,
    ...g.decks.black.draw,
    ...g.decks.hermit.draw,
  ];
  const unique = new Set(allIds);
  expect(unique.size).toBe(allIds.length);
});

// Deck sizes: White=16, Black=16, Hermit=16
test("deck sizes: 16 cards in each draw pile at start", () => {
  const g = createGame(ids(4), "deck-size");
  expect(g.decks.white.draw.length).toBe(16);
  expect(g.decks.black.draw.length).toBe(16);
  expect(g.decks.hermit.draw.length).toBe(16);
  expect(g.decks.white.discard).toEqual([]);
  expect(g.decks.black.discard).toEqual([]);
  expect(g.decks.hermit.discard).toEqual([]);
});

// Area pairing: [0,1][2,3][4,5] pairs are symmetric (pairing[pairing[a]] === a)
test("area pairing is symmetric", () => {
  const g = createGame(ids(4), "pairing");
  for (const area of g.areas) {
    const paired = g.pairing[area];
    expect(g.pairing[paired]).toBe(area);
  }
  // The 6 areas split into exactly 3 distinct pairs
  const seenPairs = new Set<string>();
  for (const area of g.areas) {
    const pair = [area, g.pairing[area]].sort().join(":");
    seenPairs.add(pair);
  }
  expect(seenPairs.size).toBe(3);
});

// pairing partners are never the same area
test("no area is paired with itself", () => {
  const g = createGame(ids(4), "no-self-pair");
  for (const area of g.areas) {
    expect(g.pairing[area]).not.toBe(area);
  }
});

// Initial state: current = first player, phase = "move"
test("initial current player and phase", () => {
  const players = ids(5);
  const g = createGame(players, "turn");
  expect(g.current).toBe("p0");
  expect(g.phase).toBe("move");
});

// turnOrder matches the player list
test("turnOrder matches playerIds in order", () => {
  const players = ids(7);
  const g = createGame(players, "order");
  expect(g.turnOrder).toEqual(players);
});

// Throws on too few or too many players
test("throws on fewer than 4 players", () => {
  expect(() => createGame(ids(3), "bad")).toThrow();
});

test("throws on more than 8 players", () => {
  expect(() => createGame(ids(9), "bad")).toThrow();
});

// game starts not over, no winners
test("game starts with over=false and no winners", () => {
  const g = createGame(ids(4), "start");
  expect(g.over).toBe(false);
  expect(g.winners).toEqual([]);
});

// shownCards starts empty, deadOrder starts empty, log starts empty
test("game starts with empty shownCards, deadOrder, log, no pendingExtraTurns", () => {
  const g = createGame(ids(4), "empty-fields");
  expect(g.deadOrder).toEqual([]);
  expect(g.log).toEqual([]);
  expect(g.pendingExtraTurns).toBe(0);
  expect(g.lastKill).toBeNull();
  // shownCards: one entry per player, all empty arrays
  for (const p of g.players) {
    expect(g.shownCards[p.id]).toEqual([]);
  }
});
