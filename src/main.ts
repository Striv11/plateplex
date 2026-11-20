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
render();
