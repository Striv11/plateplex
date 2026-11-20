import { AISLES, type CatalogFood } from "./dataset";
import type { ParetoPoint } from "./explain";
import type { Menu, Outcome } from "./model";
import { describeAmount } from "./portions";

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
      if (o.menu)
        return menuHtml(
          o.menu,
          o.foods,
          o.why.map((e) => e.text),
        );
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
        `<div class="bars">${macroBars(macroSplit(t))}</div>` +
        whyHtml(o.why.map((e) => e.text))
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

/** "Why this plan" list from shadow-price sentences. */
export function whyHtml(lines: string[]): string {
  if (lines.length === 0) return "";
  return (
    `<h3>Why this plan</h3><ul class="why">` +
    lines.map((l) => `<li>${escapeHtml(l)}</li>`).join("") +
    `</ul>`
  );
}

/** Inline SVG of minimum cost against protein floor; "" if under 2 points. */
export function paretoSvg(points: ParetoPoint[]): string {
  if (points.length < 2) return "";
  const W = 320,
    H = 140,
    pad = 28;
  const xs = points.map((p) => p.protein);
  const ys = points.map((p) => p.cost);
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
  const [y0, y1] = [Math.min(...ys), Math.max(...ys)];
  const sx = (x: number) => pad + ((x - x0) / (x1 - x0 || 1)) * (W - 2 * pad);
  const sy = (y: number) =>
    H - pad - ((y - y0) / (y1 - y0 || 1)) * (H - 2 * pad);
  const path = points
    .map((p) => `${sx(p.protein).toFixed(1)},${sy(p.cost).toFixed(1)}`)
    .join(" ");
  return (
    `<h3>Cost vs protein</h3>` +
    `<svg class="pareto" viewBox="0 0 ${W} ${H}" role="img" aria-label="Minimum daily cost rises from ${money(y0)} at ${x0} g protein to ${money(y1)} at ${x1} g">` +
    `<polyline fill="none" stroke="currentColor" stroke-width="2" points="${path}"/>` +
    `<text x="${pad}" y="${H - 8}" font-size="10">${x0} g</text>` +
    `<text x="${W - pad}" y="${H - 8}" font-size="10" text-anchor="end">${x1} g protein</text>` +
    `<text x="2" y="${pad}" font-size="10">${money(y1)}</text>` +
    `<text x="2" y="${H - pad}" font-size="10">${money(y0)}</text></svg>`
  );
}

/** Whole-unit and/or multi-day result: per-day menus, then the shopping list. */
export function menuHtml(
  menu: Menu,
  foods: CatalogFood[],
  why: string[],
): string {
  const s = menu.schedule;
  const name = (id: string) => foods.find((f) => f.id === id)?.name ?? id;
  const days = s.days
    .map((d, i) => {
      const items = Object.entries(d.grams)
        .sort((a, b) => b[1] - a[1])
        .map(
          ([id, g]) =>
            `<li>${escapeHtml(name(id))}: ${escapeHtml(describeAmount(id, g))}</li>`,
        )
        .join("");
      return (
        `<details${s.days.length === 1 ? " open" : ""}><summary>Day ${i + 1} · ${money(d.cost)} · ` +
        `${Math.round(d.totals.kcal)} kcal · ${Math.round(d.totals.protein)} g protein</summary>` +
        `<ul class="day">${items}</ul></details>`
      );
    })
    .join("");
  if (s.status === "infeasible")
    return (
      `<p class="notice warn" role="alert">Day ${s.failedDay} cannot meet your targets with these variety limits. ` +
      `Allow more days per food or re-enable foods.</p>` +
      days
    );
  const shop = menu.shopping
    .map(
      (g) =>
        `<h4>${escapeHtml(g.aisle)}</h4><ul class="shop">` +
        g.items
          .map((i) => `<li>${escapeHtml(i.name)}: ${escapeHtml(i.amount)}</li>`)
          .join("") +
        `</ul>`,
    )
    .join("");
  return (
    `<p class="summary"><strong>${money(s.totalCost)}</strong> for ${s.days.length} day${s.days.length === 1 ? "" : "s"} · ` +
    `${money(s.totalCost / s.days.length)} per day</p>` +
    days +
    `<h3>Shopping list</h3>` +
    `<p class="actions"><button type="button" id="copy-list">Copy list</button> ` +
    `<button type="button" id="download-csv">Download CSV</button></p>` +
    shop +
    whyHtml(why)
  );
}
