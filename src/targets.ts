import type { Targets } from "./diet";

export type Sex = "male" | "female";
export type Activity =
  "sedentary" | "light" | "moderate" | "active" | "athlete";
export type Goal = "cut" | "maintain" | "bulk" | "vegan";

export interface Body {
  sex: Sex;
  age: number;
  weightKg: number;
  heightCm: number;
  activity: Activity;
}

export const ACTIVITY_FACTOR: Record<Activity, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  athlete: 1.9,
};

/** Basal metabolic rate, Mifflin-St Jeor (kcal/day). */
export function bmr(b: Body): number {
  return (
    10 * b.weightKg +
    6.25 * b.heightCm -
    5 * b.age +
    (b.sex === "male" ? 5 : -161)
  );
}

/** Total daily energy expenditure (kcal/day). */
export function tdee(b: Body): number {
  return bmr(b) * ACTIVITY_FACTOR[b.activity];
}

const PRESETS: Record<
  Goal,
  { kcalFactor: number; proteinPerKg: number; label: string }
> = {
  cut: { kcalFactor: 0.8, proteinPerKg: 2.0, label: "Cut" },
  maintain: { kcalFactor: 1.0, proteinPerKg: 1.6, label: "Maintain" },
  bulk: { kcalFactor: 1.1, proteinPerKg: 1.8, label: "Bulk" },
  vegan: { kcalFactor: 1.0, proteinPerKg: 1.6, label: "Vegan maintain" },
};

export const GOALS = Object.keys(PRESETS) as Goal[];
export const goalLabel = (g: Goal): string => PRESETS[g].label;

const validate = (b: Body): void => {
  const ok =
    b.age >= 15 &&
    b.age <= 100 &&
    b.weightKg >= 30 &&
    b.weightKg <= 300 &&
    b.heightCm >= 120 &&
    b.heightCm <= 230;
  if (!ok) throw new RangeError("body stats out of supported range");
};

/** Nutrition targets for a goal. The vegan preset also needs `veganOnly` foods. */
export function presetTargets(goal: Goal, body: Body): Targets {
  validate(body);
  const p = PRESETS[goal];
  // Never plan below 1200 kcal, whatever the deficit says.
  const kcal = Math.max(
    1200,
    Math.round((tdee(body) * p.kcalFactor) / 10) * 10,
  );
  return {
    kcal: { min: Math.round(kcal * 0.97), max: Math.round(kcal * 1.03) },
    protein: { min: Math.round(p.proteinPerKg * body.weightKg) },
    fat: { min: Math.round((0.2 * kcal) / 9) },
    fiber: { min: Math.round((14 * kcal) / 1000) },
    sodium: { max: 2300 },
  };
}

export const isVeganOnly = (goal: Goal): boolean => goal === "vegan";
