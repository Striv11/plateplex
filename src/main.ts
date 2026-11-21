import { FOODS } from "./dataset";
import {
  computePlan,
  defaultState,
  type AppState,
  type Outcome,
} from "./model";
import {
  ACTIVITY_FACTOR,
  GOALS,
  goalLabel,
  isVeganOnly,
  type Activity,
  type Goal,
  type Sex,
} from "./targets";
import { proteinPareto } from "./explain";
import { shoppingCsv, shoppingText } from "./schedule";
import {
  nextTheme,
  parseSaved,
  serializeSaved,
  shortcutAction,
  SHORTCUTS,
  STORAGE_KEY,
  type Saved,
  type Theme,
} from "./persist";
import { foodListHtml, paretoSvg, resultHtml } from "./view";

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el as T;
};

let state: AppState = defaultState();
let lastOutcome: Outcome | null = null;
const excluded = new Set<string>();

const form = $<HTMLFormElement>("targets");
const num = (name: string): number =>
  (form.elements.namedItem(name) as HTMLInputElement).valueAsNumber;
const val = (name: string): string =>
  (form.elements.namedItem(name) as HTMLInputElement).value;

$("goal").innerHTML = GOALS.map(
  (g) => `<option value="${g}">${goalLabel(g)}</option>`,
).join("");
$("activity").innerHTML = (Object.keys(ACTIVITY_FACTOR) as Activity[])
  .map(
    (a) =>
      `<option value="${a}"${a === "moderate" ? " selected" : ""}>${a}</option>`,
  )
  .join("");

let theme: Theme = "auto";

function applyTheme(): void {
  document.documentElement.dataset.theme = theme;
  $("theme-btn").textContent = `Theme: ${theme}`;
}

function setField(name: string, value: string | number): void {
  (form.elements.namedItem(name) as HTMLInputElement).value = String(value);
}

function restore(): void {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    /* storage blocked: run without persistence */
  }
  const s = parseSaved(raw);
  if (s.goal) setField("goal", s.goal);
  if (s.sex) setField("sex", s.sex);
  if (s.age !== undefined) setField("age", s.age);
  if (s.weight !== undefined) setField("weight", s.weight);
  if (s.height !== undefined) setField("height", s.height);
  if (s.activity) setField("activity", s.activity);
  if (s.budget !== undefined) setField("budget", s.budget);
  if (s.days !== undefined) setField("days", s.days);
  if (s.maxrepeat !== undefined) setField("maxrepeat", s.maxrepeat);
  if (s.practical !== undefined)
    (form.elements.namedItem("practical") as HTMLInputElement).checked =
      s.practical;
  for (const id of s.excluded ?? []) excluded.add(id);
  theme = s.theme ?? "auto";
}

function save(): void {
  const saved: Saved = {
    goal: state.goal,
    sex: state.body.sex,
    age: state.body.age,
    weight: state.body.weightKg,
    height: state.body.heightCm,
    activity: state.body.activity,
    budget: val("budget"),
    days: state.days ?? 1,
    maxrepeat: val("maxrepeat"),
    practical: state.practical ?? false,
    excluded: [...excluded],
    theme,
  };
  try {
    localStorage.setItem(STORAGE_KEY, serializeSaved(saved));
  } catch {
    /* quota or blocked storage: ignore */
  }
}

function readState(): AppState {
  const budgetRaw = val("budget").trim();
  return {
    body: {
      sex: val("sex") as Sex,
      age: num("age"),
      weightKg: num("weight"),
      heightCm: num("height"),
      activity: val("activity") as Activity,
    },
    goal: val("goal") as Goal,
    budget: budgetRaw === "" ? undefined : Number(budgetRaw),
    excluded,
    practical: (form.elements.namedItem("practical") as HTMLInputElement)
      .checked,
    days: num("days"),
    maxRepeat: val("maxrepeat").trim() === "" ? undefined : num("maxrepeat"),
  };
}

function render(): void {
  state = readState();
  $("foods").innerHTML = foodListHtml(FOODS, excluded, isVeganOnly(state.goal));
  const t0 = performance.now();
  const outcome = computePlan(state);
  const ms = performance.now() - t0;
  lastOutcome = outcome;
  $("result").innerHTML = resultHtml(outcome);
  $("pareto").innerHTML =
    outcome.kind === "ok"
      ? paretoSvg(proteinPareto(outcome.foods, outcome.targets))
      : "";
  $("timing").textContent = `Solved in ${ms.toFixed(1)} ms`;
  save();
}

form.addEventListener("input", render);
form.addEventListener("submit", (e) => e.preventDefault());
$("foods").addEventListener("change", (e) => {
  const box = e.target as HTMLInputElement;
  const id = box.dataset.food;
  if (!id) return;
  if (box.checked) excluded.delete(id);
  else excluded.add(id);
  render();
});
$("reset-foods").addEventListener("click", () => {
  excluded.clear();
  render();
});
$("result").addEventListener("click", (e) => {
  const id = (e.target as HTMLElement).id;
  const menu = lastOutcome?.kind === "ok" ? lastOutcome.menu : undefined;
  if (!menu) return;
  if (id === "copy-list")
    void navigator.clipboard?.writeText(shoppingText(menu.shopping));
  if (id === "download-csv") {
    const url = URL.createObjectURL(
      new Blob([shoppingCsv(menu.shopping)], { type: "text/csv" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "shopping-list.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
});
const help = $<HTMLDialogElement>("help");
$("help-list").innerHTML = SHORTCUTS.map(
  (s) => `<dt><kbd>${s.key}</kbd></dt><dd>${s.action}</dd>`,
).join("");
const toggleHelp = (): void => {
  if (help.open) help.close();
  else help.showModal();
};
const cycleTheme = (): void => {
  theme = nextTheme(theme);
  applyTheme();
  save();
};
$("help-btn").addEventListener("click", toggleHelp);
$("theme-btn").addEventListener("click", cycleTheme);
document.addEventListener("keydown", (e) => {
  const action = shortcutAction(e.key, e.target as HTMLElement | null, {
    ctrl: e.ctrlKey,
    meta: e.metaKey,
    alt: e.altKey,
  });
  if (!action) return;
  if (action === "close") {
    if (help.open) help.close();
    return;
  }
  e.preventDefault();
  if (action === "help") toggleHelp();
  else if (action === "theme") cycleTheme();
  else if (action === "budget") $("budget").focus();
  else if (action === "reset") {
    excluded.clear();
    render();
  } else if (
    action === "copy" &&
    lastOutcome?.kind === "ok" &&
    lastOutcome.menu
  )
    void navigator.clipboard?.writeText(
      shoppingText(lastOutcome.menu.shopping),
    );
});

restore();
applyTheme();
render();
