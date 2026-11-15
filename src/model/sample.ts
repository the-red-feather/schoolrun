/**
 * The default week: two BSOs and seven schools in Delft, 86 children with
 * Dutch names, three vans and a bus. Henk is the only one with a bus licence
 * and doesn't work on Wednesday and Friday: on those days the bus stays put.
 */
import { fromLocal } from "./geo";
import { rng } from "./solver";
import { DEFAULT_RULES, week, type Bso, type Kid, type Ride, type Scenario, type School, type Staff, type Vehicle, type Week } from "./types";

const T = (h: number, m = 0) => h * 60 + m;

export const FIRST_NAMES = [
  "Noah", "Sem", "Liam", "Lucas", "Daan", "Finn", "Levi", "Luuk", "Mees", "James", "Milan", "Sam", "Noud", "Bram", "Jesse", "Thijs",
  "Siem", "Ties", "Lars", "Gijs", "Max", "Adam", "Mohammed", "Ayoub", "Yusuf", "Hamza", "Teun", "Jens", "Boaz", "Floris", "Olivier",
  "Hugo", "Benjamin", "Jurre", "Stijn", "Tygo", "Dex", "Morris", "Pepijn", "Joep", "Guus", "Owen", "Vince", "Kai", "Mats", "Ravi",
  "Emma", "Julia", "Mila", "Tess", "Sophie", "Zoë", "Sara", "Nora", "Yara", "Eva", "Liv", "Lotte", "Evi", "Noor", "Anna", "Saar",
  "Lieke", "Fenna", "Nina", "Olivia", "Fleur", "Roos", "Isa", "Lynn", "Sofie", "Maud", "Elin", "Femke", "Luna", "Jasmijn", "Amira",
  "Lina", "Aya", "Mirthe", "Floor", "Veerle", "Esmee", "Nova", "Lisa", "Romy", "Bo", "Fien", "Ella", "Jill", "Puck", "Merel",
  "Hanna", "Elif", "Ilse", "Wout", "Kiki", "Tim",
];
export const LAST_NAMES = [
  "de Jong", "Jansen", "de Vries", "van den Berg", "van Dijk", "Bakker", "Janssen", "Visser", "Smit", "Meijer", "de Boer", "Mulder",
  "de Groot", "Bos", "Vos", "Peters", "Hendriks", "van Leeuwen", "Dekker", "Brouwer", "de Wit", "Dijkstra", "Smits", "de Graaf",
  "van der Meer", "van der Linden", "Kok", "Jacobs", "de Haan", "Vermeulen", "van den Heuvel", "van der Veen", "van den Broek",
  "de Bruijn", "van der Heijden", "Schouten", "van Beek", "Willems", "van Vliet", "Hoekstra", "Maas", "Verhoeven", "Koster",
  "van Dam", "Prins", "Blom", "Huisman", "Kuipers", "Postma", "Kramer", "El Idrissi", "Yilmaz", "Bouzid", "Kaya", "Ramdin",
  "Nguyen", "Öztürk", "Boateng", "Sanchez", "Pinas",
];
export const SCHOOL_NAMES = [
  "De Regenboog", "Het Kompas", "Sint Jozefschool", "De Wilgenhoek", "Montessori De Vlinder", "De Zonnewijzer", "Het Palet",
  "De Klimboom", "Het Anker", "De Kleine Prins", "Jenaplan De Boomgaard", "De Fontein", "Het Mozaïek", "De Springplank", "Het Talent",
];
export const BSO_NAMES = ["BSO De Boomhut", "BSO Het Kasteel", "BSO De Speeltuin", "BSO Kameleon"];

/** Unique Dutch names, seeded. */
export function nameMaker(seed: number, taken: Iterable<string> = []) {
  const r = rng(seed);
  const used = new Set(taken);
  return () => {
    for (let i = 0; i < 400; i++) {
      const n = `${FIRST_NAMES[Math.floor(r() * FIRST_NAMES.length)]} ${LAST_NAMES[Math.floor(r() * LAST_NAMES.length)]}`;
      if (!used.has(n)) {
        used.add(n);
        return n;
      }
    }
    return `Kind ${used.size + 1}`;
  };
}

const ATTEND = [0.9, 0.86, 0.42, 0.86, 0.55];
const GROUP_WEIGHTS = [3, 3, 3, 3, 2, 2, 1, 1];

function makeKids(r: () => number, name: () => string, schools: School[], split: Record<string, [string, number][]>, start = 1): Kid[] {
  const kids: Kid[] = [];
  let n = start;
  for (const s of schools) {
    for (const [bso, count] of split[s.id] ?? []) {
      for (let i = 0; i < count; i++) {
        const days = ATTEND.map((p) => r() < p) as Week<boolean>;
        if (!days.some(Boolean)) days[Math.floor(r() * 5)] = true;
        let g = r() * GROUP_WEIGHTS.reduce((a, b) => a + b, 0);
        let group = 1;
        for (let k = 0; k < GROUP_WEIGHTS.length; k++) {
          g -= GROUP_WEIGHTS[k]!;
          if (g <= 0) {
            group = k + 1;
            break;
          }
        }
        kids.push({ id: `k${n++}`, name: name(), school: s.id, bso, days, group });
      }
    }
  }
  return kids;
}

export function sampleScenario(): Scenario {
  const bsos: Bso[] = [
    { id: "b1", name: "BSO De Boomhut", lat: 52.0003, lon: 4.3527, color: 0 },
    { id: "b2", name: "BSO Het Kasteel", lat: 52.0176, lon: 4.3702, color: 1 },
  ];
  const sch = (id: string, name: string, lat: number, lon: number, color: number, out: Week<number | null>, escort = false): School => ({ id, name, lat, lon, color, out, escort });
  const schools: School[] = [
    sch("s1", "De Regenboog", 51.9934, 4.3478, 0, [T(14), T(14), T(12, 15), T(14), T(12)], true),
    sch("s2", "Het Kompas", 52.0121, 4.3763, 1, [T(15, 15), T(15, 15), T(12, 30), T(15, 15), T(15, 15)]),
    sch("s3", "Sint Jozefschool", 52.0104, 4.3488, 2, [T(14, 15), T(14, 15), T(12, 15), T(14, 15), T(14, 15)], true),
    sch("s4", "De Wilgenhoek", 52.0051, 4.3388, 3, [T(14), T(14), T(12, 30), T(14), T(12)]),
    sch("s5", "Montessori De Vlinder", 52.0031, 4.3762, 4, [T(14, 45), T(14, 45), T(12, 15), T(14, 45), T(14, 45)]),
    sch("s6", "De Zonnewijzer", 51.9961, 4.3331, 8, [T(14, 15), T(14, 15), T(12, 30), T(14, 15), T(12, 30)]),
    sch("s7", "Het Palet", 52.0226, 4.3579, 9, [T(15), T(15), T(12), T(15), T(15)]),
  ];
  const split: Record<string, [string, number][]> = {
    s1: [["b1", 13], ["b2", 5]],
    s2: [["b2", 7]],
    s3: [["b2", 15], ["b1", 5]],
    s4: [["b1", 12]],
    s5: [["b2", 5]],
    s6: [["b1", 11], ["b2", 4]],
    s7: [["b2", 9]],
  };
  const kids = makeKids(rng(7), nameMaker(42), schools, split);
  const vehicles: Vehicle[] = [
    { id: "v1", name: "Busje 1", seats: 8, color: 6, home: "b1", days: week(true), driver: null },
    { id: "v2", name: "Busje 2", seats: 8, color: 5, home: "b2", days: week(true), driver: null },
    { id: "v3", name: "Busje 3", seats: 8, color: 11, home: "b2", days: week(true), driver: null },
    { id: "v4", name: "Grote bus", seats: 16, color: 7, home: "b1", days: week(true), driver: "st2" },
  ];
  const all = week(true);
  const d = (...on: number[]) => [0, 1, 2, 3, 4].map((i) => on.includes(i)) as Week<boolean>;
  const staff: Staff[] = [
    { id: "st1", name: "Anouk Visser", home: "b1", licence: 1, days: all, from: T(11, 30), until: T(18, 30) },
    { id: "st2", name: "Henk Bosman", home: "b1", licence: 2, days: d(0, 1, 3), from: T(11, 30), until: T(17, 30) },
    { id: "st3", name: "Fatima El Amrani", home: "b2", licence: 1, days: d(0, 1, 2, 3), from: T(11, 30), until: T(18, 30) },
    { id: "st4", name: "Mark de Haan", home: "b2", licence: 1, days: d(1, 2, 3, 4), from: T(11, 30), until: T(18) },
    { id: "st5", name: "Yusuf Demir", home: "b2", licence: 1, days: d(0, 2, 4), from: T(11, 30), until: T(18, 30) },
    { id: "st6", name: "Sanne Kuipers", home: "b1", licence: 0, days: all, from: T(11, 30), until: T(18, 30) },
    { id: "st7", name: "Ilse Verbeek", home: "b2", licence: 0, days: d(0, 1, 3, 4), from: T(11, 30), until: T(18, 30) },
    { id: "st8", name: "Lotte Brouwer", home: "b1", licence: 0, days: d(0, 1, 2), from: T(12), until: T(17) },
  ];
  const rides: Ride[] = [
    { id: "r1", who: "Noor Jansen (invaller)", from: "b2", to: "b1", after: T(14, 20), before: T(14, 50), days: d(0, 3) },
    { id: "r2", who: "Lotte Brouwer", from: "b1", to: "s7", after: T(14, 30), before: T(14, 55), days: d(1) },
  ];
  return { version: 2, name: "Delft", bsos, schools, kids, vehicles, staff, rides, rules: { ...DEFAULT_RULES }, absent: [[], [], [], [], []] };
}

/** A random town around `o`: 2–3 BSOs, 5–9 schools of 5–20 children, some split over two BSOs. */
export function randomScenario(seed: number, o = { lat: 52.0116, lon: 4.3571 }): Scenario {
  const r = rng(seed);
  const nB = 2 + (r() < 0.3 ? 1 : 0);
  const nS = 5 + Math.floor(r() * 5);
  const at = (rad: number) => {
    const a = r() * Math.PI * 2;
    const d = rad * Math.sqrt(r());
    const g = fromLocal(Math.cos(a) * d, Math.sin(a) * d, o);
    return { lat: +g.lat.toFixed(5), lon: +g.lon.toFixed(5) };
  };
  const bsos: Bso[] = Array.from({ length: nB }, (_, i) => ({ id: `b${i + 1}`, name: BSO_NAMES[i]!, ...at(1.8), color: i }));
  const outs = [T(14), T(14), T(14, 15), T(14, 30), T(14, 45), T(15), T(15, 15)];
  const names = [...SCHOOL_NAMES].sort(() => r() - 0.5);
  const colors = [0, 1, 2, 3, 4, 8, 9, 5, 6, 10, 11, 7];
  const schools: School[] = Array.from({ length: nS }, (_, i) => {
    const mon = outs[Math.floor(r() * outs.length)]!;
    const wed = r() < 0.5 ? T(12, 15) : T(12, 30);
    const fri = r() < 0.35 ? T(12) : mon;
    return { id: `s${i + 1}`, name: names[i % names.length]!, ...at(2.8), color: colors[i % colors.length]!, out: [mon, mon, wed, mon, fri], escort: r() < 0.25 };
  });
  const split: Record<string, [string, number][]> = {};
  for (const s of schools) {
    const total = 5 + Math.floor(r() * 16);
    const near = [...bsos].sort((a, b) => Math.hypot(a.lat - s.lat, a.lon - s.lon) - Math.hypot(b.lat - s.lat, b.lon - s.lon));
    if (total >= 12 && r() < 0.45) {
      const minor = 3 + Math.floor(r() * 4);
      split[s.id] = [[near[0]!.id, total - minor], [near[1]!.id, minor]];
    } else split[s.id] = [[near[0]!.id, total]];
  }
  const kids = makeKids(r, nameMaker(seed), schools, split);
  const vehicles: Vehicle[] = [
    ...Array.from({ length: 2 + Math.floor(r() * 2) }, (_, i) => ({ id: `v${i + 1}`, name: `Busje ${i + 1}`, seats: 8, color: [6, 5, 11][i]!, home: bsos[i % nB]!.id, days: week(true), driver: null })),
  ];
  vehicles.push({ id: `v${vehicles.length + 1}`, name: "Grote bus", seats: 16, color: 7, home: bsos[0]!.id, days: week(true), driver: null });
  const pn = nameMaker(seed + 1);
  const staff: Staff[] = Array.from({ length: 7 }, (_, i) => ({
    id: `st${i + 1}`,
    name: pn(),
    home: bsos[i % nB]!.id,
    licence: (i === 0 ? 2 : i <= vehicles.length - 1 ? 1 : 0) as 0 | 1 | 2,
    days: [0, 1, 2, 3, 4].map(() => r() < 0.8) as Week<boolean>,
    from: T(11, 30),
    until: T(18, 30),
  }));
  return { version: 2, name: `Willekeurig ${seed % 1000}`, bsos, schools, kids, vehicles, staff, rides: [], rules: { ...DEFAULT_RULES }, absent: [[], [], [], [], []] };
}

/** An empty week: one BSO, nothing else. */
export function emptyScenario(o = { lat: 52.0116, lon: 4.3571 }): Scenario {
  return {
    version: 2,
    name: "Nieuw",
    bsos: [{ id: "b1", name: "BSO", lat: o.lat, lon: o.lon, color: 0 }],
    schools: [],
    kids: [],
    vehicles: [{ id: "v1", name: "Busje 1", seats: 8, color: 6, home: "b1", days: week(true), driver: null }],
    staff: [],
    rides: [],
    rules: { ...DEFAULT_RULES },
    absent: [[], [], [], [], []],
  };
}
