import { planDiet, type Food, type Nutrient, type Targets } from "./diet";

export const UNIT: Record<Nutrient, string> = {
  kcal: "kcal",
  protein: "g",
  carbs: "g",
  fat: "g",
  fiber: "g",
  sodium: "mg",
};

/** Step used to phrase a shadow price as a human-sized change. */
const STEP: Record<Nutrient, number> = {
  kcal: 100,
  protein: 10,
  carbs: 10,
  fat: 10,
  fiber: 5,
  sodium: 100,
};

const NAME: Record<Nutrient, string> = {
  kcal: "calories",
  protein: "protein",
  carbs: "carbs",
  fat: "fat",
  fiber: "fiber",
  sodium: "sodium",
};

export interface Explanation {
  nutrient: Nutrient;
  bound: "min" | "max";
  /** Cost change (currency/day) for the step, positive = more expensive. */
  deltaCost: number;
  step: number;
  /** Sentence ready to show. */
  text: string;
}

const money = (n: number): string => `$${Math.abs(n).toFixed(2)}`;

/**
 * Turn shadow prices into sentences, most expensive first. Tightening a
 * binding minimum (or loosening a binding maximum) is phrased as a trade-off
 * of one STEP of that nutrient.
 */
export function explainShadow(
  shadow: { nutrient: Nutrient; bound: "min" | "max"; perUnit: number }[],
): Explanation[] {
  return shadow
    .map((s): Explanation => {
      const step = STEP[s.nutrient];
      const unit = UNIT[s.nutrient];
      const delta = s.perUnit * step;
      const name = NAME[s.nutrient];
      const text =
        s.bound === "min"
          ? `+${step} ${unit} of ${name} costs ${money(delta)} more per day.`
          : `Allowing ${step} ${unit} more ${name} would save ${money(delta)} per day.`;
      return {
        nutrient: s.nutrient,
        bound: s.bound,
        deltaCost: delta,
        step,
        text,
      };
    })
    .filter((e) => Math.abs(e.deltaCost) >= 0.005)
    .sort((a, b) => Math.abs(b.deltaCost) - Math.abs(a.deltaCost));
}

export interface Conflict {
  nutrient: Nutrient;
  bound: "min" | "max";
  limit: number;
}

function withoutBound(t: Targets, c: Conflict): Targets {
  const r = { ...t[c.nutrient] };
  delete r[c.bound];
  return { ...t, [c.nutrient]: r };
}

/**
 * Deletion filter: drop each target bound in turn; if the problem is still
 * infeasible without it, leave it out for good. What remains is an
 * irreducible set of bounds that cannot be met together (removing any one
 * makes the rest feasible). Returns [] if the targets are feasible.
 */
export function minimalConflict(foods: Food[], targets: Targets): Conflict[] {
  const feasible = (t: Targets) => planDiet(foods, t).status === "optimal";
  if (feasible(targets)) return [];
  const all: Conflict[] = [];
  for (const [n, r] of Object.entries(targets) as [
    Nutrient,
    NonNullable<Targets[Nutrient]>,
  ][]) {
    if (r.min !== undefined)
      all.push({ nutrient: n, bound: "min", limit: r.min });
    if (r.max !== undefined)
      all.push({ nutrient: n, bound: "max", limit: r.max });
  }
  let current = targets;
  const kept: Conflict[] = [];
  for (const c of all) {
    const trial = withoutBound(current, c);
    if (feasible(trial))
      kept.push(c); // needed to stay infeasible
    else current = trial;
  }
  return kept;
}

export function describeConflict(conflict: Conflict[]): string {
  if (conflict.length === 0) return "";
  const parts = conflict.map(
    (c) =>
      `${NAME[c.nutrient]} ${c.bound === "min" ? "at least" : "at most"} ${Math.round(c.limit)} ${UNIT[c.nutrient]}`,
  );
  return `These targets cannot all be met with the selected foods: ${parts.join(" and ")}. Relax one of them or re-enable foods.`;
}

export interface ParetoPoint {
  protein: number;
  cost: number;
}

/**
 * Minimum daily cost as the protein floor rises from the target's own floor
 * until the problem becomes infeasible. Cost is non-decreasing and convex.
 */
export function proteinPareto(
  foods: Food[],
  targets: Targets,
  step = 10,
  maxPoints = 60,
): ParetoPoint[] {
  const start = Math.ceil((targets.protein?.min ?? 0) / step) * step;
  const out: ParetoPoint[] = [];
  for (let i = 0; i < maxPoints; i++) {
    const protein = start + i * step;
    const t: Targets = {
      ...targets,
      protein: { ...targets.protein, min: protein },
    };
    const p = planDiet(foods, t);
    if (p.status !== "optimal") break;
    out.push({ protein, cost: p.cost });
  }
  return out;
}
