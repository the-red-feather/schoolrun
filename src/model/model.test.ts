import { describe, expect, test } from "bun:test";
import { checkScenario } from "./check";
import { buildDay, kidsToday } from "./day";
import { haversine } from "./geo";
import { randomScenario, sampleScenario } from "./sample";
import { finalize, schedule, timeRun } from "./schedule";
import { trips } from "./sim";
import { Solver, covers, greedy, pinsToday } from "./solver";
import { ALL_DAYS, hhmm, parseHhmm, type Day, type Scenario } from "./types";

const solve = (sc: Scenario, day: Day, iterations = 6000) => {
  const dm = buildDay(sc, day);
  const s = new Solver(dm, { seed: 3, iterations });
  const res = finalize(dm, s.run());
  return { dm, s, res };
};

describe("the sample week", () => {
  const sc = sampleScenario();
  test("two BSOs, seven schools of 5 to 20 children, some split over both", () => {
    expect(sc.bsos.length).toBe(2);
    expect(sc.schools.length).toBe(7);
    for (const s of sc.schools) {
      const n = sc.kids.filter((k) => k.school === s.id).length;
      expect(n).toBeGreaterThanOrEqual(5);
      expect(n).toBeLessThanOrEqual(20);
    }
    const split = sc.schools.filter((s) => new Set(sc.kids.filter((k) => k.school === s.id).map((k) => k.bso)).size > 1);
    expect(split.length).toBeGreaterThanOrEqual(2);
    expect(new Set(sc.kids.map((k) => k.name)).size).toBe(sc.kids.length);
  });

  test("Henk is the only one with a bus licence: no bus on Wednesday", () => {
    const wed = buildDay(sc, 2);
    expect(wed.crew.some((c) => c.vehicle.id === "v4")).toBe(false);
    expect(wed.issues.some((i) => i.kind === "noDriver" && i.bus)).toBe(true);
    const mon = buildDay(sc, 0);
    expect(mon.crew.find((c) => c.vehicle.id === "v4")?.driver.name).toBe("Henk Bosman");
  });

  for (const day of ALL_DAYS) {
    test(`day ${day}: everyone once, never over the seats, home at their own BSO`, () => {
      const { dm, res } = solve(sc, day);
      const plan = new Solver(dm, { seed: 3, iterations: 6000 });
      plan.run();
      expect(covers(dm, plan.best)).toBe(true);
      expect(res.over).toBe(0);
      const tr = trips(res);
      const today = kidsToday(sc, day).filter((k) => sc.schools.find((s) => s.id === k.school)!.out[day] != null);
      expect(tr.size).toBe(today.length);
      for (const k of today) {
        const t = tr.get(k.id)!;
        const s = sc.schools.find((x) => x.id === k.school)!;
        expect(t.board.pickup).toBeGreaterThanOrEqual(s.out[day]! - 1e-6);
        const off = t.run.stops.find((st) => st.off.includes(t.board))!;
        expect(off.place).toBe(k.bso);
        expect(t.board.deliver).toBeGreaterThan(t.board.pickup);
      }
      for (const d of res.days)
        for (const r of d.runs) {
          expect(r.maxLoad).toBeLessThanOrEqual(d.crew.vehicle.seats);
          if (r.needsEscort) expect(r.escort === null || dm.helpers.some((h) => h.id === r.escort) || res.days.some((x) => !x.runs.length && x.crew.driver.id === r.escort)).toBe(true);
        }
    });
  }

  test("a run leaves no earlier than its vehicle is free, and starts where the last one ended", () => {
    const { res } = solve(sc, 0);
    for (const d of res.days) {
      let at = d.crew.vehicle.home;
      let free = d.crew.from;
      for (const r of d.runs) {
        expect(r.start).toBe(at);
        expect(r.depart).toBeGreaterThanOrEqual(free - 1e-6);
        at = r.end;
        free = r.back;
      }
    }
  });

  test("a lift arrives where it should", () => {
    const { res } = solve(sc, 0);
    const lift = res.days.flatMap((d) => d.runs.flatMap((r) => r.boards.map((b) => ({ r, b })))).find((x) => x.b.key === "r|r1")!;
    expect(lift).toBeTruthy();
    const on = lift.r.stops.find((s) => s.on.includes(lift.b))!;
    const off = lift.r.stops.find((s) => s.off.includes(lift.b))!;
    expect(on.place).toBe("b2");
    expect(off.place).toBe("b1");
    expect(lift.b.pickup).toBeGreaterThanOrEqual(14 * 60 + 20);
  });

  test("the solver only ever improves on greedy", () => {
    const dm = buildDay(sc, 1);
    const g = schedule(dm, greedy(dm)).cost;
    const s = new Solver(dm, { seed: 1, iterations: 4000 });
    expect(s.run().cost).toBeLessThanOrEqual(g + 1e-9);
  });

  test("without the bus driver on a full day, children wait too long", () => {
    const x = structuredClone(sc);
    x.absent[0] = ["st2"];
    const { res, dm } = solve(x, 0, 8000);
    expect(dm.crew.length).toBe(3);
    expect(res.lateKids).toBeGreaterThan(0);
  });

  test("a plan follows small changes: one child less, it still covers", () => {
    const dm = buildDay(sc, 0);
    const s = new Solver(dm, { seed: 1, iterations: 3000 });
    s.run();
    const x = structuredClone(sc);
    x.absent[0] = [x.kids.find((k) => k.days[0])!.id];
    const dm2 = buildDay(x, 0);
    const s2 = new Solver(dm2, { seed: 1, iterations: 0, from: s.best, vehicles: dm.crew.map((c) => c.vehicle.id) });
    expect(covers(dm2, s2.best)).toBe(true);
  });
});

describe("random weeks", () => {
  for (const seed of [1, 2, 3, 4]) {
    test(`seed ${seed}: solves every day`, () => {
      const sc = randomScenario(seed);
      for (const day of [0, 4] as Day[]) {
        const { dm, res } = solve(sc, day, 1500);
        if (!dm.crew.length) continue;
        expect(res.over).toBe(0);
        expect(trips(res).size).toBe([...dm.jobs.values()].reduce((n, j) => n + j.kids.length, 0));
      }
    });
  }
});

describe("storage", () => {
  test("a scenario survives JSON", () => {
    const sc = sampleScenario();
    expect(checkScenario(JSON.parse(JSON.stringify(sc)))).toEqual(sc);
  });
  test("garbage is refused, broken references are fixed", () => {
    expect(checkScenario(null)).toBeNull();
    expect(checkScenario({ hello: 1 })).toBeNull();
    const sc = sampleScenario() as any;
    sc.kids[0].bso = "nope";
    sc.kids[1].school = "nope";
    sc.vehicles[0].driver = "nobody";
    sc.rules.speed = 9999;
    const ok = checkScenario(sc)!;
    expect(ok.kids[0]!.bso).toBe("b1");
    expect(ok.kids.length).toBe(85);
    expect(ok.vehicles[0]!.driver).toBeNull();
    expect(ok.rules.speed).toBe(120);
  });
  test("the first version's scenarios are read", () => {
    const v1 = {
      hub: { id: "hub", name: "Club", x: 5, y: 5 },
      places: [{ id: "p1", name: "Centrum", x: 2, y: 3 }],
      schools: [{ id: "s1", name: "De Regenboog", place: "p1", out: 840, kids: 6 }],
      buses: [{ id: "b1", name: "Bus 1", seats: 8, color: 0 }],
      rules: { speed: 30 },
    };
    const sc = checkScenario(v1)!;
    expect(sc.version).toBe(2);
    expect(sc.kids.length).toBe(6);
    expect(sc.bsos[0]!.name).toBe("Club");
    expect(buildDay(sc, 0).crew.length).toBe(1);
  });
});

test("times and distances", () => {
  expect(hhmm(14 * 60 + 5)).toBe("14:05");
  expect(parseHhmm("9.30")).toBe(570);
  expect(parseHhmm("25:00")).toBeNull();
  expect(parseHhmm("1415")).toBe(14 * 60 + 15);
  expect(parseHhmm("14")).toBe(14 * 60);
  expect(parseHhmm("abc")).toBeNull();
  const d = haversine({ lat: 52, lon: 4.35 }, { lat: 52.01, lon: 4.35 });
  expect(d).toBeGreaterThan(1.1);
  expect(d).toBeLessThan(1.12);
});

test("a run waits at the BSO, not on the way: it leaves as late as costs nobody anything", () => {
  const dm = buildDay(sampleScenario(), 3);
  const x = timeRun(dm, [{ key: "r|r1", n: 1 }, { key: "k|s6|b2", n: 3 }], "b1", 11 * 60 + 45, 18 * 60);
  // the lift is ready at 14:20: no leaving at a quarter to twelve to wait two and a half hours
  expect(x.depart).toBeGreaterThan(14 * 60);
  expect(x.stops[0]!.on[0]!.pickup - x.stops[0]!.arrive).toBeLessThan(1);
});

describe("pins: pickups fixed by hand", () => {
  const sc = sampleScenario();
  const onVehicle = (res: ReturnType<typeof finalize>, key: string, vehicle: string) =>
    res.days.filter((d) => d.crew.vehicle.id === vehicle).flatMap((d) => d.runs.flatMap((r) => r.boards.filter((b) => b.key === key && b.pin)));

  test("a pinned pickup stays on its vehicle with its count, whatever the solver does", () => {
    // De Regenboog's 12 for De Boomhut: 5 of them with Busje 3 (parked at the other BSO)
    const pins = [{ key: "k|s1|b1", vehicle: "v3", n: 5 }, { key: "r|r1", vehicle: "v4", n: 1 }];
    const dm = buildDay(sc, 0);
    for (const seed of [1, 2]) {
      const s = new Solver(dm, { seed, iterations: 5000, pins });
      const res = finalize(dm, s.run());
      expect(covers(dm, s.best)).toBe(true);
      expect(onVehicle(res, "k|s1|b1", "v3").reduce((n, b) => n + b.n, 0)).toBe(5);
      expect(onVehicle(res, "r|r1", "v4").length).toBe(1);
      expect(trips(res).size).toBe([...dm.jobs.values()].reduce((n, j) => n + j.kids.length, 0));
    }
  });

  test("a pin bigger than its group is capped; a pin on a vehicle that doesn't drive is let go", () => {
    const x = structuredClone(sc);
    x.absent[0] = ["st2"]; // no bus today
    const dm = buildDay(x, 0);
    const total = dm.jobs.get("k|s4|b1")!.total;
    const pins = [{ key: "k|s4|b1", vehicle: "v1", n: 99 }, { key: "k|s1|b1", vehicle: "v4", n: 6 }];
    const s = new Solver(dm, { seed: 1, iterations: 3000, pins });
    const res = finalize(dm, s.run());
    expect(covers(dm, s.best)).toBe(true);
    expect(onVehicle(res, "k|s4|b1", "v1").reduce((n, b) => n + b.n, 0)).toBe(total);
    expect(pinsToday(dm, pins).map((p) => p.holds)).toEqual([true, false]);
  });

  test("pins survive storage, and nonsense pins don't", () => {
    const x = structuredClone(sc) as any;
    x.pins[2] = [{ key: "k|s1|b1", vehicle: "v3", n: 4 }, { key: "nonsense", vehicle: "v3", n: 1 }, { key: "r|r1", vehicle: "gone", n: 1 }];
    expect(checkScenario(x)!.pins[2]).toEqual([{ key: "k|s1|b1", vehicle: "v3", n: 4 }]);
  });
});
