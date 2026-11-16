import { describe, expect, it } from "vitest";
import { solve, type LinearProgram } from "../src/solver/simplex";

const near = (a: number, b: number, eps = 1e-6) =>
  expect(Math.abs(a - b)).toBeLessThan(eps);

describe("simplex", () => {
  it("solves a classic maximization (as min of negated cost)", () => {
    // max 3x + 5y s.t. x<=4, 2y<=12, 3x+2y<=18  => x=2, y=6, obj 36
    const lp: LinearProgram = {
      cost: [-3, -5],
      constraints: [
        { coeffs: [1, 0], rel: "<=", rhs: 4 },
        { coeffs: [0, 2], rel: "<=", rhs: 12 },
        { coeffs: [3, 2], rel: "<=", rhs: 18 },
      ],
    };
    const s = solve(lp);
    expect(s.status).toBe("optimal");
    near(s.x[0]!, 2);
    near(s.x[1]!, 6);
    near(s.objective, -36);
  });

  it("handles >= rows (diet problem)", () => {
    // min 2x + 3y s.t. x + y >= 4, x + 3y >= 6  => x=3, y=1, obj 9
    const s = solve({
      cost: [2, 3],
      constraints: [
        { coeffs: [1, 1], rel: ">=", rhs: 4 },
        { coeffs: [1, 3], rel: ">=", rhs: 6 },
      ],
    });
    expect(s.status).toBe("optimal");
    near(s.objective, 9);
    near(s.x[0]!, 3);
    near(s.x[1]!, 1);
  });

  it("handles equality rows", () => {
    const s = solve({
      cost: [1, 1],
      constraints: [{ coeffs: [1, 2], rel: "=", rhs: 6 }],
    });
    expect(s.status).toBe("optimal");
    near(s.objective, 3); // y=3, x=0
  });

  it("respects variable upper bounds", () => {
    // min -x - y with x<=1, y<=2 and x+y<=10
    const s = solve({
      cost: [-1, -1],
      constraints: [{ coeffs: [1, 1], rel: "<=", rhs: 10 }],
      upper: [1, 2],
    });
    near(s.objective, -3);
  });

  it("detects infeasibility", () => {
    const s = solve({
      cost: [1],
      constraints: [
        { coeffs: [1], rel: ">=", rhs: 5 },
        { coeffs: [1], rel: "<=", rhs: 3 },
      ],
    });
    expect(s.status).toBe("infeasible");
  });

  it("detects infeasibility caused by an upper bound", () => {
    const s = solve({
      cost: [1],
      constraints: [{ coeffs: [1], rel: ">=", rhs: 5 }],
      upper: [2],
    });
    expect(s.status).toBe("infeasible");
  });

  it("detects unboundedness", () => {
    const s = solve({
      cost: [-1, 0],
      constraints: [{ coeffs: [0, 1], rel: "<=", rhs: 1 }],
    });
    expect(s.status).toBe("unbounded");
  });

  it("normalizes negative right-hand sides", () => {
    // -x <= -2  (x >= 2), min x
    const s = solve({
      cost: [1],
      constraints: [{ coeffs: [-1], rel: "<=", rhs: -2 }],
    });
    expect(s.status).toBe("optimal");
    near(s.x[0]!, 2);
  });

  it("tolerates redundant equality rows", () => {
    const s = solve({
      cost: [1, 2],
      constraints: [
        { coeffs: [1, 1], rel: "=", rhs: 4 },
        { coeffs: [2, 2], rel: "=", rhs: 8 },
      ],
    });
    expect(s.status).toBe("optimal");
    near(s.objective, 4);
  });

  it("terminates on a degenerate problem (Beale-style cycling example)", () => {
    const s = solve({
      cost: [-0.75, 150, -0.02, 6],
      constraints: [
        { coeffs: [0.25, -60, -0.04, 9], rel: "<=", rhs: 0 },
        { coeffs: [0.5, -90, -0.02, 3], rel: "<=", rhs: 0 },
        { coeffs: [0, 0, 1, 0], rel: "<=", rhs: 1 },
      ],
    });
    expect(s.status).toBe("optimal");
    near(s.objective, -0.05);
  });

  it("reports shadow prices that match finite differences", () => {
    const base: LinearProgram = {
      cost: [2, 3],
      constraints: [
        { coeffs: [1, 1], rel: ">=", rhs: 4 },
        { coeffs: [1, 3], rel: ">=", rhs: 6 },
      ],
    };
    const s = solve(base);
    const bumped = solve({
      ...base,
      constraints: [
        base.constraints[0]!,
        { ...base.constraints[1]!, rhs: 6.001 },
      ],
    });
    near((bumped.objective - s.objective) / 0.001, s.duals[1]!, 1e-4);
    // First row is non-binding at optimum? Check consistency with its own bump.
    const bumped0 = solve({
      ...base,
      constraints: [
        { ...base.constraints[0]!, rhs: 4.001 },
        base.constraints[1]!,
      ],
    });
    near((bumped0.objective - s.objective) / 0.001, s.duals[0]!, 1e-4);
  });

  it("matches brute-force vertex enumeration on random small problems", () => {
    let seed = 12345;
    const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
    for (let t = 0; t < 60; t++) {
      const n = 3;
      const cost = Array.from({ length: n }, () => 1 + Math.floor(rnd() * 9));
      const constraints = Array.from({ length: 3 }, () => ({
        coeffs: Array.from({ length: n }, () => Math.floor(rnd() * 6)),
        rel: ">=" as const,
        rhs: 1 + Math.floor(rnd() * 10),
      }));
      const upper = [8, 8, 8];
      const s = solve({ cost, constraints, upper });
      const best = bruteForce(cost, constraints, upper);
      if (best === null) expect(s.status).toBe("infeasible");
      else {
        expect(s.status).toBe("optimal");
        near(s.objective, best, 1e-6);
      }
    }
  });
});

/** Enumerate all vertices by choosing n active constraints among rows+bounds. */
function bruteForce(
  cost: number[],
  cons: { coeffs: number[]; rel: ">="; rhs: number }[],
  upper: number[],
): number | null {
  const n = cost.length;
  const planes: { a: number[]; b: number }[] = [];
  cons.forEach((c) => planes.push({ a: c.coeffs, b: c.rhs }));
  for (let j = 0; j < n; j++) {
    const e = new Array<number>(n).fill(0);
    e[j] = 1;
    planes.push({ a: e, b: 0 });
    planes.push({ a: e, b: upper[j]! });
  }
  let best: number | null = null;
  const idx = [0, 0, 0];
  const pick = (start: number, k: number) => {
    if (k === n) {
      const x = gauss(
        idx.map((i) => planes[i]!.a),
        idx.map((i) => planes[i]!.b),
      );
      if (!x) return;
      if (x.some((v, j) => v < -1e-7 || v > upper[j]! + 1e-7)) return;
      if (
        cons.some(
          (c) => c.coeffs.reduce((s, v, j) => s + v * x[j]!, 0) < c.rhs - 1e-7,
        )
      )
        return;
      const obj = cost.reduce((s, v, j) => s + v * x[j]!, 0);
      if (best === null || obj < best) best = obj;
      return;
    }
    for (let i = start; i < planes.length; i++) {
      idx[k] = i;
      pick(i + 1, k + 1);
    }
  };
  pick(0, 0);
  return best;
}

function gauss(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((r, i) => [...r, b[i]!]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++)
      if (Math.abs(M[r]![c]!) > Math.abs(M[p]![c]!)) p = r;
    if (Math.abs(M[p]![c]!) < 1e-9) return null;
    [M[c], M[p]] = [M[p]!, M[c]!];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r]![c]! / M[c]![c]!;
      for (let j = c; j <= n; j++) M[r]![j]! -= f * M[c]![j]!;
    }
  }
  return M.map((r, i) => r[n]! / r[i]!);
}
