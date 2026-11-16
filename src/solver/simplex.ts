/**
 * Dense two-phase simplex for problems of the form
 *
 *   minimize    c·x
 *   subject to  a_i·x {<=, >=, =} b_i
 *               0 <= x_j <= ub_j   (ub_j may be Infinity)
 *
 * Variable upper bounds are turned into ordinary rows. Pivoting uses Dantzig's
 * rule and switches to Bland's rule after a run of degenerate pivots, which
 * guarantees termination. Besides the primal solution we return the dual
 * values (shadow prices) of the user constraints.
 */

export type Relation = "<=" | ">=" | "=";

export interface Constraint {
  /** Dense coefficients, one per variable. */
  coeffs: number[];
  rel: Relation;
  rhs: number;
}

export interface LinearProgram {
  /** Objective coefficients (minimized). */
  cost: number[];
  constraints: Constraint[];
  /** Per-variable upper bounds; defaults to Infinity. */
  upper?: number[];
}

export type SolveStatus = "optimal" | "infeasible" | "unbounded";

export interface Solution {
  status: SolveStatus;
  x: number[];
  objective: number;
  /**
   * Shadow price of each user constraint: d(objective)/d(rhs). Positive means
   * relaxing the right-hand side upward would raise the cost.
   */
  duals: number[];
  iterations: number;
}

const EPS = 1e-9;

export function solve(lp: LinearProgram): Solution {
  const n = lp.cost.length;
  const upper = lp.upper ?? [];
  for (const c of lp.constraints) {
    if (c.coeffs.length !== n)
      throw new Error("constraint width does not match cost vector");
  }

  // Expand bounds into rows. User rows come first so duals map 1:1.
  const rows: Constraint[] = lp.constraints.map((c) => ({ ...c }));
  const userRows = rows.length;
  for (let j = 0; j < n; j++) {
    const ub = upper[j] ?? Infinity;
    if (ub < 0) return infeasible(n, userRows);
    if (Number.isFinite(ub)) {
      const coeffs = new Array<number>(n).fill(0);
      coeffs[j] = 1;
      rows.push({ coeffs, rel: "<=", rhs: ub });
    }
  }

  const m = rows.length;
  // Normalize so every rhs >= 0, remembering sign flips for the duals.
  const flip: number[] = [];
  const norm = rows.map((r, i) => {
    if (r.rhs < 0) {
      flip[i] = -1;
      return {
        coeffs: r.coeffs.map((v) => -v),
        rel: (r.rel === "<=" ? ">=" : r.rel === ">=" ? "<=" : "=") as Relation,
        rhs: -r.rhs,
      };
    }
    flip[i] = 1;
    return r;
  });

  // Column layout: [structural n | slack/surplus | artificial | rhs]
  let slackCount = 0;
  let artCount = 0;
  for (const r of norm) {
    if (r.rel !== "=") slackCount++;
    if (r.rel !== "<=") artCount++;
  }
  const total = n + slackCount + artCount;
  const rhsCol = total;
  const T: number[][] = [];
  const basis: number[] = new Array<number>(m);
  /** Column that starts as the identity column for each row (slack or artificial). */
  const identityCol: number[] = new Array<number>(m);
  let s = n;
  let a = n + slackCount;
  norm.forEach((r, i) => {
    const row = new Array<number>(total + 1).fill(0);
    r.coeffs.forEach((v, j) => (row[j] = v));
    row[rhsCol] = r.rhs;
    if (r.rel === "<=") {
      row[s] = 1;
      basis[i] = s;
      identityCol[i] = s;
      s++;
    } else if (r.rel === ">=") {
      row[s] = -1;
      s++;
      row[a] = 1;
      basis[i] = a;
      identityCol[i] = a;
      a++;
    } else {
      row[a] = 1;
      basis[i] = a;
      identityCol[i] = a;
      a++;
    }
    T.push(row);
  });

  let iterations = 0;
  const artStart = n + slackCount;

  function run(obj: number[], allowed: number): "optimal" | "unbounded" {
    // obj is the reduced-cost row (length total+1); we minimize.
    let degenerate = 0;
    for (;;) {
      let enter = -1;
      const bland = degenerate > 50;
      let best = -EPS;
      for (let j = 0; j < allowed; j++) {
        const rc = obj[j] as number;
        if (rc < -EPS) {
          if (bland) {
            enter = j;
            break;
          }
          if (rc < best) {
            best = rc;
            enter = j;
          }
        }
      }
      if (enter < 0) return "optimal";
      let leave = -1;
      let minRatio = Infinity;
      for (let i = 0; i < m; i++) {
        const row = T[i] as number[];
        const piv = row[enter] as number;
        if (piv > EPS) {
          const ratio = (row[rhsCol] as number) / piv;
          if (
            ratio < minRatio - EPS ||
            (bland &&
              Math.abs(ratio - minRatio) <= EPS &&
              leave >= 0 &&
              (basis[i] as number) < (basis[leave] as number))
          ) {
            minRatio = ratio;
            leave = i;
          }
        }
      }
      if (leave < 0) return "unbounded";
      degenerate = minRatio < EPS ? degenerate + 1 : 0;
      pivot(leave, enter, obj);
      iterations++;
      if (iterations > 50_000)
        throw new Error("simplex iteration limit exceeded");
    }
  }

  function pivot(r: number, c: number, obj: number[]): void {
    const prow = T[r] as number[];
    const pv = prow[c] as number;
    for (let j = 0; j <= total; j++) prow[j] = (prow[j] as number) / pv;
    for (let i = 0; i < m; i++) {
      if (i === r) continue;
      const row = T[i] as number[];
      const f = row[c] as number;
      if (Math.abs(f) > 0)
        for (let j = 0; j <= total; j++)
          row[j] = (row[j] as number) - f * (prow[j] as number);
    }
    const f = obj[c] as number;
    if (Math.abs(f) > 0)
      for (let j = 0; j <= total; j++)
        obj[j] = (obj[j] as number) - f * (prow[j] as number);
    basis[r] = c;
  }

  // Phase 1: minimize the sum of artificials.
  if (artCount > 0) {
    const obj1 = new Array<number>(total + 1).fill(0);
    for (let j = artStart; j < total; j++) obj1[j] = 1;
    for (let i = 0; i < m; i++) {
      if ((basis[i] as number) >= artStart) {
        const row = T[i] as number[];
        for (let j = 0; j <= total; j++)
          obj1[j] = (obj1[j] as number) - (row[j] as number);
      }
    }
    run(obj1, total);
    if (-(obj1[rhsCol] as number) > 1e-7)
      return infeasible(n, userRows, iterations);
    // Drive remaining (zero-level) artificials out of the basis.
    for (let i = 0; i < m; i++) {
      if ((basis[i] as number) >= artStart) {
        const row = T[i] as number[];
        let col = -1;
        for (let j = 0; j < artStart; j++) {
          if (Math.abs(row[j] as number) > 1e-7) {
            col = j;
            break;
          }
        }
        if (col >= 0) pivot(i, col, obj1);
        // else: redundant row; the artificial stays at zero and is never entered.
      }
    }
  }

  // Phase 2: real objective, artificials excluded from entering.
  const obj2 = new Array<number>(total + 1).fill(0);
  lp.cost.forEach((v, j) => (obj2[j] = v));
  for (let i = 0; i < m; i++) {
    const cb = obj2[basis[i] as number] as number;
    if (Math.abs(cb) > 0) {
      const row = T[i] as number[];
      for (let j = 0; j <= total; j++)
        obj2[j] = (obj2[j] as number) - cb * (row[j] as number);
    }
  }
  const status = run(obj2, artStart);
  if (status === "unbounded") {
    return {
      status,
      x: new Array<number>(n).fill(0),
      objective: -Infinity,
      duals: new Array<number>(userRows).fill(0),
      iterations,
    };
  }

  const x = new Array<number>(n).fill(0);
  for (let i = 0; i < m; i++) {
    const b = basis[i] as number;
    if (b < n) x[b] = Math.max(0, (T[i] as number[])[rhsCol] as number);
  }
  // Dual of row i = c_B B^-1 e_i, read from the reduced cost of its identity column:
  // reduced_cost(identity col) = cost(col) - y_i, and artificial/slack costs are 0.
  const duals: number[] = [];
  for (let i = 0; i < userRows; i++) {
    const col = identityCol[i] as number;
    const rc = obj2[col] as number;
    // Slack and artificial columns have zero cost, so y = -reduced_cost for every row type.
    const y = -rc * (flip[i] as number);
    duals.push(Math.abs(y) < 1e-10 ? 0 : y);
  }
  const objective = lp.cost.reduce(
    (acc, c, j) => acc + c * (x[j] as number),
    0,
  );
  return { status: "optimal", x, objective, duals, iterations };
}

function infeasible(n: number, userRows: number, iterations = 0): Solution {
  return {
    status: "infeasible",
    x: new Array<number>(n).fill(0),
    objective: NaN,
    duals: new Array<number>(userRows).fill(0),
    iterations,
  };
}
