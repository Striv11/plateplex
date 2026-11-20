import { describe, expect, it } from "vitest";
import { FOODS } from "../src/dataset";
import { planDiet } from "../src/diet";
import {
  deviation,
  describeAmount,
  planPortions,
  unitOf,
} from "../src/portions";
import { GOALS, isVeganOnly, presetTargets, type Body } from "../src/targets";

const bodies: Body[] = [
  { sex: "male", age: 30, weightKg: 80, heightCm: 180, activity: "moderate" },
  { sex: "female", age: 45, weightKg: 62, heightCm: 165, activity: "light" },
  { sex: "male", age: 22, weightKg: 95, heightCm: 190, activity: "athlete" },
];

describe("planPortions", () => {
  for (const goal of GOALS) {
    for (const [i, body] of bodies.entries()) {
      it(`${goal} / body ${i}: whole units, within 2%, near the LP cost`, () => {
        const foods = FOODS.filter((f) => !isVeganOnly(goal) || f.vegan);
        const targets = presetTargets(goal, body);
        const lp = planDiet(foods, targets);
        const p = planPortions(foods, targets);
        expect(p.status).toBe("optimal");
        expect(p.maxDeviation).toBeLessThanOrEqual(0.02 + 1e-9);
        for (const [id, n] of Object.entries(p.units)) {
          expect(Number.isInteger(n)).toBe(true);
          expect(p.grams[id]).toBeCloseTo(n * unitOf(id).grams, 9);
          const food = foods.find((f) => f.id === id)!;
          expect(p.grams[id]!).toBeLessThanOrEqual(food.maxGrams + 1e-9);
        }
        // Rounding can't beat the continuous optimum (allowing the 2% slack).
        expect(p.cost).toBeGreaterThanOrEqual(lp.cost * 0.9);
        // ...and shouldn't cost much more than it.
        expect(p.cost).toBeLessThanOrEqual(lp.cost * 1.35 + 0.5);
        expect(p.nodes).toBeLessThanOrEqual(600);
      });
    }
  }

  it("reports totals consistent with the portions", () => {
    const targets = presetTargets("maintain", bodies[0]!);
    const p = planPortions(FOODS, targets);
    let kcal = 0;
    for (const [id, g] of Object.entries(p.grams))
      kcal += (FOODS.find((f) => f.id === id)!.per100g.kcal * g) / 100;
    expect(p.totals.kcal).toBeCloseTo(kcal, 6);
    expect(deviation(p.totals, targets)).toBeCloseTo(p.maxDeviation, 12);
  });

  it("finds a hand-checkable integer optimum", () => {
    // Eggs come in 50 g pieces: 150 kcal/50 g... need >= 130 protein-free kcal.
    const egg = FOODS.find((f) => f.id === "eggs")!;
    const kcalPerEgg = (egg.per100g.kcal * 50) / 100;
    const p = planPortions(
      [egg],
      { kcal: { min: kcalPerEgg * 2.5 } },
      {
        tolerance: 0,
      },
    );
    expect(p.status).toBe("optimal");
    expect(p.units["eggs"]).toBe(3);
  });

  it("reports infeasible when even the continuous problem is", () => {
    const p = planPortions(FOODS, { kcal: { min: 1e6 } });
    expect(p.status).toBe("infeasible");
  });

  it("stops at the node limit instead of running away", () => {
    const targets = presetTargets("maintain", bodies[0]!);
    const p = planPortions(FOODS, targets, { nodeLimit: 2 });
    expect(p.nodes).toBeLessThanOrEqual(4);
    expect(["optimal", "limit"]).toContain(p.status);
  });

  it("describes pieces and grams", () => {
    expect(describeAmount("eggs", 150)).toBe("3 eggs (150 g)");
    expect(describeAmount("eggs", 50)).toBe("1 egg (50 g)");
    expect(describeAmount("rice", 175)).toBe("175 g");
  });
});
