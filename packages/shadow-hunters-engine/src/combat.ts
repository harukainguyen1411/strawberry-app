// Combat module for the Shadow Hunters engine.
// Source of truth: ruleset.md
//   §10 — Range: one player on your current area OR its paired area.
//         Damage = |d6 − d4| (0–5); tie = miss (0). Multi-target rolls ONCE,
//         applies to all. Equipment modifiers stack.
//   §11 — death/loot is delegated to damage.ts; a multi-kill loots one per victim.
//   §6  — Chainsaw / Butcher Knife / Rusted Broad Axe: successful attacks +1 each (stack).
//         Holy Robe: your attacks −1; incoming attack damage −1 (both directions stack).
//         Spear of Longinus: Hunter only, on a damaging attack may reveal for +2.
//         Handgun: range = every area except your own pair.
//         Machine Gun: roll once, apply to all valid targets in range.
//         Cursed Sword Masamune: roll only the d4 as damage (never misses); +mods apply.
//   §12.3 — only combat attacks (and Werewolf counter, Charles Bloody Feast) are "attacks".
//   §12.6 — Werewolf Counterattack: a separate normal attack; can miss; reveals if hidden;
//           does NOT itself provoke a counter; the orchestrator (reduce.ts) queues it.
//   §12.7 — Vampire Suck Blood: heal 2 ONCE per attack action when any damage was dealt.
//   §12.8 — Bob Robbery (4–6p): a 2+ would-be hit becomes a steal of 1 equipment (NO damage),
//           so it triggers no damage-on-hit effects.
//   §12.14 — equipment is active at declaration; kill-based transfers affect only later attacks.

import { rollD6, rollD4 } from "./rng.js";
import { applyDamage, applyHeal, withWinCheckBatch } from "./damage.js";
import { CHARACTERS } from "./data/characters.js";
import type { GameState, GameEvent, PlayerId, PlayerState, AreaId } from "./types.js";

/** Source string used for all combat damage (lets the damage layer key attack-only guards). §12.3 */
export const ATTACK_SOURCE = "attack";

/** Dice pair for the |d6−d4| roll. Tests inject these; production rolls from state.rng. */
export interface CombatDice {
  d6: number;
  d4: number;
}

/** What computeDamage returns for one (attacker, defender) pair under a given roll. */
export interface AttackComputation {
  base: number; // |d6−d4|, or the raw d4 for Masamune
  final: number; // after equipment modifiers, clamped to >= 0
  hit: boolean; // true when the attack deals (or would deal, pre-Robbery) damage
}

/** Result of resolving a full attack action. */
export interface AttackResult {
  state: GameState;
  events: GameEvent[];
  /** rolled-and-modified damage dealt per target (0 on a miss or a Bob steal) */
  damage: number;
  /** true when at least one target was actually damaged */
  hit: boolean;
  /** true when Bob's 4–6p Robbery converted the hit into a steal (no damage) §12.8 */
  stole?: boolean;
}

// ─── Equipment lookups (id form: "<deck>:<effectKey>#<n>") ───────────────────────

function hasEquipment(player: PlayerState, effectKey: string): boolean {
  return player.equipment.some((id) => id.includes(effectKey));
}

/** Count of stacking +1 blades equipped (Chainsaw, Butcher Knife, Rusted Broad Axe). §6 §10 */
function bladeBonus(player: PlayerState): number {
  let n = 0;
  if (hasEquipment(player, "chainsaw")) n += 1;
  if (hasEquipment(player, "butcher_knife")) n += 1;
  if (hasEquipment(player, "rusted_broad_axe")) n += 1;
  return n;
}

function factionOf(characterId: string): string {
  const def = CHARACTERS.find((c) => c.id === characterId);
  if (!def) throw new Error(`Unknown characterId "${characterId}"`);
  return def.faction;
}

function getPlayer(state: GameState, id: PlayerId): PlayerState {
  const p = state.players.find((pl) => pl.id === id);
  if (!p) throw new Error(`Player "${id}" not found`);
  return p;
}

// ─── Range (§10, Handgun §6) ─────────────────────────────────────────────────────

/**
 * The set of areas an attacker can reach. §10
 * - Default: the attacker's current area and its paired area.
 * - Handgun (§6): every area EXCEPT the attacker's own pair.
 * Returns [] if the attacker has no area yet.
 */
function attackableAreas(state: GameState, attacker: PlayerState): AreaId[] {
  if (attacker.area === null) return [];
  const here = attacker.area;
  const paired = state.pairing[here];

  if (hasEquipment(attacker, "handgun")) {
    // Every area except the attacker's own pair (here + paired). §6
    return state.areas.filter((a) => a !== here && a !== paired);
  }

  // Default: current area + its pair. §10
  const out: AreaId[] = [here];
  if (paired && paired !== here) out.push(paired);
  return out;
}

/**
 * All players the attacker may legally attack right now. §10
 * Excludes self, dead players, and unplaced (null-area) players.
 */
export function attackTargetsInRange(state: GameState, attackerId: PlayerId): PlayerId[] {
  const attacker = getPlayer(state, attackerId);
  const areas = new Set(attackableAreas(state, attacker));
  return state.players
    .filter(
      (p) =>
        p.id !== attackerId &&
        p.alive &&
        p.area !== null &&
        areas.has(p.area),
    )
    .map((p) => p.id);
}

// ─── Damage computation (§10, §6) ────────────────────────────────────────────────

/**
 * Compute the damage a single attack would deal to one defender, given the dice. §10
 *
 * - Base = Masamune ? d4 : |d6 − d4|.
 * - A tie (d6 === d4) is a MISS (base 0) — UNLESS Masamune, which never misses (§6).
 * - On a hit, equipment modifiers stack and are applied to the base, then clamped to >= 0:
 *     + bladeBonus(attacker)                         (Chainsaw/Butcher/Axe, §6)
 *     + 2 if attacker is a revealed Hunter with Spear (§6; only on a damaging attack)
 *     − 1 if attacker has Holy Robe                  (your attacks −1, §6)
 *     − 1 if defender has Holy Robe                  (incoming attack damage −1, §6)
 * - A miss applies no modifiers (a +1 blade never turns a miss into a hit, §6).
 *
 * Pure: does not mutate state or roll dice; the caller supplies the dice.
 */
export function computeDamage(
  state: GameState,
  attackerId: PlayerId,
  defenderId: PlayerId,
  dice: CombatDice,
): AttackComputation {
  const attacker = getPlayer(state, attackerId);
  const defender = getPlayer(state, defenderId);

  const masamune = hasEquipment(attacker, "cursed_sword_masamune");

  // Base damage. Masamune: only the d4, never misses (§6). Else |d6−d4|, tie = miss (§10).
  let base: number;
  let hit: boolean;
  if (masamune) {
    base = dice.d4;
    hit = true; // never misses
  } else {
    base = Math.abs(dice.d6 - dice.d4);
    hit = base > 0; // tie → 0 → miss
  }

  if (!hit) {
    return { base, final: 0, hit: false };
  }

  // Equipment modifiers stack on a hit (§6 §10).
  let final = base;
  final += bladeBonus(attacker);

  // Spear of Longinus: Hunter only, on a damaging attack, may reveal for +2 (§6).
  // We model "may reveal for +2" as: the bonus applies when the attacker is a
  // revealed Hunter holding the Spear (reveal is the precondition the player opts into).
  if (
    hasEquipment(attacker, "spear_of_longinus") &&
    factionOf(attacker.characterId) === "Hunter" &&
    attacker.revealed
  ) {
    final += 2;
  }

  // Holy Robe: attacker's outgoing −1, defender's incoming −1 (both stack, §6).
  if (hasEquipment(attacker, "holy_robe")) final -= 1;
  if (hasEquipment(defender, "holy_robe")) final -= 1;

  if (final < 0) final = 0;

  return { base, final, hit: final > 0 };
}

// ─── Roll helper ─────────────────────────────────────────────────────────────────

function rollCombatDice(state: GameState, opts?: { dice?: CombatDice }): CombatDice {
  if (opts?.dice) return opts.dice;
  const d6 = rollD6(state.rng);
  const d4 = rollD4(state.rng);
  return { d6, d4 };
}

// ─── Bob Robbery (§12.8, §5) ─────────────────────────────────────────────────────

/**
 * 4–6 player Robbery: if Bob would deal 2+ attack damage, he instead takes 1 Equipment
 * of his choice from the target (no damage). §5 §12.8
 *
 * [RULING] If the target has no equipment to steal, there is nothing to take, so the
 * attack proceeds as normal damage. (The 7–8p kill-steal clause is a normal damaging
 * attack handled by the loot path in damage.ts, not here.)
 */
function bobRobberyApplies(
  state: GameState,
  attacker: PlayerState,
  target: PlayerState,
  wouldBeDamage: number,
): boolean {
  return (
    attacker.characterId === "bob" &&
    state.players.length >= 4 &&
    state.players.length <= 6 &&
    wouldBeDamage >= 2 &&
    target.equipment.length > 0
  );
}

/** Steal one equipment (the first, as a deterministic default) from target to Bob. §12.8 */
function applyBobSteal(
  state: GameState,
  attacker: PlayerState,
  target: PlayerState,
): GameEvent[] {
  const card = target.equipment[0]!;
  target.equipment = target.equipment.slice(1);
  attacker.equipment.push(card);
  const evt: GameEvent = {
    type: "EquipmentTaken",
    player: attacker.id,
    from: target.id,
    card,
  };
  state.log.push(evt);
  return [evt];
}

// ─── Attack orchestration (§10, §11, §12.7, §12.8) ───────────────────────────────

/**
 * Resolve an attack action by `attackerId`. §10
 *
 * Targets:
 *   - Machine Gun (§6): roll ONCE and apply to ALL valid targets in range (`target` ignored).
 *   - Otherwise: a single `target`, which must be supplied and in range.
 *
 * For each target:
 *   - Bob 4–6p Robbery (§12.8): a 2+ would-be hit becomes a steal (no damage).
 *   - Else apply the computed damage via damage.ts (source "attack", crediting the killer).
 *
 * After all targets resolve, Vampire heals 2 ONCE if any damage was dealt (§12.7).
 *
 * Werewolf Counterattack queuing (§12.3/§12.6): EVERY real attack path runs through
 * here (combat-step attacks, Charles's Bloody Feast, Machine-Gun volleys), so this is
 * where pending counters are recorded — one PER-ATTACK occurrence for each alive
 * Werewolf among the targets (NOT deduped by attacker, so a Werewolf hit twice may
 * counter each), fired on hit OR miss. `queueCounters` defaults to true; the Werewolf's
 * OWN counter passes false (a counter does NOT itself provoke a counter, §12.6).
 *
 * Throws if the chosen target is out of range / missing (server relies on this).
 */
export function applyAttack(
  state: GameState,
  attackerId: PlayerId,
  target?: PlayerId,
  opts?: { dice?: CombatDice; queueCounters?: boolean },
): AttackResult {
  const attacker = getPlayer(state, attackerId);
  const inRange = attackTargetsInRange(state, attackerId);

  // Determine the target list.
  const machineGun = hasEquipment(attacker, "machine_gun");
  let targets: PlayerId[];
  if (machineGun) {
    targets = inRange; // §6: apply to all valid targets in range
  } else {
    if (target === undefined) {
      throw new Error(`applyAttack requires a target unless the attacker has Machine Gun`);
    }
    if (!inRange.includes(target)) {
      throw new Error(`Target "${target}" is out of range for attacker "${attackerId}" §10`);
    }
    targets = [target];
  }

  // Roll ONCE (§10 / §12.2): the same dice apply to every target.
  const dice = rollCombatDice(state, opts);

  const events: GameEvent[] = [];
  let dealtAny = false;
  let lastDamage = 0;
  let stoleAny = false;

  // §12.6: every alive Werewolf that this attack actually targets earns a pending
  // counter, recorded PER-ATTACK occurrence (not deduped by attacker) so a Werewolf
  // hit twice may counter each, and fired on hit OR miss. We collect the Werewolf
  // targets that were alive when resolved here, then queue after the attack settles
  // (a Werewolf killed by the attack is dead and cannot counter).
  const werewolfTargets: PlayerId[] = [];

  // Resolve every target with the one rolled dice. The per-target body is shared so a
  // single-target attack and a Machine Gun multi-target volley use identical mechanics.
  const resolveTargets = (): GameEvent[] => {
    const loop: GameEvent[] = [];
    for (const tId of targets) {
      const targetPlayer = getPlayer(state, tId);
      if (!targetPlayer.alive) continue; // a simultaneous-kill target already removed

      // Record the (alive-at-resolution) Werewolf occurrence so a counter can be queued.
      if (targetPlayer.characterId === "werewolf") werewolfTargets.push(tId);

      const comp = computeDamage(state, attackerId, tId, dice);
      lastDamage = comp.final;

      // Bob Robbery (§12.8): steal instead of dealing 2+ damage; no damage-on-hit effects.
      if (bobRobberyApplies(state, attacker, targetPlayer, comp.final)) {
        loop.push(...applyBobSteal(state, attacker, targetPlayer));
        stoleAny = true;
        lastDamage = 0; // a steal deals no damage
        continue;
      }

      if (comp.final > 0) {
        // §11 / §12.14: damage applied via the damage track, crediting the attacker for loot.
        loop.push(...applyDamage(state, tId, comp.final, ATTACK_SOURCE, attackerId));
        dealtAny = true;
      }
    }
    return loop;
  };

  // §12.2: a Machine Gun volley is ONE effect — all targets are damaged SIMULTANEOUSLY
  // with the single roll, so its multi-target loop runs inside a win-check batch (deaths
  // resolve fully, the game ends only AFTER every target is hit, win-check runs once and
  // ALL satisfied conditions win together). A single-target attack does NOT batch, so its
  // per-hit §12.1 win-check cadence is unchanged.
  if (machineGun) {
    events.push(...withWinCheckBatch(state, resolveTargets));
  } else {
    events.push(...resolveTargets());
  }

  // §12.3/§12.6: queue one pending-counter occurrence per alive Werewolf target so
  // EVERY real attack path (combat step, Charles Bloody Feast, Machine-Gun volley)
  // provokes counters uniformly. Skipped for the Werewolf's own counter (a counter
  // does NOT itself provoke a counter): callers pass queueCounters:false. A Werewolf
  // killed by this attack is no longer alive and is excluded. Game-over short-circuits
  // (no counters after the game ends). Occurrences are appended, never deduped.
  const queueCounters = opts?.queueCounters !== false;
  if (queueCounters && !state.over) {
    for (const wId of werewolfTargets) {
      const w = getPlayer(state, wId);
      if (!w.alive) continue;
      state.pendingCounters ??= {};
      const list = state.pendingCounters[wId] ?? [];
      list.push(attackerId);
      state.pendingCounters[wId] = list;
    }
  }

  // Vampire Suck Blood §12.7: heal 2 ONCE per attack action when any damage was dealt.
  if (dealtAny && attacker.characterId === "vampire" && attacker.alive) {
    events.push(...applyHeal(state, attackerId, 2, "suck_blood"));
  }

  return {
    state,
    events,
    damage: stoleAny && !dealtAny ? 0 : lastDamage,
    hit: dealtAny,
    ...(stoleAny ? { stole: true } : {}),
  };
}

// ─── Werewolf Counterattack (§12.6) ──────────────────────────────────────────────

/**
 * Werewolf's Counterattack — a separate normal attack back at the original attacker. §12.6
 *
 * - It is a normal attack: rolls, can miss, the Werewolf's equipment modifiers apply.
 * - It reveals the Werewolf if hidden (reveal is the precondition for using the ability).
 * - It does NOT itself provoke a counter (this module never auto-counters; reduce.ts
 *   queues counters as explicit actions, so there is no recursion to guard against).
 *
 * The `target` must be in the Werewolf's range (normally the original attacker). Throws
 * otherwise, so an illegal counter is rejected.
 */
export function applyCounterattack(
  state: GameState,
  werewolfId: PlayerId,
  target: PlayerId,
  opts?: { dice?: CombatDice },
): AttackResult {
  const werewolf = getPlayer(state, werewolfId);

  const events: GameEvent[] = [];

  // §12.6: reveal the Werewolf to counter (idempotent — only emits once if hidden).
  if (!werewolf.revealed) {
    werewolf.revealed = true;
    const evt: GameEvent = {
      type: "Revealed",
      player: werewolfId,
      characterId: werewolf.characterId,
    };
    events.push(evt);
    state.log.push(evt);
  }

  // The counter is a normal attack (range/dice/modifiers all apply) but does NOT itself
  // provoke a counter (§12.6) — so queueCounters:false even if the target is a Werewolf.
  const res = applyAttack(state, werewolfId, target, { ...opts, queueCounters: false });
  events.push(...res.events);

  return { ...res, events };
}
