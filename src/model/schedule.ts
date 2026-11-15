/**
 * A plan, timed and costed. A plan is, per vehicle with a driver, its runs;
 * a run is an ordered list of pickups (some children of one school for one
 * BSO, or a colleague's lift). Driving a run: go to each pickup in order,
 * letting off whoever is home at every stop on the way; then drop the rest
 * at their BSOs in the best order. The next run starts where this one
 * ended. A run with a classroom pickup takes a caretaker along from the BSO
 * it leaves from (a seat), who gets off where it ends. Pure, no DOM.
 */
import type { Crew, DayModel, JobInfo } from "./day";
import type { Geo, Kid } from "./types";

export interface Job {
  key: string;
  n: number;
}
/** Per crew (same order as DayModel.crew): its runs, each a list of pickups. */
export type Plan = Job[][][];

export interface Board {
  key: string;
  n: number;
  /** On board. */
  pickup: number;
  /** Off at the destination. */
  deliver: number;
  /** Minutes waited since ready (school out). */
  wait: number;
  kids?: Kid[];
}
export interface Stop {
  place: string;
  arrive: number;
  leave: number;
  on: Board[];
  off: Board[];
  /** People on board when it leaves (the caretaker counted). */
  load: number;
}
export interface Run {
  depart: number;
  /** Done: the last people off. */
  back: number;
  start: string;
  end: string;
  stops: Stop[];
  boards: Board[];
  maxLoad: number;
  km: number;
  drive: number;
  needsEscort: boolean;
  /** The caretaker riding along (staff id); null when nobody could. */
  escort: string | null;
}
/** A stretch of a vehicle's day: driving from → to, or standing (from = to). */
export interface Leg {
  t0: number;
  t1: number;
  from: Geo;
  to: Geo;
  load: number;
  /** Where it stands, or (driving) where it's going. */
  place?: string;
}
export interface VehicleDay {
  crew: Crew;
  runs: Run[];
  legs: Leg[];
  km: number;
  drive: number;
  /** Back at its own BSO. */
  home: number;
  /** Minutes past the driver's hours. */
  overtime: number;
}
export interface Result {
  days: VehicleDay[];
  cost: number;
  kids: number;
  /** Child-minutes waiting at school, the longest wait. */
  waitTotal: number;
  waitMax: number;
  /** Child-minutes on board, the longest ride. */
  rideTotal: number;
  rideMax: number;
  km: number;
  drive: number;
  runs: number;
  /** People over the seats, summed over runs (should be 0). */
  over: number;
  /** Child-minutes waited past maxWait, and how many children that is. */
  late: number;
  lateKids: number;
  /** Minutes colleagues arrive too late, summed, and how many lifts. */
  rideLate: number;
  ridesLate: number;
  /** Runs that need a caretaker and have none. */
  escortMissing: number;
  overtime: number;
  /** The first departure, the last child in. */
  first: number;
  done: number;
}

const OVER_COST = 1000;
const LATE_COST = 20;
const RIDE_LATE_COST = 40;
const ESCORT_COST = 600;
const SHIFT_COST = 30;

interface Timed {
  stops: Stop[];
  boards: Board[];
  depart: number;
  back: number;
  end: string;
  km: number;
  drive: number;
  maxLoad: number;
  wait: number;
  ride: number;
  late: number;
  rideLate: number;
  /** What the people pay: waiting, riding, too late (no driving, no overtime). */
  cost: number;
  /** The drop-offs at the end, in order. */
  dests: string[];
}

function permutations<T>(xs: T[]): T[][] {
  if (xs.length <= 1) return [xs];
  const out: T[][] = [];
  xs.forEach((x, i) => {
    for (const p of permutations([...xs.slice(0, i), ...xs.slice(i + 1)])) out.push([x, ...p]);
  });
  return out;
}

/** Drive `jobs` from `start`, leaving at `depart`, the leftovers dropped in `order` (or as they come). */
function drive(dm: DayModel, jobs: Job[], infos: JobInfo[], start: string, depart: number, escort: boolean, order: string[] | null): Timed {
  const r = dm.sc.rules;
  const stops: Stop[] = [];
  const boards: Board[] = jobs.map((j) => ({ key: j.key, n: j.n, pickup: depart, deliver: depart, wait: 0 }));
  let at = start;
  let t = depart;
  let km = 0;
  let dr = 0;
  let load = escort ? 1 : 0;
  let maxLoad = load;
  const aboard: number[] = [];
  let cur = null as { stop: Stop; on: number[] } | null;
  const go = (p: string) => {
    if (p === at) return;
    const m = dm.minutes(at, p);
    km += dm.km(at, p);
    dr += m;
    t += m;
    at = p;
  };
  const open = (p: string) => {
    const s: Stop = { place: p, arrive: t, leave: t, on: [], off: [], load };
    for (let k = aboard.length - 1; k >= 0; k--) {
      const i = aboard[k]!;
      if (infos[i]!.to === p) {
        s.off.push(boards[i]!);
        load -= boards[i]!.n;
        aboard.splice(k, 1);
      }
    }
    if (s.off.length) {
      t += r.drop;
      for (const b of s.off) b.deliver = t;
    }
    stops.push(s);
    cur = { stop: s, on: [] };
  };
  const close = () => {
    if (!cur) return;
    const { stop, on } = cur;
    if (on.length) {
      let ready = t;
      let extra = 0;
      for (const i of on) {
        ready = Math.max(ready, infos[i]!.ready);
        if (infos[i]!.escort) extra = r.escortBoard;
      }
      for (const i of on) {
        boards[i]!.pickup = ready;
        boards[i]!.wait = ready - infos[i]!.ready;
      }
      t = ready + r.board + extra;
    }
    stop.leave = t;
    stop.load = load;
    maxLoad = Math.max(maxLoad, load);
    cur = null;
  };
  for (let i = 0; i < jobs.length; i++) {
    const inf = infos[i]!;
    if (!cur || cur.stop.place !== inf.from) {
      close();
      go(inf.from);
      open(inf.from);
    }
    cur!.stop.on.push(boards[i]!);
    cur!.on.push(i);
    aboard.push(i);
    load += boards[i]!.n;
  }
  close();
  const left = [...new Set(aboard.map((i) => infos[i]!.to))];
  const dests = order ? order.filter((p) => left.includes(p)).concat(left.filter((p) => !order.includes(p))) : left;
  for (const p of dests) {
    go(p);
    open(p);
    close();
  }
  let wait = 0,
    ride = 0,
    late = 0,
    rideLate = 0;
  boards.forEach((b, i) => {
    const inf = infos[i]!;
    if (inf.kind === "kids") {
      wait += b.n * b.wait;
      ride += b.n * (b.deliver - b.pickup);
      late += b.n * Math.max(0, b.wait - r.maxWait);
    } else {
      ride += b.deliver - b.pickup;
      rideLate += Math.max(0, b.deliver - inf.due);
    }
  });
  const cost = r.wWait * wait + r.wRide * ride + LATE_COST * late + RIDE_LATE_COST * rideLate;
  return { stops, boards, depart, back: t, end: at, km, drive: dr, maxLoad, wait, ride, late, rideLate, cost, dests };
}

/** What a run costs when choosing how to drive it: the people, the driving, and overtime. */
const judge = (dm: DayModel, x: Timed, until: number) => x.cost + dm.sc.rules.wDrive * x.drive + SHIFT_COST * Math.max(0, x.back - until);

/** The best order to drop the leftovers, for a run leaving at `depart`. */
function bestOrder(dm: DayModel, jobs: Job[], infos: JobInfo[], start: string, depart: number, escort: boolean, until: number): Timed {
  const first = drive(dm, jobs, infos, start, depart, escort, null);
  if (first.dests.length <= 1) return first;
  let best = first;
  let bestCost = judge(dm, first, until);
  for (const p of permutations(first.dests.slice(0, 5))) {
    const x = drive(dm, jobs, infos, start, depart, escort, p);
    const c = judge(dm, x, until);
    if (c < bestCost - 1e-9) {
      best = x;
      bestCost = c;
    }
  }
  return best;
}

type Timed2 = Timed & { needsEscort: boolean; start: string };
const caches = new WeakMap<DayModel, Map<string, Timed2>>();

/**
 * A run leaves as soon as the vehicle is free, or later if leaving later
 * costs nobody anything: try leaving just in time for each stop it would
 * wait at, keep the cheapest (the latest, on a tie).
 */
export function timeRun(dm: DayModel, jobs: Job[], start: string, free: number, until: number): Timed2 {
  let cache = caches.get(dm);
  if (!cache) caches.set(dm, (cache = new Map()));
  let key = `${start}@${free.toFixed(3)}~${until}:`;
  for (const j of jobs) key += j.key + "*" + j.n + ",";
  const hit = cache.get(key);
  if (hit) return hit;
  const infos = jobs.map((j) => dm.jobs.get(j.key)!);
  const escort = infos.some((i) => i.escort);
  let best = bestOrder(dm, jobs, infos, start, free, escort, until);
  let bestCost = judge(dm, best, until);
  const drop = dm.sc.rules.drop;
  const slacks = best.stops.filter((s) => s.on.length).map((s) => s.on[0]!.pickup - s.arrive - (s.off.length ? drop : 0)).filter((g) => g > 1e-6);
  for (const slack of slacks) {
    const x = bestOrder(dm, jobs, infos, start, free + slack, escort, until);
    const c = judge(dm, x, until);
    if (c <= bestCost + 1e-9) {
      best = x;
      bestCost = c;
    }
  }
  const out = { ...best, needsEscort: escort, start };
  if (cache.size > 200_000) cache.clear();
  cache.set(key, out);
  return out;
}

/** The plan, timed and costed, caretakers found for the runs that need one. */
export function schedule(dm: DayModel, plan: Plan): Result {
  const { sc } = dm;
  const r = sc.rules;
  const days: VehicleDay[] = [];
  let waitTotal = 0,
    waitMax = 0,
    rideTotal = 0,
    rideMax = 0,
    km = 0,
    dr = 0,
    kids = 0,
    over = 0,
    late = 0,
    lateKids = 0,
    rideLate = 0,
    ridesLate = 0,
    overtime = 0,
    nRuns = 0,
    done = -Infinity,
    first = Infinity;
  let cost = 0;
  dm.crew.forEach((c, ci) => {
    const runs: Run[] = [];
    let free = c.from;
    let at = c.vehicle.home;
    let vkm = 0,
      vdr = 0;
    for (const jobs of plan[ci] ?? []) {
      if (!jobs.length) continue;
      const x = timeRun(dm, jobs, at, free, c.until);
      runs.push({ depart: x.depart, back: x.back, start: x.start, end: x.end, stops: x.stops, boards: x.boards, maxLoad: x.maxLoad, km: x.km, drive: x.drive, needsEscort: x.needsEscort, escort: null });
      cost += x.cost;
      over += Math.max(0, x.maxLoad - c.vehicle.seats);
      vkm += x.km;
      vdr += x.drive;
      waitTotal += x.wait;
      rideTotal += x.ride;
      late += x.late;
      rideLate += x.rideLate;
      x.boards.forEach((b, i) => {
        const inf = dm.jobs.get(jobs[i]!.key)!;
        if (inf.kind === "kids") {
          kids += b.n;
          waitMax = Math.max(waitMax, b.wait);
          rideMax = Math.max(rideMax, b.deliver - b.pickup);
          if (b.wait > r.maxWait + 1e-6) lateKids += b.n;
        } else if (b.deliver > inf.due + 1e-6) ridesLate++;
      });
      free = x.back;
      at = x.end;
      done = Math.max(done, x.back);
      first = Math.min(first, x.depart);
    }
    const homeKm = dm.km(at, c.vehicle.home);
    const homeMin = dm.minutes(at, c.vehicle.home);
    vkm += homeKm;
    vdr += homeMin;
    const home = runs.length ? free + homeMin : c.from;
    const ot = Math.max(0, home - c.until);
    overtime += ot;
    km += vkm;
    dr += vdr;
    nRuns += runs.length;
    days.push({ crew: c, runs, legs: [], km: vkm, drive: vdr, home, overtime: ot });
  });

  // caretakers for the runs that need one
  const escortMissing = assignEscorts(dm, days);
  cost += r.wDrive * dr + OVER_COST * over + ESCORT_COST * escortMissing + SHIFT_COST * overtime;
  return {
    days,
    cost,
    kids,
    waitTotal,
    waitMax,
    rideTotal,
    rideMax,
    km,
    drive: dr,
    runs: nRuns,
    over,
    late,
    lateKids,
    rideLate,
    ridesLate,
    escortMissing,
    overtime,
    first: Number.isFinite(first) ? first : r.start,
    done: Number.isFinite(done) ? done : r.start,
  };
}

/** Hand out the caretakers: who's at the BSO the run leaves from, free, and working long enough. */
function assignEscorts(dm: DayModel, days: VehicleDay[]): number {
  const need: Run[] = [];
  for (const d of days) for (const run of d.runs) if (run.needsEscort) need.push(run);
  if (!need.length) return 0;
  const idleDrivers = days.filter((d) => !d.runs.length).map((d) => d.crew.driver);
  const pool = [...dm.helpers, ...idleDrivers];
  const st = new Map(pool.map((s) => [s.id, { at: s.home, free: Math.max(dm.sc.rules.start, s.from) }]));
  need.sort((a, b) => a.depart - b.depart);
  let missing = 0;
  for (const run of need) {
    if (dm.place.get(run.start)?.kind !== "bso") {
      missing++;
      continue;
    }
    let pick: (typeof pool)[number] | null = null;
    for (const s of pool) {
      const x = st.get(s.id)!;
      if (x.at !== run.start || x.free > run.depart + 1e-6 || s.until < run.back - 1e-6) continue;
      if (!pick || (s.home === run.end && pick.home !== run.end)) pick = s;
    }
    if (!pick) {
      missing++;
      continue;
    }
    run.escort = pick.id;
    st.set(pick.id, { at: run.end, free: run.back });
  }
  return missing;
}

/**
 * The plan for showing: legs to animate, and the children handed out by
 * name over the pickups of their group (earliest pickup, youngest first).
 * Copies everything: timed runs are shared through the cache.
 */
export function finalize(dm: DayModel, res: Result): Result {
  const days = res.days.map((d) => {
    const runs = d.runs.map((run) => {
      const map = new Map<Board, Board>();
      const boards = run.boards.map((b) => {
        const c = { ...b };
        map.set(b, c);
        return c;
      });
      const stops = run.stops.map((s) => ({ ...s, on: s.on.map((b) => map.get(b)!), off: s.off.map((b) => map.get(b)!) }));
      return { ...run, boards, stops };
    });
    return { ...d, runs, legs: legsOf(dm, d.crew, runs, d.home) };
  });
  const byKey = new Map<string, Board[]>();
  for (const d of days) for (const run of d.runs) for (const b of run.boards) byKey.set(b.key, [...(byKey.get(b.key) ?? []), b]);
  for (const [key, bs] of byKey) {
    const inf = dm.jobs.get(key);
    if (!inf || inf.kind !== "kids") continue;
    bs.sort((a, b) => a.pickup - b.pickup);
    let i = 0;
    for (const b of bs) {
      b.kids = inf.kids.slice(i, i + b.n);
      i += b.n;
    }
  }
  return { ...res, days };
}

function legsOf(dm: DayModel, c: Crew, runs: Run[], home: number): Leg[] {
  const legs: Leg[] = [];
  const P = (id: string) => dm.place.get(id)!;
  let pos = c.vehicle.home;
  let t = c.from;
  for (const run of runs) {
    let load = run.needsEscort ? 1 : 0;
    if (pos !== run.start) {
      // (never: a run starts where the last one ended)
      pos = run.start;
    }
    if (run.depart > t) legs.push({ t0: t, t1: run.depart, from: P(pos), to: P(pos), load: 0, place: pos });
    t = run.depart;
    for (const s of run.stops) {
      if (s.place !== pos) {
        legs.push({ t0: t, t1: s.arrive, from: P(pos), to: P(s.place), load, place: s.place });
        pos = s.place;
      }
      legs.push({ t0: s.arrive, t1: s.leave, from: P(pos), to: P(pos), load: s.load, place: pos });
      load = s.load;
      t = s.leave;
    }
  }
  if (runs.length && pos !== c.vehicle.home) legs.push({ t0: t, t1: home, from: P(pos), to: P(c.vehicle.home), load: 0, place: c.vehicle.home });
  return legs;
}
