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
