/**
 * WIE HAALT WIE OP: the plan by hand. Per group (a school's children for one
 * BSO, or a colleague's lift) its pickups: which vehicle, how many, pinned or
 * not. A change pins the pickup; the solver plans everything else around the
 * pins. The magic wand looks for the best plan that keeps them.
 */
import { LitElement, css, html, nothing } from "lit";
import { customElement } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import { L } from "../i18n";
import type { JobInfo } from "../model/day";
import { BSO_COLORS, PALETTE, hhmm } from "../model/types";
import { store, StoreController } from "../store";
import { icon } from "./icons";
import { base } from "./shared";

@customElement("sr-assign")
export class SrAssign extends LitElement {
  private ctl = new StoreController(this);

  static override styles = [
    base,
    css`
      :host {
        display: block;
      }
      .head {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        flex-wrap: wrap;
        margin-bottom: 14px;
      }
      .head .ic {
        width: 34px;
        height: 34px;
        border-radius: 10px;
        display: grid;
        place-items: center;
        color: #fff;
        background: linear-gradient(135deg, var(--c9), var(--c7));
        flex: none;
      }
      .wand {
        border: none;
        color: #fff;
        background: linear-gradient(90deg, var(--c9), var(--c7), var(--c5));
        background-size: 200% 100%;
        box-shadow: 0 4px 14px color-mix(in oklab, var(--c7) 35%, transparent);
      }
      .wand:hover {
        background-position: 100% 0;
        color: #fff;
        border: none;
      }
      .wand.busy .icon {
        animation: wiggle 0.5s ease-in-out infinite alternate;
      }
      @keyframes wiggle {
        from {
          transform: rotate(-14deg);
        }
        to {
          transform: rotate(14deg);
        }
      }
      .groups {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(420px, 1fr));
        gap: 8px;
      }
      @media (max-width: 560px) {
        .groups {
          grid-template-columns: minmax(0, 1fr);
        }
      }
      .grp {
        border-radius: 12px;
        border: 1.5px solid var(--hair);
        border-left: 6px solid var(--c);
        background: var(--surface-2);
        padding: 8px 10px;
        display: grid;
        gap: 6px;
        align-content: start;
        min-width: 0;
      }
      .gh {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.85rem;
        min-width: 0;
      }
      .gh b {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .gh .meta {
        margin-left: auto;
        color: var(--dim);
        font-size: 0.76rem;
        white-space: nowrap;
      }
      .pieces {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .pc {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 3px 4px 3px 4px;
        border-radius: 10px;
        background: var(--surface);
        border: 1.5px solid var(--hair);
        border-left: 5px solid var(--v);
      }
      .pc.pinned {
        border-color: var(--ink);
        border-left-color: var(--v);
        box-shadow: 0 0 0 1px var(--ink);
      }
      .pc select {
        height: 26px;
        font-size: 0.8rem;
        font-weight: 700;
        padding: 1px 4px;
        border-color: transparent;
        background: transparent;
        max-width: 120px;
      }
      .pc input {
        width: 46px;
        height: 26px;
        font-size: 0.8rem;
        padding: 1px 4px;
        text-align: center;
      }
      .pc .t {
        font-family: var(--mono);
        font-size: 0.74rem;
        color: var(--dim);
        padding: 0 2px;
      }
      .pc .icon-btn {
        width: 26px;
        height: 26px;
      }
      .pc .icon-btn.on {
        background: var(--ink);
        color: var(--bg);
      }
      .empty {
        color: var(--dim);
        font-size: 0.88rem;
      }
    `,
  ];

  override render() {
    const sc = store.sc;
    const dm = store.rdm;
    const day = store.prefs.day;
    const A = L().assign;
    const pins = sc.pins[day].length;
    const jobs = [...dm.jobs.values()].sort((a, b) => Number(a.kind === "ride") - Number(b.kind === "ride") || a.ready - b.ready || (a.school?.name ?? "").localeCompare(b.school?.name ?? ""));
    return html`<section class="card">
      <div class="head">
        <span class="ic">${icon("route", 18)}</span>
        <div class="grow" style="min-width:240px"><h2>${A.title}</h2><p class="hint">${A.hint}</p></div>
        ${pins ? html`<button class="btn small ghost" @click=${() => store.unpinAll()}>${icon("pushpin", 15)} ${A.unpinAll(pins)}</button>` : nothing}
        <button class="btn wand ${store.wanding ? "busy" : ""}" title=${A.wandTitle} ?disabled=${!dm.crew.length || store.wanding} @click=${() => store.wand()}>
          ${icon("wand", 17)} ${store.wanding ? A.wandBusy : A.wand}
        </button>
      </div>
      ${!dm.crew.length ? html`<p class="empty">${A.noVehicles}</p>` : !jobs.length ? html`<p class="empty">${A.none}</p>` : html`<div class="groups">${jobs.map((j) => this.group(j))}</div>`}
    </section>`;
  }

  private group(j: JobInfo) {
    const dm = store.rdm;
    const A = L().assign;
    const pieces = store.pieces(j.key);
    const color = j.school ? PALETTE[j.school.color % PALETTE.length]! : "var(--dim)";
    const bso = store.sc.bsos.find((b) => b.id === j.to);
    const head =
      j.kind === "kids"
        ? html`<i class="dot" style="background:${color}"></i><b>${j.school!.name}</b><span class="dim">→</span>
            <i class="sq" style="background:${BSO_COLORS[(bso?.color ?? 0) % BSO_COLORS.length]}"></i><b>${bso?.name.replace(/^BSO /, "")}</b>
            <span class="meta">${A.out(hhmm(j.ready))} · ${A.kids(j.total)}</span>`
        : html`<span style="color:var(--dim)">${icon("person", 14)}</span><b>${j.ride!.who}</b>
            <span class="meta">${A.lift(dm.place.get(j.from)?.name ?? "?", dm.place.get(j.to)?.name ?? "?")}</span>`;
    return html`<div class="grp" style="--c:${color}">
      <div class="gh">${head}</div>
      <div class="pieces">
        ${repeat(pieces, (p, i) => `${i}|${p.vehicle}|${p.n}|${p.pin}`, (p, i) => {
          const v = store.sc.vehicles.find((x) => x.id === p.vehicle);
          const vc = PALETTE[(v?.color ?? 0) % PALETTE.length];
          return html`<span class="pc ${p.pin ? "pinned" : ""}" style="--v:${vc}">
            <select title=${A.vehicle} @change=${(e: Event) => store.setPiece(j.key, i, { vehicle: (e.target as HTMLSelectElement).value })}>
              ${dm.crew.map((c) => html`<option value=${c.vehicle.id} ?selected=${c.vehicle.id === p.vehicle}>${c.vehicle.name}</option>`)}
            </select>
            ${j.kind === "kids"
              ? html`<input
                  type="number"
                  min="1"
                  max=${j.total}
                  .value=${String(p.n)}
                  title=${A.count}
                  @change=${(e: Event) => {
                    const n = +(e.target as HTMLInputElement).value;
                    if (Number.isFinite(n) && n >= 1) store.setPiece(j.key, i, { n });
                    else this.requestUpdate();
                  }}
                />`
              : nothing}
            <span class="t">${hhmm(p.pickup)}</span>
            <button class="icon-btn ${p.pin ? "on" : ""}" title=${p.pin ? A.pinned : A.unpinned} @click=${() => store.setPiece(j.key, i, { pin: !p.pin })}>${icon("pushpin", 14)}</button>
            ${j.kind === "kids" && p.n > 1 ? html`<button class="icon-btn" title=${A.split} @click=${() => store.setPiece(j.key, i, { split: true })}>${icon("scissors", 14)}</button>` : nothing}
          </span>`;
        })}
      </div>
    </div>`;
  }
}
