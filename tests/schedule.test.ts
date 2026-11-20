import { describe, expect, it } from "vitest";
import { FOODS } from "../src/dataset";
import {
  type DayPlan,
  planDays,
  shoppingCsv,
  shoppingList,
  shoppingText,
} from "../src/schedule";
import { presetTargets } from "../src/targets";

const targets = presetTargets("maintain", {
  sex: "male",
  age: 30,
  weightKg: 80,
  heightCm: 180,
  activity: "moderate",
});

describe("planDays", () => {
  it("never uses a food on more than maxDaysPerFood days", () => {
    const s = planDays(FOODS, targets, {
      days: 7,
      maxDaysPerFood: 3,
      practical: false,
    });
    expect(s.status).toBe("ok");
    const count = new Map<string, number>();
    for (const d of s.days)
      for (const id of Object.keys(d.grams))
        count.set(id, (count.get(id) ?? 0) + 1);
    expect(Math.max(...count.values())).toBeLessThanOrEqual(3);
    expect(s.days).toHaveLength(7);
  });

  it("variety costs at least as much as repeating the cheapest day", () => {
    const one = planDays(FOODS, targets, {
      days: 1,
      maxDaysPerFood: 7,
      practical: false,
    });
    const week = planDays(FOODS, targets, {
      days: 7,
      maxDaysPerFood: 2,
      practical: false,
    });
    if (one.status !== "ok" || week.status !== "ok")
      throw new Error("infeasible");
    expect(week.totalCost).toBeGreaterThanOrEqual(7 * one.totalCost - 1e-6);
  });

  it("without a binding limit every day equals the single-day plan", () => {
    const one = planDays(FOODS, targets, {
      days: 1,
      maxDaysPerFood: 7,
      practical: false,
    });
    const three = planDays(FOODS, targets, {
      days: 3,
      maxDaysPerFood: 3,
      practical: false,
    });
    if (one.status !== "ok" || three.status !== "ok")
      throw new Error("infeasible");
    expect(three.totalCost).toBeCloseTo(3 * one.totalCost, 6);
  });

  it("reports the day that cannot be planned", () => {
    const s = planDays(FOODS.slice(0, 5), targets, {
      days: 4,
      maxDaysPerFood: 1,
      practical: false,
    });
    expect(s.status).toBe("infeasible");
    if (s.status === "infeasible")
      expect(s.failedDay).toBeGreaterThanOrEqual(1);
  });

  it("supports practical portions", () => {
    const s = planDays(FOODS, targets, {
      days: 2,
      maxDaysPerFood: 2,
      practical: true,
    });
    expect(s.status).toBe("ok");
    if (s.status === "ok")
      for (const d of s.days)
        for (const [id, g] of Object.entries(d.grams)) {
          expect(g).toBeGreaterThan(0);
          expect(FOODS.some((f) => f.id === id)).toBe(true);
        }
  });
});

describe("shopping list", () => {
  const days: DayPlan[] = [
    { grams: { eggs: 100, rice: 150 }, cost: 0, totals: {} as never },
    { grams: { eggs: 50, banana: 120 }, cost: 0, totals: {} as never },
  ];
  const groups = shoppingList(days, FOODS);

  it("sums grams across days and groups by aisle", () => {
    const flat = groups.flatMap((g) => g.items);
    expect(flat.find((i) => i.id === "eggs")).toMatchObject({
      grams: 150,
      days: 2,
    });
    expect(
      groups.find((g) => g.items.some((i) => i.id === "rice"))?.aisle,
    ).toBe("grains");
    expect(
      groups.find((g) => g.items.some((i) => i.id === "banana"))?.aisle,
    ).toBe("produce");
    expect(groups.every((g) => g.items.length > 0)).toBe(true);
  });

  it("formats pieces and exports text and CSV", () => {
    const text = shoppingText(groups);
    expect(text).toContain("- Eggs: 3 eggs (150 g)");
    const csv = shoppingCsv(groups).split("\n");
    expect(csv[0]).toBe("aisle,food,grams,cost");
    expect(csv.length).toBe(1 + 3);
    expect(csv.find((l) => l.includes("Eggs"))).toMatch(
      /^"chilled","Eggs",150,/,
    );
  });
});
