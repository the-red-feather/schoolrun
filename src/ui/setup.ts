/**
 * OPZET: the week's fixed parts. BSO locations, schools (out times per
 * weekday, collected from the classroom or not), vehicles (seats; above 8 a
 * bus licence), staff (licence, days, hours), colleagues' lifts, and the
 * rules the solver plays by.
 */
import { LitElement, css, html, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { live } from "lit/directives/live.js";
import { L } from "../i18n";
import { BSO_COLORS, B_MAX_SEATS, DEFAULT_RULES, PALETTE, freeColor, freshId, hhmm, mayDrive, needsBusLicence, parseHhmm, week, type Licence, type Rules, type Scenario, type Week } from "../model/types";
import { store, StoreController } from "../store";
import { icon } from "./icons";
import { base } from "./shared";

@customElement("sr-setup")
export class SrSetup extends LitElement {
  private ctl = new StoreController(this);
  @state() private picking: string | null = null;

  static override styles = [
    base,
    css`
      :host {
        display: block;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 18px;
        align-items: start;
      }
      .wide {
        grid-column: 1 / -1;
      }
      .col {
        display: grid;
        gap: 18px;
        align-content: start;
        min-width: 0;
      }
      @media (max-width: 1000px) {
        .grid {
          grid-template-columns: minmax(0, 1fr);
        }
      }
      .card-head .ic {
        width: 34px;
        height: 34px;
        border-radius: 10px;
        display: grid;
        place-items: center;
        color: #fff;
        flex: none;
      }
      .list {
        display: grid;
        gap: 8px;
      }
      .item {
        display: grid;
        gap: 8px;
        padding: 10px;
        border-radius: 12px;
        background: var(--surface-2);
        border: 1.5px solid var(--hair);
      }
      .item .row {
        flex-wrap: wrap;
      }
      input.name {
        flex: 1 1 160px;
        font-weight: 700;
      }
      .swatch {
        width: 26px;
        height: 26px;
        border-radius: 8px;
        border: 2px solid var(--surface);
        box-shadow: 0 0 0 1.5px var(--hair-2);
        cursor: pointer;
        flex: none;
        padding: 0;
      }
      .swatch.round {
        border-radius: 50%;
      }
      .palette {
        display: flex;
        gap: 5px;
        flex-wrap: wrap;
      }
      .palette button {
        width: 22px;
        height: 22px;
        border-radius: 6px;
        border: 2px solid transparent;
        cursor: pointer;
        padding: 0;
      }
      .palette button.on {
        border-color: var(--ink);
      }
      .times {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: 6px;
      }
      .times label {
        display: grid;
        gap: 2px;
        font-size: 0.7rem;
        font-weight: 700;
        color: var(--dim);
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }
      input.time {
        width: 62px;
        font-family: var(--mono);
        text-align: center;
        padding: 5px 4px;
      }
      .times input.time {
        width: 100%;
      }
      input.time.none {
        color: var(--faint);
        border-style: dashed;
      }
      @media (max-width: 560px) {
        .times {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
      }
      .toggle {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 0.82rem;
        font-weight: 600;
        cursor: pointer;
        padding: 4px 10px 4px 6px;
        border-radius: 999px;
        border: 1.5px solid var(--hair-2);
        background: var(--surface);
      }
      .toggle.on {
        background: var(--ink);
        color: var(--bg);
        border-color: var(--ink);
      }
      .toggle input {
        display: none;
      }
      .meta {
        font-size: 0.78rem;
        color: var(--dim);
      }
      .rules {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 6px 28px;
      }
      @media (max-width: 700px) {
        .rules {
          grid-template-columns: minmax(0, 1fr);
        }
      }
      .rule {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 76px;
        gap: 0 10px;
        align-items: center;
      }
      .rule span {
        font-size: 0.85rem;
        font-weight: 600;
      }
      .rule small {
        grid-column: 1 / -1;
        color: var(--dim);
        font-size: 0.75rem;
        margin-top: -2px;
      }
      .rule output {
        font-family: var(--mono);
        font-size: 0.85rem;
        text-align: right;
        font-weight: 700;
      }
      .rule input[type="range"] {
        grid-column: 1 / -1;
        width: 100%;
      }
      .sub {
        grid-column: 1 / -1;
        margin-top: 10px;
      }
      .add {
        justify-self: start;
      }
    `,
  ];

  private ed(fn: (sc: Scenario) => void, now = false) {
    store.edit(fn, { now });
  }

  /** A 24-hour time as text (14:00, 1400, 14.00 or 14): the same everywhere, whatever the browser's locale. */
  private time(v: number | null, set: (m: number | null) => void, allowNone = false) {
    return html`<input
      class="time ${v == null ? "none" : ""}"
      inputmode="numeric"
      maxlength="5"
      placeholder=${allowNone ? "–" : "uu:mm"}
      .value=${v == null ? "" : hhmm(v)}
      @change=${(e: Event) => {
        const el = e.target as HTMLInputElement;
        const m = el.value.trim() ? parseHhmm(el.value) : null;
        if (m != null || (allowNone && !el.value.trim())) set(m);
        el.value = m == null ? (allowNone && !el.value.trim() ? "" : v == null ? "" : hhmm(v)) : hhmm(m);
      }}
    />`;
  }

  private days(d: Week<boolean>, set: (i: number) => void) {
    const today = store.prefs.day;
    return html`<span class="days">${L().daysShort.map((x, i) => html`<button class="${d[i] ? "on" : ""} ${i === today ? "today" : ""}" style="--day:var(--d${i})" title=${L().days[i]} @click=${() => set(i)}>${x}</button>`)}</span>`;
  }

  private swatch(id: string, colors: string[], cur: number, set: (c: number) => void, round = false) {
    const open = this.picking === id;
    return html`<button class="swatch ${round ? "round" : ""}" style="background:${colors[cur % colors.length]}" title=${L().setup.color} @click=${() => (this.picking = open ? null : id)}></button>
      ${open
        ? html`<div class="palette" style="flex-basis:100%">
            ${colors.map((c, i) => html`<button class=${i === cur ? "on" : ""} style="background:${c}" @click=${() => ((this.picking = null), set(i))}></button>`)}
          </div>`
        : nothing}`;
  }

  private pin(kind: "bso" | "school", id: string) {
    const on = store.placing?.id === id;
    return html`<button
      class="icon-btn ${on ? "on" : ""}"
      title=${L().setup.placeOnMap}
      @click=${() => {
        store.placing = on ? null : { kind, id };
        if (!on) store.pref("tab", "plan");
        store.notify();
      }}
    >
      ${icon("pin")}
    </button>`;
  }

  override render() {
    return html`<div class="grid">
      <div class="col">${this.bsos()} ${this.staff()}</div>
      <div class="col">${this.vehicles()} ${this.rides()}</div>
      ${this.schools()} ${this.rules()}
    </div>`;
  }

  private bsos() {
    const sc = store.sc;
    return html`<section class="card">
      <div class="card-head"><span class="ic" style="background:${BSO_COLORS[0]}">${icon("house")}</span><div class="grow"><h2>${L().setup.bsos}</h2><div class="meta">${L().setup.bsosHint}</div></div></div>
      <div class="list">
        ${sc.bsos.map((b) => {
          const kids = sc.kids.filter((k) => k.bso === b.id).length;
          return html`<div class="item">
            <div class="row">
              ${this.swatch(b.id, BSO_COLORS, b.color, (c) => this.ed((x) => (x.bsos.find((y) => y.id === b.id)!.color = c)))}
              <input class="name" .value=${b.name} @change=${(e: Event) => this.ed((x) => (x.bsos.find((y) => y.id === b.id)!.name = (e.target as HTMLInputElement).value.trim() || b.name))} />
              <span class="meta">${L().setup.kidsN(kids)}</span>
              ${this.pin("bso", b.id)}
              <button
                class="icon-btn danger"
                title=${L().remove}
                ?disabled=${sc.bsos.length <= 1}
                @click=${() => {
                  if (kids && !confirm(L().setup.confirmRemoveBso(b.name, kids))) return;
                  this.ed((x) => (x.bsos = x.bsos.filter((y) => y.id !== b.id)), true);
                }}
              >
                ${icon("trash")}
              </button>
            </div>
          </div>`;
        })}
        <button
          class="btn small add"
          @click=${() =>
            this.ed((x) => {
              const id = freshId("b", [...x.bsos.map((b) => b.id), ...x.schools.map((s) => s.id)]);
              const o = x.bsos[0] ?? { lat: 52.0116, lon: 4.3571 };
              x.bsos.push({ id, name: `BSO ${x.bsos.length + 1}`, lat: o.lat + 0.01, lon: o.lon + 0.01, color: freeColor(x.bsos.map((b) => b.color), BSO_COLORS.length) });
              store.placing = { kind: "bso", id };
            }, true)}
        >
          ${icon("plus", 15)} ${L().setup.addBso}
        </button>
      </div>
    </section>`;
  }

  private schools() {
    const sc = store.sc;
    return html`<section class="card wide">
      <div class="card-head"><span class="ic" style="background:${PALETTE[0]}">${icon("school")}</span><div class="grow"><h2>${L().setup.schools}</h2><div class="meta">${L().setup.schoolsHint}</div></div></div>
      <div class="list" style="grid-template-columns:repeat(auto-fill,minmax(440px,1fr))">
        ${sc.schools.map((s) => {
          const kids = sc.kids.filter((k) => k.school === s.id).length;
          const set = (fn: (x: (typeof sc.schools)[number]) => void, now = false) => this.ed((x) => fn(x.schools.find((y) => y.id === s.id)!), now);
          return html`<div class="item" style="border-left:6px solid ${PALETTE[s.color % PALETTE.length]}">
            <div class="row">
              ${this.swatch(s.id, PALETTE, s.color, (c) => set((x) => (x.color = c)), true)}
              <input class="name" .value=${s.name} @change=${(e: Event) => set((x) => (x.name = (e.target as HTMLInputElement).value.trim() || s.name))} />
              <span class="meta">${L().setup.kidsN(kids)}</span>
              ${this.pin("school", s.id)}
              <button
                class="icon-btn danger"
                title=${L().remove}
                @click=${() => {
                  if (kids && !confirm(L().setup.confirmRemoveSchool(s.name, kids))) return;
                  this.ed((x) => {
                    x.schools = x.schools.filter((y) => y.id !== s.id);
                    x.kids = x.kids.filter((k) => k.school !== s.id);
                  }, true);
                }}
              >
                ${icon("trash")}
              </button>
            </div>
            <div class="times">
              ${L().days.map((d, i) => html`<label>${d}${this.time(s.out[i]!, (m) => set((x) => (x.out[i] = m), true), true)}</label>`)}
            </div>
            <div class="row">
              <label class="toggle ${s.escort ? "on" : ""}"><input type="checkbox" .checked=${s.escort} @change=${(e: Event) => set((x) => (x.escort = (e.target as HTMLInputElement).checked), true)} />${icon("hand", 15)} ${L().setup.escort}</label>
              <span class="meta grow">${s.escort ? L().setup.escortOn : L().setup.escortOff}</span>
            </div>
          </div>`;
        })}
      </div>
      <div style="margin-top:10px">
        <button
          class="btn small add"
          @click=${() =>
            this.ed((x) => {
              const id = freshId("s", [...x.schools.map((s) => s.id), ...x.bsos.map((b) => b.id)]);
              const o = x.bsos[0] ?? { lat: 52.0116, lon: 4.3571 };
              x.schools.push({ id, name: `School ${x.schools.length + 1}`, lat: o.lat - 0.008, lon: o.lon + 0.012, color: freeColor(x.schools.map((s) => s.color)), out: [840, 840, 735, 840, 840], escort: false });
              store.placing = { kind: "school", id };
            }, true)}
        >
          ${icon("plus", 15)} ${L().setup.addSchool}
        </button>
        <span class="hint" style="margin-left:8px">${L().setup.outHint}</span>
      </div>
    </section>`;
  }

  private vehicles() {
    const sc = store.sc;
    return html`<section class="card">
      <div class="card-head"><span class="ic" style="background:${PALETTE[6]}">${icon("bus")}</span><div class="grow"><h2>${L().setup.vehicles}</h2><div class="meta">${L().setup.vehiclesHint(B_MAX_SEATS)}</div></div></div>
      <div class="list">
        ${sc.vehicles.map((v) => {
          const set = (fn: (x: (typeof sc.vehicles)[number]) => void, now = false) => this.ed((x) => fn(x.vehicles.find((y) => y.id === v.id)!), now);
          const bus = needsBusLicence(v);
          return html`<div class="item">
            <div class="row">
              ${this.swatch(v.id, PALETTE, v.color, (c) => set((x) => (x.color = c)))}
              <input class="name" .value=${v.name} @change=${(e: Event) => set((x) => (x.name = (e.target as HTMLInputElement).value.trim() || v.name))} />
              <input type="number" min="1" max="60" .value=${String(v.seats)} title=${L().setup.seats} @change=${(e: Event) => set((x) => (x.seats = Math.max(1, Math.round(+(e.target as HTMLInputElement).value) || v.seats)), true)} />
              <span class="meta">${L().setup.seats}</span>
              <span class="lic ${bus ? "d" : ""}" title=${bus ? L().setup.needsD : L().setup.needsB}>${bus ? "D" : "B"}</span>
              <button class="icon-btn danger" title=${L().remove} @click=${() => this.ed((x) => (x.vehicles = x.vehicles.filter((y) => y.id !== v.id)), true)}>${icon("trash")}</button>
            </div>
            <div class="row">
              <span class="meta">${L().setup.parkedAt}</span>
              <select .value=${live(v.home)} @change=${(e: Event) => set((x) => (x.home = (e.target as HTMLSelectElement).value), true)}>${sc.bsos.map((b) => html`<option value=${b.id} ?selected=${v.home === b.id}>${b.name}</option>`)}</select>
              <span class="meta">${L().setup.driver}</span>
              <select .value=${live(v.driver ?? "")} @change=${(e: Event) => set((x) => (x.driver = (e.target as HTMLSelectElement).value || null), true)}>
                <option value="" ?selected=${!v.driver}>${L().setup.anyDriver}</option>
                ${sc.staff.filter((s) => mayDrive(s, v)).map((s) => html`<option value=${s.id} ?selected=${v.driver === s.id}>${s.name}</option>`)}
              </select>
              ${this.days(v.days, (i) => set((x) => (x.days[i] = !x.days[i]), true))}
            </div>
          </div>`;
        })}
        <button
          class="btn small add"
          @click=${() =>
            this.ed((x) => {
              x.vehicles.push({ id: freshId("v", x.vehicles.map((v) => v.id)), name: `Busje ${x.vehicles.length + 1}`, seats: 8, color: freeColor(x.vehicles.map((v) => v.color)), home: x.bsos[0]!.id, days: week(true), driver: null });
            }, true)}
        >
          ${icon("plus", 15)} ${L().setup.addVehicle}
        </button>
      </div>
    </section>`;
  }

  private staff() {
    const sc = store.sc;
    return html`<section class="card">
      <div class="card-head"><span class="ic" style="background:${PALETTE[9]}">${icon("person")}</span><div class="grow"><h2>${L().setup.staff}</h2><div class="meta">${L().setup.staffHint}</div></div></div>
      <div class="list">
        ${sc.staff.map((s) => {
          const set = (fn: (x: (typeof sc.staff)[number]) => void, now = false) => this.ed((x) => fn(x.staff.find((y) => y.id === s.id)!), now);
          return html`<div class="item">
            <div class="row">
              <input class="name" .value=${s.name} @change=${(e: Event) => set((x) => (x.name = (e.target as HTMLInputElement).value.trim() || s.name))} />
              <select title=${L().setup.licence} .value=${live(String(s.licence))} @change=${(e: Event) => set((x) => (x.licence = +(e.target as HTMLSelectElement).value as Licence), true)}>
                ${([0, 1, 2] as Licence[]).map((l) => html`<option value=${l} ?selected=${s.licence === l}>${L().setup.licences[l]}</option>`)}
              </select>
              <button class="icon-btn danger" title=${L().remove} @click=${() => this.ed((x) => (x.staff = x.staff.filter((y) => y.id !== s.id)), true)}>${icon("trash")}</button>
            </div>
            <div class="row">
              <select .value=${live(s.home)} @change=${(e: Event) => set((x) => (x.home = (e.target as HTMLSelectElement).value), true)}>${sc.bsos.map((b) => html`<option value=${b.id} ?selected=${s.home === b.id}>${b.name}</option>`)}</select>
              ${this.days(s.days, (i) => set((x) => (x.days[i] = !x.days[i]), true))}
              ${this.time(s.from, (m) => set((x) => (x.from = m ?? s.from), true))}<span class="meta">–</span>${this.time(s.until, (m) => set((x) => (x.until = m ?? s.until), true))}
            </div>
          </div>`;
        })}
        <button
          class="btn small add"
          @click=${() =>
            this.ed((x) => {
              x.staff.push({ id: freshId("st", x.staff.map((s) => s.id)), name: `${L().setup.newStaff} ${x.staff.length + 1}`, home: x.bsos[0]!.id, licence: 1, days: week(true), from: 11 * 60 + 30, until: 18 * 60 + 30 });
            }, true)}
        >
          ${icon("plus", 15)} ${L().setup.addStaff}
        </button>
      </div>
    </section>`;
  }

  private rides() {
    const sc = store.sc;
    const places = [...sc.bsos.map((b) => ({ id: b.id, name: b.name })), ...sc.schools.map((s) => ({ id: s.id, name: s.name }))];
    const opts = (cur: string) => places.map((p) => html`<option value=${p.id} ?selected=${cur === p.id}>${p.name}</option>`);
    return html`<section class="card">
      <div class="card-head"><span class="ic" style="background:${PALETTE[4]}">${icon("route")}</span><div class="grow"><h2>${L().setup.rides}</h2><div class="meta">${L().setup.ridesHint}</div></div></div>
      <div class="list">
        ${sc.rides.map((r) => {
          const set = (fn: (x: (typeof sc.rides)[number]) => void, now = false) => this.ed((x) => fn(x.rides.find((y) => y.id === r.id)!), now);
          return html`<div class="item">
            <div class="row">
              <input class="name" .value=${r.who} placeholder=${L().setup.who} @change=${(e: Event) => set((x) => (x.who = (e.target as HTMLInputElement).value.trim() || r.who))} />
              ${this.days(r.days, (i) => set((x) => (x.days[i] = !x.days[i]), true))}
              <button class="icon-btn danger" title=${L().remove} @click=${() => this.ed((x) => (x.rides = x.rides.filter((y) => y.id !== r.id)), true)}>${icon("trash")}</button>
            </div>
            <div class="row">
              <select .value=${live(r.from)} @change=${(e: Event) => set((x) => (x.from = (e.target as HTMLSelectElement).value), true)}>${opts(r.from)}</select>
              <span class="meta">→</span>
              <select .value=${live(r.to)} @change=${(e: Event) => set((x) => (x.to = (e.target as HTMLSelectElement).value), true)}>${opts(r.to)}</select>
            </div>
            <div class="row">
              <span class="meta">${L().setup.readyAt}</span>${this.time(r.after, (m) => set((x) => (x.after = m ?? r.after), true))}
              <span class="meta">${L().setup.thereBy}</span>${this.time(r.before, (m) => set((x) => (x.before = m ?? r.before), true))}
            </div>
          </div>`;
        })}
      </div>
      <div style="margin-top:10px">
        <button
          class="btn small add"
          ?disabled=${places.length < 2}
          @click=${() =>
            this.ed((x) => {
              x.rides.push({ id: freshId("r", x.rides.map((r) => r.id)), who: L().setup.colleague, from: places[0]!.id, to: places[1]!.id, after: 14 * 60, before: 14 * 60 + 30, days: week(true) });
            }, true)}
        >
          ${icon("plus", 15)} ${L().setup.addRide}
        </button>
      </div>
    </section>`;
  }

  private rules() {
    const r = store.sc.rules;
    const T = L().rules;
    const row = (k: keyof Rules, min: number, max: number, step: number, fmt: (v: number) => string) => html`<label class="rule">
      <span>${T[k][0]}</span><output>${fmt(r[k])}</output>
      <input type="range" min=${min} max=${max} step=${step} .value=${String(r[k])} @change=${(e: Event) => this.ed((x) => (x.rules[k] = +(e.target as HTMLInputElement).value))} />
      <small>${T[k][1]}</small>
    </label>`;
    const min = (v: number) => `${v} min`;
    const x = (v: number) => `${v.toFixed(1)}×`;
    return html`<section class="card wide">
      <div class="card-head">
        <span class="ic" style="background:${PALETTE[7]}">${icon("sparkle")}</span>
        <div class="grow"><h2>${L().setup.rules}</h2><div class="meta">${L().setup.rulesHint}</div></div>
        <button class="btn small ghost" @click=${() => this.ed((s) => (s.rules = { ...DEFAULT_RULES }), true)}>${L().setup.defaults}</button>
      </div>
      <div class="rules">
        <span class="label sub" style="margin-top:0">${L().setup.travel}</span>
        ${row("speed", 10, 60, 1, (v) => `${v} km/u`)} ${row("road", 1, 2, 0.05, (v) => `${v.toFixed(2)}×`)}
        ${row("board", 0, 10, 0.5, min)} ${row("escortBoard", 0, 15, 0.5, min)} ${row("drop", 0, 10, 0.5, min)}
        <label class="rule"><span>${T.start[0]}</span>${this.time(r.start, (m) => this.ed((s) => (s.rules.start = m ?? r.start)))}<small>${T.start[1]}</small></label>
        <span class="label sub">${L().setup.weights}</span>
        ${row("maxWait", 0, 45, 1, min)} ${row("wWait", 0, 5, 0.1, x)} ${row("wRide", 0, 5, 0.1, x)} ${row("wDrive", 0, 5, 0.1, x)}
      </div>
    </section>`;
  }
}
