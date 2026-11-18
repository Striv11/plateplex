import { AISLES, type CatalogFood } from "./dataset";
import type { Outcome } from "./model";

export const escapeHtml = (s: string): string =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ] as string,
  );

export const money = (n: number): string => `$${n.toFixed(2)}`;

/** Share of energy from protein, carbs (net of fiber) and fat, as percentages. */
export function macroSplit(t: {
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}): { protein: number; carbs: number; fat: number } {
  const p = t.protein * 4;
  const c = Math.max(0, t.carbs - t.fiber) * 4 + t.fiber * 2;
  const f = t.fat * 9;
  const total = p + c + f || 1;
  return {
    protein: (p / total) * 100,
    carbs: (c / total) * 100,
    fat: (f / total) * 100,
  };
}

function macroBars(split: { protein: number; carbs: number; fat: number }) {
  const row = (label: string, cls: string, pct: number) =>
    `<div class="bar-row"><span class="bar-label">${label}</span>` +
    `<div class="bar" role="img" aria-label="${label} ${pct.toFixed(0)}% of energy">` +
    `<div class="bar-fill ${cls}" style="width:${pct.toFixed(1)}%"></div></div>` +
    `<span class="bar-value">${pct.toFixed(0)}%</span></div>`;
  return (
    row("Protein", "protein", split.protein) +
    row("Carbs", "carbs", split.carbs) +
    row("Fat", "fat", split.fat)
  );
}

/** HTML for the result panel for any outcome (all dynamic text escaped). */
export function resultHtml(o: Outcome | null): string {
  if (!o)
    return `<p class="empty">Enter your details to see the cheapest plan that meets your targets.</p>`;
  switch (o.kind) {
    case "error":
      return `<p class="notice error" role="alert">${escapeHtml(o.message)}</p>`;
    case "infeasible":
      return `<p class="notice error" role="alert">${escapeHtml(o.reason)}</p>`;
    case "over-budget":
      return (
        `<p class="notice warn" role="alert">The cheapest plan that meets your targets costs ` +
        `<strong>${money(o.minCost)}</strong> per day, over your ${money(o.budget)} budget. ` +
        `Raise the budget, or re-enable foods you have switched off.</p>`
      );
    case "ok": {
      const rows = o.foods
        .filter((f) => o.plan.grams[f.id])
        .map((f) => ({ f, g: o.plan.grams[f.id] ?? 0 }))
        .sort((a, b) => b.g * b.f.price - a.g * a.f.price)
        .map(
          ({ f, g }) =>
            `<tr><th scope="row">${escapeHtml(f.name)}</th>` +
            `<td>${Math.round(g)} g</td><td>${money((g * f.price) / 100)}</td></tr>`,
        )
        .join("");
      const t = o.plan.totals;
      return (
        `<p class="summary"><strong>${money(o.plan.cost)}</strong> per day · ` +
        `${Math.round(t.kcal)} kcal · ${Math.round(t.protein)} g protein · ` +
        `${Math.round(t.fiber)} g fiber · ${Math.round(t.sodium)} mg sodium</p>` +
        `<table><thead><tr><th>Food</th><th>Amount</th><th>Cost</th></tr></thead><tbody>${rows}</tbody></table>` +
        `<div class="bars">${macroBars(macroSplit(t))}</div>`
      );
    }
  }
}

/** Food toggles grouped by aisle. `disabled` marks foods the goal rules out. */
export function foodListHtml(
  foods: CatalogFood[],
  excluded: ReadonlySet<string>,
  veganOnly: boolean,
): string {
  return AISLES.map((aisle) => {
    const items = foods.filter((f) => f.aisle === aisle);
    if (items.length === 0) return "";
    const boxes = items
      .map((f) => {
        const blocked = veganOnly && !f.vegan;
        const checked = !excluded.has(f.id) && !blocked;
        return (
          `<label class="food${blocked ? " blocked" : ""}">` +
          `<input type="checkbox" data-food="${escapeHtml(f.id)}"${checked ? " checked" : ""}${blocked ? " disabled" : ""}> ` +
          `${escapeHtml(f.name)}</label>`
        );
      })
      .join("");
    return `<fieldset><legend>${escapeHtml(aisle)}</legend>${boxes}</fieldset>`;
  }).join("");
}
