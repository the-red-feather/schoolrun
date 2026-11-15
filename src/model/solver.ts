/**
 * Finding a plan: greedy insertion (pickups by ready time, each where it adds
 * least), then simulated annealing (random moves, worse ones accepted less
 * and less). In steps, so the page can spread it over frames and show it
 * getting better. Seeded: the same day solves the same way.
 */
import type { DayModel } from "./day";
import { schedule, type Job, type Plan, type Result } from "./schedule";

/** mulberry32: small, seeded. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
type Rand = () => number;
const pick = <T>(a: T[], r: Rand): T => a[Math.floor(r() * a.length)]!;

const clone = (p: Plan): Plan => p.map((b) => b.map((r) => r.map((j) => ({ ...j }))));
const tidy = (p: Plan): Plan => p.map((b) => b.map((r) => r.filter((j) => j.n > 0)).filter((r) => r.length));

/** Everyone exactly once: per job, the plan's people add up to the day's. */
export function covers(dm: DayModel, plan: Plan): boolean {
  if (plan.length !== dm.crew.length) return false;
  const got = new Map<string, number>();
  for (const b of plan) for (const r of b) for (const j of r) got.set(j.key, (got.get(j.key) ?? 0) + j.n);
  for (const [k, n] of got) if (dm.jobs.get(k)?.total !== n) return false;
  for (const j of dm.jobs.values()) if (got.get(j.key) !== j.total) return false;
  return true;
}

/**
 * A plan made for a slightly different day, made to fit this one: runs follow
 * their vehicle, pickups that are gone are dropped, counts trimmed or topped
 * up, new pickups left for greedy. Null if nothing's left of it.
 */
export function repair(dm: DayModel, plan: Plan, vehicles: string[]): Plan | null {
  const out: Plan = dm.crew.map((c) => {
    const i = vehicles.indexOf(c.vehicle.id);
    return i >= 0 && plan[i] ? clone([plan[i]!])[0]! : [];
  });
  const got = new Map<string, number>();
  for (const b of out)
    for (const r of b)
      for (const j of r) {
        const job = dm.jobs.get(j.key);
        if (!job) {
          j.n = 0;
          continue;
        }
        const have = got.get(j.key) ?? 0;
        j.n = Math.max(0, Math.min(j.n, job.total - have));
        got.set(j.key, have + j.n);
      }
  const p = tidy(out);
  // top up groups that grew, on the piece that has them
  for (const job of dm.jobs.values()) {
    const have = got.get(job.key) ?? 0;
    if (have > 0 && have < job.total) {
      const piece = p.flat(2).find((j) => j.key === job.key);
      if (piece) piece.n += job.total - have;
    }
  }
  return p.some((b) => b.length) ? p : null;
}

/** Put what's missing where it adds least: any position of any run, or a new run. */
export function insertMissing(dm: DayModel, start: Plan): Plan {
  let plan = clone(start);
  if (!dm.crew.length) return plan;
  const have = new Map<string, number>();
  for (const b of plan) for (const r of b) for (const j of r) have.set(j.key, (have.get(j.key) ?? 0) + j.n);
  const big = Math.max(...dm.crew.map((c) => c.vehicle.seats));
  const todo = [...dm.jobs.values()].filter((j) => (have.get(j.key) ?? 0) < j.total).sort((a, b) => a.ready - b.ready || b.total - a.total);
  for (const job of todo) {
    const left = job.total - (have.get(job.key) ?? 0);
    const cap = Math.max(1, big - (job.escort ? 1 : 0));
    // even pieces: 13 for 8 seats goes as 7 + 6, not 8 + 5
    const pieces = Math.ceil(left / cap);
    const sizes = Array.from({ length: pieces }, (_, i) => Math.floor(left / pieces) + (i < left % pieces ? 1 : 0));
    for (const k of sizes) {
      let best: Plan | null = null;
      let bestCost = Infinity;
      plan.forEach((runs, bi) => {
        for (let ri = 0; ri <= runs.length; ri++) {
          const positions = ri === runs.length ? 1 : runs[ri]!.length + 1;
          for (let pos = 0; pos < positions; pos++) {
            const p = clone(plan);
            if (ri === runs.length) p[bi]!.push([{ key: job.key, n: k }]);
            else p[bi]![ri]!.splice(pos, 0, { key: job.key, n: k });
            const c = schedule(dm, p).cost;
            if (c < bestCost) {
              bestCost = c;
              best = p;
            }
          }
          // a new run in between
          if (ri < runs.length) {
            const p = clone(plan);
            p[bi]!.splice(ri, 0, [{ key: job.key, n: k }]);
            const c = schedule(dm, p).cost;
            if (c < bestCost) {
              bestCost = c;
              best = p;
            }
          }
        }
      });
      plan = best!;
    }
  }
  return plan;
}

export const greedy = (dm: DayModel): Plan => insertMissing(dm, dm.crew.map(() => []));

interface Slot {
  b: number;
  r: number;
  i: number;
}
function slots(p: Plan): Slot[] {
  const out: Slot[] = [];
  p.forEach((runs, b) => runs.forEach((run, r) => run.forEach((_, i) => out.push({ b, r, i }))));
  return out;
}
function insertAnywhere(p: Plan, job: Job, rand: Rand) {
  const b = Math.floor(rand() * p.length);
  const runs = p[b]!;
  const r = Math.floor(rand() * (runs.length + 1));
  if (r === runs.length || rand() < 0.15) runs.splice(Math.min(r, runs.length), 0, [job]);
  else runs[r]!.splice(Math.floor(rand() * (runs[r]!.length + 1)), 0, job);
}

/** One random change: move, swap, reverse, split, merge, move a run, or shift children between twin pickups. */
export function neighbour(dm: DayModel, p0: Plan, rand: Rand): Plan | null {
  const p = clone(p0);
  const all = slots(p);
  if (!all.length) return null;
  const at = (s: Slot) => p[s.b]![s.r]![s.i]!;
  const m = rand();
  if (m < 0.3) {
    const s = pick(all, rand);
    const [job] = p[s.b]![s.r]!.splice(s.i, 1);
    insertAnywhere(p, job!, rand);
  } else if (m < 0.45) {
    if (all.length < 2) return null;
    const a = pick(all, rand),
      b = pick(all, rand);
    const ja = at(a),
      jb = at(b);
    p[a.b]![a.r]![a.i] = jb;
    p[b.b]![b.r]![b.i] = ja;
  } else if (m < 0.55) {
    const runs = p.flat().filter((r) => r.length > 1);
    if (!runs.length) return null;
    const run = pick(runs, rand);
    const i = Math.floor(rand() * run.length),
      j = Math.floor(rand() * run.length);
    const [lo, hi] = i < j ? [i, j] : [j, i];
    run.splice(lo, hi - lo + 1, ...run.slice(lo, hi + 1).reverse());
  } else if (m < 0.67) {
    const big = all.filter((s) => at(s).n > 1 && dm.jobs.get(at(s).key)?.kind === "kids");
    if (!big.length) return null;
    const s = pick(big, rand);
    const job = at(s);
    const k = 1 + Math.floor(rand() * (job.n - 1));
    job.n -= k;
    insertAnywhere(p, { key: job.key, n: k }, rand);
  } else if (m < 0.77) {
    const s = pick(all, rand);
    const job = at(s);
    const twins = all.filter((o) => (o.b !== s.b || o.r !== s.r || o.i !== s.i) && at(o).key === job.key);
    if (!twins.length) return null;
    const o = pick(twins, rand);
    job.n += at(o).n;
    at(o).n = 0;
  } else if (m < 0.87) {
    // shift a few children from one pickup of a group to another
    const s = pick(all, rand);
    const job = at(s);
    const twins = all.filter((o) => (o.b !== s.b || o.r !== s.r || o.i !== s.i) && at(o).key === job.key);
    if (!twins.length || job.n < 2) return null;
    const o = pick(twins, rand);
    const k = 1 + Math.floor(rand() * Math.min(3, job.n - 1));
    job.n -= k;
    at(o).n += k;
  } else {
    const withRuns = p.map((r, b) => ({ r, b })).filter((x) => x.r.length);
    const from = pick(withRuns, rand);
    const [run] = from.r.splice(Math.floor(rand() * from.r.length), 1);
    const to = p[Math.floor(rand() * p.length)]!;
    to.splice(Math.floor(rand() * (to.length + 1)), 0, run!);
  }
  return tidy(p);
}

const ROUNDS = 3;
/** How often a step is a ruin-and-recreate instead of a small move. */
const RUIN = 0.06;

/**
 * Ruin and recreate: take out one or two pickups (or a whole run) and put
 * them back where each adds least. Finds the big rearrangements (a group
 * split over other vehicles) that small random moves rarely stumble on.
 */
export function ruin(dm: DayModel, p0: Plan, rand: Rand, share = 0): Plan | null {
  const p = clone(p0);
  const all = slots(p);
  if (!all.length) return null;
  if (share > 0) {
    for (const s of all) if (rand() < share) p[s.b]![s.r]![s.i]!.n = 0;
  } else if (rand() < 0.3) {
    const withRuns = p.filter((r) => r.length);
    const runs = pick(withRuns, rand);
    runs.splice(Math.floor(rand() * runs.length), 1);
  } else {
    const k = 1 + Math.floor(rand() * Math.min(3, all.length));
    const out = new Set<Slot>();
    while (out.size < k) out.add(pick(all, rand));
    for (const s of [...out].sort((a, b) => b.i - a.i)) p[s.b]![s.r]![s.i]!.n = 0;
  }
  return insertMissing(dm, tidy(p));
}

export class Solver {
  readonly dm: DayModel;
  private rand: Rand;
  private cur: Plan;
  private curCost: number;
  best: Plan;
  bestResult: Result;
  done = 0;
  readonly total: number;
  private t0: number;

  constructor(dm: DayModel, opts: { seed?: number; iterations?: number; from?: Plan; vehicles?: string[] } = {}) {
    this.dm = dm;
    this.rand = rng(opts.seed ?? 1);
    let start: Plan | null = null;
    if (opts.from && opts.vehicles) {
      const fixed = repair(dm, opts.from, opts.vehicles);
      if (fixed) start = insertMissing(dm, fixed);
    }
    if (!start || !covers(dm, start)) start = greedy(dm);
    this.cur = start;
    this.bestResult = schedule(dm, start);
    this.curCost = this.bestResult.cost;
    this.best = start;
    const n = dm.jobs.size + dm.crew.length;
    this.total = !dm.crew.length || !dm.jobs.size ? 0 : (opts.iterations ?? Math.min(45000, 4000 + n * 1600));
    this.t0 = Math.max(5, Math.min(2000, this.curCost * 0.03));
  }

  get finished() {
    return this.done >= this.total;
  }

  /** Run n more iterations. True if the best got better. */
  step(n: number): boolean {
    let improved = false;
    const end = Math.min(this.total, this.done + n);
    const round = this.total / ROUNDS;
    for (; this.done < end; this.done++) {
      // three rounds, each reheating from the best plan so far (a bit cooler each time): out of local minima
      const r = Math.min(ROUNDS - 1, Math.floor(this.done / round));
      if (this.done > 0 && this.done === Math.ceil(r * round)) {
        this.cur = this.best;
        this.curCost = this.bestResult.cost;
      }
      const temp = (this.t0 / (1 + r)) * Math.pow(0.0005, (this.done - r * round) / round);
      const next = this.rand() < RUIN ? ruin(this.dm, this.cur, this.rand) : neighbour(this.dm, this.cur, this.rand);
      if (!next) continue;
      const res = schedule(this.dm, next);
      const d = res.cost - this.curCost;
      if (d <= 0 || this.rand() < Math.exp(-d / temp)) {
        this.cur = next;
        this.curCost = res.cost;
        if (res.cost < this.bestResult.cost - 1e-9) {
          this.best = next;
          this.bestResult = res;
          improved = true;
        }
      }
    }
    return improved;
  }

  run(): Result {
    while (!this.finished) this.step(5000);
    return this.bestResult;
  }
}
