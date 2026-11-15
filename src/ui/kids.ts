/**
 * KINDEREN: every child, by school (a coloured block) and within it by BSO.
 * This is the input: rename, set the groep and contract days, call a child
 * off for today, drag them to another BSO or school, paste a class list.
 * The dot before each name is where the child is at the clock's time.
 */
import { LitElement, css, html, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import { live } from "lit/directives/live.js";
import { L } from "../i18n";
import { kidState } from "../model/sim";
import { nameMaker } from "../model/sample";
import { BSO_COLORS, PALETTE, freeColor, freshId, hhmm, inkOn, week, type Kid, type School } from "../model/types";
import { store, StoreController } from "../store";
import { icon } from "./icons";
import { base } from "./shared";

@customElement("sr-kids")
export class SrKids extends LitElement {
  private ctl = new StoreController(this);
  @state() private q = "";
  @state() private onlyToday = false;
  @state() private pasting: string | null = null;
  @state() private pasteText = "";
  @state() private pasteBso = "";
  @state() private moving: string | null = null;
  @state() private over: string | null = null;
  private dragKid: string | null = null;

  static override styles = [
    base,
    css`
      :host {
        display: block;
      }
      .head {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
        margin-bottom: 16px;
      }
      .head h2 {
        font-size: 1.5rem;
      }
      .sum {
        color: var(--dim);
        font-size: 0.9rem;
      }
      .search {
        display: flex;
        align-items: center;
        gap: 6px;
        background: var(--surface);
        border: 1.5px solid var(--hair);
        border-radius: 999px;
        padding: 0 10px;
        color: var(--dim);
      }
      .search input {
        border: none;
        background: transparent;
        box-shadow: none;
        width: 170px;
      }
      .legend {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        font-size: 0.8rem;
        color: var(--dim);
        margin-bottom: 14px;
        align-items: center;
      }
      .legend span {
        display: inline-flex;
        align-items: center;
        gap: 5px;
      }
      .cols {
        columns: 3 340px;
        column-gap: 16px;
      }
      .school {
        break-inside: avoid;
        margin-bottom: 16px;
        border-radius: var(--radius-lg);
        background: color-mix(in oklab, var(--c) 9%, var(--surface));
        border: 2px solid var(--c);
        overflow: hidden;
        box-shadow: var(--shadow);
      }
      .school.over > header {
        filter: brightness(1.1);
      }
      header {
        background: var(--c);
        color: var(--on);
        padding: 10px 12px 9px 14px;
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 2px 8px;
        align-items: center;
      }
      header input {
        color: inherit;
        font-weight: 800;
        font-size: 1.05rem;
        border-color: transparent;
        background: transparent;
        padding: 2px 4px;
        margin-left: -5px;
        height: 30px;
      }
      header input:hover,
      header input:focus {
        border-color: color-mix(in oklab, var(--on) 40%, transparent);
        background: color-mix(in oklab, var(--on) 10%, transparent);
        box-shadow: none;
      }
      header .n {
        font-family: var(--mono);
        font-weight: 800;
        font-size: 1.25rem;
      }
      header .meta {
        grid-column: 1 / -1;
        font-size: 0.78rem;
        font-weight: 600;
        opacity: 0.85;
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        align-items: center;
      }
      header .meta span {
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }
      .grp {
        padding: 8px 8px 6px;
        border-top: 1.5px solid color-mix(in oklab, var(--c) 25%, transparent);
      }
      .grp:first-of-type {
        border-top: none;
      }
      .grp.over {
        background: color-mix(in oklab, var(--b) 14%, transparent);
        outline: 2px dashed var(--b);
        outline-offset: -4px;
      }
      .grp.empty {
        padding: 4px 8px;
      }
      .ghead {
        display: flex;
        align-items: center;
        gap: 7px;
        padding: 0 4px 4px;
        font-weight: 700;
        font-size: 0.84rem;
      }
      .grp.empty .ghead {
        color: var(--faint);
        font-weight: 600;
        padding: 0 4px;
      }
      .ghead .sq {
        width: 14px;
        height: 14px;
        border-radius: 4px;
      }
      ul {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 1px;
      }
      li {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px;
        padding: 1px 2px 1px 0;
        border-radius: 8px;
        min-height: 32px;
      }
      li:hover {
        background: var(--surface);
      }
      li.dragging {
        opacity: 0.4;
      }
      li .grip {
        color: var(--faint);
        cursor: grab;
        display: grid;
        place-items: center;
        width: 18px;
        flex: none;
        border: none;
        background: none;
        padding: 0;
      }
      li .st {
        width: 9px;
        height: 9px;
        border-radius: 50%;
        flex: none;
        background: var(--hair-2);
      }
      li .st.waiting {
        background: var(--warn);
        box-shadow: 0 0 0 3px color-mix(in oklab, var(--warn) 30%, transparent);
      }
      li .st.in {
        background: var(--good);
      }
      li input.name {
        flex: 1;
        font-weight: 600;
        font-size: 0.86rem;
        height: 28px;
        padding: 2px 5px;
      }
      li select.g {
        width: 50px;
        height: 26px;
        font-size: 0.76rem;
        padding: 1px 2px;
        font-family: var(--mono);
        color: var(--dim);
      }
      li.off input.name {
        color: var(--faint);
      }
      li.absent input.name {
        text-decoration: line-through;
        color: var(--faint);
      }
      li .icon-btn {
        width: 24px;
        height: 24px;
      }
      li .acts {
        display: flex;
        opacity: 0;
        transition: opacity 0.12s;
      }
      li:hover .acts,
      li:focus-within .acts,
      li.absent .acts {
        opacity: 1;
      }
      @media (hover: none) {
        li .acts {
          opacity: 1;
        }
      }
      @media (max-width: 520px) {
        li {
          padding-bottom: 4px;
        }
        li input.name {
          flex: 1 1 calc(100% - 40px);
        }
        li select.g {
          margin-left: 34px;
        }
        li .acts {
          margin-left: auto;
        }
      }
      li .icon-btn.on {
        background: var(--warn);
        color: #fff;
      }
      .moveto {
        flex-basis: 100%;
        margin: 0 4px 6px 22px;
        display: flex;
        gap: 6px;
        align-items: center;
        font-size: 0.8rem;
      }
      .moveto select {
        flex: 1;
      }
      .foot {
        display: flex;
        gap: 6px;
        padding: 6px 8px 10px;
        flex-wrap: wrap;
      }
      .paste {
        padding: 0 10px 12px;
        display: grid;
        gap: 6px;
      }
      .paste textarea {
        width: 100%;
        min-height: 110px;
      }
      .addschool {
        break-inside: avoid;
        display: grid;
        place-items: center;
        min-height: 120px;
        border: 2px dashed var(--hair-2);
        border-radius: var(--radius-lg);
        margin-bottom: 16px;
      }
      mark {
        background: color-mix(in oklab, var(--c2) 60%, transparent);
        color: inherit;
        border-radius: 3px;
      }
    `,
  ];

  private kidEdit(id: string, fn: (k: Kid) => void, now = false) {
    store.edit((sc) => {
      const k = sc.kids.find((x) => x.id === id);
      if (k) fn(k);
    }, { now });
  }

  private addKid(school: string, bso: string) {
    const sc = store.sc;
    const id = freshId("k", sc.kids.map((k) => k.id));
    const name = nameMaker(Date.now() % 1e9, sc.kids.map((k) => k.name))();
    store.edit((s) => s.kids.push({ id, name, school, bso, days: week(true), group: 4 }), { now: true });
    this.updateComplete.then(() => {
      const el = this.renderRoot.querySelector<HTMLInputElement>(`li[data-kid="${id}"] input.name`);
      el?.focus();
      el?.select();
    });
  }

  private addSchool() {
    const sc = store.sc;
    const id = freshId("s", [...sc.schools.map((s) => s.id), ...sc.bsos.map((b) => b.id)]);
    const b = sc.bsos[0];
    const a = Math.random() * Math.PI * 2;
    store.edit(
      (s) =>
        s.schools.push({
          id,
          name: `${L().kids.newSchool} ${s.schools.length + 1}`,
          lat: (b?.lat ?? 52) + Math.sin(a) * 0.012,
          lon: (b?.lon ?? 4.35) + Math.cos(a) * 0.018,
          color: freeColor(s.schools.map((x) => x.color)),
          out: [14 * 60, 14 * 60, 12 * 60 + 15, 14 * 60, 14 * 60],
          escort: false,
        }),
      { now: true },
    );
  }

  private doPaste(school: string) {
    const names = this.pasteText
      .split(/[\n,;\t]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!names.length) return;
    const bso = this.pasteBso || store.sc.bsos[0]?.id;
    if (!bso) return;
    store.edit(
      (sc) => {
        for (const name of names) sc.kids.push({ id: freshId("k", sc.kids.map((k) => k.id)), name: name.slice(0, 80), school, bso, days: week(true), group: 4 });
      },
      { now: true },
    );
    store.say(L().kids.pasted(names.length));
    this.pasting = null;
    this.pasteText = "";
  }

  private drop(e: DragEvent, school: string, bso: string | null) {
    e.preventDefault();
    this.over = null;
    const id = e.dataTransfer?.getData("text/x-kid") || this.dragKid;
    this.dragKid = null;
    if (!id) return;
    const k = store.sc.kids.find((x) => x.id === id);
    if (!k || (k.school === school && (bso == null || k.bso === bso))) return;
    this.kidEdit(id, (x) => {
      x.school = school;
      if (bso) x.bso = bso;
    }, true);
  }

  override render() {
    const sc = store.sc;
    const day = store.prefs.day;
    const away = new Set(sc.absent[day]);
    const q = this.q.trim().toLowerCase();
    const show = (k: Kid) => (!q || k.name.toLowerCase().includes(q)) && (!this.onlyToday || k.days[day]);
    const comingToday = sc.kids.filter((k) => k.days[day]);
    const calledOff = comingToday.filter((k) => away.has(k.id)).length;
    const dayName = L().days[day];
    return html`<div class="head">
        <h2>${L().kids.title}</h2>
        <span class="sum">${L().kids.summary(sc.kids.length, sc.schools.length, sc.bsos.length)} · ${L().kids.today(dayName, comingToday.length - calledOff, calledOff)}</span>
        <span class="grow"></span>
        <label class="search">${icon("search", 15)}<input .value=${this.q} @input=${(e: Event) => (this.q = (e.target as HTMLInputElement).value)} placeholder=${L().kids.find} /></label>
        <div class="seg">
          <button class=${this.onlyToday ? "" : "on"} @click=${() => (this.onlyToday = false)}>${L().kids.all}</button>
          <button class=${this.onlyToday ? "on" : ""} @click=${() => (this.onlyToday = true)}>${L().kids.onlyDay(dayName)}</button>
        </div>
      </div>
      <div class="legend">
        ${sc.bsos.map((b) => html`<span><i class="sq" style="background:${BSO_COLORS[b.color % BSO_COLORS.length]}"></i><b>${b.name}</b> ${sc.kids.filter((k) => k.bso === b.id).length}</span>`)}
        <span>·</span>
        <span><i class="dot" style="background:var(--hair-2)"></i>${L().kids.stClass}</span>
        <span><i class="dot" style="background:var(--warn)"></i>${L().kids.stWaiting}</span>
        <span><i class="dot" style="background:var(--c6)"></i>${L().kids.stRiding}</span>
        <span><i class="dot" style="background:var(--good)"></i>${L().kids.stIn}</span>
        <span>${L().kids.atTime(hhmm(store.t), dayName)}</span>
        <span class="grow"></span>
        <span>${L().kids.dragHint}</span>
      </div>
      <div class="cols">
        ${repeat(
          sc.schools,
          (s) => s.id,
          (s) => this.school(s, show, away),
        )}
        <div class="addschool"><button class="btn" @click=${() => this.addSchool()}>${icon("plus")} ${L().kids.addSchool}</button></div>
      </div>`;
  }

  private school(s: School, show: (k: Kid) => boolean, away: Set<string>) {
    const sc = store.sc;
    const day = store.prefs.day;
    const col = PALETTE[s.color % PALETTE.length]!;
    const kids = sc.kids.filter((k) => k.school === s.id);
    const visible = kids.filter(show);
    if (this.q && !visible.length) return nothing;
    const out = s.out[day];
    const today = kids.filter((k) => k.days[day] && !away.has(k.id)).length;
    return html`<section class="school ${this.over === s.id ? "over" : ""}" style="--c:${col};--on:${inkOn(col)}">
      <header
        @dragover=${(e: DragEvent) => (e.preventDefault(), (this.over = s.id))}
        @dragleave=${() => this.over === s.id && (this.over = null)}
        @drop=${(e: DragEvent) => this.drop(e, s.id, null)}
      >
        <input .value=${s.name} aria-label=${L().kids.schoolName} @change=${(e: Event) => store.edit((x) => (x.schools.find((y) => y.id === s.id)!.name = (e.target as HTMLInputElement).value.trim() || s.name))} />
        <span class="n" title=${L().kids.countTitle}>${kids.length}</span>
        <div class="meta">
          <span>${icon("clock", 13)} ${out == null ? L().kids.noPickupToday(L().days[day]) : L().kids.outToday(L().days[day], hhmm(out))}</span>
          <span>${icon("person", 13)} ${L().kids.comingToday(today)}</span>
          ${s.escort ? html`<span>${icon("hand", 13)} ${L().kids.fromClass}</span>` : nothing}
        </div>
      </header>
      ${sc.bsos.map((b) => this.group(s, b.id, visible.filter((k) => k.bso === b.id), kids.filter((k) => k.bso === b.id).length, away))}
      ${this.pasting === s.id
        ? html`<div class="paste">
            <span class="label">${L().kids.pasteTitle}</span>
            <textarea .value=${this.pasteText} @input=${(e: Event) => (this.pasteText = (e.target as HTMLTextAreaElement).value)} placeholder=${L().kids.pastePlaceholder}></textarea>
            <div class="row">
              <select @change=${(e: Event) => (this.pasteBso = (e.target as HTMLSelectElement).value)}>
                ${sc.bsos.map((b) => html`<option value=${b.id} ?selected=${(this.pasteBso || sc.bsos[0]?.id) === b.id}>${b.name}</option>`)}
              </select>
              <span class="grow"></span>
              <button class="btn small ghost" @click=${() => (this.pasting = null)}>${L().cancel}</button>
              <button class="btn small primary" @click=${() => this.doPaste(s.id)}>${L().kids.pasteAdd}</button>
            </div>
          </div>`
        : html`<div class="foot">
            <button class="btn small ghost" @click=${() => ((this.pasting = s.id), (this.pasteText = ""))}>${icon("paste", 15)} ${L().kids.paste}</button>
          </div>`}
    </section>`;
  }

  private group(s: School, bso: string, kids: Kid[], total: number, away: Set<string>) {
    const sc = store.sc;
    const b = sc.bsos.find((x) => x.id === bso)!;
    const bcol = BSO_COLORS[b.color % BSO_COLORS.length]!;
    const key = `${s.id}|${bso}`;
    const sorted = [...kids].sort((a, c) => a.name.localeCompare(c.name));
    const empty = !total;
    return html`<div
      class="grp ${empty ? "empty" : ""} ${this.over === key ? "over" : ""}"
      style="--b:${bcol}"
      @dragover=${(e: DragEvent) => (e.preventDefault(), e.stopPropagation(), (this.over = key))}
      @dragleave=${() => this.over === key && (this.over = null)}
      @drop=${(e: DragEvent) => (e.stopPropagation(), this.drop(e, s.id, bso))}
    >
      <div class="ghead">
        <i class="sq" style="background:${bcol};${empty ? "opacity:.45" : ""}"></i>
        <span class="grow ellipsis">${b.name}</span>
        ${empty ? nothing : html`<span class="badge">${total}</span>`}
        <button class="icon-btn" style="width:24px;height:24px" title=${L().kids.addKid(b.name)} @click=${() => this.addKid(s.id, bso)}>${icon("plus", 15)}</button>
      </div>
      ${sorted.length ? html`<ul>${repeat(sorted, (k) => k.id, (k) => this.kid(k, away))}</ul>` : nothing}
    </div>`;
  }

  private kid(k: Kid, away: Set<string>) {
    const sc = store.sc;
    const day = store.prefs.day;
    const L_ = L();
    const isAway = away.has(k.id);
    const school = sc.schools.find((s) => s.id === k.school);
    const tr = store.trips.get(k.id);
    const st = k.days[day] && !isAway ? kidState(tr, school?.out[day] ?? null, store.t) : "off";
    const vcol = tr ? PALETTE[store.res!.days[tr.vehicle]!.crew.vehicle.color % PALETTE.length] : undefined;
    const title = tr
      ? L_.kids.tripTitle(store.res!.days[tr.vehicle]!.crew.vehicle.name, hhmm(tr.board.pickup), hhmm(tr.board.deliver))
      : !k.days[day]
        ? L_.kids.notToday(L_.days[day])
        : isAway
          ? L_.kids.calledOff
          : "";
    return html`<li
        data-kid=${k.id}
        class="${k.days[day] ? "" : "off"} ${isAway ? "absent" : ""} ${this.dragKid === k.id ? "dragging" : ""}"
        draggable="true"
        @dragstart=${(e: DragEvent) => {
          this.dragKid = k.id;
          e.dataTransfer?.setData("text/x-kid", k.id);
          if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
        }}
        @dragend=${() => ((this.dragKid = null), (this.over = null))}
      >
        <button class="grip" title=${L_.kids.move} @click=${() => (this.moving = this.moving === k.id ? null : k.id)}>${icon("grip", 14)}</button>
        <i class="st ${st}" style=${st === "riding" && vcol ? `background:${vcol}` : ""} title=${title}></i>
        <input class="name bare" .value=${k.name} @change=${(e: Event) => this.kidEdit(k.id, (x) => (x.name = (e.target as HTMLInputElement).value.trim() || x.name))} aria-label=${L_.kids.name} />
        <select class="g bare" title=${L_.kids.group} .value=${live(String(k.group))} @change=${(e: Event) => this.kidEdit(k.id, (x) => (x.group = +(e.target as HTMLSelectElement).value), true)}>
          ${[1, 2, 3, 4, 5, 6, 7, 8].map((g) => html`<option value=${g} ?selected=${k.group === g}>g${g}</option>`)}
        </select>
        <span class="days" title=${L_.kids.daysTitle}>
          ${L_.daysShort.map(
            (d, i) =>
              html`<button class="${k.days[i] ? "on" : ""} ${i === day ? "today" : ""}" style="--day:var(--d${i})" title=${L_.days[i]} @click=${() => this.kidEdit(k.id, (x) => (x.days[i] = !x.days[i]), true)}>${d}</button>`,
          )}
        </span>
        <span class="acts">
          <button class="icon-btn ${isAway ? "on" : ""}" ?disabled=${!k.days[day]} title=${isAway ? L_.kids.undoCallOff(L_.days[day]) : L_.kids.callOff(L_.days[day])}
            @click=${() => store.edit((x) => (x.absent[day] = isAway ? x.absent[day].filter((id) => id !== k.id) : [...x.absent[day], k.id]), { now: true })}>${icon("away", 15)}</button>
          <button class="icon-btn danger" title=${L_.kids.remove(k.name)} @click=${() => store.edit((x) => (x.kids = x.kids.filter((y) => y.id !== k.id)), { now: true })}>${icon("trash", 15)}</button>
        </span>
      ${this.moving === k.id
        ? html`<div class="moveto">
            ${L_.kids.moveTo}
            <select
              @change=${(e: Event) => {
                const [school, bso] = (e.target as HTMLSelectElement).value.split("|");
                this.moving = null;
                this.kidEdit(k.id, (x) => ((x.school = school!), (x.bso = bso!)), true);
              }}
            >
              ${sc.schools.flatMap((s) => sc.bsos.map((b) => html`<option value=${`${s.id}|${b.id}`} ?selected=${k.school === s.id && k.bso === b.id}>${s.name} → ${b.name}</option>`))}
            </select>
          </div>`
        : nothing}
    </li>`;
  }
}
