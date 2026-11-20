import { describe, expect, it } from "vitest";
import { FOODS } from "../src/dataset";
import { availableFoods, computePlan, defaultState } from "../src/model";
import { foodListHtml, macroSplit, resultHtml } from "../src/view";

describe("computePlan", () => {
  it("solves the default state within 50 ms", () => {
    computePlan(defaultState()); // warm up
    const t0 = performance.now();
    const o = computePlan(defaultState());
    const ms = performance.now() - t0;
    expect(o.kind).toBe("ok");
    expect(ms).toBeLessThan(50);
  });

  it("reports invalid body stats as an error, not a throw", () => {
    const s = defaultState();
    const o = computePlan({ ...s, body: { ...s.body, weightKg: NaN } });
    expect(o.kind).toBe("error");
  });

  it("rejects a non-positive budget", () => {
    expect(computePlan({ ...defaultState(), budget: 0 }).kind).toBe("error");
  });

  it("flags a budget below the minimum cost and reports that cost", () => {
    const base = computePlan(defaultState());
    if (base.kind !== "ok") throw new Error("expected ok");
    const tight = computePlan({
      ...defaultState(),
      budget: base.plan.cost - 0.5,
    });
    expect(tight.kind).toBe("over-budget");
    if (tight.kind === "over-budget")
      expect(tight.minCost).toBeCloseTo(base.plan.cost, 9);
    const exact = computePlan({
      ...defaultState(),
      budget: base.plan.cost + 0.01,
    });
    expect(exact.kind).toBe("ok");
  });

  it("never uses excluded foods, and costs no less than before", () => {
    const base = computePlan(defaultState());
    if (base.kind !== "ok") throw new Error("expected ok");
    const used = Object.keys(base.plan.grams);
    const o = computePlan({ ...defaultState(), excluded: new Set(used) });
    if (o.kind === "ok") {
      for (const id of used) expect(o.plan.grams[id]).toBeUndefined();
      expect(o.plan.cost).toBeGreaterThanOrEqual(base.plan.cost - 1e-9);
    } else expect(o.kind).toBe("infeasible");
  });

  it("is infeasible when every food is excluded", () => {
    const o = computePlan({
      ...defaultState(),
      excluded: new Set(FOODS.map((f) => f.id)),
    });
    expect(o.kind).toBe("infeasible");
  });

  it("is infeasible when only a couple of cheap foods remain", () => {
    const keep = new Set(["rice", "oats"]);
    const o = computePlan({
      ...defaultState(),
      excluded: new Set(FOODS.filter((f) => !keep.has(f.id)).map((f) => f.id)),
    });
    expect(o.kind).toBe("infeasible");
  });

  it("restricts the vegan goal to vegan foods", () => {
    const s = { ...defaultState(), goal: "vegan" as const };
    expect(availableFoods(s).every((f) => f.vegan)).toBe(true);
    const o = computePlan(s);
    expect(o.kind).toBe("ok");
    if (o.kind === "ok")
      for (const id of Object.keys(o.plan.grams))
        expect(FOODS.find((f) => f.id === id)?.vegan).toBe(true);
  });
});

describe("view", () => {
  it("shows an empty state", () => {
    expect(resultHtml(null)).toContain("empty");
  });

  it("renders a plan table with a row per used food", () => {
    const o = computePlan(defaultState());
    if (o.kind !== "ok") throw new Error("expected ok");
    const html = resultHtml(o);
    expect(html.match(/<tr><th scope="row">/g)?.length).toBe(
      Object.keys(o.plan.grams).length,
    );
    expect(html).toContain("per day");
  });

  it("renders error, infeasible and over-budget states as alerts", () => {
    for (const o of [
      { kind: "error", message: "x" },
      { kind: "infeasible", reason: "y" },
      { kind: "over-budget", minCost: 5, budget: 3 },
    ] as const)
      expect(resultHtml(o)).toContain('role="alert"');
  });

  it("escapes dynamic text", () => {
    expect(
      resultHtml({ kind: "error", message: "<img onerror=1>" }),
    ).not.toContain("<img");
  });

  it("macro split sums to 100%", () => {
    const s = macroSplit({ protein: 100, carbs: 300, fat: 70, fiber: 30 });
    expect(s.protein + s.carbs + s.fat).toBeCloseTo(100, 9);
  });

  it("food list checks included foods and disables non-vegan ones for vegan", () => {
    const html = foodListHtml(FOODS, new Set(["rice"]), true);
    expect(html).toMatch(/data-food="rice"(?! checked)/);
    expect(html).toContain("disabled");
    const all = foodListHtml(FOODS, new Set(), false);
    expect(all.match(/data-food=/g)?.length).toBe(FOODS.length);
    expect(all).not.toContain("disabled");
  });
});

describe("practical and multi-day state", () => {
  it("returns a menu and shopping list for a week with variety", () => {
    const o = computePlan({
      ...defaultState(),
      days: 3,
      maxRepeat: 2,
      practical: true,
    });
    expect(o.kind).toBe("ok");
    if (o.kind !== "ok" || !o.menu) throw new Error("expected menu");
    expect(o.menu.schedule.status).toBe("ok");
    expect(o.menu.shopping.length).toBeGreaterThan(0);
    const html = resultHtml(o);
    expect(html).toContain("Day 3");
    expect(html).toContain("Shopping list");
  });

  it("rejects bad day counts without throwing", () => {
    expect(computePlan({ ...defaultState(), days: 0 }).kind).toBe("error");
    expect(computePlan({ ...defaultState(), days: 2, maxRepeat: 0 }).kind).toBe(
      "error",
    );
  });

  it("leaves the plain single-day path without a menu", () => {
    const o = computePlan(defaultState());
    expect(o.kind === "ok" && o.menu).toBeFalsy();
  });
});
