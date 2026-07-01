// Damage, heal, death, reveal & loot — the damage track every other system depends on.
// Source of truth: ruleset.md
//   §5  — max HP per character; death threshold = accumulated damage >= max HP.
//   §6  — Talisman (immune to Bloodthirsty Spider / Vampire Bat / Dynamite),
//         Fortune Brooch (immune to Weird Woods), Silver Rosary (take-all on kill),
//         First Aid (absolute set to 7).
//   §11 — death & reveal: reveal, remove pieces, killer takes 1 equipment
//         (Silver Rosary / Bob 7–8p: take all), rest discarded.
//   §12.2  — simultaneous deaths from one effect; win-check once after.
//   §12.5  — Daniel "first to die" reads deadOrder.
//   §12.12 — First Aid: absolute set to 7, then death check.
//   §12.16 — discarded equipment goes to its colour's discard pile.
//   §12.18 — HP values centralised in data/characters.ts.

import { CHARACTERS } from "./data/characters.js";
import type {
  GameState,
  GameEvent,
  PlayerId,
  PlayerState,
  DeckKind,
  CardId,
} from "./types.js";

// ─── Win-check hook (wired in Task 11) ───────────────────────────────────────
// Death/reveal must re-evaluate win conditions (§12.1 cadence). win.ts does not
// exist yet, so we expose a swappable hook the reducer/win module installs. The
// default is a no-op, keeping damage.ts free of a hard dependency on win.ts.
// §12.1: re-evaluate ALL win conditions immediately after every damage/death/reveal.

type WinCheckHook = (state: GameState) => GameEvent[];

let winCheckHook: WinCheckHook = () => [];

/** Install the win-check hook (Task 11 / reduce.ts wires this). */
export function setWinCheckHook(hook: WinCheckHook): void {
  winCheckHook = hook;
}

/** Reset the win-check hook to the no-op default (test isolation). */
export function resetWinCheckHook(): void {
  winCheckHook = () => [];
  winCheckBatchDepth = 0;
  batchEpoch = null;
}

// ─── Simultaneous-death batching (§12.2) ─────────────────────────────────────
// §12.2: deaths from a SINGLE effect (Flare, Dynamite, Machine Gun) resolve
// SIMULTANEOUSLY; then win conditions are checked ONCE; ALL satisfied win.
//
// The per-mutation cadence (§12.1) would otherwise end the game after the FIRST
// death and never apply the remaining (simultaneous) deaths — leaving a victim
// wrongly alive (and possibly a winner). To make a one-effect multi-death actually
// simultaneous, an AoE handler opens a batch: while a batch is open, runWinCheck is
// suppressed (deaths still resolve fully — deadOrder/lastKill/loot/Died all run — the
// game is simply not ENDED yet). When the batch closes, the win-check runs once over
// the settled state, so every satisfied condition (including a co-victim's loss /
// faction win / Daniel co-first) is evaluated together. Batches nest by depth so a
// handler that itself calls into another batched primitive is safe.
let winCheckBatchDepth = 0;

// Death-epoch bookkeeping (§12.2 / §12.5 co-first). Every death records an epoch into
// state.deadEpoch (aligned with deadOrder). Deaths inside ONE batch share the epoch
// captured when the (outermost) batch opened, so they are simultaneous; a sequential
// death (no open batch) takes a fresh epoch. win.ts reads this to credit Daniel
// "first to die" co-first when he dies in the same effect as the game's first death(s).
//
// The monotonic counter lives ON the state (state.nextDeathEpoch, init 0 in createGame),
// NOT in a module var — so two identical (seed, actions) games run back-to-back in the
// same process stamp identical epochs (determinism). batchEpoch stays module-local: a
// batch only spans ONE synchronous withWinCheckBatch call, never across reduce()s.
// The epoch the currently-open batch assigns to its deaths (null when no batch open).
let batchEpoch: number | null = null;

/** The epoch to stamp on the next death (§12.2). Batched deaths share one epoch. */
function takeDeathEpoch(state: GameState): number {
  if (batchEpoch !== null) return batchEpoch;
  return state.nextDeathEpoch++;
}

/**
 * Run `body` with the win-check deferred to a single check at the end (§12.2).
 * Use this to wrap the target loop of a one-effect multi-death (AoE) so all deaths
 * resolve before the game can end. Every death inside the batch shares ONE death epoch
 * (so §12.5 co-first works). Returns the body's events plus the events from the single
 * trailing win-check. Re-entrant: nested batches share the outermost batch's epoch and
 * only the OUTERMOST batch fires the win-check when it closes.
 */
export function withWinCheckBatch(
  state: GameState,
  body: () => GameEvent[],
): GameEvent[] {
  const opensBatch = winCheckBatchDepth === 0;
  if (opensBatch) batchEpoch = state.nextDeathEpoch++;
  winCheckBatchDepth += 1;
  let events: GameEvent[];
  try {
    events = body();
  } finally {
    winCheckBatchDepth -= 1;
    if (opensBatch) batchEpoch = null;
  }
  // Only the outermost batch runs the single trailing win-check (§12.2).
  if (opensBatch) {
    events = [...events, ...runWinCheck(state)];
  }
  return events;
}

function runWinCheck(state: GameState): GameEvent[] {
  if (state.over) return [];
  // §12.2: inside a simultaneous-death batch, defer the check to the batch close so
  // all deaths from the one effect resolve before the game can end.
  if (winCheckBatchDepth > 0) return [];
  return winCheckHook(state);
}

// ─── Lookups ──────────────────────────────────────────────────────────────────

function maxHpOf(characterId: string): number {
  const def = CHARACTERS.find((c) => c.id === characterId);
  if (!def) throw new Error(`Unknown characterId "${characterId}"`);
  return def.maxHp;
}

function getPlayer(state: GameState, id: PlayerId): PlayerState {
  const p = state.players.find((pl) => pl.id === id);
  if (!p) throw new Error(`Player "${id}" not found`);
  return p;
}

/** A card instance id is "<deck>:<effectKey>#<copy>"; returns the deck colour. */
function colorOf(cardId: CardId): DeckKind {
  const prefix = cardId.split(":", 1)[0];
  if (prefix === "white" || prefix === "black" || prefix === "hermit") return prefix;
  // Equipment only ever comes from white/black; default to white if malformed.
  throw new Error(`Cannot determine deck colour of card "${cardId}"`);
}

/** Does the player have an equipment whose effectKey matches? (id form: "<deck>:<effectKey>#<n>") */
function hasEquipment(player: PlayerState, effectKey: string): boolean {
  return player.equipment.some((id) => id.includes(effectKey));
}

// ─── Immunity guards keyed on source (§6) ─────────────────────────────────────

// Talisman: immune to these Black-card sources (§6).
const TALISMAN_BLOCKS = new Set(["bloodthirsty_spider", "vampire_bat", "dynamite"]);
// Fortune Brooch: immune to Weird Woods damage (§6 / §7).
const FORTUNE_BROOCH_BLOCKS = new Set(["weird_woods"]);

/**
 * Is the target immune to damage from this source? §6
 * - Talisman blocks Bloodthirsty Spider / Vampire Bat / Dynamite.
 * - Fortune Brooch blocks Weird Woods.
 * Immunity is keyed strictly on the `source` string — no domain-based trust;
 * an unknown source is never blocked.
 */
function isImmune(player: PlayerState, source: string): boolean {
  if (hasEquipment(player, "talisman") && TALISMAN_BLOCKS.has(source)) return true;
  if (hasEquipment(player, "fortune_brooch") && FORTUNE_BROOCH_BLOCKS.has(source)) return true;
  return false;
}

// ─── reveal (§11) ─────────────────────────────────────────────────────────────

/**
 * Reveal a player's identity. Idempotent — emits Revealed exactly once. §11
 * Runs the win-check hook after revealing (§12.1).
 */
export function reveal(state: GameState, id: PlayerId): GameEvent[] {
  const player = getPlayer(state, id);
  if (player.revealed) return [];

  player.revealed = true;
  const events: GameEvent[] = [
    { type: "Revealed", player: id, characterId: player.characterId },
  ];
  state.log.push(...events);

  const winEvents = runWinCheck(state);
  events.push(...winEvents);
  return events;
}

// ─── Loot rule (§11, §5 Bob, §6 Silver Rosary) ───────────────────────────────

/**
 * How much equipment the killer takes on a kill. §11
 *   - "none" — no killer (card/AoE death): all victim equipment is discarded.
 *   - "all"  — killer has Silver Rosary equipped (§6), OR killer is Bob in a
 *              7–8 player game (§5 Robbery 7–8p clause).
 *   - "one"  — default: killer takes 1 of their choice, the rest discarded.
 */
export function lootRule(state: GameState, killer: PlayerId | null): "none" | "one" | "all" {
  if (killer === null) return "none";
  const k = state.players.find((p) => p.id === killer);
  if (!k) return "none";

  // §6 Silver Rosary: on a kill by your attack, take ALL the victim's equipment.
  if (hasEquipment(k, "silver_rosary")) return "all";

  // §5 Bob Robbery (7–8p): if your attack kills, take ALL the victim's equipment.
  if (k.characterId === "bob" && state.players.length >= 7) return "all";

  return "one";
}

// ─── Loot application (§11, §12.14, §12.16) ──────────────────────────────────

/**
 * Move the victim's equipment to the killer / discard, per lootRule. §11 §12.16
 * The killer's loot uses the FIRST equipment as the default "1 of choice" pick;
 * a concrete choice can be threaded later via the action. The remainder discards
 * to each card's colour discard pile (§12.16). Emits EquipmentTaken per looted card.
 */
function applyLoot(
  state: GameState,
  victim: PlayerState,
  killer: PlayerId | null,
): GameEvent[] {
  const events: GameEvent[] = [];
  const loot = victim.equipment;
  if (loot.length === 0) {
    return events; // nothing to transfer or discard
  }

  const rule = lootRule(state, killer);

  // Decide which cards the killer takes vs. which are discarded.
  let taken: CardId[] = [];
  let discarded: CardId[] = [];

  if (rule === "all" && killer !== null) {
    taken = [...loot];
    discarded = [];
  } else if (rule === "one" && killer !== null) {
    // Killer takes 1 (default: the first); the rest are discarded.
    taken = loot.slice(0, 1);
    discarded = loot.slice(1);
  } else {
    // "none" (no killer): discard everything.
    taken = [];
    discarded = [...loot];
  }

  // Victim loses all equipment.
  victim.equipment = [];

  // Killer gains the taken cards (§12.14: only affect subsequent attacks).
  if (killer !== null && taken.length > 0) {
    const k = getPlayer(state, killer);
    for (const card of taken) {
      k.equipment.push(card);
      const evt: GameEvent = {
        type: "EquipmentTaken",
        player: killer,
        from: victim.id,
        card,
      };
      events.push(evt);
      state.log.push(evt);
    }
  }

  // Remainder discarded to its colour's discard pile (§12.16).
  for (const card of discarded) {
    state.decks[colorOf(card)].discard.push(card);
  }

  return events;
}

// ─── Death (§11) ──────────────────────────────────────────────────────────────

/**
 * Kill a player: set alive=false, force reveal, record deadOrder + lastKill,
 * emit Died (+ Revealed if not already), apply loot, and run the win-check. §11
 * Internal — callers reach death via applyDamage / setDamage / checkDeath.
 */
function die(state: GameState, victim: PlayerState, killer: PlayerId | null): GameEvent[] {
  const events: GameEvent[] = [];

  victim.alive = false;
  state.deadOrder.push(victim.id);
  // §12.2/§12.5: stamp the death epoch — batched (one-effect) deaths share an epoch and
  // are thus simultaneous; sequential deaths each get a fresh one.
  state.deadEpoch.push(takeDeathEpoch(state));
  state.lastKill = { killer, deadCountAfter: state.deadOrder.length };

  // Forced reveal on death (§11). Revealed exactly once.
  if (!victim.revealed) {
    victim.revealed = true;
    const revealedEvt: GameEvent = {
      type: "Revealed",
      player: victim.id,
      characterId: victim.characterId,
    };
    events.push(revealedEvt);
    state.log.push(revealedEvt);
  }

  const diedEvt: GameEvent = { type: "Died", player: victim.id, killer };
  events.push(diedEvt);
  state.log.push(diedEvt);

  // Loot transfer happens after death (§11 / §12.14).
  events.push(...applyLoot(state, victim, killer));

  // §12.1: re-evaluate win conditions after the death.
  events.push(...runWinCheck(state));

  return events;
}

/**
 * Run the death check for a player. §11
 * Kills (once) iff alive and accumulated damage >= max HP. No-op otherwise.
 */
export function checkDeath(
  state: GameState,
  id: PlayerId,
  killer: PlayerId | null,
): GameEvent[] {
  const player = getPlayer(state, id);
  if (!player.alive) return [];
  if (player.damage < maxHpOf(player.characterId)) return [];
  return die(state, player, killer);
}

// ─── applyDamage (§11) ──────────────────────────────────────────────────────

/**
 * Apply `amount` damage to a target from a named `source`, optionally crediting
 * a `killer` for loot/attribution. §11
 *
 * - Dead targets are a no-op (death is final).
 * - Immunity guards (Talisman / Fortune Brooch) keyed on `source` block the
 *   damage entirely (§6) — no Damaged event, no death.
 * - Amount is clamped so damage never exceeds max HP and a 0/negative amount
 *   applies nothing (a miss).
 * - Emits Damaged (when amount > 0), then runs the death check.
 */
export function applyDamage(
  state: GameState,
  id: PlayerId,
  amount: number,
  source: string,
  killer: PlayerId | null = null,
): GameEvent[] {
  const player = getPlayer(state, id);
  if (!player.alive) return []; // §11: death is final
  if (amount <= 0) return []; // a miss applies nothing (§10 tie = miss)

  // §6 immunity: Talisman / Fortune Brooch block by source.
  if (isImmune(player, source)) return [];

  // §12.9 Guardian Angel: blocks attack-source damage only (§6: "from attacks").
  // Does NOT block Weird Woods, card damage, Franklin/George abilities. (§12.3, §12.9)
  if (player.attackImmune && source === "attack") return [];

  const maxHp = maxHpOf(player.characterId);
  const before = player.damage;
  player.damage = Math.min(maxHp, before + amount);
  const applied = player.damage - before; // actual damage after clamp

  const events: GameEvent[] = [];
  if (applied > 0) {
    const evt: GameEvent = { type: "Damaged", player: id, amount: applied, source };
    events.push(evt);
    state.log.push(evt);
  }

  // Death check (§11) — credits the killer for loot.
  events.push(...checkDeath(state, id, killer));

  // §12.1: win-check after damage (death already ran its own check inside die()).
  if (player.alive) events.push(...runWinCheck(state));

  return events;
}

// ─── applyHeal (§11) ──────────────────────────────────────────────────────────

/**
 * Heal `amount` of a player's damage, clamping at 0 (never negative). §11
 * Dead players cannot be healed. Emits Healed when healing > 0.
 */
export function applyHeal(
  state: GameState,
  id: PlayerId,
  amount: number,
  source: string,
): GameEvent[] {
  const player = getPlayer(state, id);
  if (!player.alive) return [];
  if (amount <= 0) return [];

  const before = player.damage;
  player.damage = Math.max(0, before - amount);
  const healed = before - player.damage;

  const events: GameEvent[] = [];
  if (healed > 0) {
    const evt: GameEvent = { type: "Healed", player: id, amount: healed, source };
    events.push(evt);
    state.log.push(evt);
  }
  return events;
}

// ─── setDamage — absolute set (First Aid → 7, §12.12) ────────────────────────

/**
 * Set a player's damage to an absolute value, then run the death check. §12.12
 * Used by First Aid (set to 7). Clamps the stored value into [0, maxHp]; a value
 * >= maxHp triggers death (kills any character with max HP <= the set value).
 * Dead players are a no-op.
 */
export function setDamage(
  state: GameState,
  id: PlayerId,
  value: number,
  source: string,
): GameEvent[] {
  const player = getPlayer(state, id);
  if (!player.alive) return [];

  const maxHp = maxHpOf(player.characterId);
  player.damage = Math.max(0, Math.min(maxHp, value));

  const events: GameEvent[] = [];
  // First Aid is not damage-on-hit; record it as a Damaged event with the source
  // only if it raised the track. We keep it minimal: the absolute set itself does
  // not emit Damaged/Healed (it is a "set"), but the death check still runs (§12.12).
  void source;

  // §12.12: run the death check after the absolute set (no killer for a card set).
  events.push(...checkDeath(state, id, null));

  // §12.1: win-check after the set if still alive.
  if (player.alive) events.push(...runWinCheck(state));

  return events;
}
