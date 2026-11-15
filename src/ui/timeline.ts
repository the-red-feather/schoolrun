/**
 * The afternoon as a timeline: a row per vehicle (its runs, how full),
 * a row per school (out, waiting, picked up by whom), a row per lift
 * (the window, the ride). Drag anywhere to scrub the clock.
 */
import { LitElement, css, html, nothing } from "lit";
import { customElement } from "lit/decorators.js";
import { L } from "../i18n";
import { BSO_COLORS, PALETTE, hhmm, type School } from "../model/types";
import { store, StoreController } from "../store";
import { icon } from "./icons";
import { base } from "./shared";

@customElement("sr-timeline")
export class SrTimeline extends LitElement {
  private ctl = new StoreController(this);

  static override styles = [
    base,
    css`
      :host {
        display: block;
      }
      .tl {
        --name: 190px;
        position: relative;
        user-select: none;
        -webkit-user-select: none;
        touch-action: pan-y;
      }
      @media (max-width: 640px) {
        .tl {
          --name: 116px;
        }
      }
      .axis {
        position: relative;
        height: 22px;
        margin-left: var(--name);
      }
      .axis span {
        position: absolute;
        transform: translateX(-50%);
        font-size: 0.72rem;
        color: var(--dim);
        font-family: var(--mono);
        top: 2px;
      }
      .tick {
        position: absolute;
        top: 22px;
        bottom: 0;
        width: 0;
        border-left: 1px dashed var(--hair);
        pointer-events: none;
      }
      .tick.hour {
        border-left: 1px solid var(--hair-2);
      }
      .sec {
        display: block;
        margin: 14px 0 4px var(--name);
      }
      .r {
        display: grid;
        grid-template-columns: var(--name) minmax(0, 1fr);
        align-items: center;
        min-height: 30px;
      }
      .r.faded {
        opacity: 0.3;
      }
      .nm {
        display: flex;
        align-items: center;
        gap: 7px;
        padding-right: 10px;
        min-width: 0;
        font-size: 0.85rem;
        font-weight: 600;
        cursor: pointer;
      }
      .nm .t {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .nm small {
        display: block;
        font-weight: 500;
        color: var(--dim);
        font-size: 0.72rem;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .track {
        position: relative;
        height: 28px;
        border-bottom: 1px solid var(--hair);
        cursor: ew-resize;
      }
      .run {
        position: absolute;
        top: 3px;
        bottom: 3px;
        border-radius: 7px;
        border: 2px solid;
        overflow: hidden;
      }
      .run i {
        position: absolute;
        bottom: 0;
        opacity: 0.9;
      }
      .run .esc {
        position: absolute;
        right: 2px;
        top: 2px;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: var(--surface);
        display: grid;
        place-items: center;
      }
      .run .esc.missing {
        background: var(--bad);
        color: #fff;
      }
      .idle {
        position: absolute;
        inset: 6px 0;
        font-size: 0.75rem;
        color: var(--dim);
        display: flex;
        align-items: center;
        padding-left: 6px;
        gap: 6px;
      }
      .idle.bad {
        color: var(--bad);
        font-weight: 700;
      }
      .out {
        position: absolute;
        top: 4px;
        bottom: 4px;
        width: 3px;
        margin-left: -1.5px;
        border-radius: 2px;
      }
      .wait {
        position: absolute;
        top: 50%;
        height: 6px;
        margin-top: -3px;
        background: var(--warn);
        border-radius: 3px;
        opacity: 0.75;
      }
      .wait.late {
        background: var(--bad);
        opacity: 1;
      }
      .pick {
        position: absolute;
        top: 50%;
        width: 14px;
        height: 14px;
        margin: -7px 0 0 -7px;
        border-radius: 50%;
        box-shadow: 0 0 0 2px var(--surface);
        font-size: 0.6rem;
        font-weight: 800;
        color: #fff;
        display: grid;
        place-items: center;
        font-family: var(--mono);
      }
      .window {
        position: absolute;
        top: 7px;
        bottom: 7px;
        border-radius: 5px;
        border: 1.5px dashed var(--dim);
      }
      .lift {
        position: absolute;
        top: 10px;
        bottom: 10px;
        border-radius: 5px;
      }
      .cursor {
        position: absolute;
        top: 18px;
        bottom: 0;
        width: 0;
        border-left: 2px solid var(--pop);
        pointer-events: none;
      }
      .cursor b {
        position: absolute;
        top: -18px;
        left: 0;
        transform: translateX(-50%);
        background: var(--pop);
        color: #fff;
        font-family: var(--mono);
        font-size: 0.7rem;
        padding: 1px 5px;
        border-radius: 5px;
      }
      .legend {
        display: flex;
        flex-wrap: wrap;
        gap: 14px;
        font-size: 0.75rem;
        color: var(--dim);
        margin: 10px 0 0 var(--name);
      }
      .legend span {
        display: inline-flex;
        align-items: center;
        gap: 5px;
      }
    `,
  ];

  private scrub(e: PointerEvent) {
    if ((e.target as Element).closest(".nm")) return;
    const el = e.currentTarget as HTMLElement;
    const axis = el.querySelector(".axis") as HTMLElement | null;
    if (!axis) return;
    const set = (ev: PointerEvent) => {
      const r = axis.getBoundingClientRect();
      const f = Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width));
      const [lo, hi] = store.span();
      store.setTime(lo + f * (hi - lo));
    };
    store.stop();
    set(e);
    el.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => set(ev);
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  }

  override render() {
    const sc = store.sc;
    const dm = store.rdm;
    const res = store.res;
    const day = store.prefs.day;
    const [lo, hi] = store.span();
    const f = (m: number) => (m - lo) / (hi - lo);
    const pct = (m: number) => `${(f(m) * 100).toFixed(3)}%`;
    const w = (a: number, b: number) => `${(((b - a) / (hi - lo)) * 100).toFixed(3)}%`;
    const every = hi - lo > 300 ? 60 : 30;
    const ticks = [];
    for (let m = lo; m <= hi; m += 15) ticks.push(html`<div class="tick ${m % 60 === 0 ? "hour" : ""}" style="left:calc(var(--name) + (100% - var(--name)) * ${f(m)})"></div>`);
    const labels = [];
    for (let m = Math.ceil(lo / every) * every; m <= hi; m += every) labels.push(html`<span style="left:${pct(m)}">${hhmm(m)}</span>`);
    const nameOf = (id: string) => dm.place.get(id)?.name ?? "?";
    const staffName = (id: string | null) => sc.staff.find((s) => s.id === id)?.name ?? "";
    const vcol = (c: number) => PALETTE[c % PALETTE.length]!;
    const focus = store.focus;

    const vehicleRows = (res?.days ?? []).map((d) => {
      const v = d.crew.vehicle;
      const c = vcol(v.color);
      return html`<div class="r ${focus && focus !== v.id ? "faded" : ""}">
        <div class="nm" @click=${() => ((store.focus = store.focus === v.id ? null : v.id), store.notify())} title=${L().tl.focus(v.name)}>
          <i class="sq" style="background:${c}"></i>
          <span class="t">${v.name} <span class="faint mono">${v.seats}</span><small>${d.crew.driver.name}</small></span>
        </div>
        <div class="track">
          ${d.runs.length
            ? d.runs.map((run) => {
                const steps: { a: number; b: number; load: number }[] = [];
                let load = run.needsEscort ? 1 : 0;
                let at = run.depart;
                for (const st of run.stops) {
                  if (st.arrive > at) steps.push({ a: at, b: st.arrive, load });
                  steps.push({ a: st.arrive, b: st.leave, load: st.load });
                  load = st.load;
                  at = st.leave;
                }
                const span = run.back - run.depart || 1;
                const title = `${v.name} ${hhmm(run.depart)}–${hhmm(run.back)}: ${run.stops
                  .filter((s) => s.on.length)
                  .map((s) => `${nameOf(s.place)} ${s.on.reduce((n, b) => n + b.n, 0)} @ ${hhmm(s.on[0]!.pickup)}`)
                  .join(", ")} · ${run.maxLoad}/${v.seats}${run.needsEscort ? ` · ${run.escort ? staffName(run.escort) : L().tl.noEscort}` : ""}`;
                return html`<div class="run" title=${title} style="left:${pct(run.depart)};width:${w(run.depart, run.back)};border-color:${c};background:color-mix(in oklab, ${c} 14%, var(--surface))">
                  ${steps.map((s) => html`<i style="left:${(((s.a - run.depart) / span) * 100).toFixed(2)}%;width:${(((s.b - s.a) / span) * 100).toFixed(2)}%;height:${Math.min(100, (s.load / v.seats) * 100).toFixed(1)}%;background:${c}"></i>`)}
                  ${run.needsEscort ? html`<span class="esc ${run.escort ? "" : "missing"}">${icon("person", 10)}</span>` : nothing}
                </div>`;
              })
            : html`<div class="idle">${L().tl.notNeeded}</div>`}
        </div>
      </div>`;
    });
    const parkedRows = dm.parked.map(
      (p) => html`<div class="r">
        <div class="nm"><i class="sq" style="background:${vcol(p.vehicle.color)};opacity:.4"></i><span class="t">${p.vehicle.name} <span class="faint mono">${p.vehicle.seats}</span><small>—</small></span></div>
        <div class="track"><div class="idle ${p.why === "noDriver" ? "bad" : ""}">${p.why === "noDriver" ? html`${icon("warn", 14)} ${L().tl.noDriver}` : L().tl.away}</div></div>
      </div>`,
    );

    const schoolRow = (s: School) => {
      const out = s.out[day]!;
      const col = PALETTE[s.color % PALETTE.length]!;
      const boards = (res?.days ?? []).flatMap((d) => d.runs.flatMap((r) => r.boards.filter((b) => dm.jobs.get(b.key)?.school?.id === s.id).map((b) => ({ b, d }))));
      const n = boards.reduce((k, x) => k + x.b.n, 0);
      const faded = focus && !boards.some((x) => x.d.crew.vehicle.id === focus);
      return html`<div class="r ${faded ? "faded" : ""}">
        <div class="nm" title=${s.name}><i class="dot" style="background:${col}"></i><span class="t">${s.name}<small>${L().tl.outAt(hhmm(out), n)}${s.escort ? " · " + L().tl.fromClass : ""}</small></span></div>
        <div class="track">
          ${boards.map(({ b }) => (b.wait > 0.5 ? html`<div class="wait ${b.wait > sc.rules.maxWait + 1e-6 ? "late" : ""}" style="left:${pct(out)};width:${w(out, b.pickup)}"></div>` : nothing))}
          <div class="out" style="left:${pct(out)};background:${col}" title=${L().tl.outTitle(s.name, hhmm(out))}></div>
          ${boards.map(
            ({ b, d }) =>
              html`<div class="pick" style="left:${pct(b.pickup)};background:${vcol(d.crew.vehicle.color)}" title=${L().tl.pickTitle(d.crew.vehicle.name, b.n, hhmm(b.pickup), Math.round(b.wait), nameOf(dm.jobs.get(b.key)?.to ?? ""))}>${b.n}</div>`,
          )}
        </div>
      </div>`;
    };
    const schoolsToday = sc.schools.filter((s) => s.out[day] != null && [...dm.jobs.values()].some((j) => j.school?.id === s.id)).sort((a, b) => a.out[day]! - b.out[day]! || a.name.localeCompare(b.name));

    const lifts = [...dm.jobs.values()].filter((j) => j.kind === "ride");
    const liftRows = lifts.map((j) => {
      const found = (res?.days ?? []).flatMap((d) => d.runs.flatMap((r) => r.boards.filter((b) => b.key === j.key).map((b) => ({ b, d }))))[0];
      const late = found && found.b.deliver > j.due + 1e-6;
      return html`<div class="r">
        <div class="nm" title=${j.ride!.who}><span style="color:var(--dim)">${icon("person", 14)}</span><span class="t">${j.ride!.who}<small>${nameOf(j.from)} → ${nameOf(j.to)}</small></span></div>
        <div class="track">
          <div class="window" style="left:${pct(j.ready)};width:${w(j.ready, j.due)}" title=${L().tl.window(hhmm(j.ready), hhmm(j.due))}></div>
          ${found
            ? html`<div class="lift" style="left:${pct(found.b.pickup)};width:${w(found.b.pickup, found.b.deliver)};background:${late ? "var(--bad)" : vcol(found.d.crew.vehicle.color)}"
                title=${`${found.d.crew.vehicle.name} ${hhmm(found.b.pickup)}–${hhmm(found.b.deliver)}`}></div>`
            : nothing}
        </div>
      </div>`;
    });

    const bsoRows = sc.bsos.map((b) => {
      const arrivals = (res?.days ?? []).flatMap((d) => d.runs.flatMap((r) => r.stops.filter((s) => s.place === b.id && s.off.some((x) => dm.jobs.get(x.key)?.kind === "kids")).map((s) => ({ s, d }))));
      if (!arrivals.length) return nothing;
      const col = BSO_COLORS[b.color % BSO_COLORS.length]!;
      return html`<div class="r">
        <div class="nm"><i class="sq" style="background:${col}"></i><span class="t">${b.name}</span></div>
        <div class="track">
          ${arrivals.map(({ s, d }) => {
            const n = s.off.filter((x) => dm.jobs.get(x.key)?.kind === "kids").reduce((k, x) => k + x.n, 0);
            return html`<div class="pick" style="left:${pct(s.arrive)};background:${vcol(d.crew.vehicle.color)};border-radius:4px" title=${`${d.crew.vehicle.name} ${hhmm(s.arrive)}: ${n}`}>${n}</div>`;
          })}
        </div>
      </div>`;
    });

    return html`<div class="tl" @pointerdown=${this.scrub}>
      <div class="axis">${labels}</div>
      ${ticks}
      <span class="label sec" style="margin-top:4px">${L().tl.vehicles}</span>
      ${vehicleRows} ${parkedRows}
      <span class="label sec">${L().tl.schools}</span>
      ${schoolsToday.map(schoolRow)}
      ${lifts.length ? html`<span class="label sec">${L().tl.lifts}</span>${liftRows}` : nothing}
      <span class="label sec">${L().tl.arrivals}</span>
      ${bsoRows}
      <div class="cursor" style="left:calc(var(--name) + (100% - var(--name)) * ${Math.min(1, Math.max(0, f(store.t)))})"><b>${hhmm(store.t)}</b></div>
    </div>
    <div class="legend">
      <span><i class="out" style="position:static;display:inline-block;width:3px;height:14px;background:var(--ink)"></i>${L().tl.lgOut}</span>
      <span><i style="display:inline-block;width:22px;height:6px;border-radius:3px;background:var(--warn)"></i>${L().tl.lgWait}</span>
      <span><i style="display:inline-block;width:22px;height:6px;border-radius:3px;background:var(--bad)"></i>${L().tl.lgLate(sc.rules.maxWait)}</span>
      <span><i class="dot" style="background:var(--dim)"></i>${L().tl.lgPick}</span>
      <span>${icon("person", 13)} ${L().tl.lgEscort}</span>
    </div>`;
  }
}
