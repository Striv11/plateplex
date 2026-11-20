import { planDiet, type DietPlan, type Targets } from "./diet";
import { FOODS, type CatalogFood } from "./dataset";
import {
  describeConflict,
  explainShadow,
  minimalConflict,
  type Explanation,
} from "./explain";
import {
  planDays,
  shoppingList,
  type Schedule,
  type ShoppingGroup,
} from "./schedule";
import { isVeganOnly, presetTargets, type Body, type Goal } from "./targets";

export interface AppState {
  body: Body;
  goal: Goal;
  /** Maximum spend per day; undefined means no budget. */
  budget?: number;
  /** Ids of foods the user switched off. */
  excluded: ReadonlySet<string>;
  /** Round to whole units (eggs, slices, 25 g steps). */
  practical?: boolean;
  /** Number of days to plan (default 1). */
  days?: number;
  /** A food may be eaten on at most this many days (default: no limit). */
  maxRepeat?: number;
}

/** Multi-day / whole-unit result with its shopping list. */
export interface Menu {
  schedule: Schedule;
  shopping: ShoppingGroup[];
}

export type Outcome =
  | {
      kind: "ok";
      plan: DietPlan;
      foods: CatalogFood[];
      targets: Targets;
      why: Explanation[];
      /** Present when the state asks for whole units or several days. */
      menu?: Menu;
    }
  | { kind: "over-budget"; minCost: number; budget: number }
  | { kind: "infeasible"; reason: string }
  | { kind: "error"; message: string };

export const defaultState = (): AppState => ({
  body: {
    sex: "male",
    age: 30,
    weightKg: 80,
    heightCm: 180,
    activity: "moderate",
  },
  goal: "maintain",
  excluded: new Set(),
});

/** Foods the solver may use for this state. */
export function availableFoods(
  state: AppState,
  catalog: CatalogFood[] = FOODS,
): CatalogFood[] {
  return catalog.filter(
    (f) => !state.excluded.has(f.id) && (!isVeganOnly(state.goal) || f.vegan),
  );
}

/** Turn UI state into a result the view can render; never throws. */
export function computePlan(
  state: AppState,
  catalog: CatalogFood[] = FOODS,
): Outcome {
  let targets: Targets;
  try {
    targets = presetTargets(state.goal, state.body);
  } catch (e) {
    return {
      kind: "error",
      message: e instanceof Error ? e.message : "invalid input",
    };
  }
  if (state.budget !== undefined && !(state.budget > 0))
    return { kind: "error", message: "budget must be greater than zero" };
  const foods = availableFoods(state, catalog);
  if (foods.length === 0)
    return { kind: "infeasible", reason: "No foods are selected." };
  const plan = planDiet(foods, targets);
  if (plan.status !== "optimal") {
    const conflict = minimalConflict(foods, targets);
    return {
      kind: "infeasible",
      reason:
        describeConflict(conflict) ||
        "These targets cannot be met with the selected foods. Re-enable some foods or pick a different goal.",
    };
  }
  if (state.budget !== undefined && plan.cost > state.budget + 1e-9)
    return { kind: "over-budget", minCost: plan.cost, budget: state.budget };
  const days = state.days ?? 1;
  if (!Number.isInteger(days) || days < 1 || days > 14)
    return {
      kind: "error",
      message: "days must be a whole number from 1 to 14",
    };
  const maxRepeat = state.maxRepeat ?? days;
  if (!Number.isInteger(maxRepeat) || maxRepeat < 1)
    return { kind: "error", message: "max days per food must be at least 1" };
  const why = explainShadow(plan.shadow);
  if (!state.practical && days === 1)
    return { kind: "ok", plan, foods, targets, why };
  const schedule = planDays(foods, targets, {
    days,
    maxDaysPerFood: maxRepeat,
    practical: !!state.practical,
  });
  return {
    kind: "ok",
    plan,
    foods,
    targets,
    why,
    menu: {
      schedule,
      shopping:
        schedule.status === "ok" ? shoppingList(schedule.days, foods) : [],
    },
  };
}
