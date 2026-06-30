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
  lastKill: { killer: PlayerId | null; deadCountAfter: number } | null;
  winners: PlayerId[];       // set when game ends
  over: boolean;
  pendingExtraTurns: number; // Concealed Knowledge (§12.10)
  shownCards: Record<PlayerId, CharacterId[]>; // Hermit's Prediction (§12.11, private to giver)
  log: GameEvent[];
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
  | { type: "EquipmentTaken"; player: PlayerId; from: PlayerId; card: CardId }
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
}
