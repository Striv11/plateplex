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

**Status: planned for the UI (Day 3).** Today, `npm run dev` shows a preview that solves a sodium-capped day from the 68-food dataset (Mifflin-St Jeor "maintain" preset for an 80 kg, 180 cm, 30-year-old) and prints the cheapest plan. `npm test` runs the solver against brute-force vertex enumeration.

## Design decisions & trade-offs

- **Dense tableau, not revised simplex.** A few hundred foods fit comfortably; clarity and testability win for v1.
- **Bounds as rows.** Simpler than bounded-variable simplex, slightly bigger tableau.
- **Bland's rule fallback** after 50 degenerate pivots: Dantzig speed normally, guaranteed termination.
- **Food data is approximate** and prices illustrative. This is not medical advice.

## Roadmap

See [PLAN.md](PLAN.md) for the day-by-day arc.

- [x] Simplex core, diet model, tests
- [x] Food dataset (68 foods) and target presets (cut/maintain/bulk/vegan)
- [ ] Responsive UI
- [ ] Explanations from shadow prices
- [ ] Practical portions, multi-day plans, shopping list
- [ ] PWA, e2e tests, benchmarks
- [ ] Screenshots and release

## License

MIT. See [LICENSE](LICENSE).
