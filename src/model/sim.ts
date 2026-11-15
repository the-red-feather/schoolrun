/** The afternoon at a moment: where every vehicle is, who's on board, who's still waiting, who's in. */
import type { DayModel } from "./day";
import type { Board, Result, Run, VehicleDay } from "./schedule";
import type { Geo, Kid } from "./types";

export interface Trip {
  kid: Kid;
  vehicle: number;
  run: Run;
  board: Board;
}

/** Per child, the trip that takes them (after finalize). */
export function trips(res: Result): Map<string, Trip> {
  const m = new Map<string, Trip>();
  res.days.forEach((d, vi) => {
    for (const run of d.runs) for (const b of run.boards) for (const kid of b.kids ?? []) m.set(kid.id, { kid, vehicle: vi, run, board: b });
  });
  return m;
}

export type KidState = "off" | "class" | "waiting" | "riding" | "in";
export function kidState(tr: Trip | undefined, out: number | null, t: number): KidState {
  if (!tr || out == null) return "off";
  if (t < out) return "class";
  if (t < tr.board.pickup) return "waiting";
  if (t < tr.board.deliver) return "riding";
  return "in";
}

export function vehicleAt(d: VehicleDay, home: Geo, t: number): Geo & { load: number; moving: boolean; place?: string; heading?: Geo } {
  let pos: Geo = home;
  let place: string | undefined = d.crew.vehicle.home;
  for (const l of d.legs) {
    if (t < l.t0) break;
    if (t < l.t1) {
      const f = l.t1 > l.t0 ? (t - l.t0) / (l.t1 - l.t0) : 1;
      const moving = l.from !== l.to;
      return { lat: l.from.lat + (l.to.lat - l.from.lat) * f, lon: l.from.lon + (l.to.lon - l.from.lon) * f, load: l.load, moving, place: moving ? undefined : l.place, heading: moving ? l.to : undefined };
    }
    pos = l.to;
    place = l.place;
  }
  return { ...pos, load: 0, moving: false, place };
}

/** The run a vehicle is on at t, if any. */
export const runAt = (d: VehicleDay, t: number) => d.runs.find((r) => t >= r.depart && t < r.back);

/** Who's on board at t: the boards picked up and not yet let off. */
export function aboard(run: Run | undefined, t: number): Board[] {
  if (!run) return [];
  return run.boards.filter((b) => b.pickup <= t && b.deliver > t);
}

/** Where a run is heading at t: the next stop it hasn't left. */
export function nextStop(run: Run | undefined, t: number) {
  return run?.stops.find((s) => s.leave > t);
}

export function counts(dm: DayModel, res: Result, t: number) {
  const tr = trips(res);
  const schools = new Map<string, { class: number; waiting: number; gone: number; total: number; maxWait: number }>();
  const bsos = new Map<string, { in: number; total: number }>();
  for (const b of dm.sc.bsos) bsos.set(b.id, { in: 0, total: 0 });
  for (const j of dm.jobs.values()) {
    if (j.kind !== "kids" || !j.school) continue;
    const s = schools.get(j.school.id) ?? { class: 0, waiting: 0, gone: 0, total: 0, maxWait: 0 };
    const b = bsos.get(j.to)!;
    for (const k of j.kids) {
      const st = kidState(tr.get(k.id), j.ready, t);
      s.total++;
      b.total++;
      if (st === "class") s.class++;
      else if (st === "waiting") {
        s.waiting++;
        s.maxWait = Math.max(s.maxWait, t - j.ready);
      } else s.gone++;
      if (st === "in") b.in++;
    }
    schools.set(j.school.id, s);
  }
  return { schools, bsos, trips: tr };
}
