/**
 * PLANNING: today's puzzle solved. The numbers, today's crew (tap someone to
 * call them in sick, tap a vehicle to take it off the road), what's wrong,
 * the map and the clock, who is where right now, the timeline, and every
 * run written out with the children's names: the driver's sheet.
 */
import { LitElement, css, html, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { L } from "../i18n";
import type { DayModel } from "../model/day";
import type { Board, Result, Run, VehicleDay } from "../model/schedule";
import { aboard, nextStop, runAt, vehicleAt, counts } from "../model/sim";
import { BSO_COLORS, PALETTE, hhmm, needsBusLicence, type Scenario } from "../model/types";
import { store, StoreController } from "../store";
import { icon, type IconName } from "./icons";
import { base } from "./shared";
import "./map";
import "./timeline";

interface Issue {
  level: "bad" | "warn" | "info";
  icon: IconName;
  text: string;
  detail?: string;
}

export function issuesOf(sc: Scenario, dm: DayModel, res: Result | null): Issue[] {
  const T = L().issues;
  const out: Issue[] = [];
  const staff = (id: string | null) => sc.staff.find((s) => s.id === id)?.name ?? "?";
  const name = (id: string) => dm.place.get(id)?.name ?? "?";
  for (const i of dm.issues) {
    if (i.kind === "noDriver") out.push({ level: "bad", icon: "warn", text: i.bus ? T.noBusDriver(i.vehicle.name) : T.noDriver(i.vehicle.name), detail: i.missing.length ? T.away(i.missing.map((s) => s.name)) : i.bus ? T.nobodyHasD : undefined });
    else if (i.kind === "substitute") out.push({ level: "info", icon: "person", text: T.substitute(i.vehicle.name, i.driver.name, i.by.name) });
    else if (i.kind === "noVehicles") out.push({ level: "bad", icon: "bus", text: T.noVehicles });
    else if (i.kind === "noPickup") out.push({ level: "warn", icon: "school", text: T.noPickup(i.school.name, i.kids) });
    else if (i.kind === "orphans") out.push({ level: "warn", icon: "warn", text: T.orphans(i.kids) });
    else if (i.kind === "tooBig") out.push({ level: "bad", icon: "warn", text: T.tooSmall });
  }
  if (!res) return out;
  if (res.over > 0) out.push({ level: "bad", icon: "bus", text: T.over(res.over) });
  if (res.lateKids > 0) {
    const per = new Map<string, { n: number; max: number }>();
    for (const d of res.days)
      for (const r of d.runs)
        for (const b of r.boards) {
          const j = dm.jobs.get(b.key);
          if (j?.kind !== "kids" || b.wait <= sc.rules.maxWait + 1e-6) continue;
          const x = per.get(j.from) ?? { n: 0, max: 0 };
          x.n += b.n;
          x.max = Math.max(x.max, b.wait);
          per.set(j.from, x);
        }
    out.push({
      level: "bad",
      icon: "clock",
      text: T.late(res.lateKids, sc.rules.maxWait, Math.round(res.waitMax)),
      detail: [...per].map(([id, x]) => `${name(id)}: ${x.n} (${Math.round(x.max)}′)`).join(" · "),
    });
  }
  if (res.escortMissing > 0) {
    const runs = res.days.flatMap((d) => d.runs.filter((r) => r.needsEscort && !r.escort).map((r) => `${d.crew.vehicle.name} ${hhmm(r.depart)}`));
    out.push({ level: "bad", icon: "hand", text: T.noEscort(res.escortMissing), detail: runs.join(" · ") });
  }
  if (res.ridesLate > 0) {
    for (const d of res.days)
      for (const r of d.runs)
        for (const b of r.boards) {
          const j = dm.jobs.get(b.key);
          if (j?.kind === "ride" && b.deliver > j.due + 1e-6) out.push({ level: "warn", icon: "person", text: T.liftLate(j.ride!.who, name(j.to), Math.round(b.deliver - j.due)) });
        }
  }
  for (const d of res.days) if (d.overtime > 0.5) out.push({ level: "warn", icon: "clock", text: T.overtime(d.crew.driver.name, Math.round(d.overtime), hhmm(d.home)) });
  void staff;
  return out;
}

@customElement("sr-plan")
export class SrPlan extends LitElement {
  private ctl = new StoreController(this);
  @state() private open = new Set<string>();

  static override styles = [
    base,
    css`
      :host {
        display: block;
      }
      .page {
        display: grid;
        gap: 18px;
      }
      .kpis {
        display: grid;
        grid-template-columns: repeat(7, minmax(0, 1fr));
        gap: 10px;
      }
      @media (max-width: 1100px) {
        .kpis {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }
      }
      @media (max-width: 560px) {
        .kpis {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
      .kpi {
        border-radius: 14px;
        padding: 10px 14px 11px;
        background: color-mix(in oklab, var(--c) 13%, var(--surface));
        border: 1.5px solid color-mix(in oklab, var(--c) 35%, transparent);
        min-width: 0;
        position: relative;
        overflow: hidden;
      }
      .kpi b {
        display: block;
        font-family: var(--mono);
        font-size: 1.55rem;
        font-weight: 700;
        letter-spacing: -0.03em;
        line-height: 1.2;
        color: color-mix(in oklab, var(--c) 70%, var(--ink));
        white-space: nowrap;
      }
      .kpi span {
        font-size: 0.75rem;
        font-weight: 700;
        color: var(--dim);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        display: block;
      }
      .today {
        display: grid;
        gap: 10px;
      }
      .today .row {
        gap: 6px;
      }
      .today .label {
        width: 108px;
        flex: none;
      }
      @media (max-width: 640px) {
        .today .label {
          width: 100%;
        }
      }
      .chip {
        cursor: pointer;
      }
      .chip:hover {
        border-color: var(--ink);
      }
      .chip.out {
        opacity: 0.5;
        text-decoration: line-through;
        border-style: dashed;
      }
      .chip.bad {
        border-color: var(--bad);
        color: var(--bad);
      }
      .chip small {
        font-weight: 500;
        color: var(--dim);
      }
      .main {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 360px;
        gap: 18px;
        align-items: start;
      }
      @media (max-width: 1100px) {
        .main {
          grid-template-columns: minmax(0, 1fr);
        }
      }
      .mapcol {
        display: grid;
        gap: 10px;
        min-width: 0;
      }
      sr-map {
        height: clamp(420px, 62vh, 700px);
      }
      .bar {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }
      .bar input[type="range"] {
        flex: 1;
        min-width: 160px;
      }
      .play {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        border: none;
        background: var(--pop);
        color: #fff;
        display: grid;
        place-items: center;
        cursor: pointer;
        box-shadow: 0 4px 14px color-mix(in oklab, var(--pop) 40%, transparent);
      }
      .play:hover {
        filter: brightness(1.08);
      }
      .solving {
        font-size: 0.8rem;
        color: var(--dim);
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }
      .meter {
        width: 80px;
        height: 5px;
        border-radius: 3px;
        background: var(--hair);
        overflow: hidden;
      }
      .meter i {
        display: block;
        height: 100%;
        background: linear-gradient(90deg, var(--c0), var(--c2), var(--c4), var(--c6));
      }
      .side {
        display: grid;
        gap: 14px;
        min-width: 0;
      }
      .issues {
        display: grid;
        gap: 8px;
      }
      .issue {
        display: grid;
        grid-template-columns: 22px minmax(0, 1fr);
        gap: 8px;
        padding: 9px 11px;
        border-radius: 11px;
        font-size: 0.86rem;
        line-height: 1.35;
        background: color-mix(in oklab, var(--c) 11%, var(--surface));
        border: 1.5px solid color-mix(in oklab, var(--c) 40%, transparent);
      }
      .issue .ic {
        color: var(--c);
        padding-top: 1px;
      }
      .issue small {
        display: block;
        color: var(--dim);
        margin-top: 2px;
        font-size: 0.78rem;
      }
      .issue.bad {
        --c: var(--bad);
      }
      .issue.warn {
        --c: var(--warn);
      }
      .issue.info {
        --c: var(--c6);
      }
      .issue.good {
        --c: var(--good);
        font-weight: 600;
      }
      .now {
        display: grid;
        gap: 10px;
      }
      .veh {
        display: grid;
        gap: 6px;
        padding-bottom: 10px;
        border-bottom: 1px solid var(--hair);
      }
      .veh:last-child {
        border-bottom: none;
        padding-bottom: 0;
      }
      .veh .head {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 700;
        font-size: 0.9rem;
      }
      .veh .status {
        font-size: 0.82rem;
        color: var(--dim);
      }
      .names {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
      }
      .kid {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 0.74rem;
        font-weight: 600;
        padding: 2px 7px 2px 3px;
        border-radius: 999px;
        background: var(--surface-2);
        border: 1px solid var(--hair);
        white-space: nowrap;
      }
      .kid i {
        width: 9px;
        height: 9px;
        border-radius: 50%;
        display: inline-block;
      }
      .kid.staff {
        background: var(--ink);
        color: var(--bg);
        border-color: var(--ink);
      }
      .bsobar {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 4px 10px;
        align-items: center;
        font-size: 0.84rem;
        font-weight: 600;
      }
      .prog {
        grid-column: 1 / -1;
        height: 8px;
        border-radius: 4px;
        background: var(--hair);
        overflow: hidden;
      }
      .prog i {
        display: block;
        height: 100%;
        border-radius: 4px;
        transition: width 0.15s;
      }
      .runs {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
        gap: 14px;
      }
      @media (max-width: 560px) {
        .runs {
          grid-template-columns: minmax(0, 1fr);
        }
      }
      .vcard {
        border-top: 6px solid var(--c);
        padding-top: 12px;
      }
      .run {
        border-radius: 10px;
        padding: 8px 10px;
        cursor: pointer;
        border: 1.5px solid transparent;
      }
      .run:hover {
        background: var(--surface-2);
      }
      .run.now {
        border-color: var(--c);
        background: color-mix(in oklab, var(--c) 8%, var(--surface));
      }
      .run .when {
        font-family: var(--mono);
        font-size: 0.8rem;
        font-weight: 700;
      }
      .chain {
        font-size: 0.85rem;
        line-height: 1.5;
      }
      .chain b {
        font-weight: 700;
      }
      .stops {
        display: grid;
        gap: 6px;
        margin-top: 8px;
        padding-left: 10px;
        border-left: 2px dashed color-mix(in oklab, var(--c) 50%, transparent);
      }
      .stop {
        font-size: 0.8rem;
      }
      .stop .t {
        font-family: var(--mono);
        color: var(--dim);
        margin-right: 6px;
      }
      .esc {
        font-size: 0.8rem;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        color: var(--dim);
      }
      .esc.missing {
        color: var(--bad);
        font-weight: 700;
      }
      .empty {
        font-size: 0.85rem;
        color: var(--dim);
        padding: 4px 10px;
      }
    `,
  ];

  private toggleAway(id: string) {
    const day = store.prefs.day;
    store.edit(
      (sc) => {
        const a = sc.absent[day];
        sc.absent[day] = a.includes(id) ? a.filter((x) => x !== id) : [...a, id];
      },
      { now: true },
    );
  }

  override render() {
    const sc = store.sc;
    const dm = store.rdm;
    const res = store.res;
    return html`<div class="page">
      ${this.kpis(res)} ${this.today(sc, dm, res)}
      <div class="main">
        <div class="mapcol">
          <sr-map></sr-map>
          ${this.bar()}
        </div>
        <div class="side">
          <section class="card">
            <div class="card-head"><h2>${L().plan.problems}</h2></div>
            ${this.issues(sc, dm, res)}
          </section>
          <section class="card">
            <div class="card-head"><h2 class="grow">${L().plan.now}</h2><span class="mono" style="font-weight:700">${hhmm(store.t)}</span></div>
            ${this.now(sc, dm, res)}
          </section>
        </div>
      </div>
      <section class="card">
        <div class="card-head"><h2 class="grow">${L().plan.afternoon}</h2></div>
        <sr-timeline></sr-timeline>
      </section>
      <section>
        <div class="card-head"><h2 class="grow">${L().plan.runs}</h2><span class="hint">${L().plan.runsHint}</span></div>
        <div class="runs">${(res?.days ?? []).map((d) => this.vehicleCard(d, dm))}</div>
      </section>
    </div>`;
  }

  private kpis(res: Result | null) {
    const sc = store.sc;
    const kids = res?.kids ?? 0;
    const k = (c: string, v: string, l: string) => html`<div class="kpi" style="--c:${c}"><b>${v}</b><span>${l}</span></div>`;
    const wait = res ? Math.round(res.waitMax) : 0;
    const issues = issuesOf(sc, store.rdm, res).filter((i) => i.level !== "info").length;
    return html`<div class="kpis">
      ${k("var(--c6)", String(kids), L().kpi.kids)} ${k("var(--c5)", String(res?.runs ?? 0), L().kpi.runs)}
      ${k(wait > sc.rules.maxWait ? "var(--bad)" : wait > sc.rules.maxWait / 2 ? "var(--warn)" : "var(--good)", res ? `${wait}′` : "–", L().kpi.maxWait)}
      ${k("var(--c1)", res && kids ? `${(res.waitTotal / kids).toFixed(1)}′` : "–", L().kpi.avgWait)} ${k("var(--c8)", res && kids ? `${Math.round(res.rideTotal / kids)}′` : "–", L().kpi.avgRide)}
      ${k("var(--c7)", res && res.runs ? hhmm(res.done) : "–", L().kpi.done)} ${k(issues ? "var(--bad)" : "var(--good)", issues ? String(issues) : "✓", L().kpi.problems)}
    </div>`;
  }

  private today(sc: Scenario, dm: DayModel, res: Result | null) {
    const day = store.prefs.day;
    const away = new Set(sc.absent[day]);
    const roles = new Map<string, string>();
    const esc = new Map<string, number>();
    for (const d of res?.days ?? []) for (const r of d.runs) if (r.escort) esc.set(r.escort, (esc.get(r.escort) ?? 0) + 1);
    for (const d of res?.days ?? []) roles.set(d.crew.driver.id, d.runs.length ? L().plan.drives(d.crew.vehicle.name) : L().plan.standby(d.crew.vehicle.name));
    for (const [id, n] of esc) roles.set(id, roles.has(id) ? `${roles.get(id)} · ${L().plan.escorts(n)}` : L().plan.escorts(n));
    const dayName = L().days[day];
    return html`<section class="card today">
      <div class="row wrap">
        <span class="label">${L().plan.vehiclesToday}</span>
        ${sc.vehicles.map((v) => {
          const crew = dm.crew.find((c) => c.vehicle.id === v.id);
          const parked = dm.parked.find((p) => p.vehicle.id === v.id);
          const out = parked?.why === "away";
          const bad = parked?.why === "noDriver";
          return html`<button class="chip ${out ? "out" : ""} ${bad ? "bad" : ""}" title=${out ? L().plan.backOnRoad(v.name, dayName) : L().plan.offRoad(v.name, dayName)} @click=${() => this.toggleAway(v.id)}>
            <i class="sq" style="background:${PALETTE[v.color % PALETTE.length]}"></i>${v.name} <small class="mono">${v.seats}</small>
            ${needsBusLicence(v) ? html`<span class="lic d">D</span>` : nothing}
            <small>${crew ? crew.driver.name.split(" ")[0] : bad ? html`<b style="color:var(--bad)">${L().plan.noDriverShort}</b>` : L().plan.inGarage}</small>
          </button>`;
        })}
      </div>
      <div class="row wrap">
        <span class="label">${L().plan.staffToday}</span>
        ${sc.staff
          .filter((s) => s.days[day])
          .map((s) => {
            const out = away.has(s.id);
            return html`<button class="chip ${out ? "out" : ""}" title=${out ? L().plan.backIn(s.name, dayName) : L().plan.callIn(s.name, dayName)} @click=${() => this.toggleAway(s.id)}>
              ${s.licence ? html`<span class="lic ${s.licence === 2 ? "d" : ""}">${s.licence === 2 ? "D" : "B"}</span>` : html`<span style="color:var(--dim)">${icon("person", 15)}</span>`}
              ${s.name} <small>${out ? L().plan.sick : (roles.get(s.id) ?? "")}</small>
            </button>`;
          })}
        ${sc.staff.some((s) => !s.days[day]) ? html`<span class="hint">${L().plan.offToday(sc.staff.filter((s) => !s.days[day]).map((s) => s.name.split(" ")[0]!))}</span>` : nothing}
      </div>
    </section>`;
  }

  private bar() {
    const [lo, hi] = store.span();
    const speeds = [2, 6, 15, 30];
    return html`<div class="bar">
      <button class="play" title=${store.playing ? L().plan.pause : L().plan.play} @click=${() => store.togglePlay()} ?disabled=${!store.res?.runs}>${icon(store.playing ? "pause" : "play", 20)}</button>
      <button class="icon-btn" title=${L().plan.restart} @click=${() => (store.stop(), store.setTime(lo))}>${icon("restart")}</button>
      <input type="range" min=${lo} max=${hi} step="0.5" .value=${String(store.t)} @input=${(e: Event) => (store.stop(), store.setTime(+(e.target as HTMLInputElement).value))} aria-label=${L().plan.clock} />
      <div class="seg" title=${L().plan.speed}>
        ${speeds.map((s) => html`<button class=${store.prefs.speed === s ? "on" : ""} @click=${() => store.pref("speed", s)}>${s}×</button>`)}
      </div>
      <span class="solving">${store.solving ? html`${L().plan.solving}${store.attempt > 1 ? ` (${L().plan.attempt(store.attempt)})` : ""}<span class="meter"><i style="width:${store.progress * 100}%"></i></span>` : html`${icon("check", 15)} ${L().plan.solved}`}</span>
      <button class="btn small ghost" title=${L().plan.againTitle} @click=${() => store.solve(true)}>${icon("dice", 16)} ${L().plan.again}</button>
    </div>`;
  }

  private issues(sc: Scenario, dm: DayModel, res: Result | null) {
    const list = issuesOf(sc, dm, res);
    if (!list.some((i) => i.level !== "info"))
      list.unshift({ level: "info", icon: "check", text: res?.kids ? L().issues.allGood(res.kids, Math.round(res.waitMax)) : L().issues.nothingToDo });
    return html`<div class="issues">
      ${list.map((i, k) => html`<div class="issue ${i.level} ${k === 0 && i.icon === "check" ? "good" : ""}"><span class="ic">${icon(i.icon, 18)}</span><div>${i.text}${i.detail ? html`<small>${i.detail}</small>` : nothing}</div></div>`)}
    </div>`;
  }

  private kidChip(b: Board, dm: DayModel) {
    const j = dm.jobs.get(b.key);
    if (j?.kind === "ride") return html`<span class="kid staff">${icon("person", 11)} ${j.ride!.who}</span>`;
    const col = j?.school ? PALETTE[j.school.color % PALETTE.length] : "var(--dim)";
    return (b.kids ?? []).map((k) => html`<span class="kid" title=${`${j?.school?.name} → ${dm.place.get(j?.to ?? "")?.name}`}><i style="background:${col}"></i>${k.name.split(" ")[0]}</span>`);
  }

  private now(sc: Scenario, dm: DayModel, res: Result | null) {
    if (!res) return html`<p class="hint">…</p>`;
    const t = store.t;
    const name = (id: string) => dm.place.get(id)?.name ?? "?";
    const staff = (id: string | null) => sc.staff.find((s) => s.id === id)?.name.split(" ")[0] ?? "";
    const cnt = counts(dm, res, t);
    const vehicles = res.days.map((d) => {
      const run = runAt(d, t);
      const home = dm.place.get(d.crew.vehicle.home)!;
      const at = vehicleAt(d, home, t);
      const on = aboard(run, t);
      let status: string;
      if (run) {
        const nx = nextStop(run, t);
        if (!at.moving && at.place) {
          const st = run.stops.find((s) => s.place === at.place && s.arrive <= t && s.leave >= t);
          status = st && st.on.length && t >= (st.on[0]?.pickup ?? 0) ? L().now.boarding(name(at.place)) : st && st.off.length && t < st.arrive + sc.rules.drop ? L().now.dropping(name(at.place)) : L().now.waitingAt(name(at.place));
        } else status = L().now.to(nx ? name(nx.place) : "");
      } else if (!d.runs.length) status = L().now.notNeeded(name(d.crew.vehicle.home));
      else if (t < d.runs[0]!.depart) status = L().now.leavesAt(name(d.runs[0]!.start), hhmm(d.runs[0]!.depart));
      else {
        const next = d.runs.find((r) => r.depart > t);
        status = next ? L().now.leavesAt(name(next.start), hhmm(next.depart)) : at.moving ? L().now.home(name(d.crew.vehicle.home)) : L().now.done;
      }
      const col = PALETTE[d.crew.vehicle.color % PALETTE.length]!;
      return html`<div class="veh" style="--c:${col}">
        <div class="head"><i class="sq" style="background:${col}"></i><span class="grow ellipsis">${d.crew.vehicle.name} <span class="dim" style="font-weight:500">· ${d.crew.driver.name.split(" ")[0]}</span></span>
          ${run ? html`<span class="badge">${at.load}/${d.crew.vehicle.seats}</span>` : nothing}</div>
        <div class="status">${status}</div>
        ${on.length || run?.escort ? html`<div class="names">${run?.escort ? html`<span class="kid staff">${icon("hand", 11)} ${staff(run.escort)}</span>` : nothing}${on.map((b) => this.kidChip(b, dm))}</div>` : nothing}
      </div>`;
    });
    const waiting = sc.schools
      .map((s) => ({ s, c: cnt.schools.get(s.id) }))
      .filter((x) => x.c && x.c.waiting > 0)
      .map(
        ({ s, c }) =>
          html`<div class="row" style="font-size:.84rem"><i class="dot" style="background:${PALETTE[s.color % PALETTE.length]}"></i><span class="grow ellipsis"><b>${s.name}</b></span>
            <span class="badge" style="background:${c!.maxWait > sc.rules.maxWait ? "var(--bad)" : "var(--warn)"};color:#fff">${L().now.waitingN(c!.waiting)} · ${Math.round(c!.maxWait)}′</span></div>`,
      );
    return html`<div class="now">
      ${vehicles}
      ${waiting.length ? html`<div><span class="label">${L().now.stillWaiting}</span><div style="display:grid;gap:6px;margin-top:6px">${waiting}</div></div>` : nothing}
      <div style="display:grid;gap:10px">
        ${sc.bsos.map((b) => {
          const c = cnt.bsos.get(b.id);
          if (!c || !c.total) return nothing;
          const col = BSO_COLORS[b.color % BSO_COLORS.length];
          return html`<div class="bsobar"><span class="ellipsis">${b.name}</span><span class="mono">${c.in}/${c.total}</span><div class="prog"><i style="width:${(c.in / c.total) * 100}%;background:${col}"></i></div></div>`;
        })}
      </div>
    </div>`;
  }

  private vehicleCard(d: VehicleDay, dm: DayModel) {
    const v = d.crew.vehicle;
    const col = PALETTE[v.color % PALETTE.length]!;
    const sc = store.sc;
    const name = (id: string) => dm.place.get(id)?.name ?? "?";
    const staff = (id: string | null) => sc.staff.find((s) => s.id === id)?.name ?? "";
    const t = store.t;
    const runKey = (r: Run) => `${v.id}@${r.depart.toFixed(1)}`;
    return html`<div class="card vcard" style="--c:${col}">
      <div class="card-head" style="margin-bottom:6px">
        <i class="sq" style="background:${col};width:16px;height:16px"></i>
        <div class="grow"><h3>${v.name}</h3><div class="dim" style="font-size:.8rem">${L().plan.driver}: ${d.crew.driver.name} · ${v.seats} ${L().plan.seats} · ${d.km.toFixed(1)} km</div></div>
        <span class="badge">${d.runs.length}</span>
      </div>
      ${d.runs.length
        ? d.runs.map((r) => {
            const k = runKey(r);
            const open = this.open.has(k);
            const ons = r.stops.filter((s) => s.on.length);
            return html`<div
              class="run ${t >= r.depart && t <= r.back ? "now" : ""}"
              @click=${() => {
                store.stop();
                store.setTime(r.depart);
                const o = new Set(this.open);
                o.has(k) ? o.delete(k) : o.add(k);
                this.open = o;
              }}
            >
              <div class="row"><span class="when">${hhmm(r.depart)}–${hhmm(r.back)}</span><span class="grow"></span><span class="badge">${r.maxLoad}/${v.seats}</span>${icon("chevron", 14)}</div>
              <div class="chain">
                ${name(r.start)} ${r.stops.map((s) => html` → <b>${name(s.place)}</b>${s.on.length ? html` <span class="mono dim">+${s.on.reduce((n, b) => n + b.n, 0)}</span>` : nothing}${s.off.length ? html` <span class="mono dim">−${s.off.reduce((n, b) => n + b.n, 0)}</span>` : nothing}`)}
              </div>
              ${r.needsEscort ? html`<span class="esc ${r.escort ? "" : "missing"}">${icon("hand", 13)} ${r.escort ? L().plan.ridesAlong(staff(r.escort)) : L().plan.noEscort}</span>` : nothing}
              ${open
                ? html`<div class="stops">
                    ${r.stops.map(
                      (s) => html`<div class="stop">
                        <span class="t">${hhmm(s.arrive)}</span><b>${name(s.place)}</b>
                        ${s.off.length ? html` <span class="dim">· ${L().plan.off(s.off.reduce((n, b) => n + b.n, 0))}</span>` : nothing}
                        ${s.on.length ? html`<div class="names" style="margin-top:4px">${s.on.map((b) => this.kidChip(b, dm))}</div>` : nothing}
                      </div>`,
                    )}
                  </div>`
                : ons.length
                  ? html`<div class="names" style="margin-top:6px">${ons.flatMap((s) => s.on.map((b) => this.kidChip(b, dm)))}</div>`
                  : nothing}
            </div>`;
          })
        : html`<div class="empty">${L().plan.stays(name(v.home))}</div>`}
    </div>`;
  }
}
