# Plan

Seven-day arc. Every milestone has acceptance criteria that can be checked by a test or a command.

| Day | Milestone                    | Acceptance criteria                                                                                                                                                                                                                                              | Status |
| --- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1   | Simplex core + diet model    | Two-phase simplex handles `<=`, `>=`, `=`, bounds; detects infeasible/unbounded; survives a Beale cycling case; shadow prices match finite differences; 60 random LPs match brute-force vertex enumeration; `planDiet` meets all ranges; `bash check.sh` passes. | [x]    |
| 2   | Food database + targets      | 60+ foods in a typed JSON dataset with schema validation test; presets (cut/maintain/bulk/vegan) computed from age, weight, height, activity (Mifflin-St Jeor) with unit tests; every preset is feasible on the dataset.                                         | [x]    |
| 3   | Core UI                      | Responsive Vite UI: targets form, budget, food list with include/exclude toggles, plan table with cost and macro bars; empty state; error and infeasible states; plan recomputes in under 50 ms (asserted in a test).                                            | [x]    |
| 4   | Explain and trade-offs       | "Why this plan" panel from shadow prices ("+10 g protein costs $0.18"); infeasibility explanation naming the minimal conflicting targets (deletion filter, tested); cost-vs-protein Pareto curve chart.                                                          | [x]    |
| 5   | Practical portions + days    | Round to real units (eggs, slices, 25 g steps) via branch-and-bound with a node limit; rounding keeps targets within 2% (tested); multi-day variety constraint (max N days per food); shopping list grouped by aisle, copy/export.                               | [ ]    |
| 6   | Design system, PWA, e2e      | Light/dark theme, type scale, keyboard shortcuts (`?` overlay), persisted state in localStorage, installable offline PWA, Playwright e2e covering the core flows; solver benchmark with a budget enforced in CI.                                                 | [ ]    |
| 7   | Polish, screenshots, release | README screenshots and live link, landing section, accessibility pass (axe in e2e), custom food editor, v0.1.0 changelog; Pages deployment verified.                                                                                                             | [ ]    |

## Stretch

- Micronutrient targets and a "variety" objective (minimize deviation from preferred foods).
- Import prices from CSV (receipts or store exports).
- Revised simplex with sparse LU for larger food databases.
