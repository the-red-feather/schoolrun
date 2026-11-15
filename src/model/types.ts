/**
 * SCHOOLRUN: the after-school run of a BSO (buitenschoolse opvang).
 *
 * Every afternoon children have to get from their school to their BSO.
 * Schools are out at different times, several BSO locations share a few
 * vehicles, a big bus needs a driver with a bus licence, and some pickups
 * need a caretaker on board (children collected from the classroom), or a
 * colleague needs a lift. This file is the vocabulary; day.ts turns it into
 * one weekday's puzzle, schedule.ts times a plan, solver.ts finds one.
 */

export const DAYS = 5;
/** 0 = Monday … 4 = Friday. */
export type Day = 0 | 1 | 2 | 3 | 4;
export type Week<T> = [T, T, T, T, T];
export const ALL_DAYS: Day[] = [0, 1, 2, 3, 4];

export interface Geo {
  lat: number;
  lon: number;
}

export interface Bso extends Geo {
  id: string;
  name: string;
  /** Slot in BSO_COLORS. */
  color: number;
}

export interface School extends Geo {
  id: string;
  name: string;
  /** Slot in PALETTE. */
  color: number;
  /** Minutes after midnight the school is out, per weekday; null: no pickup that day. */
  out: Week<number | null>;
  /** Children are collected from the classroom: a caretaker has to ride along. */
  escort: boolean;
}

export interface Kid {
  id: string;
  name: string;
  school: string;
  bso: string;
  /** Contract days: the weekdays this child comes to the BSO. */
  days: Week<boolean>;
  /** Groep 1–8. */
  group: number;
}

/** 0: no licence, 1: B (a van up to 8 passengers), 2: D/D1, the bus licence. */
export type Licence = 0 | 1 | 2;
/** Passenger seats a B licence may drive. */
export const B_MAX_SEATS = 8;

export interface Vehicle {
  id: string;
  name: string;
  /** Passenger seats, the driver not counted. */
  seats: number;
  /** Slot in PALETTE. */
  color: number;
  /** The BSO where it's parked: it starts there and goes back there. */
  home: string;
  /** Days it can be used (not in the garage, not lent out). */
  days: Week<boolean>;
  /** A fixed driver (staff id), or null: whoever may drive it. */
  driver: string | null;
}

export interface Staff {
  id: string;
  name: string;
  /** The BSO they work at: where they start. */
  home: string;
  licence: Licence;
  days: Week<boolean>;
  /** Working hours, minutes after midnight. */
  from: number;
  until: number;
}

/** A colleague who needs a lift: from a place to a place, in a window. */
export interface Ride {
  id: string;
  who: string;
  /** Place ids: a BSO or a school. */
  from: string;
  to: string;
  /** Ready to leave at. */
  after: number;
  /** Has to be there by. */
  before: number;
  days: Week<boolean>;
}

export interface Rules {
  /** km/h, door to door. */
  speed: number;
  /** Roads are longer than the crow flies: × the straight line. */
  road: number;
  /** Minutes to get children on board at a school gate. */
  board: number;
  /** Extra minutes when they're collected from the classroom. */
  escortBoard: number;
  /** Minutes to let them off at a BSO. */
  drop: number;
  /** No vehicle leaves before this. */
  start: number;
  /** Children shouldn't wait longer than this at school (minutes). */
  maxWait: number;
  /** Weights: a child-minute waiting, a person-minute riding, a vehicle-minute driving. */
  wWait: number;
  wRide: number;
  wDrive: number;
}

/** A pickup fixed by hand: this many of this job (kids of a school for a BSO, or a lift) go with this vehicle. The solver keeps it. */
export interface Pin {
  /** Job key: "k|<school>|<bso>" or "r|<ride>". */
  key: string;
  vehicle: string;
  n: number;
}

export interface MapView {
  lat: number;
  lon: number;
  zoom: number;
}

export interface Scenario {
  version: 2;
  name: string;
  bsos: Bso[];
  schools: School[];
  kids: Kid[];
  vehicles: Vehicle[];
  staff: Staff[];
  rides: Ride[];
  rules: Rules;
  /** This week's exceptions: kids, staff and vehicles that are out on a weekday (ill, in the garage). */
  absent: Week<string[]>;
  /** Per weekday, the pickups fixed by hand. */
  pins: Week<Pin[]>;
  view?: MapView;
}

export const DEFAULT_RULES: Rules = {
  speed: 28,
  road: 1.35,
  board: 3,
  escortBoard: 6,
  drop: 3,
  start: 11 * 60 + 45,
  maxWait: 15,
  wWait: 1,
  wRide: 0.4,
  wDrive: 0.8,
};

/** Twelve loud colours for schools and vehicles (school blocks, routes, markers). */
export const PALETTE = [
  "#e5383b", // tomaat
  "#f77f00", // oranje
  "#f4b400", // goud
  "#8ac926", // limoen
  "#2a9d5c", // groen
  "#0fa3b1", // petrol
  "#1e88e5", // blauw
  "#4c4cdb", // indigo
  "#8e44ad", // paars
  "#e84393", // roze
  "#b5179e", // bes
  "#a0522d", // kaneel
];
/** Deep colours for the BSOs: the anchors of the map. */
export const BSO_COLORS = ["#2b2d7c", "#0b6e4f", "#7a1f4a", "#1d4e89", "#5c3d99", "#6b4e16"];

/** Black or white, whichever reads on `hex`. */
export function inkOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  const lum = 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  return lum > 0.36 ? "#16163f" : "#ffffff";
}

/** 13:45 ⇄ 825. */
export const hhmm = (m: number) => {
  const r = Math.round(m);
  return `${String(Math.floor(r / 60) % 24).padStart(2, "0")}:${String(((r % 60) + 60) % 60).padStart(2, "0")}`;
};
export function parseHhmm(s: string): number | null {
  const t = s.trim();
  const m = /^(\d{1,2})[:.]?(\d{2})$/.exec(t) ?? (/^\d{1,2}$/.test(t) ? [t, t, "00"] : null);
  if (!m) return null;
  const h = +m[1]!,
    mi = +m[2]!;
  return h < 24 && mi < 60 ? h * 60 + mi : null;
}

/** A fresh id not in `taken`: prefix + n. */
export function freshId(prefix: string, taken: Iterable<string>): string {
  const t = new Set(taken);
  for (let n = 1; ; n++) if (!t.has(prefix + n)) return prefix + n;
}

/** The lowest palette slot nobody in `used` has. */
export function freeColor(used: number[], size = PALETTE.length): number {
  for (let c = 0; c < size; c++) if (!used.includes(c)) return c;
  return used.length % size;
}

export const week = <T>(v: T): Week<T> => [v, v, v, v, v];
export const needsBusLicence = (v: Vehicle) => v.seats > B_MAX_SEATS;
export const mayDrive = (s: Staff, v: Vehicle) => s.licence >= (needsBusLicence(v) ? 2 : 1);

/** Every place a vehicle can go: the BSOs and the schools. */
export interface Place extends Geo {
  id: string;
  name: string;
  kind: "bso" | "school";
  color: string;
}
export function places(sc: Scenario): Map<string, Place> {
  const m = new Map<string, Place>();
  for (const b of sc.bsos) m.set(b.id, { id: b.id, name: b.name, lat: b.lat, lon: b.lon, kind: "bso", color: BSO_COLORS[b.color % BSO_COLORS.length]! });
  for (const s of sc.schools) m.set(s.id, { id: s.id, name: s.name, lat: s.lat, lon: s.lon, kind: "school", color: PALETTE[s.color % PALETTE.length]! });
  return m;
}
