import { describe, expect, it } from "vitest";
import { FOODS, parseFoods } from "../src/dataset";
import { NUTRIENTS } from "../src/diet";

describe("food dataset", () => {
  it("has 60+ foods with unique ids", () => {
    expect(FOODS.length).toBeGreaterThanOrEqual(60);
    expect(new Set(FOODS.map((f) => f.id)).size).toBe(FOODS.length);
  });

  it("has plausible macros: kcal within 25% of an Atwater estimate", () => {
    for (const f of FOODS) {
      const n = f.per100g;
      // Carbs include fiber, which yields roughly 2 kcal/g rather than 4.
      const est =
        4 * n.protein + 4 * (n.carbs - n.fiber) + 2 * n.fiber + 9 * n.fat;
      expect(Math.abs(n.kcal - est) / n.kcal, f.id).toBeLessThan(0.25);
      expect(n.protein + n.carbs + n.fat, f.id).toBeLessThanOrEqual(101);
    }
  });

  it("has enough vegan foods and animal foods", () => {
    expect(FOODS.filter((f) => f.vegan).length).toBeGreaterThanOrEqual(30);
    expect(FOODS.filter((f) => !f.vegan).length).toBeGreaterThanOrEqual(10);
  });

  it("rejects malformed entries with a helpful message", () => {
    const good = FOODS[0]!;
    expect(() => parseFoods({})).toThrow(/array/);
    expect(() => parseFoods([good, good])).toThrow(/duplicate/);
    expect(() => parseFoods([{ ...good, price: 0 }])).toThrow(/price/);
    expect(() => parseFoods([{ ...good, aisle: "moon" }])).toThrow(/aisle/);
    const bad = { ...good, per100g: { ...good.per100g, fiber: -1 } };
    expect(() => parseFoods([bad])).toThrow(/fiber/);
    for (const n of NUTRIENTS) {
      const p = { ...good.per100g } as Record<string, number>;
      delete p[n];
      expect(() => parseFoods([{ ...good, per100g: p }])).toThrow(n);
    }
  });
});
