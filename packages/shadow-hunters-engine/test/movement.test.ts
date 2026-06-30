// Test suite for Task 4: Movement
// Source of truth: ruleset.md §9, §7, §5 (Emi), §6 (Mystic Compass)
// Validates: RollMove maps d6+d4 to area; 7=wild awaits MoveTo; never-stay re-roll;
// Emi Teleport choices; Mystic Compass double-roll; Moved event; phase→area.

import { expect, test, describe } from "vitest";
import { nextFloat, makeRng } from "../src/rng.js";
import { AREA_BY_DICE, AREAS } from "../src/data/areas.js";
import { createGame } from "../src/setup.js";
import { applyRollMove, applyMoveTo, emiTeleportTargets } from "../src/movement.js";
import type { GameState, AreaId } from "../src/types.js";

// ─── Helper: peek at the next dice sum from a given rng state ───────────────
function peekDiceSum(rngS: number): { d6: number; d4: number; sum: number } {
  const r = { s: rngS };
  const d6 = 1 + Math.floor(nextFloat(r) * 6);
  const d4 = 1 + Math.floor(nextFloat(r) * 4);
  return { d6, d4, sum: d6 + d4 };
}

// ─── Helper: build a minimal GameState for movement tests ───────────────────
function makeState(opts: {
  characterId?: string;
  currentArea?: AreaId | null;
  equipment?: string[];
  seed?: string;
}): GameState {
  const playerIds = ["p0", "p1", "p2", "p3"];
  const state = createGame(playerIds, opts.seed ?? "move-test");

  // Override the current player (p0) for the test scenario
  const player = state.players.find((p) => p.id === "p0")!;
  if (opts.characterId !== undefined) player.characterId = opts.characterId;
  if (opts.currentArea !== undefined) player.area = opts.currentArea;
  if (opts.equipment !== undefined) player.equipment = [...opts.equipment];

  // Make sure p0 is the current player
  state.current = "p0";

  return state;
}

// ─── Find a seed that produces a specific dice sum on the first RollMove ─────
function findSeedWithSum(target: number, prefix: string): { seed: string; state: GameState } | null {
  for (let i = 0; i < 500; i++) {
    const seed = `${prefix}-${i}`;
    const state = makeState({ currentArea: null, seed });
    const { sum } = peekDiceSum(state.rng.s);
    if (sum === target) return { seed, state };
  }
  return null;
}

// ─── Basic roll + area mapping (§7, §9) ──────────────────────────────────────

describe("RollMove: normal area resolution §7 §9", () => {
  test("resolves area from dice sum and emits Moved event with roll", () => {
    // Find a non-wild seed
    let found: { seed: string; state: GameState } | null = null;
    for (let i = 0; i < 200; i++) {
      const seed = `roll-area-${i}`;
      const state = makeState({ currentArea: null, seed });
      const { sum } = peekDiceSum(state.rng.s);
      if (sum !== 7) { found = { seed, state }; break; }
    }
    expect(found).not.toBeNull();
    const { state } = found!;
    const { sum, d6, d4 } = peekDiceSum(state.rng.s);
    const expectedArea = AREA_BY_DICE[sum] as AreaId;

    const result = applyRollMove(state);

    // Phase advances to "area" for non-wild rolls
    expect(result.state.phase).toBe("area");

    // Player moved to expected area
    const player = result.state.players.find((p) => p.id === "p0")!;
    expect(player.area).toBe(expectedArea);

    // Moved event emitted with correct fields
    const movedEvt = result.events.find((e) => e.type === "Moved");
    expect(movedEvt).toBeDefined();
    if (movedEvt?.type === "Moved") {
      expect(movedEvt.player).toBe("p0");
      expect(movedEvt.area).toBe(expectedArea);
      expect(movedEvt.roll).toEqual([d6, d4]);
    }
  });

  test("deterministic: same seed produces same movement result", () => {
    const s1 = makeState({ currentArea: null, seed: "det-move-42" });
    const s2 = makeState({ currentArea: null, seed: "det-move-42" });

    const r1 = applyRollMove(s1);
    const r2 = applyRollMove(s2);

    expect(r1.events).toEqual(r2.events);
    const p1 = r1.state.players.find((p) => p.id === "p0")!;
    const p2 = r2.state.players.find((p) => p.id === "p0")!;
    expect(p1.area).toEqual(p2.area);
    expect(r1.state.phase).toEqual(r2.state.phase);
  });

  test("rolled area is a valid AreaId (in AREAS list)", () => {
    for (let i = 0; i < 30; i++) {
      const seed = `valid-area-${i}`;
      const state = makeState({ currentArea: null, seed });
      const result = applyRollMove(state);
      if (result.state.phase === "area") {
        const player = result.state.players.find((p) => p.id === "p0")!;
        expect(AREAS).toContain(player.area);
      }
    }
  });
});

// ─── Never-stay rule (§9) ─────────────────────────────────────────────────

describe("RollMove: never-stay re-roll rule §9", () => {
  test("player never moves to their current area", () => {
    // Test over many different areas and seeds
    let tested = 0;
    for (let i = 0; i < 100; i++) {
      const seed = `never-stay-${i}`;
      // Place player in a specific area by first doing a move
      const primeState = makeState({ currentArea: null, seed: `prime-${i}` });
      // Find non-wild roll to place the player
      const { sum: primeSum } = peekDiceSum(primeState.rng.s);
      if (primeSum === 7) continue;

      const primeResult = applyRollMove(primeState);
      if (primeResult.state.phase !== "area") continue;

      const playerArea = primeResult.state.players.find((p) => p.id === "p0")!.area!;

      // Now set up a state where the player IS in that area and roll again
      const state2 = makeState({ currentArea: playerArea, seed });
      const result2 = applyRollMove(state2);

      if (result2.state.phase === "area") {
        const playerAfter = result2.state.players.find((p) => p.id === "p0")!;
        // Must NOT stay in same area
        expect(playerAfter.area).not.toBe(playerArea);
        tested++;
      }
    }
    // Should have tested at least some cases
    expect(tested).toBeGreaterThan(0);
  });

  test("forced re-roll when dice maps to current area (deterministic proof)", () => {
    // Find a state where the first roll would land on a fixed area, place player there,
    // and confirm they end up somewhere else.
    for (let i = 0; i < 500; i++) {
      const seed = `reroll-${i}`;
      const protoState = makeState({ currentArea: null, seed });
      const { sum } = peekDiceSum(protoState.rng.s);
      if (sum === 7) continue;

      const firstArea = AREA_BY_DICE[sum] as AreaId | undefined;
      if (!firstArea || firstArea === "wild") continue;

      // Place player in firstArea — this forces a re-roll
      const state = makeState({ currentArea: firstArea, seed });
      const result = applyRollMove(state);

      if (result.state.phase === "area") {
        const player = result.state.players.find((p) => p.id === "p0")!;
        expect(player.area).not.toBe(firstArea);
        return; // Found and validated at least one case
      }
    }
  });
});

// ─── Wild (7): phase stays move, awaiting MoveTo ──────────────────────────

describe("RollMove + MoveTo: wild (7) choice §7 §9", () => {
  test("roll of 7 sets wildPending=true and phase stays move", () => {
    const found = findSeedWithSum(7, "wild-hunt");
    if (!found) {
      console.warn("No sum=7 seed found in 500 tries");
      return;
    }

    const result = applyRollMove(found.state);
    expect(result.wildPending).toBe(true);
    expect(result.state.phase).toBe("move");
  });

  test("wild roll: player area not yet changed before MoveTo", () => {
    const found = findSeedWithSum(7, "wild-area-unchanged");
    if (!found) return;

    const result = applyRollMove(found.state);
    expect(result.wildPending).toBe(true);
    // Player area is still null (was null before move)
    const player = result.state.players.find((p) => p.id === "p0")!;
    expect(player.area).toBeNull();
  });

  test("MoveTo resolves wild: sets area and advances phase to area", () => {
    const found = findSeedWithSum(7, "wild-moveto");
    if (!found) {
      console.warn("No sum=7 seed found");
      return;
    }

    const rollResult = applyRollMove(found.state);
    expect(rollResult.wildPending).toBe(true);

    const targetArea = AREAS[0] as AreaId;
    const moveResult = applyMoveTo(rollResult.state, targetArea);

    expect(moveResult.state.phase).toBe("area");
    const player = moveResult.state.players.find((p) => p.id === "p0")!;
    expect(player.area).toBe(targetArea);

    // Moved event emitted
    const movedEvt = moveResult.events.find((e) => e.type === "Moved");
    expect(movedEvt).toBeDefined();
    if (movedEvt?.type === "Moved") {
      expect(movedEvt.player).toBe("p0");
      expect(movedEvt.area).toBe(targetArea);
    }
  });

  test("MoveTo for wild cannot stay in current area (never-stay §9)", () => {
    // Player is in church, has rolled wild — cannot choose church
    const state = makeState({ currentArea: "church", seed: "moveto-nostay" });
    // Simulate wild pending
    (state as unknown as Record<string, unknown>)["wildPending"] = true;

    // Trying to stay in current area should throw
    expect(() => applyMoveTo(state, "church")).toThrow();
  });

  test("MoveTo for non-wild state is illegal (throws)", () => {
    // State is in area phase (no wildPending)
    const state = makeState({ currentArea: null, seed: "moveto-notwild" });
    // Find a non-wild seed so phase becomes area after roll
    for (let i = 0; i < 200; i++) {
      const s = makeState({ currentArea: null, seed: `moveto-notwild-${i}` });
      const { sum } = peekDiceSum(s.rng.s);
      if (sum === 7) continue;
      const rolled = applyRollMove(s);
      // In area phase, MoveTo should throw
      expect(() => applyMoveTo(rolled.state, AREAS[0] as AreaId)).toThrow();
      return;
    }
  });
});

// ─── Emi Teleport (§9, §5, §12.21) ──────────────────────────────────────────

describe("Emi Teleport: movement replacement §9 §5", () => {
  test("emiTeleportTargets returns 1-2 areas not including current area", () => {
    const state = makeState({ characterId: "emi", currentArea: "church", seed: "emi-test" });
    const targets = emiTeleportTargets(state, "p0");

    expect(targets.length).toBeGreaterThanOrEqual(1);
    expect(targets.length).toBeLessThanOrEqual(2);

    for (const t of targets) {
      expect(AREAS).toContain(t);
      expect(t).not.toBe("church");
    }
  });

  test("emiTeleportTargets returns paired area of current location", () => {
    const state = makeState({ characterId: "emi", currentArea: "church", seed: "emi-paired" });
    const targets = emiTeleportTargets(state, "p0");

    // One of the targets must be the paired area of current
    const pairedArea = state.pairing["church"];
    expect(targets).toContain(pairedArea);
  });

  test("emiTeleportTargets returns [] when player has no area (null)", () => {
    // Before first move, area is null — teleport not applicable
    const state = makeState({ characterId: "emi", currentArea: null, seed: "emi-null" });
    // applyRollMove or calling teleportTargets should handle null gracefully
    // (Implementation may return [] or throw; we test that it handles it)
    // Based on ruleset §9: teleport moves to paired area OR closest in opposite pair.
    // null area has no pair → no valid targets
    const targets = emiTeleportTargets(state, "p0");
    expect(targets).toEqual([]);
  });

  test("applying Emi MoveTo sets area and phase=area with no roll in Moved event", () => {
    const state = makeState({ characterId: "emi", currentArea: "church", seed: "emi-apply" });

    // Emi's move: first call applyRollMove to initiate teleport (sets pendingMove=emi)
    const rollResult = applyRollMove(state);
    // Phase stays "move" while Emi picks
    expect(rollResult.state.phase).toBe("move");

    const targets = emiTeleportTargets(rollResult.state, "p0");
    expect(targets.length).toBeGreaterThan(0);

    const chosen = targets[0] as AreaId;
    const result = applyMoveTo(rollResult.state, chosen);

    expect(result.state.phase).toBe("area");
    const player = result.state.players.find((p) => p.id === "p0")!;
    expect(player.area).toBe(chosen);

    // Moved event, no dice roll for teleport
    const movedEvt = result.events.find((e) => e.type === "Moved");
    expect(movedEvt).toBeDefined();
    if (movedEvt?.type === "Moved") {
      expect(movedEvt.area).toBe(chosen);
      expect(movedEvt.roll).toBeUndefined();
    }
  });
});

// ─── Mystic Compass: roll twice, choose §6 §9 ───────────────────────────────

describe("Mystic Compass: double-roll §6 §9", () => {
  test("with Mystic Compass, applyRollMove provides compassChoices array of 2 areas", () => {
    const state = makeState({
      currentArea: null,
      equipment: ["white:mystic_compass#0"],
      seed: "compass-test",
    });

    const result = applyRollMove(state);

    expect(result.compassChoices).toBeDefined();
    // Compass rolls twice; if both give the same area, may have 1 unique choice
    expect(result.compassChoices!.length).toBeGreaterThanOrEqual(1);
    expect(result.compassChoices!.length).toBeLessThanOrEqual(2);
    for (const choice of result.compassChoices!) {
      expect(AREAS).toContain(choice);
    }
  });

  test("with Mystic Compass, choosing one of two rolls resolves movement", () => {
    const state = makeState({
      currentArea: null,
      equipment: ["white:mystic_compass#0"],
      seed: "compass-choose",
    });

    const rollResult = applyRollMove(state);
    expect(rollResult.compassChoices).toBeDefined();
    expect(rollResult.compassChoices!.length).toBeGreaterThanOrEqual(1);
    expect(rollResult.compassChoices!.length).toBeLessThanOrEqual(2);

    const chosen = rollResult.compassChoices![0] as AreaId;
    const moveResult = applyMoveTo(rollResult.state, chosen);

    expect(moveResult.state.phase).toBe("area");
    const player = moveResult.state.players.find((p) => p.id === "p0")!;
    expect(player.area).toBe(chosen);
  });

  test("Mystic Compass does not add compassChoices when not equipped", () => {
    const state = makeState({ currentArea: null, seed: "no-compass" });
    // Ensure no compass
    const player = state.players.find((p) => p.id === "p0")!;
    player.equipment = [];

    const result = applyRollMove(state);
    expect(result.compassChoices).toBeUndefined();
  });

  test("with Mystic Compass, both choices are valid areas; never-stay still applies", () => {
    // Player is in a specific area; compass gives two rolls
    // Neither choice should equal the current area
    for (let i = 0; i < 20; i++) {
      const seed = `compass-nostay-${i}`;
      const currentArea = AREAS[i % AREAS.length] as AreaId;
      const state = makeState({
        currentArea,
        equipment: ["white:mystic_compass#0"],
        seed,
      });

      const result = applyRollMove(state);
      if (!result.compassChoices) continue;

      for (const choice of result.compassChoices) {
        expect(choice).not.toBe(currentArea);
      }
    }
  });
});

// ─── Phase must advance to "area" after successful move ───────────────────────

describe("Phase transitions after movement", () => {
  test("normal (non-wild) roll advances phase from move to area", () => {
    let found = false;
    for (let i = 0; i < 50; i++) {
      const state = makeState({ currentArea: null, seed: `phase-adv-${i}` });
      const { sum } = peekDiceSum(state.rng.s);
      if (sum === 7) continue;

      const result = applyRollMove(state);
      expect(result.state.phase).toBe("area");
      found = true;
      break;
    }
    expect(found).toBe(true);
  });

  test("wild roll keeps phase=move; MoveTo then advances to area", () => {
    const found = findSeedWithSum(7, "phase-wild");
    if (!found) {
      console.warn("No sum=7 seed found for phase-wild test");
      return;
    }

    const rollResult = applyRollMove(found.state);
    expect(rollResult.state.phase).toBe("move");

    // Resolve via MoveTo
    const target = AREAS[0] as AreaId;
    const moveResult = applyMoveTo(rollResult.state, target);
    expect(moveResult.state.phase).toBe("area");
  });

  test("RollMove is not legal when phase is not move", () => {
    const state = makeState({ currentArea: null, seed: "wrong-phase" });
    // Manually set phase to area
    state.phase = "area";
    expect(() => applyRollMove(state)).toThrow();
  });
});
