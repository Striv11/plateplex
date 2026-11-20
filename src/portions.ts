import {
  NUTRIENTS,
  type Food,
  type Nutrient,
  type Targets,
  planDiet,
} from "./diet";
import { solve, type Constraint } from "./solver/simplex";

/** A purchasable/servable unit: its mass and how to name it. */
export interface Unit {
  grams: number;
  singular: string;
  plural: string;
}

const gramStep: Unit = { grams: 25, singular: "25 g", plural: "25 g" };
const spoon = (): Unit => ({ grams: 5, singular: "5 g", plural: "5 g" });
const item = (grams: number, singular: string, plural = singular + "s") => ({
  grams,
  singular,
  plural,
});

/** Natural units for foods that come in pieces; everything else uses 25 g steps. */
const UNITS: Record<string, Unit> = {
  eggs: item(50, "egg"),
  "bread-wholemeal": item(30, "slice"),
  "bread-white": item(30, "slice"),
  tortilla: item(45, "tortilla"),
  banana: item(120, "banana"),
  apple: item(180, "apple"),
  orange: item(150, "orange"),
  onion: item(110, "onion"),
  tomato: item(120, "tomato", "tomatoes"),
  "bell-pepper": item(120, "pepper"),
  carrots: item(60, "carrot"),
  potato: item(170, "potato", "potatoes"),
  "sweet-potato": item(130, "sweet potato", "sweet potatoes"),
  "olive-oil": spoon(),
  "canola-oil": spoon(),
  butter: spoon(),
  sugar: spoon(),
  honey: spoon(),
  chia: spoon(),
  flaxseed: spoon(),
  "nutritional-yeast": spoon(),
};

export function unitOf(foodId: string): Unit {
  return UNITS[foodId] ?? gramStep;
}

/** "3 eggs", "2 slices", or "150 g" for foods without a natural piece. */
export function describeAmount(foodId: string, grams: number): string {
  const u = unitOf(foodId);
  const n = Math.round(grams / u.grams);
  if (UNITS[foodId] && u.singular !== `${u.grams} g`)
    return `${n} ${n === 1 ? u.singular : u.plural} (${Math.round(grams)} g)`;
  return `${Math.round(grams)} g`;
}

export interface PortionPlan {
  status: "optimal" | "infeasible" | "limit";
  /** Whole units per food id. */
  units: Record<string, number>;
  /** Grams per food id (units × unit size). */
  grams: Record<string, number>;
  cost: number;
  totals: Record<Nutrient, number>;
  /** Branch-and-bound nodes (LP solves) used. */
  nodes: number;
  /** Largest relative violation of any target bound; 0 when all are met. */
  maxDeviation: number;
}

export interface PortionOptions {
  /** LP solves allowed per stage (strict, then relaxed). */
  nodeLimit?: number;
  /** Relative slack allowed on every bound in the relaxed stage. */
  tolerance?: number;
}

interface Node {
  lower: number[];
  upper: number[];
}

const INT_EPS = 1e-6;

/** Largest relative amount by which totals fall outside any target bound. */
export function deviation(
  totals: Record<Nutrient, number>,
  targets: Targets,
): number {
  let worst = 0;
  for (const n of NUTRIENTS) {
    const r = targets[n];
    if (!r) continue;
    const t = totals[n];
    if (r.min !== undefined && t < r.min && r.min > 0)
      worst = Math.max(worst, (r.min - t) / r.min);
    if (r.max !== undefined && t > r.max && r.max > 0)
      worst = Math.max(worst, (t - r.max) / r.max);
  }
  return worst;
}

function relax(targets: Targets, tol: number): Targets {
  const out: Targets = {};
  for (const n of NUTRIENTS) {
    const r = targets[n];
    if (!r) continue;
    out[n] = {
      ...(r.min !== undefined && { min: r.min * (1 - tol) }),
      ...(r.max !== undefined && { max: r.max * (1 + tol) }),
    };
  }
  return out;
}

/**
 * Depth-first branch-and-bound over whole units. Each food's amount is
 * `count × unit.grams`; the LP relaxation is solved with the simplex and a
 * fractional count is split into floor / ceil children. Returns the best
 * integer solution found and how many LPs it took.
 */
function branchAndBound(
  foods: Food[],
  targets: Targets,
  nodeLimit: number,
): { x: number[] | null; cost: number; nodes: number; exhausted: boolean } {
  const units = foods.map((f) => unitOf(f.id).grams);
  const base: Constraint[] = [];
  for (const nutrient of NUTRIENTS) {
    const r = targets[nutrient];
    if (!r) continue;
    const coeffs = foods.map((f, i) => (f.per100g[nutrient] / 100) * units[i]!);
    if (r.min !== undefined) base.push({ coeffs, rel: ">=", rhs: r.min });
    if (r.max !== undefined) base.push({ coeffs, rel: "<=", rhs: r.max });
  }
  const cost = foods.map((f, i) => (f.price / 100) * units[i]!);
  const root: Node = {
    lower: foods.map(() => 0),
    upper: foods.map((f, i) => Math.floor(f.maxGrams / units[i]! + 1e-9)),
  };

  let best: number[] | null = null;
  let bestCost = Infinity;
  let nodes = 0;
  const stack: Node[] = [root];
  while (stack.length > 0) {
    if (nodes >= nodeLimit)
      return { x: best, cost: bestCost, nodes, exhausted: false };
    const node = stack.pop()!;
    nodes++;
    const constraints = [...base];
    node.lower.forEach((lo, j) => {
      if (lo > 0) {
        const coeffs = foods.map((_, k) => (k === j ? 1 : 0));
        constraints.push({ coeffs, rel: ">=", rhs: lo });
      }
    });
    const sol = solve({ cost, constraints, upper: node.upper });
    if (sol.status !== "optimal") continue;
    if (sol.objective >= bestCost - 1e-9) continue;
    // Most fractional variable.
    let pick = -1;
    let frac = INT_EPS;
    sol.x.forEach((v, j) => {
      const d = Math.abs(v - Math.round(v));
      if (d > frac) {
        frac = d;
        pick = j;
      }
    });
    if (pick < 0) {
      best = sol.x.map((v) => Math.round(v));
      bestCost = sol.objective;
      continue;
    }
    const v = sol.x[pick]!;
    const down: Node = {
      lower: node.lower,
      upper: node.upper.map((u, j) => (j === pick ? Math.floor(v) : u)),
    };
    const up: Node = {
      lower: node.lower.map((l, j) => (j === pick ? Math.ceil(v) : l)),
      upper: node.upper,
    };
    // Explore the nearer side first (it is popped last-in-first-out).
    if (v - Math.floor(v) >= 0.5) stack.push(down, up);
    else stack.push(up, down);
  }
  return { x: best, cost: bestCost, nodes, exhausted: true };
}

/**
 * Cheapest plan in whole units. First tries to meet every target exactly; if
 * no integer solution turns up within the node limit, allows each bound to be
 * missed by `tolerance` (default 2%). `maxDeviation` reports what was used.
 */
export function planPortions(
  foods: Food[],
  targets: Targets,
  opts: PortionOptions = {},
): PortionPlan {
  const nodeLimit = opts.nodeLimit ?? 300;
  const tolerance = opts.tolerance ?? 0.02;
  let nodes = 0;
  let status: PortionPlan["status"] = "infeasible";
  let found: number[] | null = null;

  // Infeasible even continuously (at the relaxed bounds): no point searching.
  if (planDiet(foods, relax(targets, tolerance)).status === "optimal") {
    status = "limit";
    for (const tol of [0, tolerance]) {
      const r = branchAndBound(foods, relax(targets, tol), nodeLimit);
      nodes += r.nodes;
      if (r.x) {
        found = r.x;
        status = "optimal";
        break;
      }
      if (r.exhausted && tol > 0) status = "infeasible";
    }
  }

  const grams: Record<string, number> = {};
  const unitsOut: Record<string, number> = {};
  const totals = Object.fromEntries(NUTRIENTS.map((n) => [n, 0])) as Record<
    Nutrient,
    number
  >;
  let cost = 0;
  if (found) {
    foods.forEach((f, i) => {
      const n = found![i] ?? 0;
      if (n <= 0) return;
      const g = n * unitOf(f.id).grams;
      unitsOut[f.id] = n;
      grams[f.id] = g;
      cost += (g * f.price) / 100;
      for (const k of NUTRIENTS) totals[k] += (f.per100g[k] * g) / 100;
    });
  }
  return {
    status,
    units: unitsOut,
    grams,
    cost: found ? cost : NaN,
    totals,
    nodes,
    maxDeviation: found ? deviation(totals, targets) : NaN,
  };
}
