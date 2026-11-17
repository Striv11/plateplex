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
