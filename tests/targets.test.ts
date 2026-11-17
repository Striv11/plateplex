import { describe, expect, it } from "vitest";
import { FOODS } from "../src/dataset";
import { planDiet } from "../src/diet";
import {
  bmr,
  GOALS,
  isVeganOnly,
  presetTargets,
  tdee,
  type Body,
} from "../src/targets";

const male: Body = {
  sex: "male",
  age: 30,
  weightKg: 80,
  heightCm: 180,
  activity: "moderate",
};
const female: Body = {
  sex: "female",
  age: 28,
  weightKg: 60,
  heightCm: 165,
  activity: "light",
};

describe("Mifflin-St Jeor", () => {
  it("matches hand-computed values", () => {
    expect(bmr(male)).toBe(1780);
    expect(bmr(female)).toBeCloseTo(1330.25, 6);
    expect(tdee(male)).toBeCloseTo(1780 * 1.55, 6);
  });
});

describe("presets", () => {
  it("scale energy by goal", () => {
    const cut = presetTargets("cut", male).kcal!;
    const keep = presetTargets("maintain", male).kcal!;
    const bulk = presetTargets("bulk", male).kcal!;
    expect(cut.max!).toBeLessThan(keep.min!);
    expect(bulk.min!).toBeGreaterThan(keep.max!);
  });

  it("floors energy at 1200 kcal", () => {
    const tiny: Body = {
      ...female,
      age: 90,
      weightKg: 35,
      heightCm: 130,
      activity: "sedentary",
    };
    expect(presetTargets("cut", tiny).kcal!.min).toBe(1164);
  });

  it("rejects out-of-range body stats", () => {
    expect(() => presetTargets("cut", { ...male, weightKg: 5 })).toThrow(
      RangeError,
    );
  });

  it("every preset is feasible on the dataset, for varied bodies", () => {
    const bodies: Body[] = [
      male,
      female,
      {
        sex: "male",
        age: 45,
        weightKg: 110,
        heightCm: 195,
        activity: "athlete",
      },
      {
        sex: "female",
        age: 60,
        weightKg: 50,
        heightCm: 155,
        activity: "sedentary",
      },
      { ...female, activity: "sedentary" },
      { ...female, activity: "athlete" },
    ];
    for (const body of bodies)
      for (const goal of GOALS) {
        const foods = isVeganOnly(goal) ? FOODS.filter((f) => f.vegan) : FOODS;
        const t = presetTargets(goal, body);
        const plan = planDiet(foods, t);
        expect(plan.status, `${goal} ${JSON.stringify(body)}`).toBe("optimal");
        expect(plan.totals.protein).toBeGreaterThanOrEqual(
          t.protein!.min! - 1e-6,
        );
        expect(plan.totals.kcal).toBeLessThanOrEqual(t.kcal!.max! + 1e-6);
        expect(plan.cost).toBeGreaterThan(0);
      }
  });

  it("vegan plan uses only vegan foods", () => {
    const foods = FOODS.filter((f) => f.vegan);
    const plan = planDiet(foods, presetTargets("vegan", male));
    const ids = new Set(foods.map((f) => f.id));
    for (const id of Object.keys(plan.grams)) expect(ids.has(id)).toBe(true);
  });
});
