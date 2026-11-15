/**
 * One weekday's puzzle: who has to go where (the jobs), which vehicles have a
 * driver (the crew), who's left to ride along, and what's already wrong
 * before any route is planned.
 */
import { haversine } from "./geo";
import { mayDrive, needsBusLicence, places, type Day, type Kid, type Place, type Ride, type Scenario, type School, type Staff, type Vehicle } from "./types";

/** Something to move: some children from a school to a BSO, or a colleague's lift. */
export interface JobInfo {
  key: string;
  kind: "kids" | "ride";
  from: string;
  to: string;
  /** Can't board before (school out, colleague ready). */
  ready: number;
  /** Has to arrive by (rides; Infinity for children). */
  due: number;
  /** A caretaker has to be on board for this pickup. */
  escort: boolean;
  /** People in total (children of this school for this BSO, or 1). */
  total: number;
  school?: School;
  bsoId?: string;
  ride?: Ride;
  /** The children, youngest first: handed out to the pickups in time order. */
  kids: Kid[];
}

export interface Crew {
  vehicle: Vehicle;
  driver: Staff;
  /** The vehicle can drive from … until (the driver's hours, the first departure). */
  from: number;
  until: number;
}

export type StaticIssue =
  | { kind: "noDriver"; vehicle: Vehicle; bus: boolean; missing: Staff[]; fixed?: Staff }
  | { kind: "fixedDriverAway"; vehicle: Vehicle; driver: Staff }
  | { kind: "substitute"; vehicle: Vehicle; driver: Staff; by: Staff }
  | { kind: "noVehicles" }
  | { kind: "noPickup"; school: School; kids: number }
  | { kind: "tooBig"; job: JobInfo; seats: number }
  | { kind: "orphans"; kids: number };

export interface DayModel {
  sc: Scenario;
  day: Day;
  place: Map<string, Place>;
  jobs: Map<string, JobInfo>;
  /** Vehicles that drive today, each with a driver. */
  crew: Crew[];
  /** Vehicles that stay put today, and why. */
  parked: { vehicle: Vehicle; why: "away" | "noDriver" }[];
  /** Staff working today who aren't driving: they can ride along. */
  helpers: Staff[];
  /** Staff working today. */
  working: Staff[];
  issues: StaticIssue[];
  /** Minutes between two places, by road (straight × road factor). */
  minutes(a: string, b: string): number;
  km(a: string, b: string): number;
}

export const kidsKey = (school: string, bso: string) => `k|${school}|${bso}`;
export const rideKey = (ride: string) => `r|${ride}`;

export function isAway(sc: Scenario, day: Day, id: string) {
  return sc.absent[day].includes(id);
}

/** Children who come today (contract day, not called off), and have a school and BSO that exist. */
export function kidsToday(sc: Scenario, day: Day): Kid[] {
  const away = new Set(sc.absent[day]);
  const schools = new Set(sc.schools.map((s) => s.id));
  const bsos = new Set(sc.bsos.map((b) => b.id));
  return sc.kids.filter((k) => k.days[day] && !away.has(k.id) && schools.has(k.school) && bsos.has(k.bso));
}

const byYoung = (a: Kid, b: Kid) => a.group - b.group || a.name.localeCompare(b.name);

/**
 * Who drives what: a fixed driver if they're in; then the buses (bus licence)
 * and then the vans, each from the drivers of its own BSO first, B licences
 * before bus licences (keep those for the buses).
 */
export function assignDrivers(sc: Scenario, day: Day) {
  const away = new Set(sc.absent[day]);
  const working = sc.staff.filter((s) => s.days[day] && !away.has(s.id));
  const usable = sc.vehicles.filter((v) => v.days[day] && !away.has(v.id) && sc.bsos.some((b) => b.id === v.home));
  const taken = new Set<string>();
  const got = new Map<string, Staff>();
  const issues: StaticIssue[] = [];
  for (const v of usable) {
    if (!v.driver) continue;
    const d = sc.staff.find((s) => s.id === v.driver);
    if (!d) continue;
    if (working.includes(d) && mayDrive(d, v) && !taken.has(d.id)) {
      got.set(v.id, d);
      taken.add(d.id);
    } else if (!working.includes(d)) issues.push({ kind: "fixedDriverAway", vehicle: v, driver: d });
  }
  const order = [...usable].filter((v) => !got.has(v.id)).sort((a, b) => Number(needsBusLicence(b)) - Number(needsBusLicence(a)) || b.seats - a.seats);
  for (const v of order) {
    const can = working.filter((s) => !taken.has(s.id) && mayDrive(s, v));
    can.sort((a, b) => Number(b.home === v.home) - Number(a.home === v.home) || a.licence - b.licence || a.name.localeCompare(b.name));
    const d = can[0];
    if (d) {
      got.set(v.id, d);
      taken.add(d.id);
    }
  }
  return { working, usable, got, issues };
}

export function buildDay(sc: Scenario, day: Day): DayModel {
  const place = places(sc);
  const away = new Set(sc.absent[day]);
  const issues: StaticIssue[] = [];

  // the jobs: children per school per BSO, and the lifts
  const jobs = new Map<string, JobInfo>();
  const today = kidsToday(sc, day);
  const orphans = sc.kids.filter((k) => k.days[day] && !away.has(k.id)).length - today.length;
  if (orphans > 0) issues.push({ kind: "orphans", kids: orphans });
  const schoolOf = new Map(sc.schools.map((s) => [s.id, s]));
  const noPickup = new Map<string, number>();
  for (const k of today) {
    const s = schoolOf.get(k.school)!;
    const out = s.out[day];
    if (out == null) {
      noPickup.set(s.id, (noPickup.get(s.id) ?? 0) + 1);
      continue;
    }
    const key = kidsKey(s.id, k.bso);
    let j = jobs.get(key);
    if (!j) {
      j = { key, kind: "kids", from: s.id, to: k.bso, ready: out, due: Infinity, escort: s.escort, total: 0, school: s, bsoId: k.bso, kids: [] };
      jobs.set(key, j);
    }
    j.total++;
    j.kids.push(k);
  }
  for (const j of jobs.values()) j.kids.sort(byYoung);
  for (const [id, n] of noPickup) issues.push({ kind: "noPickup", school: schoolOf.get(id)!, kids: n });
  for (const r of sc.rides) {
    if (!r.days[day] || !place.has(r.from) || !place.has(r.to) || r.from === r.to) continue;
    const key = rideKey(r.id);
    jobs.set(key, { key, kind: "ride", from: r.from, to: r.to, ready: r.after, due: Math.max(r.after, r.before), escort: false, total: 1, ride: r, kids: [] });
  }

  // the crew
  const { working, usable, got, issues: driverIssues } = assignDrivers(sc, day);
  const fixedAway = new Map(driverIssues.flatMap((i) => (i.kind === "fixedDriverAway" ? [[i.vehicle.id, i.driver] as const] : [])));
  const crew: Crew[] = [];
  const parked: DayModel["parked"] = [];
  for (const v of sc.vehicles) {
    if (!usable.includes(v)) {
      parked.push({ vehicle: v, why: "away" });
      continue;
    }
    const d = got.get(v.id);
    if (!d) {
      parked.push({ vehicle: v, why: "noDriver" });
      const bus = needsBusLicence(v);
      const missing = sc.staff.filter((s) => s.licence >= (bus ? 2 : 1) && (!s.days[day] || away.has(s.id)));
      issues.push({ kind: "noDriver", vehicle: v, bus, missing, fixed: fixedAway.get(v.id) });
      continue;
    }
    const fixed = fixedAway.get(v.id);
    if (fixed) issues.push({ kind: "substitute", vehicle: v, driver: fixed, by: d });
    crew.push({ vehicle: v, driver: d, from: Math.max(sc.rules.start, d.from), until: d.until });
  }
  if (!crew.length && jobs.size) issues.push({ kind: "noVehicles" });
  const biggest = Math.max(0, ...crew.map((c) => c.vehicle.seats));
  for (const j of jobs.values()) if (crew.length && j.kind === "kids" && j.escort && biggest < 2) issues.push({ kind: "tooBig", job: j, seats: biggest });

  const drivers = new Set(crew.map((c) => c.driver.id));
  const helpers = working.filter((s) => !drivers.has(s.id));

  const rules = sc.rules;
  const cache = new Map<string, number>();
  const km = (a: string, b: string) => {
    if (a === b) return 0;
    const k = a < b ? a + "|" + b : b + "|" + a;
    let d = cache.get(k);
    if (d === undefined) {
      const pa = place.get(a),
        pb = place.get(b);
      d = pa && pb ? haversine(pa, pb) * rules.road : 0;
      cache.set(k, d);
    }
    return d;
  };
  return { sc, day, place, jobs, crew, parked, helpers, working, issues, km, minutes: (a, b) => (km(a, b) / rules.speed) * 60 };
}
