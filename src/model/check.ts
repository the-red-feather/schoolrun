/**
 * Whatever was stored, imported or shared, made sound: unknown references
 * fixed or dropped, numbers clamped, missing fields filled in. Also reads the
 * first version's scenarios (one club, places on a 10 km map, kids as counts).
 */
import { fromLocal } from "./geo";
import { nameMaker } from "./sample";
import { BSO_COLORS, DEFAULT_RULES, PALETTE, freshId, week, type Bso, type Kid, type Licence, type Ride, type Rules, type Scenario, type School, type Staff, type Vehicle, type Week } from "./types";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const num = (v: unknown, d: number, lo: number, hi: number) => (typeof v === "number" && Number.isFinite(v) ? clamp(v, lo, hi) : d);
const str = (v: unknown, d: string, max = 80) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : d);
const lat = (v: unknown, d: number) => num(v, d, -85, 85);
const lon = (v: unknown, d: number) => num(v, d, -180, 180);
const weekOf = <T>(v: unknown, d: T, ok: (x: unknown) => x is T): Week<T> => {
  const a = Array.isArray(v) ? v : [];
  return [0, 1, 2, 3, 4].map((i) => (ok(a[i]) ? a[i] : d)) as Week<T>;
};
const isBool = (x: unknown): x is boolean => typeof x === "boolean";
const isTime = (x: unknown): x is number | null => x === null || (typeof x === "number" && x >= 0 && x < 24 * 60);
const arr = (v: unknown): any[] => (Array.isArray(v) ? v : []);

function unique<T extends { id: string }>(xs: T[], prefix: string): T[] {
  const seen = new Set<string>();
  for (const x of xs) {
    if (!x.id || seen.has(x.id)) x.id = freshId(prefix, [...seen, ...xs.map((y) => y.id)]);
    seen.add(x.id);
  }
  return xs;
}

export function checkScenario(raw: unknown): Scenario | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, any>;
  if (r.version !== 2 && Array.isArray(r.places) && r.hub) return fromV1(r);
  if (!Array.isArray(r.bsos) || !Array.isArray(r.schools)) return null;
  const base = { lat: 52.0116, lon: 4.3571 };

  const bsos: Bso[] = unique(
    arr(r.bsos).map((b, i) => ({ id: str(b?.id, ""), name: str(b?.name, `BSO ${i + 1}`), lat: lat(b?.lat, base.lat), lon: lon(b?.lon, base.lon), color: Math.round(num(b?.color, i, 0, BSO_COLORS.length - 1)) })),
    "b",
  );
  if (!bsos.length) bsos.push({ id: "b1", name: "BSO", ...base, color: 0 });
  const here = { lat: bsos[0]!.lat, lon: bsos[0]!.lon };
  const bsoIds = new Set(bsos.map((b) => b.id));
  const schools: School[] = unique(
    arr(r.schools).map((s, i) => ({
      id: str(s?.id, ""),
      name: str(s?.name, `School ${i + 1}`),
      lat: lat(s?.lat, here.lat),
      lon: lon(s?.lon, here.lon),
      color: Math.round(num(s?.color, i, 0, PALETTE.length - 1)),
      out: weekOf<number | null>(s?.out, 14 * 60, isTime),
      escort: !!s?.escort,
    })),
    "s",
  );
  // one id space for places: a school can't share an id with a BSO
  for (const s of schools) if (bsoIds.has(s.id)) s.id = freshId("s", [...schools.map((x) => x.id), ...bsoIds]);
  const schoolIds = new Set(schools.map((s) => s.id));
  const kids: Kid[] = unique(
    arr(r.kids)
      .filter((k) => schoolIds.has(k?.school))
      .map((k, i) => ({
        id: str(k?.id, ""),
        name: str(k?.name, `Kind ${i + 1}`),
        school: k.school,
        bso: bsoIds.has(k?.bso) ? k.bso : bsos[0]!.id,
        days: weekOf(k?.days, true, isBool),
        group: Math.round(num(k?.group, 4, 1, 8)),
      })),
    "k",
  );
  const staff: Staff[] = unique(
    arr(r.staff).map((s, i) => ({
      id: str(s?.id, ""),
      name: str(s?.name, `Medewerker ${i + 1}`),
      home: bsoIds.has(s?.home) ? s.home : bsos[0]!.id,
      licence: Math.round(num(s?.licence, 0, 0, 2)) as Licence,
      days: weekOf(s?.days, true, isBool),
      from: num(s?.from, 11 * 60 + 30, 0, 24 * 60 - 1),
      until: num(s?.until, 18 * 60 + 30, 0, 24 * 60 - 1),
    })),
    "st",
  );
  const staffIds = new Set(staff.map((s) => s.id));
  const vehicles: Vehicle[] = unique(
    arr(r.vehicles).map((v, i) => ({
      id: str(v?.id, ""),
      name: str(v?.name, `Busje ${i + 1}`),
      seats: Math.round(num(v?.seats, 8, 1, 60)),
      color: Math.round(num(v?.color, 6, 0, PALETTE.length - 1)),
      home: bsoIds.has(v?.home) ? v.home : bsos[0]!.id,
      days: weekOf(v?.days, true, isBool),
      driver: staffIds.has(v?.driver) ? v.driver : null,
    })),
    "v",
  );
  const placeIds = new Set([...bsoIds, ...schoolIds]);
  const rides: Ride[] = unique(
    arr(r.rides)
      .filter((x) => placeIds.has(x?.from) && placeIds.has(x?.to))
      .map((x) => ({
        id: str(x?.id, ""),
        who: str(x?.who, "?"),
        from: x.from,
        to: x.to,
        after: num(x?.after, 14 * 60, 0, 24 * 60 - 1),
        before: num(x?.before, 15 * 60, 0, 24 * 60 - 1),
        days: weekOf(x?.days, true, isBool),
      })),
    "r",
  );
  const ru = r.rules ?? {};
  const d = DEFAULT_RULES;
  const rules: Rules = {
    speed: num(ru.speed, d.speed, 5, 120),
    road: num(ru.road, d.road, 1, 3),
    board: num(ru.board, d.board, 0, 30),
    escortBoard: num(ru.escortBoard, d.escortBoard, 0, 30),
    drop: num(ru.drop, d.drop, 0, 30),
    start: num(ru.start, d.start, 0, 24 * 60 - 1),
    maxWait: num(ru.maxWait, d.maxWait, 0, 240),
    wWait: num(ru.wWait, d.wWait, 0, 10),
    wRide: num(ru.wRide, d.wRide, 0, 10),
    wDrive: num(ru.wDrive, d.wDrive, 0, 10),
  };
  const ids = new Set([...kids.map((k) => k.id), ...staff.map((s) => s.id), ...vehicles.map((v) => v.id)]);
  const absent = weekOf<string[]>(r.absent, [], (x): x is string[] => Array.isArray(x)).map((a) => [...new Set(a.filter((id) => ids.has(id)))]) as Week<string[]>;
  const view = r.view && typeof r.view === "object" ? { lat: lat(r.view.lat, here.lat), lon: lon(r.view.lon, here.lon), zoom: num(r.view.zoom, 13, 2, 19) } : undefined;
  return { version: 2, name: str(r.name, "Schoolrun", 60), bsos, schools, kids, vehicles, staff, rides, rules, absent, view };
}

/** The first SCHOOLRUN (one hub, places in km on a 10 × 10 map, kids as numbers): put it in Delft, give the children names. */
function fromV1(r: Record<string, any>): Scenario | null {
  const o = { lat: 52.0116, lon: 4.3571 };
  const at = (p: any) => fromLocal((num(p?.x, 5, 0, 10) - 5) * 0.8, (5 - num(p?.y, 5, 0, 10)) * 0.8, o);
  const places = new Map<string, any>(arr(r.places).map((p) => [p?.id, p]));
  const name = nameMaker(1);
  const schools: any[] = [];
  const kids: any[] = [];
  arr(r.schools).forEach((s, i) => {
    const p = places.get(s?.place);
    const out = num(s?.out, 14 * 60, 0, 24 * 60 - 1);
    schools.push({ id: `s${i + 1}`, name: str(s?.name, `School ${i + 1}`), ...at(p), color: i % PALETTE.length, out: week(out), escort: false });
    for (let k = 0; k < Math.round(num(s?.kids, 0, 0, 60)); k++) kids.push({ id: `k${kids.length + 1}`, name: name(), school: `s${i + 1}`, bso: "b1", days: week(true), group: 4 });
  });
  return checkScenario({
    version: 2,
    name: "Schoolrun",
    bsos: [{ id: "b1", name: str(r.hub?.name, "BSO"), ...at(r.hub), color: 0 }],
    schools,
    kids,
    vehicles: arr(r.buses).map((b, i) => ({ id: `v${i + 1}`, name: str(b?.name, `Busje ${i + 1}`), seats: b?.seats, color: [6, 5, 11, 7, 10, 3, 1, 0][i % 8], home: "b1", days: week(true), driver: null })),
    staff: arr(r.buses).map((b, i) => ({ id: `st${i + 1}`, name: name(), home: "b1", licence: num(b?.seats, 8, 1, 99) > 8 ? 2 : 1, days: week(true), from: 11 * 60 + 30, until: 18 * 60 + 30 })),
    rides: [],
    rules: { ...DEFAULT_RULES, ...(r.rules ?? {}) },
    absent: [[], [], [], [], []],
  });
}
