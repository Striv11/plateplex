# plateplex

> Tell it your nutrition targets and your budget; it solves the cheapest daily meal plan, on your device, with a simplex solver written from scratch.

**Live demo:** https://striv11.github.io/plateplex/ (planned; deploys via GitHub Pages once the UI is built)

![CI](https://github.com/Striv11/plateplex/actions/workflows/ci.yml/badge.svg)

## Problem

Eating well on a budget is a constrained optimization problem: hit calories, protein and fiber, stay under sodium, and spend as little as possible. People solve it by guesswork. Meal-planning apps either ignore cost or send your data to a server and give no explanation of the trade-offs.

## Motivation

This is George Stigler's 1945 diet problem, a founding example of linear programming. Building it from scratch explores:

- a two-phase simplex implementation (bounds, equality rows, redundant rows, degeneracy and anti-cycling),
- reading **dual values** as shadow prices, so the app can explain "protein is what makes this plan expensive",
- integer rounding to real portions with branch-and-bound,
- a fully client-side product: no accounts, no API keys, no data leaving the device.

## Architecture

```
 targets + budget + foods
          │
          ▼
  diet.ts  ── builds LP: min price·x  s.t. nutrient ranges, 0 ≤ x ≤ max grams
          │
          ▼
  solver/simplex.ts ── two-phase tableau simplex (Dantzig, Bland fallback)
          │
          ▼
  plan: grams per food, cost, totals, shadow prices
          │
          ▼
  UI (Vite + TypeScript, static build on GitHub Pages)
```

Invariants: a solution returned as `optimal` satisfies every constraint within 1e-6; duals equal finite-difference cost changes; the solver is pure and deterministic.

## Setup

Prerequisites: Node 22+.

```bash
npm ci
npm run dev        # local dev server
bash check.sh      # format check, lint, typecheck, tests, build
```

## Demo

`npm run dev` opens the UI: pick a goal and body stats, optionally set a daily budget, toggle foods on or off, and the cheapest plan (table, cost, macro bars) recomputes on every change in a few milliseconds. A "Why this plan" panel turns shadow prices into sentences ("+10 g of protein costs $0.18 more per day"), a cost-vs-protein curve shows the price of a higher protein floor, and infeasible targets name the minimal conflicting bounds. "Practical portions" rounds to whole eggs, slices and 25 g steps with branch-and-bound; planning several days with a max-days-per-food limit produces per-day menus and an aisle-grouped shopping list you can copy or download as CSV. Settings and excluded foods persist in localStorage; `t` cycles the theme and `?` lists shortcuts. Empty, invalid-input, infeasible and over-budget states each get their own message. `npm test` also runs the solver against brute-force vertex enumeration.

## Design decisions & trade-offs

- **Dense tableau, not revised simplex.** A few hundred foods fit comfortably; clarity and testability win for v1.
- **Bounds as rows.** Simpler than bounded-variable simplex, slightly bigger tableau.
- **Branch-and-bound for portions.** Depth-first over unit counts with a node limit; tries exact targets first, then allows 2% slack, and reports the deviation it used. Plans cost a few percent more than the continuous optimum.
- **Greedy variety.** "At most N days per food" is planned day by day over foods with days left, a heuristic rather than a MILP; a late day can fail where a global assignment would not, and the UI names that day.
- **Bland's rule fallback** after 50 degenerate pivots: Dantzig speed normally, guaranteed termination.
- **Food data is approximate** and prices illustrative. This is not medical advice.

## Roadmap

See [PLAN.md](PLAN.md) for the day-by-day arc.

- [x] Simplex core, diet model, tests
- [x] Food dataset (68 foods) and target presets (cut/maintain/bulk/vegan)
- [x] Responsive UI
- [x] Explanations from shadow prices, infeasibility diagnosis, cost-vs-protein curve
- [x] Practical portions, multi-day plans, shopping list
- [x] Dark theme, shortcuts (`?`), saved state, benchmark budget in CI
- [ ] PWA, e2e tests
- [ ] Screenshots and release

## License

MIT. See [LICENSE](LICENSE).
