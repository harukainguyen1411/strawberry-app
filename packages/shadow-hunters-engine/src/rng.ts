// Seeded PRNG for deterministic, reproducible game state.
// §9: dice = d6 + d4; all randomness flows through a single Rng threaded through GameState.
// Rng is a plain object (serialisable number) — no module-level mutable state.

export interface Rng { s: number }

/** FNV-1a string → 32-bit unsigned integer seed. */
function hashSeed(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Create a new Rng from a string seed. The seed is hashed to a 32-bit integer. */
export function makeRng(seed: string): Rng { return { s: hashSeed(seed) || 1 }; }

/**
 * Advance the RNG using the mulberry32 algorithm and return a float in [0, 1).
 * Mutates rng.s in place so callers thread the same Rng object through state.
 */
export function nextFloat(r: Rng): number {
  r.s |= 0;
  r.s = (r.s + 0x6D2B79F5) | 0;
  let t = Math.imul(r.s ^ (r.s >>> 15), 1 | r.s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Roll d6 → [1, 6]. §9: movement uses d6+d4; §10: combat uses |d6−d4|. */
export function rollD6(r: Rng): number { return 1 + Math.floor(nextFloat(r) * 6); }

/** Roll d4 → [1, 4]. */
export function rollD4(r: Rng): number { return 1 + Math.floor(nextFloat(r) * 4); }

/**
 * Fisher-Yates shuffle. Returns a new array (input is readonly).
 * Uses nextFloat(r) so the shuffle is deterministic given the rng state.
 */
export function shuffle<T>(arr: readonly T[], r: Rng): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(nextFloat(r) * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
