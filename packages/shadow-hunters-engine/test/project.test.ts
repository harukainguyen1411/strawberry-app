// Task 13: project(state, viewerId) — per-player view redaction (secrecy).
// Source of truth: ruleset.md §1 (identities exposed only on reveal/death),
// §11 (death → reveal). Secrecy is a hard engine invariant.

import { expect, test } from "vitest";
import { createGame } from "../src/setup.js";
import { project } from "../src/project.js";
import { legalActions } from "../src/reduce.js";
import { CHARACTERS } from "../src/data/characters.js";

const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i}`);
const factionOf = (cid: string) =>
  CHARACTERS.find((c) => c.id === cid)!.faction;
const winConditionOf = (cid: string) =>
  CHARACTERS.find((c) => c.id === cid)!.winCondition;
const maxHpOf = (cid: string) => CHARACTERS.find((c) => c.id === cid)!.maxHp;

test("viewer sees their own role/HP/win-condition", () => {
  const g = createGame(ids(6), "view-seed");
  const me = g.players[0]!;
  const view = project(g, me.id);
  expect(view.you.id).toBe(me.id);
  expect(view.you.characterId).toBe(me.characterId);
  expect(view.you.faction).toBe(factionOf(me.characterId));
  expect(view.you.maxHp).toBe(maxHpOf(me.characterId));
  expect(view.you.winCondition).toBe(winConditionOf(me.characterId));
});

test("hidden other players have characterId === null", () => {
  const g = createGame(ids(6), "view-seed");
  const me = g.players[0]!;
  const view = project(g, me.id);
  for (const pub of view.players) {
    if (pub.id === me.id) continue;
    const real = g.players.find((p) => p.id === pub.id)!;
    if (real.revealed || !real.alive) {
      expect(pub.characterId).toBe(real.characterId);
    } else {
      expect(pub.characterId).toBeNull();
    }
  }
});

test("public per-player data (damage/alive/area/equipment/revealed) is exposed", () => {
  const g = createGame(ids(5), "pub-seed");
  // Mutate some public fields to ensure they propagate.
  g.players[1]!.damage = 4;
  g.players[1]!.area = "church";
  g.players[1]!.equipment = ["black:chainsaw#0"];
  const view = project(g, g.players[0]!.id);
  const pub = view.players.find((p) => p.id === "p1")!;
  expect(pub.damage).toBe(4);
  expect(pub.alive).toBe(true);
  expect(pub.area).toBe("church");
  expect(pub.equipment).toEqual(["black:chainsaw#0"]);
  expect(pub.revealed).toBe(false);
});

test("public board (areas, pairing, current, phase) is exposed", () => {
  const g = createGame(ids(4), "board-seed");
  const view = project(g, g.players[0]!.id);
  expect(view.areas).toEqual(g.areas);
  expect(view.pairing).toEqual(g.pairing);
  expect(view.current).toBe(g.current);
  expect(view.phase).toBe(g.phase);
  expect(view.over).toBe(g.over);
  expect(view.winners).toEqual(g.winners);
});

test("legal = the viewer's own legalActions; recent = log tail", () => {
  const g = createGame(ids(4), "legal-seed");
  const viewer = g.current; // current player has real legal moves
  const view = project(g, viewer);
  expect(view.legal).toEqual(legalActions(g, viewer));
  expect(view.recent).toEqual(g.log.slice(-20));
});

test("SECRECY: JSON.stringify(view) leaks no other hidden player's characterId, faction, or rng seed", () => {
  const g = createGame(ids(8), "secret-seed");
  for (const viewer of g.players) {
    const view = project(g, viewer.id);
    const json = JSON.stringify(view);
    // No rng seed anywhere in the view.
    expect(json).not.toContain('"rng"');
    expect(json).not.toContain('"s":'); // Rng is { s: number }
    expect(json).not.toContain(String(g.rng.s));
    // No deck order leaked.
    expect(json).not.toContain('"decks"');
    expect(json).not.toContain('"draw"');
    for (const other of g.players) {
      if (other.id === viewer.id) continue;
      const hidden = !other.revealed && other.alive;
      if (hidden) {
        // The hidden player's character id must NOT appear anywhere in the
        // serialized view (not as a value, not embedded in any string).
        expect(json).not.toContain(other.characterId);
      }
    }
  }
});

test("SECRECY: a hidden other player shares the viewer's faction without leaking it", () => {
  // Even when two players share a faction, the hidden player's characterId
  // stays null — faction is never exposed for a hidden other player.
  const g = createGame(ids(6), "faction-seed");
  const me = g.players[0]!;
  const view = project(g, me.id);
  for (const pub of view.players) {
    if (pub.id === me.id) continue;
    const real = g.players.find((p) => p.id === pub.id)!;
    if (!real.revealed && real.alive) {
      // PublicPlayer carries no faction field at all; characterId is null.
      expect(pub.characterId).toBeNull();
      expect((pub as Record<string, unknown>)["faction"]).toBeUndefined();
    }
  }
});

test("after a reveal the role becomes visible to everyone", () => {
  const g = createGame(ids(5), "reveal-seed");
  const target = g.players[2]!;
  target.revealed = true;
  const view = project(g, g.players[0]!.id);
  const pub = view.players.find((p) => p.id === target.id)!;
  expect(pub.revealed).toBe(true);
  expect(pub.characterId).toBe(target.characterId);
});

test("after death the role becomes visible (dead players are open, §11)", () => {
  const g = createGame(ids(5), "death-seed");
  const target = g.players[3]!;
  target.alive = false; // dead but, say, not flagged revealed yet
  const view = project(g, g.players[0]!.id);
  const pub = view.players.find((p) => p.id === target.id)!;
  expect(pub.characterId).toBe(target.characterId);
});

test("Hermit's Prediction info appears ONLY in the giver's view (§12.11)", () => {
  const g = createGame(ids(6), "predict-seed");
  const giver = g.players[0]!;
  const shownAbout = g.players[3]!; // recipient who showed their card to giver
  g.shownCards[giver.id] = [shownAbout.characterId];

  const giverView = project(g, giver.id);
  expect(giverView.shownCards).toEqual([shownAbout.characterId]);

  // No other viewer sees this prediction info, and it does not leak the
  // hidden recipient's characterId into a non-giver view.
  for (const other of g.players) {
    if (other.id === giver.id) continue;
    const v = project(g, other.id);
    expect(v.shownCards).toEqual([]);
    if (other.id !== shownAbout.id && !shownAbout.revealed && shownAbout.alive) {
      expect(JSON.stringify(v)).not.toContain(shownAbout.characterId);
    }
  }
});
