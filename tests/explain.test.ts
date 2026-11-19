import { describe, expect, it } from "vitest";
import { FOODS } from "../src/dataset";
import { planDiet, type Targets } from "../src/diet";
import {
  describeConflict,
  explainShadow,
  minimalConflict,
  proteinPareto,
} from "../src/explain";
import { computePlan, defaultState } from "../src/model";
import { paretoSvg, resultHtml } from "../src/view";
import { presetTargets } from "../src/targets";

const targets = presetTargets("maintain", defaultState().body);

describe("explainShadow", () => {
  it("matches the finite-difference cost of tightening protein", () => {
    const base = planDiet(FOODS, targets);
    const tighter = planDiet(FOODS, {
      ...targets,
      protein: { ...targets.protein, min: (targets.protein?.min ?? 0) + 1 },
    });
    const ex = explainShadow(base.shadow);
    const p = ex.find((e) => e.nutrient === "protein" && e.bound === "min");
    if (p)
      expect(p.deltaCost / p.step).toBeCloseTo(tighter.cost - base.cost, 6);
    expect(ex.length).toBeGreaterThan(0);
  });

  it("phrases minimums as costs and maximums as savings, sorted by size", () => {
    const ex = explainShadow([
      { nutrient: "protein", bound: "min", perUnit: 0.018 },
      { nutrient: "sodium", bound: "max", perUnit: -0.0005 },
      { nutrient: "fiber", bound: "min", perUnit: 0.0001 },
    ]);
    expect(ex[0]?.text).toBe("+10 g of protein costs $0.18 more per day.");
    expect(ex[1]?.text).toContain("save $0.05");
    expect(ex).toHaveLength(2); // sub-cent effect dropped
  });
});

describe("minimalConflict", () => {
  it("returns [] for feasible targets", () => {
    expect(minimalConflict(FOODS, targets)).toEqual([]);
  });

  it("finds an irreducible conflicting pair", () => {
    // 400 g protein is 1600 kcal, so it conflicts with a 1500 kcal ceiling.
    const t: Targets = {
      ...targets,
      kcal: { min: 1000, max: 1500 },
      protein: { min: 400 },
    };
    const set = minimalConflict(FOODS, t);
    expect(set.length).toBeGreaterThan(0);
    // Infeasible together, but dropping any one member restores feasibility.
    expect(set.map((c) => `${c.nutrient}:${c.bound}`).sort()).toEqual([
      "kcal:max",
      "protein:min",
    ]);
    // Infeasible together, but dropping any one member restores feasibility.
    for (let i = 0; i < set.length; i++) {
      const rest = set.filter((_, j) => j !== i);
      const only: Targets = {};
      for (const c of rest)
        only[c.nutrient] = { ...only[c.nutrient], [c.bound]: c.limit };
      expect(planDiet(FOODS, only).status).toBe("optimal");
    }
    const all: Targets = {};
    for (const c of set)
      all[c.nutrient] = { ...all[c.nutrient], [c.bound]: c.limit };
    expect(planDiet(FOODS, all).status).toBe("infeasible");
    expect(describeConflict(set)).toContain("protein");
  });

  it("is surfaced by computePlan when too few foods are enabled", () => {
    const s = defaultState();
    const keep = new Set(["oats", "rice"]);
    const excluded = new Set(
      FOODS.filter((f) => !keep.has(f.id)).map((f) => f.id),
    );
    const o = computePlan({ ...s, excluded });
    expect(o.kind).toBe("infeasible");
    if (o.kind === "infeasible")
      expect(o.reason).toContain("cannot all be met");
  });
});

describe("proteinPareto", () => {
  it("has non-decreasing cost and ends where the problem becomes infeasible", () => {
    const pts = proteinPareto(FOODS, targets, 20);
    expect(pts.length).toBeGreaterThan(3);
    for (let i = 1; i < pts.length; i++)
      expect(pts[i]!.cost).toBeGreaterThanOrEqual(pts[i - 1]!.cost - 1e-9);
    const last = pts[pts.length - 1]!;
    const next = planDiet(FOODS, {
      ...targets,
      protein: { ...targets.protein, min: last.protein + 20 },
    });
    if (pts.length < 60) expect(next.status).not.toBe("optimal");
  });

  it("renders an svg, and nothing for a single point", () => {
    expect(paretoSvg(proteinPareto(FOODS, targets, 20))).toContain("<polyline");
    expect(paretoSvg([{ protein: 1, cost: 1 }])).toBe("");
  });
});

describe("why panel", () => {
  it("appears in the ok result html", () => {
    const o = computePlan(defaultState());
    expect(resultHtml(o)).toContain("Why this plan");
  });
});
