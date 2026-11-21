import { describe, expect, it } from "vitest";
import { computePlan, defaultState } from "../src/model";
import { proteinPareto } from "../src/explain";
import { GOALS } from "../src/targets";

/** Median of repeated timings; the median shrugs off one-off CI hiccups. */
function medianMs(fn: () => void, runs: number): number {
  fn(); // warm up the JIT
  const times: number[] = [];
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    fn();
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  return times[Math.floor(runs / 2)]!;
}

describe("solver benchmark budget (enforced in CI via check.sh)", () => {
  it("solves a plan for every goal with median under 50 ms", () => {
    for (const goal of GOALS) {
      const state = { ...defaultState(), goal };
      let kind = "";
      const ms = medianMs(() => {
        kind = computePlan(state).kind;
      }, 15);
      expect(kind).toBe("ok");
      expect(ms, `${goal} median ${ms.toFixed(1)} ms`).toBeLessThan(50);
    }
  });

  it("computes the cost-vs-protein curve in under 2 s", () => {
    const out = computePlan(defaultState());
    if (out.kind !== "ok") throw new Error("expected ok");
    const t0 = performance.now();
    const curve = proteinPareto(out.foods, out.targets);
    const ms = performance.now() - t0;
    expect(curve.length).toBeGreaterThan(2);
    expect(ms).toBeLessThan(2000);
  });
});
