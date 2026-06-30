// reduce + legalActions — the turn state machine that orchestrates every other module.
// Source of truth: ruleset.md
//   §7    — area effects (the 6 ResolveArea branches).
//   §8    — turn structure: Move (mandatory) → Area action (optional) → Attack (optional).
//           Franklin/George trigger at the START of the turn (§12.22, before the move).
//           Reveal may happen any time (except Daniel, §5/§12.5; Unknown CAN reveal).
//   §9    — movement (wild / Emi / Compass), delegated to movement.ts.
//   §10   — combat range / resolution, delegated to combat.ts.
//   §11   — death/loot, delegated to damage.ts.
//   §12.1 — win-check cadence: re-evaluate after every action (maybeEndGame is installed
//           as damage.ts's win-check hook AND run once more at the end of every reduce).
//   §12.6 — Werewolf Counterattack: an explicit legal action when attacked.
//   §12.10 — Concealed Knowledge: pendingExtraTurns grants the SAME player another full
//            turn before play passes on.
//   §12.17 — turn-order compression: dead players are skipped when advancing `current`.
//
// reduce(state, action) → { state, events } is PURE: it deep-clones the input (rng is
// {s} copied by value) and never mutates the argument. legalActions(state, playerId)
// returns EXACTLY the actions allowed right now; reduce THROWS on anything not legal
// (the server relies on this).

import { applyRollMove, applyMoveTo, emiTeleportTargets } from "./movement.js";
import { applyAttack, applyCounterattack, attackTargetsInRange } from "./combat.js";
import {
  applyDamage,
  applyHeal,
  reveal,
  setWinCheckHook,
} from "./damage.js";
import { playCard as playWhite } from "./cards/white.js";
import { playCard as playBlack } from "./cards/black.js";
import { giveHermit } from "./cards/hermit.js";
import { shuffle } from "./rng.js";
import { ABILITIES, abilityFor, abilityAvailable, runHook } from "./abilities.js";
import { maybeEndGame } from "./win.js";
import { CHARACTERS } from "./data/characters.js";
import { AREA_BY_DICE } from "./data/areas.js";
import type {
  GameState,
  GameEvent,
  Action,
  AreaChoice,
  PlayerId,
  PlayerState,
  DeckKind,
  AreaId,
} from "./types.js";

// Install win-condition evaluation as damage.ts's win-check hook ONCE at module load
// (§12.1). Every applyDamage / death / reveal then re-evaluates winners on the SAME
// state object it is handed — which, inside reduce, is always the working clone.
setWinCheckHook(maybeEndGame);

// ─── Pure clone (rng is {s} copied by value) ─────────────────────────────────────

/**
 * Deep-clone a GameState so reduce never mutates its input. structuredClone copies the
 * rng object by value (rng is `{ s: number }`), so advancing the clone's rng does not
 * touch the caller's state. Falls back to a JSON round-trip if structuredClone is
 * unavailable (all current state is JSON-serialisable — no functions/Dates/Maps).
 */
function cloneState(state: GameState): GameState {
  const sc = (globalThis as { structuredClone?: <T>(v: T) => T }).structuredClone;
  if (typeof sc === "function") return sc(state);
  return JSON.parse(JSON.stringify(state)) as GameState;
}

// ─── Lookups ─────────────────────────────────────────────────────────────────────

function getPlayer(state: GameState, id: PlayerId): PlayerState {
  const p = state.players.find((pl) => pl.id === id);
  if (!p) throw new Error(`reduce: player "${id}" not found`);
  return p;
}

function factionOf(characterId: string): string {
  const def = CHARACTERS.find((c) => c.id === characterId);
  if (!def) throw new Error(`reduce: unknown character "${characterId}"`);
  return def.faction;
}

/** The deck colour of an instanced card id "<deck>:<effectKey>#<n>". */
function deckOf(cardId: string): DeckKind {
  const prefix = cardId.split(":", 1)[0];
  if (prefix === "white" || prefix === "black" || prefix === "hermit") return prefix;
  throw new Error(`reduce: cannot determine deck of card "${cardId}"`);
}

// ─── Reveal eligibility (§5 / §12.5) ─────────────────────────────────────────────

/**
 * May this player choose to Reveal right now? §5
 * Reveal is voluntary at ANY time — EXCEPT Daniel (reveal is forced on a death, never
 * voluntary, §12.5) and a player who is already revealed. Unknown CAN voluntarily
 * reveal (its Deceit ability is the only thing that is reveal-exempt, not the player).
 */
function canVoluntarilyReveal(player: PlayerState): boolean {
  if (player.revealed) return false;
  if (!player.alive) return false;
  if (player.characterId === "daniel") return false; // §12.5
  return true;
}

// ─── Deck draw (§6, §12.15 reshuffle) ────────────────────────────────────────────

/**
 * Draw the top card of a deck, reshuffling the discard into the draw pile if empty
 * (§12.15). Returns the card id, or null if both piles are empty. Mutates the deck.
 * Reshuffle uses Fisher-Yates (via rng.shuffle) so deck order is re-randomised as
 * the rulebook requires ("reshuffle that deck's discard into a fresh draw pile").
 */
function drawCard(state: GameState, deck: DeckKind): string | null {
  const d = state.decks[deck];
  if (d.draw.length === 0) {
    if (d.discard.length === 0) return null; // §6: both empty — nothing to draw
    // §12.15: reshuffle the discard into a fresh draw pile (randomised, not in-order).
    d.draw = shuffle(d.discard, state.rng);
    d.discard = [];
  }
  return d.draw.shift() ?? null;
}

// ─── Card resolution from an area draw (§7) ──────────────────────────────────────

/**
 * Resolve a freshly-drawn card for the current player. White/Black cards are played
 * by the acting player; Hermit cards are handed to a chosen recipient (§7).
 * Emits a CardDrawn event then the card's own effect events.
 */
function resolveDrawnCard(
  state: GameState,
  actor: PlayerId,
  deck: DeckKind,
  card: string,
  choice: AreaChoice | undefined,
): GameEvent[] {
  const events: GameEvent[] = [];
  const drawnEvt: GameEvent = { type: "CardDrawn", player: actor, deck, card };
  state.log.push(drawnEvt);
  events.push(drawnEvt);

  // A sensible default target for cards that require one (First Aid, Blessing,
  // Vampire Bat, Bloodthirsty Spider, Spiritual Doll, Moody Goblin, Banana Peel): the
  // next alive player other than the actor. The server/UI normally supplies an explicit
  // target via the action; this default keeps an unattended area-draw resolvable.
  const defaultTarget = state.players.find((p) => p.id !== actor && p.alive)?.id;

  if (deck === "white") {
    events.push(
      ...playWhite(state, actor, card, defaultTarget ? { target: defaultTarget } : {}),
    );
  } else if (deck === "black") {
    events.push(
      ...playBlack(state, actor, card, defaultTarget ? { target: defaultTarget } : {}),
    );
  } else {
    // Hermit: handed to a chosen recipient (§7). Default to the next alive player
    // if the actor did not name one (server normally supplies hermit_give).
    let to: PlayerId | undefined;
    if (choice && choice.kind === "hermit_give") to = choice.to;
    if (to === undefined) {
      const other = state.players.find((p) => p.id !== actor && p.alive);
      to = other?.id;
    }
    if (to !== undefined) {
      const giveEvt: GameEvent = { type: "CardGiven", from: actor, to, card };
      state.log.push(giveEvt);
      events.push(giveEvt);
      // Unknown recipients may lie/decline via their own action flow; here the
      // recipient resolves truthfully against their identity (Unknown defaults to
      // a truthful "nothing happens" unless its ability path is used). §12.11
      events.push(...giveHermit(state, actor, to, card, {}));
    }
  }
  return events;
}

// ─── ResolveArea — the 6 area effects (§7) ───────────────────────────────────────

function resolveArea(
  state: GameState,
  actor: PlayerId,
  choice: AreaChoice | undefined,
): GameEvent[] {
  const player = getPlayer(state, actor);
  const area = player.area;
  if (area === null) throw new Error("reduce: ResolveArea before the player has moved");

  const events: GameEvent[] = [];

  switch (area) {
    case "hermits_cabin": {
      // §7: draw a Hermit card, read secretly, hand to a chosen player.
      const card = drawCard(state, "hermit");
      if (card) events.push(...resolveDrawnCard(state, actor, "hermit", card, choice));
      break;
    }
    case "underworld_gate": {
      // §7: choose any one deck (White/Black/Hermit), draw, resolve.
      const deck: DeckKind =
        choice && choice.kind === "deck" ? choice.deck : "white"; // default White
      const card = drawCard(state, deck);
      if (card) events.push(...resolveDrawnCard(state, actor, deck, card, choice));
      break;
    }
    case "church": {
      // §7: draw a White card, resolve.
      const card = drawCard(state, "white");
      if (card) events.push(...resolveDrawnCard(state, actor, "white", card, choice));
      break;
    }
    case "cemetery": {
      // §7: draw a Black card, resolve.
      const card = drawCard(state, "black");
      if (card) events.push(...resolveDrawnCard(state, actor, "black", card, choice));
      break;
    }
    case "weird_woods": {
      // §7: choose any player; do exactly ONE: deal 2 damage, OR heal 1.
      if (choice && choice.kind === "weird_woods") {
        if (choice.mode === "damage") {
          events.push(...applyDamage(state, choice.target, 2, "weird_woods", null));
        } else {
          events.push(...applyHeal(state, choice.target, 1, "weird_woods"));
        }
      }
      // No choice → the optional area action is skipped (legal no-op). §8
      break;
    }
    case "erstwhile_altar": {
      // §7: steal one Equipment from any player (nothing if none have equipment).
      if (choice && choice.kind === "steal") {
        const from = getPlayer(state, choice.from);
        const idx = from.equipment.indexOf(choice.card);
        if (idx !== -1) {
          from.equipment.splice(idx, 1);
          getPlayer(state, actor).equipment.push(choice.card);
          const evt: GameEvent = {
            type: "EquipmentTaken",
            player: actor,
            from: choice.from,
            card: choice.card,
          };
          state.log.push(evt);
          events.push(evt);
        }
      }
      break;
    }
    default: {
      // Exhaustive — every AreaId is handled above.
      throw new Error(`reduce: unhandled area "${area as string}"`);
    }
  }

  // Area step done → advance to the attack step (§8) unless the game just ended.
  if (!state.over) state.phase = "attack";
  return events;
}

// ─── Start-of-turn hooks (§8 §12.22) ─────────────────────────────────────────────

/**
 * Begin a fresh turn for `current`: clear per-turn transient flags and mark the
 * start-of-turn ability available iff the current player has one still unspent
 * (Franklin/George). Guardian Angel's attack-immunity is cleared at the START of the
 * protected player's next turn (§12.9). §8 §12.22
 */
function beginTurn(state: GameState): void {
  const p = getPlayer(state, state.current);
  // §12.9: clear the acting player's own attack immunity as their next turn begins.
  p.attackImmune = false;
  state.pendingMove = undefined;
  state.pendingCounters = {};
  // §8 §10: a fresh turn (and each Concealed-Knowledge extra turn, §12.10) starts with
  // an unspent attack step — the player may take their single Attack again this turn.
  state.attackStepSpent = false;
  // Franklin/George have an onStartTurn ability; mark it available if unspent.
  const ability = abilityFor(p.characterId);
  state.startOfTurnAbilityAvailable =
    ability !== undefined && ability.trigger === "onStartTurn" && abilityAvailable(state, p.id);
}

// ─── Turn advance (§12.17) ───────────────────────────────────────────────────────

/**
 * Advance `current` to the next ALIVE player in clockwise order, skipping the dead
 * (§12.17). If pendingExtraTurns > 0, the SAME player keeps the turn (Concealed
 * Knowledge, §12.10) and one is consumed. Resets phase to "move" and runs beginTurn().
 *
 * The actor's board position is KEPT between turns (and across an extra turn) — the
 * mandatory move step then rolls from that area with the never-stay rule (§9) enforced
 * by movement.ts. A turn does not teleport a player off the board.
 */
function endTurn(state: GameState): void {
  if (state.pendingExtraTurns > 0) {
    // §12.10: the same player immediately takes another full turn (move + area + attack).
    state.pendingExtraTurns -= 1;
    state.phase = "move";
    beginTurn(state);
    return;
  }

  // §12.17: rotate to the next alive player in turnOrder, wrapping around.
  const order = state.turnOrder;
  const startIdx = order.indexOf(state.current);
  for (let step = 1; step <= order.length; step++) {
    const candidate = order[(startIdx + step) % order.length]!;
    const cp = state.players.find((pl) => pl.id === candidate);
    if (cp && cp.alive) {
      state.current = candidate;
      state.phase = "move";
      beginTurn(state);
      return;
    }
  }
  // No alive player found (should be impossible before game-end) — leave as is.
}

// ─── legalActions ────────────────────────────────────────────────────────────────

/**
 * Return EXACTLY the actions `playerId` may take against `state` right now. The set is
 * empty once the game is over. reduce() validates every incoming action against this
 * list and throws on anything absent (§ server-authority contract).
 *
 * Out-of-band actions available to NON-current players:
 *   - Reveal           — any alive, hidden, non-Daniel player, any time (§5).
 *   - Counterattack    — a Werewolf with a pending counter against an attacker (§12.6).
 *
 * Current-player actions, by phase (§8):
 *   - move:   RollMove; MoveTo (when a wild/Emi/Compass choice is pending);
 *             UseAbility (Franklin/George start-of-turn, if available, §12.22).
 *   - area:   ResolveArea; EndTurn (the area step is optional, §8).
 *   - attack: Attack (each in-range target); EndTurn (attack is optional, §8).
 *   - manual ability (Allie) is offered to the current player whenever it is unspent.
 */
export function legalActions(state: GameState, playerId: PlayerId): Action[] {
  if (state.over) return [];

  const player = state.players.find((p) => p.id === playerId);
  if (!player || !player.alive) return [];

  const actions: Action[] = [];

  // ── Out-of-band: Werewolf Counterattack (§12.6) ────────────────────────────────
  const counters = state.pendingCounters?.[playerId];
  if (counters && counters.length > 0 && player.characterId === "werewolf") {
    for (const attacker of counters) {
      // Only offer counters whose target is still in range and alive.
      if (attackTargetsInRange(state, playerId).includes(attacker)) {
        actions.push({ type: "Counterattack", player: playerId, target: attacker });
      }
    }
  }

  // ── Out-of-band: voluntary Reveal (§5) ─────────────────────────────────────────
  if (canVoluntarilyReveal(player)) {
    actions.push({ type: "Reveal", player: playerId });
  }

  // ── Current-player turn actions (§8) ────────────────────────────────────────────
  if (playerId === state.current) {
    // Allie's manual once-per-game heal is available whenever unspent (§5).
    const ability = abilityFor(player.characterId);
    if (ability && ability.trigger === "manual" && abilityAvailable(state, playerId)) {
      actions.push({ type: "UseAbility", player: playerId });
    }

    switch (state.phase) {
      case "move": {
        if (state.pendingMove) {
          // A wild/Emi/Compass choice is pending → only MoveTo, offering EXACTLY the
          // valid destinations for the pending kind (§9):
          //   wild    → any area ≠ current.
          //   compass → the two-roll options recorded on pendingMove.
          //   emi     → Emi's teleport targets (paired + closest opposite, §12.21).
          let destinations: AreaId[];
          if (state.pendingMove.kind === "emi") {
            destinations = emiTeleportTargets(state, playerId);
          } else if (state.pendingMove.kind === "compass" && state.pendingMove.compassOptions) {
            destinations = state.pendingMove.compassOptions;
          } else {
            destinations = state.areas.filter((a) => a !== player.area);
          }
          for (const a of destinations) {
            actions.push({ type: "MoveTo", player: playerId, area: a });
          }
        } else {
          // Start-of-turn ability (Franklin/George) offered before the mandatory move
          // (§12.22). The transient `startOfTurnAbilityAvailable` only SUPPRESSES the
          // option once the player rolls/uses it this turn — a freshly-set-up or
          // freshly-rotated turn (flag undefined) still offers it while the ability is
          // unspent. Default-available unless explicitly turned off (=== false).
          if (
            state.startOfTurnAbilityAvailable !== false &&
            ability &&
            ability.trigger === "onStartTurn" &&
            abilityAvailable(state, playerId)
          ) {
            actions.push({ type: "UseAbility", player: playerId });
          }
          actions.push({ type: "RollMove", player: playerId });
        }
        break;
      }
      case "area": {
        actions.push({ type: "ResolveArea", player: playerId });
        actions.push({ type: "EndTurn", player: playerId }); // §8: area action is optional
        break;
      }
      case "attack": {
        if (!state.attackStepSpent) {
          // §8/§10: a SINGLE attack step. Offer each in-range target ONLY while the
          // attack step is unspent; once the player has attacked, no fresh Attack is
          // legal (a player may not attack twice in one turn — the reason Concealed
          // Knowledge grants a whole extra turn, §12.10).
          for (const target of attackTargetsInRange(state, playerId)) {
            actions.push({ type: "Attack", player: playerId, target });
          }
        } else if (
          // §5/§12.4: the ONLY sanctioned second attack is Charles's Bloody Feast,
          // an onAfterAttack ability the attacker may invoke AFTER his own attack this
          // turn (paying 2 self-damage to attack the SAME character again). Offer it
          // as a UseAbility once the attack step is spent and a valid target remains.
          // Vampire/Bob also trigger onAfterAttack but are passive no-ops resolved
          // inside applyAttack (requiresReveal === false) — they are NOT offered here.
          ability &&
          ability.trigger === "onAfterAttack" &&
          ability.requiresReveal &&
          abilityAvailable(state, playerId) &&
          attackTargetsInRange(state, playerId).length > 0
        ) {
          actions.push({ type: "UseAbility", player: playerId });
        }
        actions.push({ type: "EndTurn", player: playerId }); // §8: attack is optional
        break;
      }
      case "ended":
        break;
    }
  }

  return actions;
}

// ─── Action legality check ───────────────────────────────────────────────────────

/**
 * Is `action` present in legalActions for its actor? For actions that carry a free
 * payload (RollMove options, ResolveArea choices, UseAbility params, MoveTo targets),
 * we match on type + the key discriminators that legalActions enumerates, and let the
 * underlying module do the fine-grained validation (and throw on a bad payload).
 */
function isLegal(state: GameState, action: Action): boolean {
  const legal = legalActions(state, action.player);
  switch (action.type) {
    case "Attack":
      return legal.some((a) => a.type === "Attack" && a.target === action.target);
    case "Counterattack":
      return legal.some((a) => a.type === "Counterattack" && a.target === action.target);
    case "MoveTo":
      return legal.some((a) => a.type === "MoveTo" && a.area === action.area);
    // RollMove / ResolveArea / Reveal / EndTurn / UseAbility / PlayCard match on type.
    default:
      return legal.some((a) => a.type === action.type);
  }
}

// ─── reduce ──────────────────────────────────────────────────────────────────────

/**
 * Apply one action to the game, returning a NEW state and the events produced this
 * call. PURE: the input `state` is never mutated (it is deep-cloned first; rng is
 * copied by value). THROWS if `action` is not in legalActions (server contract).
 * After dispatch, win evaluation runs once more (§12.1) so the result already reflects
 * any mid-action game-end.
 */
export function reduce(
  state: GameState,
  action: Action,
): { state: GameState; events: GameEvent[] } {
  if (state.over) {
    throw new Error(`reduce: the game is over; no actions are legal`);
  }
  if (!isLegal(state, action)) {
    throw new Error(
      `reduce: illegal action ${action.type} by ${action.player} (phase=${state.phase}, current=${state.current})`,
    );
  }

  // Re-install the win-check hook on every call (defensive against another module /
  // test resetting it) so death/damage/reveal end the game on THIS clone. §12.1
  setWinCheckHook(maybeEndGame);

  const next = cloneState(state);
  const events: GameEvent[] = [];
  const actor = action.player;

  switch (action.type) {
    case "RollMove": {
      // §12.22: declining the start-of-turn ability by rolling spends the option.
      next.startOfTurnAbilityAvailable = false;
      const res = applyRollMove(next);
      events.push(...res.events);
      break;
    }

    case "MoveTo": {
      const res = applyMoveTo(next, action.area);
      events.push(...res.events);
      break;
    }

    case "ResolveArea": {
      events.push(...resolveArea(next, actor, action.choice));
      break;
    }

    case "Attack": {
      const res = applyAttack(next, actor, action.target);
      events.push(...res.events);
      // §8/§10: the turn's SINGLE attack step is now spent — legalActions stops offering
      // a fresh Attack (no attacking twice in one turn, §12.10). The only sanctioned
      // second attack is Charles's Bloody Feast, offered as a UseAbility (§5/§12.4).
      next.attackStepSpent = true;
      // §12.6: if the (still-alive) target is a Werewolf, it may now Counterattack
      // the attacker. Record the pending counter so legalActions offers it.
      const target = next.players.find((p) => p.id === action.target);
      if (target && target.alive && target.characterId === "werewolf" && !next.over) {
        next.pendingCounters ??= {};
        const list = next.pendingCounters[action.target] ?? [];
        if (!list.includes(actor)) list.push(actor);
        next.pendingCounters[action.target] = list;
      }
      // Charles Bloody Feast and other onAfterAttack passives are resolved via an
      // explicit UseAbility action by the attacker (kept out of the auto-pipeline so
      // the player chooses to pay the 2 self-damage). Vampire/Bob already resolved
      // inside applyAttack (§12.7/§12.8).
      break;
    }

    case "Counterattack": {
      // §12.6: a Werewolf's explicit counter. runHook drives the ability (reveals,
      // rolls, applies). Clear the pending counter afterward (one response).
      events.push(
        ...runHook("onAttacked", actor, {
          state: next,
          player: actor,
          params: { attacker: action.target },
        }),
      );
      if (next.pendingCounters) delete next.pendingCounters[actor];
      break;
    }

    case "Reveal": {
      events.push(...reveal(next, actor));
      break;
    }

    case "UseAbility": {
      const player = getPlayer(next, actor);
      const ability = abilityFor(player.characterId);
      if (!ability) throw new Error(`reduce: ${actor} has no ability to use`);
      // The trigger determines which hook drives it. params come straight from the action.
      events.push(
        ...runHook(ability.trigger, actor, {
          state: next,
          player: actor,
          ...(action.params ? { params: action.params } : {}),
        }),
      );
      // A spent start-of-turn ability removes the start option for the rest of the turn.
      if (ability.trigger === "onStartTurn") next.startOfTurnAbilityAvailable = false;
      break;
    }

    case "PlayCard": {
      // Reserved for hand-held cards (empty in the base game). Routed by deck colour.
      const deck = deckOf(action.card);
      if (deck === "white") {
        events.push(
          ...playWhite(next, actor, action.card, {
            ...(action.target ? { target: action.target } : {}),
            ...(action.option ? { option: action.option } : {}),
          }),
        );
      } else if (deck === "black") {
        events.push(
          ...playBlack(next, actor, action.card, {
            ...(action.target ? { target: action.target } : {}),
            ...(action.option ? { option: action.option } : {}),
          }),
        );
      } else {
        const to = action.target ?? actor;
        events.push(...giveHermit(next, actor, to, action.card, {}));
      }
      break;
    }

    case "EndTurn": {
      endTurn(next);
      break;
    }

    default: {
      const _exhaustive: never = action;
      void _exhaustive;
      throw new Error(`reduce: unhandled action`);
    }
  }

  // §12.1: a final win evaluation so the returned state reflects any game-end the
  // action caused (idempotent — maybeEndGame no-ops once state.over is set).
  if (!next.over) {
    const winEvents = maybeEndGame(next);
    events.push(...winEvents);
  }

  return { state: next, events };
}

// Re-export createGame so index.ts can pull the whole public surface from one place is
// not required — index.ts imports createGame from setup.js directly. Nothing here.
void factionOf;
void ABILITIES;
void AREA_BY_DICE;
