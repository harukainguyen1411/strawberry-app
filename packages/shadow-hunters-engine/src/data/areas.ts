// Static area data for the Shadow Hunters base game.
// Source of truth: ruleset.md §7 (board, areas & dice mapping).
//
// Movement = d6 + d4 (range 2–10). [RULEBOOK]
// Area assignments:
//   2–3 → hermits_cabin      [COMMUNITY]
//   4–5 → underworld_gate    [COMMUNITY]
//   6   → church             [RULEBOOK]
//   7   → wild (any area)    [RULEBOOK]
//   8   → cemetery           [COMMUNITY]
//   9   → weird_woods        [COMMUNITY]
//  10   → erstwhile_altar    [COMMUNITY]

import type { AreaId } from "../types.js";

/** All 6 area ids in a stable canonical order. */
export const AREAS: AreaId[] = [
  "hermits_cabin",
  "underworld_gate",
  "church",
  "cemetery",
  "weird_woods",
  "erstwhile_altar",
];

/**
 * Maps every possible d6+d4 result (2–10) to an AreaId,
 * or "wild" for 7 (player may move to any area). §7
 */
export const AREA_BY_DICE: Record<number, AreaId | "wild"> = {
  2: "hermits_cabin",
  3: "hermits_cabin",
  4: "underworld_gate",
  5: "underworld_gate",
  6: "church",
  7: "wild",
  8: "cemetery",
  9: "weird_woods",
  10: "erstwhile_altar",
};
