import { describe, expect, it } from "vitest";
import { planDiet } from "../src/diet";
import { STARTER_FOODS } from "../src/foods";

describe("planDiet", () => {
  const targets = {
    kcal: { min: 2000, max: 2200 },
    protein: { min: 100 },
    fiber: { min: 30 },
    sodium: { max: 2300 },
  };

  it("finds a plan that satisfies every range", () => {
    const p = planDiet(STARTER_FOODS, targets);
    expect(p.status).toBe("optimal");
    expect(p.totals.kcal).toBeGreaterThanOrEqual(2000 - 1e-6);
    expect(p.totals.kcal).toBeLessThanOrEqual(2200 + 1e-6);
    expect(p.totals.protein).toBeGreaterThanOrEqual(100 - 1e-6);
    expect(p.totals.fiber).toBeGreaterThanOrEqual(30 - 1e-6);
    expect(p.totals.sodium).toBeLessThanOrEqual(2300 + 1e-6);
    expect(p.cost).toBeGreaterThan(0);
    expect(p.cost).toBeLessThan(10);
  });

  it("never exceeds a food's max grams", () => {
    const p = planDiet(STARTER_FOODS, targets);
    for (const f of STARTER_FOODS)
      expect(p.grams[f.id] ?? 0).toBeLessThanOrEqual(f.maxGrams + 1e-6);
  });

  it("costs more when the protein target rises, and explains why via shadow prices", () => {
    const lo = planDiet(STARTER_FOODS, targets);
    const hi = planDiet(STARTER_FOODS, { ...targets, protein: { min: 160 } });
    expect(hi.cost).toBeGreaterThan(lo.cost);
    const s = hi.shadow.find(
      (x) => x.nutrient === "protein" && x.bound === "min",
    );
    expect(s?.perUnit).toBeGreaterThan(0);
  });

  it("reports infeasible when targets cannot be met", () => {
    const p = planDiet(STARTER_FOODS, { kcal: { min: 9000 } });
    expect(p.status).toBe("infeasible");
  });
});
