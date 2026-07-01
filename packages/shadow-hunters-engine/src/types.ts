// Core domain types for the Shadow Hunters engine.
// All types are defined here once and referenced by every other module.
// §3: setup/scaling; §4: win conditions; §5: characters; §6: cards; §7: areas; §8: turn structure.

import type { Rng } from "./rng.js";

export type PlayerId = string;
export type Faction = "Shadow" | "Hunter" | "Neutral";
export type CharacterId = string;   // e.g. "vampire"
export type CardId = string;        // unique per physical card instance
export type AreaId =
  | "hermits_cabin"
  | "underworld_gate"
  | "church"
  | "cemetery"
  | "weird_woods"
  | "erstwhile_altar";
export type DeckKind = "white" | "black" | "hermit";
export type TurnPhase = "move" | "area" | "attack" | "ended";

export interface PlayerState {
  id: PlayerId;
  characterId: CharacterId;
  damage: number;            // accumulated; dead when >= maxHp (§11)
  revealed: boolean;
  alive: boolean;
  area: AreaId | null;       // null before first move
  equipment: CardId[];       // face-up equipment in front of player
  hand: CardId[];            // generally empty in base game; reserved
  usedOncePerGame: string[]; // ability ids already spent
  /**
   * Set by Guardian Angel: this player takes no damage from attacks ("attack"
   * source) until their next turn begins (§6 Guardian Angel, §12.9).
   * Added in Task 7. The reduce.ts turn-start logic clears this flag.
   */
  attackImmune: boolean;
}

export interface DeckState { draw: CardId[]; discard: CardId[]; }

export interface GameState {
  players: PlayerState[];
  turnOrder: PlayerId[];     // clockwise; dead are skipped at runtime (§12.17)
  current: PlayerId;
  phase: TurnPhase;
  areas: AreaId[];           // 6 areas in board order; pairs are [0,1],[2,3],[4,5]
  pairing: Record<AreaId, AreaId>; // each area -> its paired area
  decks: Record<DeckKind, DeckState>;
  rng: Rng;
  deadOrder: PlayerId[];     // order of deaths (for Daniel "first to die"; §4)
  /**
   * Death "epoch" aligned 1:1 with deadOrder: deaths from a SINGLE effect (one-effect
   * AoE — Flare/Dynamite/Machine Gun) share an epoch number, so they count as
   * SIMULTANEOUS (§12.2/§12.5 "co-first if simultaneous"). Sequential deaths each get a
   * fresh epoch. Used by win.ts to credit Daniel "first to die" co-first when he dies in
   * the same effect as the game's first death(s). §12.2 §12.5
   */
  deadEpoch: number[];
  /**
   * Monotonic source of the next death epoch (§12.2), carried ON the state so two
   * identical (seed, actions) games run in one process produce identical deadEpoch
   * values. Starts at 0 in createGame; takeDeathEpoch()/withWinCheckBatch() read and
   * bump it. It must NOT be reset per reduce() — that would corrupt the distinct epochs
   * of multiple SEQUENTIAL deaths within one game. structuredClone carries it through
   * reduce's pure clone, so each game's counter is independent. §12.2 §12.5
   */
  nextDeathEpoch: number;
  lastKill: { killer: PlayerId | null; deadCountAfter: number } | null;
  winners: PlayerId[];       // set when game ends
  over: boolean;
  pendingExtraTurns: number; // Concealed Knowledge (§12.10)
  shownCards: Record<PlayerId, CharacterId[]>; // Hermit's Prediction (§12.11, private to giver)
  log: GameEvent[];
  /** Transient: set during a "move" phase when player must still choose destination.
   *  "wild" = rolled 7, pick any area ≠ current. §9
   *  "compass" = Mystic Compass equipped, two rolls to choose from. §6 §9
   *  "emi" = Emi Teleport in progress, pick from precomputed targets. §5 §9
   *  undefined = no pending move choice needed.
   */
  pendingMove: { kind: "wild" | "compass" | "emi"; roll?: [number, number]; compassOptions?: AreaId[] } | undefined;
  /**
   * Transient (set by reduce.ts): a Werewolf who was just attacked this turn and may
   * still respond with a Counterattack against the listed attacker(s). §12.6 Cleared
   * once the Werewolf counters or the turn ends. Keyed by Werewolf playerId →
   * attacker playerIds that may be countered. undefined when no counter is pending.
   */
  pendingCounters?: Record<PlayerId, PlayerId[]>;
  /**
   * Transient (set by reduce.ts): true while a start-of-turn hook (Franklin/George
   * Lightning/Demolish) is still available to the current player this turn. Cleared
   * once the player rolls to move or uses/declines the ability. §8 §12.22
   */
  startOfTurnAbilityAvailable?: boolean;
  /**
   * Transient (set by reduce.ts): true once the current player has used their SINGLE
   * combat Attack this turn (§8: the turn is Move → Area → a single Attack step; §10
   * resolves one attack). The attack step is then SPENT — legalActions must no longer
   * offer a fresh Attack (a player may not attack twice in one turn, the very reason
   * Concealed Knowledge grants a whole extra turn, §12.10). The ONLY sanctioned second
   * attack is Charles's Bloody Feast (§5/§12.4), offered as a UseAbility while this flag
   * is set. Cleared by beginTurn() so a new turn (and a Concealed-Knowledge extra turn)
   * starts with a fresh attack step. §8 §10 §12.4
   */
  attackStepSpent?: boolean;
}

export type Action =
  | { type: "RollMove"; player: PlayerId }
  | { type: "MoveTo"; player: PlayerId; area: AreaId }      // for 7=wild / Emi / Compass choice
  | { type: "ResolveArea"; player: PlayerId; choice?: AreaChoice }
  | { type: "Attack"; player: PlayerId; target: PlayerId }
  | { type: "PlayCard"; player: PlayerId; card: CardId; target?: PlayerId; option?: string }
  | { type: "UseAbility"; player: PlayerId; params?: Record<string, unknown> }
  | { type: "Reveal"; player: PlayerId }
  | { type: "Counterattack"; player: PlayerId; target: PlayerId } // Werewolf (§12.6)
  | { type: "DeclineCounter"; player: PlayerId } // Werewolf passes on its pending counter(s) (§12.6)
  | { type: "EndTurn"; player: PlayerId };

export type AreaChoice =
  | { kind: "deck"; deck: DeckKind }                 // Underworld Gate (§7)
  | { kind: "weird_woods"; target: PlayerId; mode: "damage" | "heal" }  // §7
  | { kind: "steal"; from: PlayerId; card: CardId }  // Erstwhile Altar (§7)
  | { kind: "hermit_give"; to: PlayerId };           // Hermit's Cabin recipient

export type GameEvent =
  | { type: "Moved"; player: PlayerId; area: AreaId; roll?: [number, number] }
  | { type: "Damaged"; player: PlayerId; amount: number; source: string }
  | { type: "Healed"; player: PlayerId; amount: number; source: string }
  | { type: "CardDrawn"; player: PlayerId; deck: DeckKind; card: CardId }
  | { type: "CardGiven"; from: PlayerId; to: PlayerId; card: CardId }
  /**
   * Equipment moved from `from` to `player`. `via:"robbery"` tags the ONE source
   * that is an identity tell: Bob's 4–6p Robbery combat-steal (§5/§12.8), which is
   * unique to Bob (no Damaged sibling). project() uses this tag to redact the event
   * from a viewer to whom Bob is still hidden (§1). All OTHER steals — Erstwhile
   * Altar (§7), Moody Goblin (§6), Hermit give-ups (§6), and kill loot (§11) — leave
   * `via` undefined and are never redacted (they carry no character tell).
   */
  | { type: "EquipmentTaken"; player: PlayerId; from: PlayerId; card: CardId; via?: "robbery" }
  | { type: "Revealed"; player: PlayerId; characterId: CharacterId }
  | { type: "AbilityUsed"; player: PlayerId; ability: string }
  | { type: "Died"; player: PlayerId; killer: PlayerId | null }
  | { type: "GameWon"; winners: PlayerId[] };

export interface PublicPlayer {
  id: PlayerId; damage: number; alive: boolean; area: AreaId | null;
  equipment: CardId[]; revealed: boolean;
  characterId: CharacterId | null;  // null unless revealed/dead
}

export interface PlayerView {
  you: { id: PlayerId; characterId: CharacterId; faction: Faction; maxHp: number; winCondition: string };
  players: PublicPlayer[];
  areas: AreaId[]; pairing: Record<AreaId, AreaId>;
  current: PlayerId; phase: TurnPhase; over: boolean; winners: PlayerId[];
  legal: Action[];           // your legal actions right now
  recent: GameEvent[];       // tail of the log for animation
  /**
   * Hermit's Prediction info PRIVATE to this viewer: character ids of recipients
   * who showed this viewer their card via Hermit's Prediction (§12.11). Only the
   * giver ever sees these; redacted (empty) for every other viewer so a hidden
   * recipient's identity never leaks. Sourced from state.shownCards[viewerId].
   */
  shownCards: CharacterId[];
}
