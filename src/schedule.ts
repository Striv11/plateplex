import { AISLES, type Aisle, type CatalogFood } from "./dataset";
import { planDiet, type Nutrient, type Targets } from "./diet";
import { describeAmount, planPortions } from "./portions";

export interface DayPlan {
  grams: Record<string, number>;
  cost: number;
  totals: Record<Nutrient, number>;
}

export type Schedule =
  | { status: "ok"; days: DayPlan[]; totalCost: number }
  | { status: "infeasible"; failedDay: number; days: DayPlan[] };

export interface ScheduleOptions {
  days: number;
  /** A food may appear on at most this many days (variety constraint). */
  maxDaysPerFood: number;
  /** Round to whole units (branch-and-bound) instead of exact grams. */
  practical: boolean;
}

/**
 * Plan several days with a variety limit. "At most N days per food" is a
 * binary-per-day-and-food constraint, so instead of a MILP we plan greedily:
 * each day is the cheapest plan over foods that still have days left. Cheap
 * staples therefore run out first and later days rotate to the next-best foods.
 * This is a heuristic: it can fail on a late day where an optimal assignment
 * could have succeeded, in which case the failing day is reported.
 */
export function planDays(
  foods: CatalogFood[],
  targets: Targets,
  opts: ScheduleOptions,
): Schedule {
  const used = new Map<string, number>();
  const days: DayPlan[] = [];
  for (let d = 0; d < opts.days; d++) {
    const pool = foods.filter(
      (f) => (used.get(f.id) ?? 0) < opts.maxDaysPerFood,
    );
    const plan = opts.practical
      ? planPortions(pool, targets)
      : planDiet(pool, targets);
    if (plan.status !== "optimal")
      return { status: "infeasible", failedDay: d + 1, days };
    for (const id of Object.keys(plan.grams))
      used.set(id, (used.get(id) ?? 0) + 1);
    days.push({ grams: plan.grams, cost: plan.cost, totals: plan.totals });
  }
  return {
    status: "ok",
    days,
    totalCost: days.reduce((s, d) => s + d.cost, 0),
  };
}

export interface ShoppingItem {
  id: string;
  name: string;
  grams: number;
  /** Human amount, e.g. "12 eggs (600 g)". */
  amount: string;
  cost: number;
  /** Number of days the food is eaten. */
  days: number;
}

export interface ShoppingGroup {
  aisle: Aisle;
  items: ShoppingItem[];
}

/** Total each food over all days and group by aisle (catalog aisle order). */
export function shoppingList(
  days: DayPlan[],
  foods: CatalogFood[],
): ShoppingGroup[] {
  const totals = new Map<string, { grams: number; days: number }>();
  for (const d of days)
    for (const [id, g] of Object.entries(d.grams)) {
      const t = totals.get(id) ?? { grams: 0, days: 0 };
      t.grams += g;
      t.days += 1;
      totals.set(id, t);
    }
  return AISLES.map((aisle) => ({
    aisle,
    items: foods
      .filter((f) => f.aisle === aisle && totals.has(f.id))
      .map((f) => {
        const t = totals.get(f.id)!;
        return {
          id: f.id,
          name: f.name,
          grams: t.grams,
          amount: describeAmount(f.id, t.grams),
          cost: (t.grams * f.price) / 100,
          days: t.days,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name)),
  })).filter((g) => g.items.length > 0);
}

/** Plain-text list suitable for copying into a notes app. */
export function shoppingText(groups: ShoppingGroup[]): string {
  return groups
    .map(
      (g) =>
        `${g.aisle.toUpperCase()}\n` +
        g.items.map((i) => `- ${i.name}: ${i.amount}`).join("\n"),
    )
    .join("\n\n");
}

/** CSV export: aisle, food, grams, cost. Fields are quoted. */
export function shoppingCsv(groups: ShoppingGroup[]): string {
  const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const rows = groups.flatMap((g) =>
    g.items.map((i) =>
      [q(g.aisle), q(i.name), Math.round(i.grams), i.cost.toFixed(2)].join(","),
    ),
  );
  return ["aisle,food,grams,cost", ...rows].join("\n");
}
