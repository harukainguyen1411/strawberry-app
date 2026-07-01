// Character abilities + the trigger/hook system for the Shadow Hunters engine.
// Source of truth: ruleset.md
//
//   §5  — the 10 base abilities. Using an ability normally REQUIRES revealing
//         (flip card face up). Exceptions: Daniel and Unknown (their abilities do
//         not require/permit a normal reveal). Abilities are optional.
//   §8  — Franklin/George trigger at the START of the turn (before the move);
//         Werewolf's counter triggers when attacked; Daniel's Scream the instant
//         any character dies.
//   §9  — Emi Teleport: move to the paired Area, OR the closest Area in the
//         opposite pair (no roll).
//   §10/§11 — combat & loot live in combat.ts / damage.ts; abilities reuse them.
//
//   §12.3 — only combat-step attacks (and Werewolf's counter, Charles's Bloody-Feast
//           extra attack) are "attacks". Franklin/George abilities and all card
//           effects are NOT attacks. Consequences: they don't count for Charles,
//           don't trigger Werewolf's counter, don't trigger Vampire's heal, and are
//           NOT blocked by Guardian Angel. We honour this by dealing Franklin/George
//           ability damage through applyDamage with a NON-attack source ("lightning"
//           / "demolish"); the "attack"-only guards in damage.ts therefore never fire.
//   §12.4 — Charles attribution: only his OWN attacks (incl. Bloody Feast) count for
//           "lands the 3rd kill". An ability/card kill credits no attacker.
//   §12.5 — Daniel forced reveal on any death; he may not reveal at any other time.
//   §12.6 — Werewolf Counterattack: a separate NORMAL attack (rolls, can miss, equipment
//           applies); fires on hit OR miss; reveals to use; does NOT itself provoke a
//           counter (we call applyCounterattack exactly once, no recursion).
//   §12.7 — Vampire Suck Blood: heal 2 ONCE per attack action; applied inside
//           combat.applyAttack (this module documents the ruling and the trigger point).
//   §12.8 — Bob Robbery (4–6p): a steal deals NO damage; resolved inside
//           combat.applyAttack. The 7–8p kill-steal is a normal damaging attack whose
//           loot is the "all" rule in damage.lootRule.
//   §12.9 — Guardian Angel blocks attack-source damage only (enforced in damage.ts).
//   §12.11 — Unknown Deceit: handled inside cards/hermit.giveHermit (lie/decline);
//            this module's onGivenHermit hook delegates there. Prediction cannot be faked.
//   §12.22 — Franklin/George "start of turn" = before the mandatory move; reveal then resolve.
//
// Design — hook points & registry:
//   The reducer (Task 12) drives the turn machine and calls runHook(point, player, ctx)
//   at the appropriate moments. Each ability declares the single `trigger` hook point it
//   listens on; runHook dispatches to that ability's `run`. Abilities mutate state in
//   place and return the GameEvent[] they produced (the same convention as damage.ts /
//   combat.ts). "Once per game" is tracked via PlayerState.usedOncePerGame.

import { applyDamage, applyHeal, reveal } from "./damage.js";
import { applyAttack, applyCounterattack, type CombatDice } from "./combat.js";
import { emiTeleportTargets } from "./movement.js";
import { giveHermit } from "./cards/hermit.js";
import { CHARACTERS } from "./data/characters.js";
import type {
  GameState,
  GameEvent,
  PlayerId,
  CharacterId,
  AreaId,
} from "./types.js";

// ─── Hook points (§8) ──────────────────────────────────────────────────────────

/**
 * The trigger moments the reducer fires. Each ability listens on exactly one.
 *   - onStartTurn   — start of the acting player's turn, before the mandatory move
 *                     (Franklin/George; §8, §12.22).
 *   - onMove        — the move step, when the player may replace the roll (Emi; §9).
 *   - onAfterAttack — immediately after a combat attack resolves (Charles Bloody
 *                     Feast; Bob/Vampire are applied inside combat.applyAttack itself).
 *   - onAttacked    — when this player is the target of an attack (Werewolf; §12.6).
 *   - onAnyDeath    — the instant any character dies (Daniel Scream; §12.5).
 *   - onGivenHermit — when this player is handed a Hermit card (Unknown Deceit; §12.11).
 *   - manual        — player-initiated, any time (Allie Mother's Love; §5).
 */
export type HookPoint =
  | "onStartTurn"
  | "onMove"
  | "onAfterAttack"
  | "onAttacked"
  | "onAnyDeath"
  | "onGivenHermit"
  | "manual";

/**
 * Context handed to an ability's `run`. `params` carries the choice/dice the player
 * (or test/reducer) supplies for that ability. All randomness should be injected via
 * `params` (deterministic) or pulled from `state.rng` by the underlying combat/damage
 * helpers — abilities never hold module-level mutable state.
 */
export interface AbilityCtx {
  state: GameState;
  player: PlayerId;
  /** Ability-specific parameters (target, roll, dice, hermit-give fields, …). */
  params?: AbilityParams;
}

/** Loosely-typed ability parameters; each ability reads only the keys it needs. */
export interface AbilityParams {
  /** Franklin/George/Charles/Werewolf target; Weird-Woods-style picks. */
  target?: PlayerId;
  /** Franklin (d6) / George (d4) damage roll, injected for determinism. */
  roll?: number;
  /** Combat dice for Charles / Werewolf re-attacks (injected for determinism). */
  dice?: CombatDice;
  /** Emi Teleport destination (one of teleportOptions). */
  area?: AreaId;
  /** onAttacked: who attacked this player (Werewolf counter target). */
  attacker?: PlayerId;
  /** onAnyDeath: who died (Daniel Scream context). */
  deceased?: PlayerId;
  /** onGivenHermit: the giver of the Hermit card (Unknown Deceit). */
  giver?: PlayerId;
  /** onGivenHermit: the Hermit card id handed over. */
  cardId?: string;
  /** Unknown Deceit: lie about identity to trigger the effect (§12.11). */
  lie?: boolean;
  /** Unknown Deceit: decline ("nothing happens") (§12.11). */
  decline?: boolean;
  /** Probe the ability without committing (used by some onMove option queries). */
  dryRun?: boolean;
}

/** A registered character ability. */
export interface AbilityDef {
  /** The character this ability belongs to (§5). */
  characterId: CharacterId;
  /** Human-readable ability name (matches §5). */
  name: string;
  /** The single hook point this ability listens on. */
  trigger: HookPoint;
  /**
   * §5: whether USING this ability flips the player face up. False for Daniel
   * (reveal is forced by death, not by the ability) and Unknown (Deceit never reveals).
   */
  requiresReveal: boolean;
  /**
   * True if the ability is limited to once per game (tracked via usedOncePerGame).
   * Franklin/George/Allie are once-per-game; the rest are unlimited / passive.
   */
  oncePerGame: boolean;
  /** The id recorded in usedOncePerGame when spent (for oncePerGame abilities). */
  useKey?: string;
  /** Run the ability. Mutates state; returns the events produced. */
  run: (ctx: AbilityCtx) => GameEvent[];
  /** Emi only: the legal teleport destinations from a given state (§9). */
  teleportOptions?: (state: GameState, player: PlayerId) => AreaId[];
}

// ─── Lookups ─────────────────────────────────────────────────────────────────

function getPlayer(state: GameState, id: PlayerId) {
  const p = state.players.find((pl) => pl.id === id);
  if (!p) throw new Error(`abilities.ts: player "${id}" not found`);
  return p;
}

function maxHpOf(characterId: string): number {
  const def = CHARACTERS.find((c) => c.id === characterId);
  if (!def) throw new Error(`abilities.ts: unknown character "${characterId}"`);
  return def.maxHp;
}

/** Emit an AbilityUsed event and push it to the log. */
function abilityUsed(state: GameState, player: PlayerId, ability: string): GameEvent {
  const evt: GameEvent = { type: "AbilityUsed", player, ability };
  state.log.push(evt);
  return evt;
}

/**
 * §5: flip the acting player face up for an ability that requires reveal.
 * Idempotent (reveal() emits Revealed at most once).
 */
function revealForAbility(state: GameState, player: PlayerId): GameEvent[] {
  return reveal(state, player);
}

// ─── Emi — Teleport (onMove) §5 §9 §12.21 ──────────────────────────────────────

/**
 * §5 §12.21 Emi Teleport options: EXACTLY the two options in §5 — the Area paired
 * with the current one, OR the closest Area in the opposite pair. Never the current
 * Area (§9 no-stay). §12.21 is a tagged [RULING] invariant that removes the
 * "opposite pair is ambiguous on a 6-area board" ambiguity, so the engine must NOT
 * offer every non-current Area.
 *
 * This is the same rule as movement.ts emiTeleportTargets — the single source of
 * truth for Emi's destinations — so we delegate to it rather than re-deriving the
 * board geometry here. Returns the (up to) 2 legal destinations; [] before the
 * first move (player has no current Area yet).
 */
function emiTeleportOptions(state: GameState, player: PlayerId): AreaId[] {
  return emiTeleportTargets(state, player);
}

const emiAbility: AbilityDef = {
  characterId: "emi",
  name: "Teleport",
  trigger: "onMove",
  requiresReveal: true, // §5: using an ability requires reveal (Emi included)
  oncePerGame: false,
  teleportOptions: emiTeleportOptions,
  run: ({ state, player, params }) => {
    // A probe (dryRun) returns no events; callers use teleportOptions() to enumerate.
    if (params?.dryRun) return [];

    const dest = params?.area;
    if (dest === undefined) {
      throw new Error("Emi Teleport requires params.area");
    }
    const opts = emiTeleportOptions(state, player);
    if (!opts.includes(dest)) {
      throw new Error(`Emi Teleport: "${dest}" is not a legal destination §9`);
    }

    const events: GameEvent[] = [];
    // §5: reveal to use the ability.
    events.push(...revealForAbility(state, player));

    const p = getPlayer(state, player);
    p.area = dest;
    const movedEvt: GameEvent = { type: "Moved", player, area: dest };
    state.log.push(movedEvt);
    events.push(movedEvt);
    events.push(abilityUsed(state, player, "teleport"));
    return events;
  },
};

// ─── Franklin — Lightning / George — Demolish (onStartTurn) §5 §12.3 §12.22 ─────

/**
 * Shared once-per-game start-of-turn ability for Franklin (d6) and George (d4).
 * §12.3: the damage is dealt via applyDamage with a NON-attack source, so it:
 *   - is NOT blocked by Guardian Angel (the "attack"-only guard in damage.ts skips it);
 *   - does NOT trigger Vampire's Suck Blood or Werewolf's counter;
 *   - credits NO attacker (killer === null), so it does NOT count for Charles (§12.4).
 */
function startOfTurnDamageAbility(
  characterId: CharacterId,
  name: string,
  useKey: string,
  source: string,
): AbilityDef {
  return {
    characterId,
    name,
    trigger: "onStartTurn",
    requiresReveal: true, // §5
    oncePerGame: true,
    useKey,
    run: ({ state, player, params }) => {
      const p = getPlayer(state, player);
      // §5 once per game: a spent ability is a no-op.
      if (p.usedOncePerGame.includes(useKey)) return [];
      const target = params?.target;
      const roll = params?.roll;
      if (target === undefined || roll === undefined) {
        // No choice supplied → the player declined to use it this turn.
        return [];
      }

      const events: GameEvent[] = [];
      // §5: reveal to use the ability (then resolve, §12.22).
      events.push(...revealForAbility(state, player));

      // Mark used BEFORE resolving so a mid-resolution win-check can't re-enter.
      p.usedOncePerGame.push(useKey);

      // §12.3: NON-attack source → ignores Guardian Angel, no Vampire/Werewolf,
      // killer === null so it does not count for Charles (§12.4).
      events.push(...applyDamage(state, target, roll, source, null));
      events.push(abilityUsed(state, player, useKey));
      return events;
    },
  };
}

const franklinAbility = startOfTurnDamageAbility(
  "franklin",
  "Lightning",
  "lightning",
  "lightning",
);
const georgeAbility = startOfTurnDamageAbility(
  "george",
  "Demolish",
  "demolish",
  "demolish",
);

// ─── Unknown — Deceit (onGivenHermit) §5 §12.11 ────────────────────────────────

/**
 * Unknown's Deceit is fully realised inside cards/hermit.giveHermit (lie/decline via
 * GiveHermitOpts). This hook delegates there so there is a single source of truth for
 * Hermit resolution. §12.11: the lie applies the real HP change without revealing, a
 * decline is "nothing happens", and Hermit's Prediction cannot be faked.
 */
const unknownAbility: AbilityDef = {
  characterId: "unknown",
  name: "Deceit",
  trigger: "onGivenHermit",
  requiresReveal: false, // §5/§12.11: Unknown never reveals via this ability
  oncePerGame: false,
  run: ({ state, player, params }) => {
    const giver = params?.giver;
    const cardId = params?.cardId;
    if (giver === undefined || cardId === undefined) {
      throw new Error("Unknown Deceit requires params.giver and params.cardId");
    }
    // Delegate to the canonical Hermit give path (§12.11 lie/decline live there).
    // GiveHermitOpts only carries lie/decline; equipment-give choices for a
    // give-or-take Hermit are resolved deterministically inside giveHermit.
    return giveHermit(state, giver, player, cardId, {
      ...(params?.lie ? { lie: true } : {}),
      ...(params?.decline ? { decline: true } : {}),
    });
  },
};

// ─── Vampire — Suck Blood (onAfterAttack) §5 §12.7 ─────────────────────────────

/**
 * Vampire's Suck Blood is applied INSIDE combat.applyAttack (heal 2 once per attack
 * action when any damage was dealt; §12.7). The hook here is a documented no-op so the
 * reducer's onAfterAttack pass is uniform across characters — the heal already happened
 * during the attack resolution, not here.
 */
const vampireAbility: AbilityDef = {
  characterId: "vampire",
  name: "Suck Blood",
  trigger: "onAfterAttack",
  requiresReveal: false, // a passive on-attack effect; combat.ts handles the heal
  oncePerGame: false,
  run: () => [], // §12.7: heal already applied within applyAttack
};

// ─── Werewolf — Counterattack (onAttacked) §5 §12.6 ────────────────────────────

/**
 * §12.6: a separate NORMAL attack back at the original attacker, after the initial
 * attack fully resolves. Fires on hit OR miss; rolls and can miss; equipment applies;
 * reveals the Werewolf if hidden. It does NOT itself provoke a counter — we invoke
 * combat.applyCounterattack exactly once and the reducer does not fire onAttacked for
 * a counter, so there is no recursion.
 */
const werewolfAbility: AbilityDef = {
  characterId: "werewolf",
  name: "Counterattack",
  trigger: "onAttacked",
  requiresReveal: true, // §12.6: reveal to counter (applyCounterattack also reveals)
  oncePerGame: false,
  run: ({ state, player, params }) => {
    const attacker = params?.attacker;
    if (attacker === undefined) {
      // No attacker supplied → the Werewolf declines to counter.
      return [];
    }
    const events: GameEvent[] = [];
    // applyCounterattack reveals the Werewolf (idempotent) and runs a normal attack.
    const res = applyCounterattack(
      state,
      player,
      attacker,
      params?.dice ? { dice: params.dice } : undefined,
    );
    events.push(...res.events);
    events.push(abilityUsed(state, player, "counterattack"));
    return events;
  },
};

// ─── Allie — Mother's Love (manual, once per game) §5 ──────────────────────────

const allieAbility: AbilityDef = {
  characterId: "allie",
  name: "Mother's Love",
  trigger: "manual",
  requiresReveal: true, // §5
  oncePerGame: true,
  useKey: "mothers_love",
  run: ({ state, player }) => {
    const p = getPlayer(state, player);
    // §5 once per game.
    if (p.usedOncePerGame.includes("mothers_love")) return [];

    const events: GameEvent[] = [];
    events.push(...revealForAbility(state, player));
    p.usedOncePerGame.push("mothers_love");
    // Fully heal: set to 0 → heal away ALL current damage.
    events.push(...applyHeal(state, player, p.damage, "mothers_love"));
    events.push(abilityUsed(state, player, "mothers_love"));
    return events;
  },
};

// ─── Bob — Robbery (onAfterAttack) §5 §12.8 ────────────────────────────────────

/**
 * Bob's Robbery is applied INSIDE combat.applyAttack:
 *   - 4–6p: a 2+ would-be hit becomes a steal of 1 equipment (NO damage; §12.8);
 *   - 7–8p: a killing attack takes ALL the victim's equipment (loot "all" rule).
 * This hook is a documented no-op — the effect resolved during the attack itself.
 */
const bobAbility: AbilityDef = {
  characterId: "bob",
  name: "Robbery",
  trigger: "onAfterAttack",
  requiresReveal: false, // passive on-attack effect; combat.ts handles it
  oncePerGame: false,
  run: () => [], // §12.8: steal/loot already applied within applyAttack
};

// ─── Charles — Bloody Feast (onAfterAttack) §5 §12.4 ───────────────────────────

/**
 * §5: after Charles attacks, he MAY deal 2 damage to himself to attack the SAME
 * character again. §12.4: this extra attack IS an attack (routes through applyAttack),
 * so it can trigger Werewolf counters and counts toward Charles's own 3rd-kill win.
 *
 * Cost ordering: the 2 self-damage is paid via applyDamage with a NON-attack source
 * ("bloody_feast_cost") so it is not itself an "attack" and is never blocked by
 * Guardian Angel — it is the price of the ability, not combat. The re-attack then runs.
 */
const charlesAbility: AbilityDef = {
  characterId: "charles",
  name: "Bloody Feast",
  trigger: "onAfterAttack",
  requiresReveal: true, // §5: using the ability requires reveal
  oncePerGame: false,
  run: ({ state, player, params }) => {
    const target = params?.target;
    if (target === undefined) {
      // No target → Charles declines the extra attack.
      return [];
    }
    const p = getPlayer(state, player);
    if (!p.alive) return [];

    const events: GameEvent[] = [];
    // §5: reveal to use the ability.
    events.push(...revealForAbility(state, player));

    // Pay 2 self-damage (NON-attack source → not blocked by Guardian Angel, §12.3).
    events.push(...applyDamage(state, player, 2, "bloody_feast_cost", null));

    // The self-cost can kill Charles (max HP 11 with 9 prior damage, etc.). If so,
    // the extra attack does not happen (a dead player cannot attack).
    if (!p.alive) {
      events.push(abilityUsed(state, player, "bloody_feast"));
      return events;
    }

    // §12.4: the extra attack is a REAL attack (applyAttack), credited to Charles.
    const res = applyAttack(
      state,
      player,
      target,
      params?.dice ? { dice: params.dice } : undefined,
    );
    events.push(...res.events);
    events.push(abilityUsed(state, player, "bloody_feast"));
    return events;
  },
};

// ─── Daniel — Scream (onAnyDeath, forced reveal) §5 §12.5 ──────────────────────

/**
 * §12.5: Daniel is FORCED to reveal when any character dies; he may not reveal at any
 * other time. requiresReveal is false because the reveal is mandatory on a death event,
 * not an opt-in cost the player chooses to pay to use an ability.
 */
const danielAbility: AbilityDef = {
  characterId: "daniel",
  name: "Scream",
  trigger: "onAnyDeath",
  requiresReveal: false, // §5/§12.5: reveal is forced by death, not an ability reveal
  oncePerGame: false,
  run: ({ state, player }) => {
    const p = getPlayer(state, player);
    if (!p.alive) return []; // a dead Daniel already revealed on his own death
    // §12.5: forced reveal (idempotent — emits Revealed at most once).
    return revealForAbility(state, player);
  },
};

// ─── Registry (§5) ──────────────────────────────────────────────────────────────

/** All 10 base-game abilities, keyed by characterId. §5 */
export const ABILITIES: Record<CharacterId, AbilityDef> = {
  emi: emiAbility,
  franklin: franklinAbility,
  george: georgeAbility,
  unknown: unknownAbility,
  vampire: vampireAbility,
  werewolf: werewolfAbility,
  allie: allieAbility,
  bob: bobAbility,
  charles: charlesAbility,
  daniel: danielAbility,
};

/** Look up the ability for a character id, or undefined if none (defensive). */
export function abilityFor(characterId: CharacterId): AbilityDef | undefined {
  return ABILITIES[characterId];
}

// ─── Hook dispatch ──────────────────────────────────────────────────────────────

/**
 * Fire a hook for one player. If that player's ability listens on `point`, run it;
 * otherwise no-op. The reducer (Task 12) calls this at each trigger moment. Returns
 * the events produced (also pushed to state.log inside the ability / combat helpers).
 *
 * §12.3 cohesion: only Werewolf's counter (onAttacked) and Charles's Bloody Feast
 * (onAfterAttack) produce "attacks" here; Franklin/George (onStartTurn) deal NON-attack
 * damage. The hook system itself does not decide attack-ness — the source string does.
 */
export function runHook(point: HookPoint, player: PlayerId, ctx: AbilityCtx): GameEvent[] {
  const p = ctx.state.players.find((pl) => pl.id === player);
  if (!p) throw new Error(`runHook: player "${player}" not found`);
  const ability = ABILITIES[p.characterId];
  if (!ability) return [];
  if (ability.trigger !== point) return [];
  return ability.run({ ...ctx, player });
}

/**
 * Is the player's (once-per-game) ability still available to use? §5
 * - For oncePerGame abilities: true iff the useKey is not yet spent.
 * - For unlimited/passive abilities: always true (they are not "spent").
 */
export function abilityAvailable(state: GameState, player: PlayerId): boolean {
  const p = getPlayer(state, player);
  const ability = ABILITIES[p.characterId];
  if (!ability) return false;
  if (!ability.oncePerGame) return true;
  const key = ability.useKey;
  if (key === undefined) return true;
  return !p.usedOncePerGame.includes(key);
}

// Re-export for callers that compute death thresholds alongside abilities.
export { maxHpOf as abilityMaxHpOf };
