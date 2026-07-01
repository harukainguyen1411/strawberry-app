import { expect, test } from "vitest";
import { makeRng, rollD6, rollD4, shuffle } from "../src/rng.js";

test("same seed reproduces the same rolls", () => {
  const a = makeRng("seed-1"); const b = makeRng("seed-1");
  const seqA = Array.from({ length: 20 }, () => rollD6(a));
  const seqB = Array.from({ length: 20 }, () => rollD6(b));
  expect(seqA).toEqual(seqB);
});

test("d6 and d4 stay in range", () => {
  const r = makeRng("ranges");
  for (let i = 0; i < 10000; i++) {
    const d6 = rollD6(r), d4 = rollD4(r);
    expect(d6).toBeGreaterThanOrEqual(1); expect(d6).toBeLessThanOrEqual(6);
    expect(d4).toBeGreaterThanOrEqual(1); expect(d4).toBeLessThanOrEqual(4);
  }
});

test("shuffle is a permutation and deterministic per seed", () => {
  const src = [1,2,3,4,5,6,7,8,9,10];
  const s1 = shuffle(src, makeRng("x")); const s2 = shuffle(src, makeRng("x"));
  expect(s1).toEqual(s2);
  expect([...s1].sort((a,b)=>a-b)).toEqual(src);
});
