# Work log

Newest entries at the bottom. Each entry records what actually changed, what was learned, and what comes next.

## 2026-11-16 (Day 1)

- Chose the meal-planner LP idea (Stigler diet problem) from the Consumer apps backlog. The last two projects were Rust/WASM predictive-coding, so this changes both language and domain.
- Scaffolded Vite + TypeScript + vitest + eslint + prettier; `check.sh` runs format check, lint, typecheck, tests and build; CI and Pages workflows added.
- Wrote the two-phase simplex (`src/solver/simplex.ts`): `<=`, `>=`, `=`, upper bounds, infeasible/unbounded detection, Bland fallback, dual values.
- Tests: classic LPs, a Beale-style degenerate case, redundant equalities, shadow prices vs finite differences, and 60 random LPs against brute-force vertex enumeration. All pass.
- Added `planDiet` and a 10-food starter pantry, plus a text-only preview page.
- Learned: with zero-cost slack and artificial columns, a row's dual is just the negated reduced cost of its starting identity column, corrected for sign-flipped rows.
- Next: Day 2, the 60+ food dataset and target presets from body stats.

## 2026-11-17 (Day 2)

- Added `src/data/foods.json` (68 foods with aisle and vegan flags) and `src/dataset.ts`, which validates it on load with errors that name the offending food.
- Added `src/targets.ts`: Mifflin-St Jeor BMR, activity multipliers, and cut/maintain/bulk/vegan presets (kcal +/-3% band, protein per kg, fat >= 20% kcal, fiber 14 g/1000 kcal, sodium <= 2300 mg, 1200 kcal floor).
- Tests: schema rejection cases, 60+ foods, an Atwater energy sanity check on every food, hand-computed BMR, and every preset feasible for six varied bodies (vegan restricted to vegan foods).
- Learned: the first energy check failed on broccoli because listed carbs include fiber (~2 kcal/g, not 4). The check now models that instead of loosening the tolerance.
- Next: Day 3, the responsive UI (targets form, food toggles, plan table, empty/error/infeasible states, a 50 ms solve-time test).

## 2026-11-18 (Day 3)

- Built the responsive UI: targets form (goal, body stats, optional daily budget), food toggles grouped by aisle, plan table with per-food cost, and macro energy bars. Two-column layout on wide screens, single column on phones.
- Kept logic out of the DOM: `src/model.ts` (`computePlan` maps UI state to ok / over-budget / infeasible / error and never throws) and `src/view.ts` (pure HTML-string renderers with escaping). `src/main.ts` is only event wiring.
- Budget is checked after solving the min-cost LP: if the minimum exceeds the budget the UI says so and shows the minimum, which is more useful than a bare "infeasible".
- Tests (node, no DOM needed): 50 ms solve-time assertion, excluded foods never used, vegan restriction, empty/over-budget/infeasible states, HTML escaping, macro split sums to 100%.
- Learned: testing renderers as string functions avoids adding jsdom while still covering every UI state.
- Next: Day 4, "why this plan" from shadow prices, minimal-conflict infeasibility explanation (deletion filter), cost-vs-protein Pareto chart.

## 2026-11-19 (Day 4)

- Added `src/explain.ts`: shadow prices to sentences (one human-sized step per nutrient, sub-cent effects dropped, sorted by impact), a deletion-filter `minimalConflict` that names an irreducible set of infeasible target bounds, and `proteinPareto`, the minimum cost as the protein floor rises until infeasible.
- UI: "Why this plan" list, an inline SVG cost-vs-protein chart, and infeasible messages that name the conflicting targets. The Pareto sweep runs outside the timed solve so the 50 ms budget still measures one plan.
- Tests: explanation matches a finite-difference protein change; deletion filter returns exactly {kcal max, protein min} for a 400 g protein / 1500 kcal conflict and every proper subset is feasible; Pareto cost is non-decreasing and stops at infeasibility.
- Learned: my first conflict test was feasible (3000 kcal with low sodium is fine on this dataset); a hand-checkable conflict (protein kcal > kcal ceiling) makes a better test.
- Next: Day 5, practical portions via branch-and-bound, multi-day variety, shopping list by aisle.

## 2026-11-20 (Day 5)

- Added `src/portions.ts`: foods have natural units (egg 50 g, slice 30 g, 5 g spoonfuls for oils and sugar, 25 g steps otherwise). `planPortions` runs depth-first branch-and-bound on whole unit counts, branching on the most fractional variable, with a per-stage node limit (300). It first tries to meet targets exactly, then falls back to 2% slack and reports the actual `maxDeviation`.
- Added `src/schedule.ts`: `planDays` (greedy variety: each day is the cheapest plan over foods with days left under the max-days-per-food limit), `shoppingList` grouped by aisle with human amounts ("3 eggs (150 g)"), plain-text and CSV export.
- UI: days, max days per food and a practical-portions checkbox; per-day menus, shopping list, Copy and Download CSV buttons. Single-day continuous plans are unchanged.
- Tests: all 12 goal/body combinations give whole units within 2% and bounded cost versus the LP; hand-checkable integer optimum (3 eggs); node limit respected; variety limit never exceeded; variety costs at least the repeated-cheapest-day; shopping totals, aisles and CSV.
- Learned: the 300-node limit is hit on every realistic plan, so B&B acts as a good anytime heuristic rather than a proof of optimality (about 100-300 ms, so it is outside the 50 ms single-plan budget). A real MILP bound would need better incumbents or cuts.
- Next: Day 6, design system and dark theme, keyboard shortcuts, localStorage persistence, PWA, Playwright e2e, solver benchmark in CI.
