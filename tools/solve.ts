// bun tools/solve.ts [day]: solve the sample week and print it (a check of the model, no UI).
import { buildDay } from "../src/model/day";
import { sampleScenario } from "../src/model/sample";
import { Solver } from "../src/model/solver";
import { finalize } from "../src/model/schedule";
import { hhmm, type Day } from "../src/model/types";
const sc = sampleScenario();
const days = process.argv[2] ? [+process.argv[2] as Day] : ([0, 1, 2, 3, 4] as Day[]);
for (const day of days) {
  const dm = buildDay(sc, day);
  const t0 = performance.now();
  const s = new Solver(dm, { seed: 1 });
  const g = s.bestResult.cost;
  const res = finalize(dm, s.run());
  const ms = performance.now() - t0;
  console.log(`\n== day ${day}: ${[...dm.jobs.values()].reduce((n, j) => n + (j.kind === "kids" ? j.total : 0), 0)} kids, ${dm.crew.length} vehicles, ${s.total} it, ${ms.toFixed(0)} ms, greedy ${g.toFixed(0)} → ${res.cost.toFixed(0)}`);
  console.log(`   wait max ${res.waitMax.toFixed(1)} avg ${(res.waitTotal / Math.max(1, res.kids)).toFixed(1)} · ride avg ${(res.rideTotal / Math.max(1, res.kids)).toFixed(1)} · lateKids ${res.lateKids} · over ${res.over} · escortMissing ${res.escortMissing} · ridesLate ${res.ridesLate} · overtime ${res.overtime.toFixed(0)} · done ${hhmm(res.done)} · km ${res.km.toFixed(1)}`);
  console.log("   issues:", dm.issues.map((i) => i.kind + ("vehicle" in i ? ":" + i.vehicle.name : "")).join(", ") || "-");
  for (const d of res.days) {
    console.log(`   ${d.crew.vehicle.name} (${d.crew.driver.name})`);
    for (const r of d.runs) {
      const P = (id: string) => dm.place.get(id)!.name;
      console.log(`     ${hhmm(r.depart)} ${P(r.start)}${r.needsEscort ? ` +${r.escort ? sc.staff.find((s) => s.id === r.escort)!.name : "NOBODY"}` : ""} → ` + r.stops.map((st) => `${P(st.place)}@${hhmm(st.arrive)}${st.on.length ? " +" + st.on.map((b) => b.n + (b.wait > 0.5 ? `(w${b.wait.toFixed(0)})` : "")).join("+") : ""}${st.off.length ? " -" + st.off.map((b) => b.n).join("-") : ""}`).join(" → ") + ` | ${hhmm(r.back)} max ${r.maxLoad}/${d.crew.vehicle.seats}`);
    }
  }
}
