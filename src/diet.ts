import { solve, type Constraint } from "./solver/simplex";

export type Nutrient =
  "kcal" | "protein" | "carbs" | "fat" | "fiber" | "sodium";

export interface Food {
  id: string;
  name: string;
  /** Nutrients per 100 g (sodium in mg). */
  per100g: Record<Nutrient, number>;
  /** Price per 100 g in the user's currency. */
  price: number;
  /** Largest sensible amount per day, in grams. */
  maxGrams: number;
}

export interface Range {
  min?: number;
  max?: number;
}

export type Targets = Partial<Record<Nutrient, Range>>;

export interface DietPlan {
  status: "optimal" | "infeasible" | "unbounded";
  grams: Record<string, number>;
  cost: number;
  totals: Record<Nutrient, number>;
  /** Shadow price: extra cost per unit of tightening each binding bound. */
  shadow: { nutrient: Nutrient; bound: "min" | "max"; perUnit: number }[];
}

export const NUTRIENTS: Nutrient[] = [
  "kcal",
  "protein",
  "carbs",
  "fat",
  "fiber",
  "sodium",
];

/** Cheapest daily plan meeting every nutrient range. */
export function planDiet(foods: Food[], targets: Targets): DietPlan {
  const constraints: Constraint[] = [];
  const tags: { nutrient: Nutrient; bound: "min" | "max" }[] = [];
  for (const nutrient of NUTRIENTS) {
    const r = targets[nutrient];
    if (!r) continue;
    const coeffs = foods.map((f) => f.per100g[nutrient] / 100); // per gram
    if (r.min !== undefined) {
      constraints.push({ coeffs, rel: ">=", rhs: r.min });
      tags.push({ nutrient, bound: "min" });
    }
    if (r.max !== undefined) {
      constraints.push({ coeffs, rel: "<=", rhs: r.max });
      tags.push({ nutrient, bound: "max" });
    }
  }
  const sol = solve({
    cost: foods.map((f) => f.price / 100),
    constraints,
    upper: foods.map((f) => f.maxGrams),
  });
  const grams: Record<string, number> = {};
  const totals = Object.fromEntries(NUTRIENTS.map((n) => [n, 0])) as Record<
    Nutrient,
    number
  >;
  foods.forEach((f, i) => {
    const g = sol.x[i] ?? 0;
    if (g > 1e-6) grams[f.id] = g;
    for (const n of NUTRIENTS) totals[n] += (f.per100g[n] * g) / 100;
  });
  const shadow = tags
    .map((t, i) => ({ ...t, perUnit: sol.duals[i] ?? 0 }))
    .filter((s) => Math.abs(s.perUnit) > 1e-9);
  return {
    status: sol.status,
    grams,
    cost: sol.status === "optimal" ? sol.objective : NaN,
    totals,
    shadow,
  };
}
