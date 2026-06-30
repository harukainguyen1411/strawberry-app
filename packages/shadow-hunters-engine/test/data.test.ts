import { expect, test } from "vitest";
import { CHARACTERS } from "../src/data/characters.js";
import { WHITE, BLACK, HERMIT } from "../src/data/cards.js";
import { AREA_BY_DICE } from "../src/data/areas.js";

test("roster", () => {
  expect(CHARACTERS).toHaveLength(10);
  const byF = (f: string) => CHARACTERS.filter(c => c.faction === f).length;
  expect([byF("Hunter"), byF("Shadow"), byF("Neutral")]).toEqual([3, 3, 4]);
  expect(CHARACTERS.find(c => c.id === "george")!.maxHp).toBe(14);
  expect(CHARACTERS.find(c => c.id === "allie")!.maxHp).toBe(8);
});

test("deck sizes", () => {
  const size = (d: { count: number }[]) => d.reduce((n, c) => n + c.count, 0);
  expect(size(WHITE)).toBe(16); expect(size(BLACK)).toBe(16); expect(size(HERMIT)).toBe(16);
});

test("dice mapping", () => {
  expect(AREA_BY_DICE[6]).toBe("church");
  expect(AREA_BY_DICE[10]).toBe("erstwhile_altar");
  expect(AREA_BY_DICE[7]).toBe("wild");
});
