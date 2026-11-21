import type { Activity, Goal, Sex } from "./targets";
import { ACTIVITY_FACTOR, GOALS } from "./targets";

/** Form values as stored; raw strings for optional inputs so blanks round-trip. */
export interface Saved {
  goal: Goal;
  sex: Sex;
  age: number;
  weight: number;
  height: number;
  activity: Activity;
  budget: string;
  days: number;
  maxrepeat: string;
  practical: boolean;
  excluded: string[];
  theme: Theme;
}

export type Theme = "light" | "dark" | "auto";
export const STORAGE_KEY = "plateplex:v1";

const isNum = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === "string";

/**
 * Parse stored JSON defensively: anything missing or of the wrong type is
 * dropped, so corrupt or old storage never breaks the app.
 */
export function parseSaved(raw: string | null): Partial<Saved> {
  if (!raw) return {};
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return {};
  }
  if (typeof data !== "object" || data === null || Array.isArray(data))
    return {};
  const d = data as Record<string, unknown>;
  const out: Partial<Saved> = {};
  if (isStr(d.goal) && (GOALS as readonly string[]).includes(d.goal))
    out.goal = d.goal as Goal;
  if (d.sex === "male" || d.sex === "female") out.sex = d.sex;
  if (isNum(d.age)) out.age = d.age;
  if (isNum(d.weight)) out.weight = d.weight;
  if (isNum(d.height)) out.height = d.height;
  if (isStr(d.activity) && d.activity in ACTIVITY_FACTOR)
    out.activity = d.activity as Activity;
  if (isStr(d.budget)) out.budget = d.budget;
  if (isNum(d.days)) out.days = d.days;
  if (isStr(d.maxrepeat)) out.maxrepeat = d.maxrepeat;
  if (typeof d.practical === "boolean") out.practical = d.practical;
  if (Array.isArray(d.excluded))
    out.excluded = d.excluded.filter(isStr).slice(0, 1000);
  if (d.theme === "light" || d.theme === "dark" || d.theme === "auto")
    out.theme = d.theme;
  return out;
}

export function serializeSaved(s: Saved): string {
  return JSON.stringify(s);
}

const NEXT: Record<Theme, Theme> = {
  auto: "light",
  light: "dark",
  dark: "auto",
};
export const nextTheme = (t: Theme): Theme => NEXT[t];

/** Keyboard shortcuts shown in the `?` overlay and handled in main.ts. */
export const SHORTCUTS: { key: string; action: string }[] = [
  { key: "?", action: "Show or hide this help" },
  { key: "t", action: "Cycle theme (auto, light, dark)" },
  { key: "/", action: "Focus the budget field" },
  { key: "r", action: "Include all foods" },
  { key: "c", action: "Copy the shopping list" },
  { key: "Esc", action: "Close this help" },
];

/** Map a key press to an action name; ignores typing inside form fields. */
export function shortcutAction(
  key: string,
  target: { tagName?: string } | null,
  mods: { ctrl?: boolean; meta?: boolean; alt?: boolean } = {},
): "help" | "theme" | "budget" | "reset" | "copy" | "close" | null {
  if (mods.ctrl || mods.meta || mods.alt) return null;
  if (key === "Escape") return "close";
  const tag = target?.tagName?.toUpperCase();
  if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return null;
  switch (key) {
    case "?":
      return "help";
    case "t":
      return "theme";
    case "/":
      return "budget";
    case "r":
      return "reset";
    case "c":
      return "copy";
    default:
      return null;
  }
}
