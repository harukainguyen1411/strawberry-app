// Movement module for the Shadow Hunters engine.
// Source of truth: ruleset.md §9 (movement rules), §7 (dice→area mapping),
// §5 (Emi Teleport), §6 (Mystic Compass), §12.21 (Emi ruling).
//
// §9 rules:
//   - Roll d6 + d4, move to matching area.
//   - 7 = wild: player chooses any area. [RULEBOOK]
//   - Never end on current area; re-roll if result points there. [RULEBOOK]
// Modifiers:
//   - Emi (Teleport): replaces roll with a fixed two-option choice. §5 §12.21
//   - Mystic Compass: roll twice, choose either result. §6 §9

import { rollD6, rollD4 } from "./rng.js";
import { AREA_BY_DICE, AREAS } from "./data/areas.js";
import type { GameState, GameEvent, AreaId, PlayerId } from "./types.js";

/** Result type returned by applyRollMove */
export interface RollMoveResult {
  state: GameState;
  events: GameEvent[];
  /** true when sum=7 (wild) and player must follow up with MoveTo; absent otherwise */
  wildPending?: true;
  /** set when Mystic Compass is equipped: 1-2 area choices; absent without Compass */
  compassChoices?: AreaId[];
}

/** Result type returned by applyMoveTo */
export interface MoveToResult {
  state: GameState;
  events: GameEvent[];
}

// ─── Internal helpers ────────────────────────────────────────────────────────

/** Check whether a player has a specific equipment effectKey equipped. */
function hasEquipment(equipment: readonly string[], effectKey: string): boolean {
  return equipment.some((id) => id.includes(effectKey));
}

/**
 * Resolve a dice sum to an area, re-rolling if the result is the player's current area. §9
 * Returns the area id and the dice values used for the final resolved roll.
 * "wild" is returned as-is (no re-roll — caller handles wild).
 */
function resolveRoll(
  state: GameState,
  currentArea: AreaId | null,
): { area: AreaId | "wild"; d6: number; d4: number } {
  // Re-roll loop: never stay in current area (§9)
  for (let attempts = 0; attempts < 20; attempts++) {
    const d6 = rollD6(state.rng);
    const d4 = rollD4(state.rng);
    const sum = d6 + d4;
    const mapped = AREA_BY_DICE[sum];
    if (mapped === undefined) continue; // should never happen for sum 2-10

    // Wild: always legal (caller handles MoveTo; no re-roll for wild)
    if (mapped === "wild") return { area: "wild", d6, d4 };

    // Non-wild: only accept if different from current area
    if (mapped !== currentArea) return { area: mapped, d6, d4 };
    // Else: same area — re-roll (§9)
  }
  // Extreme edge: fallback to first different area (should never happen in practice)
  const fallback = AREAS.find((a) => a !== currentArea) ?? AREAS[0]!;
  return { area: fallback as AreaId, d6: 1, d4: 1 };
}

// ─── Emi Teleport ────────────────────────────────────────────────────────────

/**
 * Compute the valid teleport targets for Emi. §5 §9 §12.21
 *
 * Emi's Teleport allows her to, instead of rolling, move to:
 *   1. The area paired with her current area.
 *   2. The "closest area in the opposite pair."
 *
 * "Opposite pair" interpretation: there are 3 pairs [0,1],[2,3],[4,5] in board order.
 * The pair that does NOT include Emi's current area and is closest to it in board layout.
 * Both options in that pair are offered as option 2 (player picks one). §12.21 [RULEBOOK]
 *
 * Implementation: return up to 2 distinct areas ≠ Emi's current area.
 *   - Always include the paired area.
 *   - Find the "closest" opposite pair's two areas (in board state.areas index order),
 *     and add the one(s) from the closest non-current pair.
 *
 * If area is null (before first move), returns [].
 */
export function emiTeleportTargets(state: GameState, playerId: PlayerId): AreaId[] {
  const player = state.players.find((p) => p.id === playerId);
  if (!player || player.area === null) return [];

  const currentArea = player.area;

  // 1. Paired area (always a valid target — differs from current)
  const pairedArea = state.pairing[currentArea];
  if (!pairedArea) return []; // should not happen

  // 2. The closest area in the "opposite pair" (a pair that contains neither currentArea nor pairedArea)
  // Find the board pair that Emi is NOT in
  const pairs: [AreaId, AreaId][] = [];
  for (let i = 0; i < state.areas.length; i += 2) {
    pairs.push([state.areas[i]!, state.areas[i + 1]!]);
  }

  // The pair containing Emi's current area
  const emiPairIdx = pairs.findIndex((pair) => pair.includes(currentArea));
  // The two other pairs
  const otherPairs = pairs.filter((_, idx) => idx !== emiPairIdx);

  // "Closest" — the rulebook says "the closest Area in the opposite pair".
  // We interpret "opposite" as any pair not containing Emi, and "closest" in board order
  // means the pair whose indices in state.areas are nearest to the emi pair.
  // Since there are only 2 other pairs, we offer both areas from ONE of them, and
  // the player picks. The rulebook says "closest", so we pick the pair whose board-index
  // distance is smallest. [§12.21 RULEBOOK: "the closest Area in the opposite pair"]
  // For simplicity (and rulebook faithfulness), we return ONE area from the nearest pair —
  // specifically the single area that is the nearest (by index) to currentArea.
  // Both options from that pair are viable per the spirit of the rule, so we include both.

  // Find which of the two "other pairs" is nearest by summing |emiPairIdx - otherIdx|
  const sortedOtherPairs = otherPairs.sort((a, b) => {
    const idxA = pairs.indexOf(a);
    const idxB = pairs.indexOf(b);
    return Math.abs(idxA - emiPairIdx) - Math.abs(idxB - emiPairIdx);
  });

  // Closest other pair: both areas are candidate targets for option 2
  const closestOtherPair = sortedOtherPairs[0];
  // §5 §12.21: Option 1 = paired area; Option 2 = ONE closest area in opposite pair.
  // "Closest area" = the first area (by board-index) in the closest other pair.
  const targets: AreaId[] = [pairedArea];
  if (closestOtherPair) {
    // Pick the single "closest" area from that pair (first in board order)
    const closestInPair = closestOtherPair.find((a) => a !== currentArea && a !== pairedArea);
    if (closestInPair && !targets.includes(closestInPair)) {
      targets.push(closestInPair);
    }
  }

  return targets;
}

// ─── applyRollMove ───────────────────────────────────────────────────────────

/**
 * Apply a RollMove action for the current player.
 *
 * - Validates phase === "move".
 * - If player is Emi (Teleport), sets up pendingMove.kind="emi" for subsequent MoveTo.
 * - If player has Mystic Compass, rolls twice and sets pendingMove.kind="compass".
 * - Otherwise rolls d6+d4, re-rolling if result equals current area (§9).
 * - For sum=7 (wild), sets pendingMove.kind="wild" and does not advance phase.
 * - For all other results, moves the player and advances phase to "area".
 *
 * Mutates state.rng (PRNG advancement is an in-place mutation on the rng object
 * inside GameState, consistent with how the rest of the engine works).
 */
export function applyRollMove(state: GameState): RollMoveResult {
  if (state.phase !== "move") {
    throw new Error(`applyRollMove called in phase "${state.phase}"; expected "move"`);
  }

  const playerId = state.current;
  const player = state.players.find((p) => p.id === playerId);
  if (!player) throw new Error(`Player "${playerId}" not found`);

  const currentArea = player.area;
  const events: GameEvent[] = [];

  // ── Emi Teleport §5 §9 §12.21 ────────────────────────────────────────────
  if (player.characterId === "emi") {
    if (currentArea !== null) {
      // Emi can teleport: set up pending for MoveTo
      state.pendingMove = { kind: "emi" };
      return { state, events };
    }
    // Emi has no area yet — fall through to a normal roll for her first move
  }

  // ── Mystic Compass §6 §9 ─────────────────────────────────────────────────
  if (hasEquipment(player.equipment, "mystic_compass")) {
    // Roll twice; filter out current area (never-stay §9); present both choices
    const roll1 = resolveRoll(state, currentArea);
    const roll2 = resolveRoll(state, currentArea);

    const choices: AreaId[] = [];
    // Each roll may have returned "wild" — treat wild as a special choice
    // (In Compass + wild scenario, the player picks from the two rolls; if one is wild
    // they could move anywhere; for simplicity we expand wild to all non-current areas.)
    for (const resolved of [roll1, roll2]) {
      if (resolved.area === "wild") {
        // Expand wild to all valid areas except current
        for (const a of AREAS) {
          if (a !== currentArea && !choices.includes(a)) choices.push(a);
        }
      } else {
        if (!choices.includes(resolved.area)) choices.push(resolved.area);
      }
    }

    // Deduplicate (already done above) and filter out current area
    const uniqueChoices = choices.filter((a) => a !== currentArea);

    // If both rolls gave the same non-wild result, still present 2-roll semantics
    // but with possibly just 1 unique choice — that is fine.
    // Use up to 2 choices (one per roll result) if they differ
    const finalChoices: AreaId[] = [];
    if (roll1.area !== "wild" && roll1.area !== currentArea) finalChoices.push(roll1.area);
    else if (roll1.area === "wild") {
      // Wild in compass: offer all non-current areas as first "choice"
      const wildTarget = AREAS.find((a) => a !== currentArea);
      if (wildTarget && !finalChoices.includes(wildTarget)) finalChoices.push(wildTarget);
    }
    if (roll2.area !== "wild" && roll2.area !== currentArea && !finalChoices.includes(roll2.area)) {
      finalChoices.push(roll2.area);
    } else if (roll2.area === "wild") {
      const wildTarget = AREAS.find((a) => a !== currentArea && !finalChoices.includes(a));
      if (wildTarget) finalChoices.push(wildTarget);
    }
    // Fallback: ensure at least one unique choice if both rolled same
    if (finalChoices.length === 0 && uniqueChoices.length > 0) finalChoices.push(uniqueChoices[0]!);

    state.pendingMove = { kind: "compass", compassOptions: finalChoices as AreaId[] };
    return { state, events, compassChoices: finalChoices as AreaId[] };
  }

  // ── Standard roll §9 ─────────────────────────────────────────────────────
  const { area, d6, d4 } = resolveRoll(state, currentArea);

  if (area === "wild") {
    // Wild: player must choose via MoveTo §7
    state.pendingMove = { kind: "wild", roll: [d6, d4] };
    return { state, events, wildPending: true };
  }

  // Non-wild: move the player immediately
  player.area = area;
  state.phase = "area";
  events.push({ type: "Moved", player: playerId, area, roll: [d6, d4] });

  return { state, events };
}

// ─── applyMoveTo ─────────────────────────────────────────────────────────────

/**
 * Apply a MoveTo action — resolves a pending wild choice, a Mystic Compass choice,
 * or an Emi Teleport choice.
 *
 * Validates:
 *   - A pendingMove is set (wild, compass, or emi).
 *   - The target area is in the valid set for that pending type.
 *   - Never-stay: target ≠ current area (§9).
 *
 * Advances phase to "area" and emits Moved event.
 */
export function applyMoveTo(state: GameState, area: AreaId): MoveToResult {
  const player = state.players.find((p) => p.id === state.current);
  if (!player) throw new Error(`Player "${state.current}" not found`);

  const events: GameEvent[] = [];

  // Validate pendingMove exists
  if (!state.pendingMove) {
    throw new Error(
      `applyMoveTo called without a pending move (phase="${state.phase}", pendingMove=undefined)`,
    );
  }

  // Snapshot the pendingMove before clearing it
  const pending = state.pendingMove;
  const kind = pending.kind;

  // Never-stay check §9
  if (area === player.area) {
    throw new Error(
      `Never-stay rule §9: player "${state.current}" cannot move to their current area "${area}"`,
    );
  }

  if (kind === "wild") {
    // Any area ≠ current is valid §7
    // Use original dice roll if present
    const roll = pending.roll;
    const playerId = state.current;
    player.area = area;
    state.phase = "area";
    state.pendingMove = undefined;
    if (roll) {
      events.push({ type: "Moved", player: playerId, area, roll });
    } else {
      events.push({ type: "Moved", player: playerId, area });
    }

  } else if (kind === "compass") {
    // Must be one of the compass choices
    const opts = (pending as { kind: "compass"; compassOptions?: AreaId[] }).compassOptions;
    if (opts && opts.length > 0 && !opts.includes(area)) {
      throw new Error(
        `Mystic Compass §9: area "${area}" is not one of the offered choices [${opts.join(", ")}]`,
      );
    }
    player.area = area;
    state.phase = "area";
    state.pendingMove = undefined;
    events.push({ type: "Moved", player: state.current, area });

  } else if (kind === "emi") {
    // Must be one of Emi's teleport targets §5 §12.21
    const targets = emiTeleportTargets(state, state.current);
    if (targets.length > 0 && !targets.includes(area)) {
      throw new Error(
        `Emi Teleport §5: area "${area}" is not in teleport targets [${targets.join(", ")}]`,
      );
    }
    player.area = area;
    state.phase = "area";
    state.pendingMove = undefined;
    // Teleport: no dice roll in Moved event §5
    events.push({ type: "Moved", player: state.current, area });

  } else {
    throw new Error(`Unknown pendingMove.kind: "${kind as string}"`);
  }

  return { state, events };
}
