// Task 13: project(state, viewerId) — per-player view redaction (secrecy).
// Source of truth: ruleset.md §1 (identities exposed only on reveal/death),
// §11 (death → reveal). Secrecy is a hard engine invariant.

import { expect, test } from "vitest";
import { createGame } from "../src/setup.js";
import { project } from "../src/project.js";
import { legalActions } from "../src/reduce.js";
import { applyAttack } from "../src/combat.js";
import { CHARACTERS } from "../src/data/characters.js";
import type { AreaId } from "../src/types.js";

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

test("SECRECY: view leaks no other hidden player's characterId, faction, or rng seed", () => {
  // FIELD-AWARE check, mirroring script.ts assertSecrecy: a raw
  // JSON.stringify(view).not.toContain(characterId) scan FALSE-NEGATIVES because
  // a character id legitimately appears as a SUBSTRING of public data — e.g.
  // "vampire" is a substring of the public equipment id "black:vampire_bat#0".
  // So we assert the specific place a hidden identity could leak: every hidden
  // OTHER player's public characterId MUST be null.
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

    const hiddenOthers = new Set(
      g.players
        .filter((o) => o.id !== viewer.id && !o.revealed && o.alive)
        .map((o) => o.id),
    );
    // Field-aware: every hidden OTHER player's public characterId is null.
    for (const pub of view.players) {
      if (pub.id === viewer.id) continue;
      if (hiddenOthers.has(pub.id)) {
        expect(pub.characterId).toBeNull();
      }
    }
    // And no Revealed/Died event in the recent log names a still-hidden OTHER
    // player (its mere presence for a hidden player would itself be the leak).
    for (const evt of view.recent) {
      if (evt.type === "Revealed" || evt.type === "Died") {
        if (evt.player !== viewer.id) {
          expect(hiddenOthers.has(evt.player)).toBe(false);
        }
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

// ── Per-viewer redaction of identity-tell log events (§1 secrecy) ────────────
// project().recent is built PER VIEWER. Events that only a specific character can
// produce — Vampire's "suck_blood" Healed (§12.7) and Bob's "robbery"-tagged
// EquipmentTaken (§5/§12.8) — would otherwise let an innocent viewer infer a
// hidden player's identity by inference. They are dropped from a viewer's recent
// when their subject is hidden to that viewer; the owner and viewers to whom the
// subject is open still see them.

/** Place `attacker` and `victim` on the same area so the attack is in range (§10). */
function colocate(
  g: ReturnType<typeof createGame>,
  attackerId: string,
  victimId: string,
): void {
  const area = g.areas[0] as AreaId;
  g.players.find((p) => p.id === attackerId)!.area = area;
  g.players.find((p) => p.id === victimId)!.area = area;
}

test("SECRECY: hidden Vampire's suck_blood Healed is redacted from an innocent viewer's recent (§12.7)", () => {
  const g = createGame(ids(6), "vamp-redact-seed");
  const vamp = g.players[0]!;
  const victim = g.players[1]!;
  const innocent = g.players[2]!;
  // Force a hidden Vampire with self-damage to heal, an alive victim in range.
  vamp.characterId = "vampire";
  vamp.revealed = false;
  vamp.damage = 5; // so the heal actually moves the damage track
  colocate(g, vamp.id, victim.id);

  // d6=4,d4=1 → |4-1|=3 damage > 0 → Suck Blood fires (§12.7).
  const res = applyAttack(g, vamp.id, victim.id, { dice: { d6: 4, d4: 1 } });
  // Sanity: the suck_blood Healed actually entered the authoritative log.
  expect(g.log.some((e) => e.type === "Healed" && e.source === "suck_blood")).toBe(true);
  expect(res.hit).toBe(true);

  // Innocent viewer: NO suck_blood event, and the Vampire stays characterId:null.
  const innocentView = project(g, innocent.id);
  expect(
    innocentView.recent.some((e) => e.type === "Healed" && e.source === "suck_blood"),
  ).toBe(false);
  // Defence in depth: no event in the innocent's recent names the Vampire as a Healed subject.
  expect(
    innocentView.recent.some((e) => e.type === "Healed" && e.player === vamp.id),
  ).toBe(false);
  const vampPub = innocentView.players.find((p) => p.id === vamp.id)!;
  expect(vampPub.characterId).toBeNull();

  // The Vampire themselves still sees their own heal.
  const ownerView = project(g, vamp.id);
  expect(
    ownerView.recent.some((e) => e.type === "Healed" && e.source === "suck_blood"),
  ).toBe(true);

  // A viewer to whom the Vampire is OPEN (revealed) sees it too.
  vamp.revealed = true;
  const openView = project(g, innocent.id);
  expect(
    openView.recent.some((e) => e.type === "Healed" && e.source === "suck_blood"),
  ).toBe(true);
});

test("SECRECY: hidden Bob's robbery EquipmentTaken is redacted from an innocent viewer's recent (§12.8)", () => {
  const g = createGame(ids(6), "bob-redact-seed"); // 6 players → 4–6p Robbery applies
  const bob = g.players[0]!;
  const victim = g.players[1]!;
  const innocent = g.players[2]!;
  bob.characterId = "bob";
  bob.revealed = false;
  victim.equipment = ["black:chainsaw#0"]; // something to steal
  colocate(g, bob.id, victim.id);

  // d6=5,d4=1 → |5-1|=4 (>=2) → Robbery converts the hit into a steal (no damage). §12.8
  const res = applyAttack(g, bob.id, victim.id, { dice: { d6: 5, d4: 1 } });
  expect(res.stole).toBe(true);
  // The robbery-tagged EquipmentTaken is in the authoritative log.
  expect(
    g.log.some((e) => e.type === "EquipmentTaken" && (e as { via?: string }).via === "robbery"),
  ).toBe(true);

  // Innocent viewer: NO robbery-tagged EquipmentTaken naming Bob; Bob stays null.
  const innocentView = project(g, innocent.id);
  expect(
    innocentView.recent.some(
      (e) =>
        e.type === "EquipmentTaken" &&
        (e as { via?: string }).via === "robbery",
    ),
  ).toBe(false);
  expect(
    innocentView.recent.some(
      (e) => e.type === "EquipmentTaken" && e.player === bob.id,
    ),
  ).toBe(false);
  const bobPub = innocentView.players.find((p) => p.id === bob.id)!;
  expect(bobPub.characterId).toBeNull();

  // Bob themselves still sees the steal.
  const ownerView = project(g, bob.id);
  expect(
    ownerView.recent.some(
      (e) =>
        e.type === "EquipmentTaken" &&
        (e as { via?: string }).via === "robbery",
    ),
  ).toBe(true);

  // A non-robbery EquipmentTaken (e.g. Erstwhile Altar / Moody Goblin / kill loot)
  // is NOT redacted, even when its actor is hidden — it carries no identity tell.
  g.log.push({
    type: "EquipmentTaken",
    player: innocent.id, // hidden actor, but a plain steal carries no tell
    from: victim.id,
    card: "white:silver_rosary#0",
  });
  const viewerView = project(g, bob.id);
  expect(
    viewerView.recent.some(
      (e) =>
        e.type === "EquipmentTaken" &&
        e.card === "white:silver_rosary#0" &&
        (e as { via?: string }).via === undefined,
    ),
  ).toBe(true);
});
