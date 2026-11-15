/**
 * The map: a grey street map underneath (OpenStreetMap's tiles, greyed out
 * with a filter, inverted in the dark), a kilometre grid on top, and the
 * afternoon on it: BSOs, schools, routes as straight lines, vehicles moving
 * along them. Pan, zoom (wheel, pinch, buttons), drag locations when moving
 * is on, click to place, look up an address.
 */
import { LitElement, css, html, nothing, svg } from "lit";
import { customElement, state } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import { L } from "../i18n";
import { fit, fromLocal, project, toLocal, unproject } from "../model/geo";
import { counts, vehicleAt } from "../model/sim";
import { BSO_COLORS, PALETTE, hhmm, inkOn, type Geo } from "../model/types";
import { store, StoreController } from "../store";
import { icon, iconPaths } from "./icons";
import { base } from "./shared";

const TILE = 256;
const MIN_Z = 3;
const MAX_Z = 18.5;

interface Pt {
  x: number;
  y: number;
}
type Gesture =
  | { kind: "pan"; start: Pt; c0: Pt; moved: boolean }
  | { kind: "pinch"; d0: number; z0: number; mid: Geo }
  | { kind: "mark"; id: string; moved: boolean; start: Pt }
  | null;

@customElement("sr-map")
export class SrMap extends LitElement {
  private ctl = new StoreController(this);
  @state() private w = 800;
  @state() private h = 560;
  @state() private view = { lat: 52.0116, lon: 4.3571, zoom: 13 };
  @state() private moveMode = false;
  @state() private found: { name: string; lat: number; lon: number }[] = [];
  @state() private query = "";
  @state() private searching = false;
  private pointers = new Map<number, Pt>();
  private gesture: Gesture = null;
  private fitNonce = -1;
  private viewTimer = 0;
  private sized = false;
  private ro = new ResizeObserver(([e]) => {
    if (!e) return;
    this.w = Math.max(200, e.contentRect.width);
    this.h = Math.max(200, e.contentRect.height);
    if (!this.sized) {
      this.sized = true;
      if (store.sc.view) this.view = { ...store.sc.view };
      else this.fitAll();
      this.fitNonce = store.fitNonce;
    }
  });

  static override styles = [
    base,
    css`
      :host {
        display: block;
        position: relative;
        border-radius: var(--radius-lg);
        overflow: hidden;
        background: var(--map-bg);
        border: 1.5px solid var(--hair);
        box-shadow: var(--shadow);
        height: 100%;
        min-height: 380px;
      }
      .stage {
        position: absolute;
        inset: 0;
        touch-action: none;
        cursor: grab;
        user-select: none;
        -webkit-user-select: none;
      }
      .stage.panning {
        cursor: grabbing;
      }
      .stage.placing {
        cursor: crosshair;
      }
      .tiles {
        position: absolute;
        inset: 0;
        opacity: var(--map-opacity);
        pointer-events: none;
      }
      .tiles.plain {
        opacity: calc(var(--map-opacity) * 0.7);
      }
      .tiles img {
        position: absolute;
        filter: var(--map-filter);
        user-select: none;
        -webkit-user-drag: none;
      }
      svg.over {
        position: absolute;
        inset: 0;
        overflow: visible;
      }
      .grid line {
        stroke: var(--grid);
        stroke-width: 1;
      }
      .grid line.major {
        stroke: var(--grid-major);
      }
      text {
        font-family: var(--font);
        fill: var(--ink);
      }
      .halo {
        paint-order: stroke;
        stroke: var(--map-halo);
        stroke-width: 4px;
        stroke-linejoin: round;
      }
      .route {
        fill: none;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      [data-id] {
        cursor: pointer;
      }
      .moving [data-id] {
        cursor: move;
      }
      .school circle.mk,
      .bso rect.mk {
        stroke: var(--map-halo);
        stroke-width: 2.5;
      }
      .veh {
        transition: opacity 0.2s;
      }
      .veh rect {
        stroke: var(--map-halo);
        stroke-width: 2;
      }
      .veh text {
        font-family: var(--mono);
        font-weight: 700;
        font-size: 11px;
      }
      .ui {
        position: absolute;
        display: flex;
        gap: 6px;
        z-index: 2;
      }
      .tools {
        top: 10px;
        right: 10px;
        flex-direction: column;
        background: var(--surface);
        border: 1.5px solid var(--hair);
        border-radius: 999px;
        padding: 3px;
        box-shadow: var(--shadow);
      }
      .search {
        top: 10px;
        left: 10px;
        flex-direction: column;
        width: min(300px, calc(100% - 70px));
      }
      .search form {
        display: flex;
        align-items: center;
        background: var(--surface);
        border: 1.5px solid var(--hair);
        border-radius: 999px;
        padding: 0 4px 0 10px;
        box-shadow: var(--shadow);
        color: var(--dim);
      }
      .search input {
        border: none;
        background: transparent;
        box-shadow: none;
        flex: 1;
        height: 34px;
      }
      .results {
        background: var(--surface);
        border: 1.5px solid var(--hair);
        border-radius: 12px;
        box-shadow: var(--shadow);
        overflow: hidden;
      }
      .results button {
        display: block;
        width: 100%;
        text-align: left;
        border: none;
        background: transparent;
        padding: 8px 12px;
        font-size: 0.82rem;
        cursor: pointer;
        border-bottom: 1px solid var(--hair);
      }
      .results button:hover {
        background: var(--surface-2);
      }
      .clock {
        left: 12px;
        bottom: 10px;
        font-family: var(--mono);
        font-weight: 700;
        font-size: 1.6rem;
        letter-spacing: -0.02em;
        color: var(--ink);
        background: color-mix(in oklab, var(--surface) 85%, transparent);
        padding: 2px 10px;
        border-radius: 10px;
        pointer-events: none;
      }
      .attrib {
        right: 8px;
        bottom: 6px;
        font-size: 0.66rem;
        color: var(--dim);
        background: color-mix(in oklab, var(--surface) 80%, transparent);
        padding: 1px 6px;
        border-radius: 6px;
        align-items: center;
      }
      .attrib a {
        color: inherit;
      }
      .scale {
        display: inline-flex;
        align-items: end;
        gap: 4px;
        margin-right: 6px;
      }
      .scale i {
        display: block;
        height: 6px;
        border: 1.5px solid var(--ink);
        border-top: none;
      }
      .banner {
        left: 50%;
        transform: translateX(-50%);
        bottom: 14px;
        background: var(--ink);
        color: var(--bg);
        border-radius: 999px;
        padding: 6px 6px 6px 14px;
        align-items: center;
        font-weight: 600;
        font-size: 0.88rem;
        box-shadow: var(--shadow);
        white-space: nowrap;
      }
      .banner .btn {
        height: 26px;
        background: var(--bg);
        color: var(--ink);
        border: none;
      }
    `,
  ];

  override connectedCallback() {
    super.connectedCallback();
    this.ro.observe(this);
  }
  override disconnectedCallback() {
    super.disconnectedCallback();
    this.ro.disconnect();
  }

  override willUpdate() {
    if (this.sized && store.fitNonce !== this.fitNonce) {
      this.fitNonce = store.fitNonce;
      if (store.sc.view) this.view = { ...store.sc.view };
      else this.fitAll();
    }
  }

  // ── projection ──
  private center(): Pt {
    return project(this.view, this.view.zoom);
  }
  private toScreen(g: Geo, c = this.center()): Pt {
    const p = project(g, this.view.zoom);
    return { x: p.x - c.x + this.w / 2, y: p.y - c.y + this.h / 2 };
  }
  private toGeo(x: number, y: number): Geo {
    const c = this.center();
    return unproject(x - this.w / 2 + c.x, y - this.h / 2 + c.y, this.view.zoom);
  }
  private local(e: PointerEvent | WheelEvent | MouseEvent): Pt {
    const r = this.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  fitAll() {
    const sc = store.sc;
    const pts = [...sc.bsos, ...sc.schools];
    const f = fit(pts, this.w, this.h, 70);
    this.view = { lat: f.lat, lon: f.lon, zoom: Math.max(MIN_Z, Math.min(MAX_Z, f.zoom)) };
    this.keepView();
  }

  private keepView() {
    clearTimeout(this.viewTimer);
    this.viewTimer = window.setTimeout(() => store.setView({ lat: +this.view.lat.toFixed(6), lon: +this.view.lon.toFixed(6), zoom: +this.view.zoom.toFixed(3) }), 400);
  }

  private zoomAt(p: Pt, z: number) {
    z = Math.max(MIN_Z, Math.min(MAX_Z, z));
    const g = this.toGeo(p.x, p.y);
    const w = project(g, z);
    const c = { x: w.x - (p.x - this.w / 2), y: w.y - (p.y - this.h / 2) };
    this.view = { ...unproject(c.x, c.y, z), zoom: z };
    this.keepView();
  }

  // ── gestures ──
  private down(e: PointerEvent) {
    if ((e.target as Element).closest(".ui")) return;
    const stage = e.currentTarget as HTMLElement;
    stage.setPointerCapture(e.pointerId);
    const p = this.local(e);
    this.pointers.set(e.pointerId, p);
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()] as [Pt, Pt];
      this.gesture = { kind: "pinch", d0: Math.hypot(a.x - b.x, a.y - b.y), z0: this.view.zoom, mid: this.toGeo((a.x + b.x) / 2, (a.y + b.y) / 2) };
      return;
    }
    const mark = (e.target as Element).closest("[data-id]")?.getAttribute("data-id");
    if (mark && (this.moveMode || mark.startsWith("veh:"))) {
      this.gesture = { kind: "mark", id: mark, moved: false, start: p };
      return;
    }
    this.gesture = { kind: "pan", start: p, c0: this.center(), moved: false };
  }

  private move(e: PointerEvent) {
    if (!this.pointers.has(e.pointerId)) return;
    const p = this.local(e);
    this.pointers.set(e.pointerId, p);
    const g = this.gesture;
    if (!g) return;
    if (g.kind === "pinch" && this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()] as [Pt, Pt];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const z = Math.max(MIN_Z, Math.min(MAX_Z, g.z0 + Math.log2(d / Math.max(1, g.d0))));
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const w = project(g.mid, z);
      this.view = { ...unproject(w.x - (mid.x - this.w / 2), w.y - (mid.y - this.h / 2), z), zoom: z };
      this.keepView();
    } else if (g.kind === "pan") {
      const dx = p.x - g.start.x,
        dy = p.y - g.start.y;
      if (!g.moved && Math.hypot(dx, dy) < 4) return;
      g.moved = true;
      this.view = { ...unproject(g.c0.x - dx, g.c0.y - dy, this.view.zoom), zoom: this.view.zoom };
      this.keepView();
    } else if (g.kind === "mark" && this.moveMode && !g.id.startsWith("veh:")) {
      if (!g.moved && Math.hypot(p.x - g.start.x, p.y - g.start.y) < 3) return;
      if (!g.moved) store.checkpoint();
      g.moved = true;
      const geo = this.toGeo(p.x, p.y);
      this.setPlace(g.id, geo, true);
    }
  }

  private up(e: PointerEvent) {
    const p = this.pointers.get(e.pointerId);
    this.pointers.delete(e.pointerId);
    const g = this.gesture;
    if (this.pointers.size) {
      // a finger left a pinch: carry on panning with the other
      const [q] = [...this.pointers.values()] as [Pt];
      this.gesture = { kind: "pan", start: q, c0: this.center(), moved: true };
      return;
    }
    this.gesture = null;
    if (!g || !p) return;
    if (g.kind === "mark") {
      if (g.id.startsWith("veh:")) {
        const id = g.id.slice(4);
        store.focus = store.focus === id ? null : id;
        store.notify();
      } else if (g.moved) store.edit(() => {}, { now: true, noUndo: true });
    } else if (g.kind === "pan" && !g.moved && store.placing) {
      this.setPlace(store.placing.id, this.toGeo(p.x, p.y), false);
      store.placing = null;
      store.notify();
    } else if (g.kind === "pan" && !g.moved && store.focus) {
      store.focus = null;
      store.notify();
    }
    this.requestUpdate();
  }

  private wheel(e: WheelEvent) {
    e.preventDefault();
    const p = this.local(e);
    const dz = -e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0022);
    this.zoomAt(p, this.view.zoom + Math.max(-0.6, Math.min(0.6, dz)));
  }

  /** Move a BSO or a school. While dragging only the location changes (quiet); solved on release. */
  private setPlace(id: string, g: Geo, quiet: boolean) {
    const lat = +g.lat.toFixed(6),
      lon = +g.lon.toFixed(6);
    store.edit(
      (sc) => {
        const p = sc.bsos.find((b) => b.id === id) ?? sc.schools.find((s) => s.id === id);
        if (p) {
          p.lat = lat;
          p.lon = lon;
        }
      },
      { quiet, now: !quiet },
    );
  }

  private async search(e: Event) {
    e.preventDefault();
    const q = this.query.trim();
    if (!q) return;
    this.searching = true;
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&accept-language=${store.prefs.lang}&q=${encodeURIComponent(q)}`;
      const r = await fetch(url, { headers: { Accept: "application/json" } });
      const js = (await r.json()) as { display_name: string; lat: string; lon: string }[];
      this.found = js.map((x) => ({ name: x.display_name, lat: +x.lat, lon: +x.lon }));
      if (!this.found.length) store.say(L().map.nothingFound);
    } catch {
      store.say(L().map.searchFailed);
    } finally {
      this.searching = false;
    }
  }

  private goTo(f: { lat: number; lon: number }) {
    this.found = [];
    this.view = { lat: f.lat, lon: f.lon, zoom: Math.max(this.view.zoom, 15) };
    this.keepView();
    if (store.placing) {
      this.setPlace(store.placing.id, f, false);
      store.placing = null;
      store.notify();
    }
  }

  // ── drawing ──
  private tiles() {
    const style = store.prefs.map;
    if (style === "off") return [];
    const z = this.view.zoom;
    const zi = Math.max(0, Math.min(19, Math.round(z + 0.15)));
    const scale = 2 ** (z - zi);
    const c = project(this.view, zi);
    const x0 = c.x - this.w / 2 / scale,
      y0 = c.y - this.h / 2 / scale;
    const n = 2 ** zi;
    const out: { key: string; src: string; left: number; top: number; size: number }[] = [];
    for (let tx = Math.floor(x0 / TILE); tx <= Math.floor((x0 + this.w / scale) / TILE); tx++)
      for (let ty = Math.floor(y0 / TILE); ty <= Math.floor((y0 + this.h / scale) / TILE); ty++) {
        if (ty < 0 || ty >= n) continue;
        const x = ((tx % n) + n) % n;
        out.push({
          key: `${zi}/${tx}/${ty}`,
          src: `https://tile.openstreetmap.org/${zi}/${x}/${ty}.png`,
          left: (tx * TILE - x0) * scale,
          top: (ty * TILE - y0) * scale,
          size: TILE * scale,
        });
      }
    return out;
  }

  private grid(c: Pt) {
    const sc = store.sc;
    const o = sc.bsos[0] ?? this.view;
    const pxPerKm = (TILE * 2 ** this.view.zoom) / (40075.016 * Math.cos((this.view.lat * Math.PI) / 180));
    const step = [0.25, 0.5, 1, 2, 5, 10, 20, 50].find((s) => s * pxPerKm >= 46) ?? 100;
    const major = step < 1 ? 1 : step * 5;
    const corners = [this.toGeo(0, 0), this.toGeo(this.w, this.h)].map((g) => toLocal(g, o));
    const [a, b] = corners as [Pt, Pt];
    const xmin = Math.min(a.x, b.x),
      xmax = Math.max(a.x, b.x),
      ymin = Math.min(a.y, b.y),
      ymax = Math.max(a.y, b.y);
    const lines = [];
    const isMajor = (v: number) => Math.abs(v / major - Math.round(v / major)) < 1e-6;
    for (let x = Math.ceil(xmin / step) * step; x <= xmax; x += step) {
      const p = this.toScreen(fromLocal(x, ymin, o), c),
        q = this.toScreen(fromLocal(x, ymax, o), c);
      lines.push(svg`<line class=${isMajor(x) ? "major" : ""} x1=${p.x} y1=${p.y} x2=${q.x} y2=${q.y}></line>`);
    }
    for (let y = Math.ceil(ymin / step) * step; y <= ymax; y += step) {
      const p = this.toScreen(fromLocal(xmin, y, o), c),
        q = this.toScreen(fromLocal(xmax, y, o), c);
      lines.push(svg`<line class=${isMajor(y) ? "major" : ""} x1=${p.x} y1=${p.y} x2=${q.x} y2=${q.y}></line>`);
    }
    return { lines, step, px: step * pxPerKm };
  }

  override render() {
    const sc = store.sc;
    const dm = store.rdm;
    const res = store.res;
    const t = store.t;
    const day = store.prefs.day;
    const c = this.center();
    const S = (g: Geo) => this.toScreen(g, c);
    const tiles = this.tiles();
    const grid = this.grid(c);
    const cnt = res ? counts(dm, res, t) : null;
    const vcolor = (i: number) => PALETTE[i % PALETTE.length]!;
    const nV = res?.days.length ?? 0;
    const off = (vi: number) => (vi - (nV - 1) / 2) * 3.5;
    const focus = store.focus;
    /** A small map (a phone): shorter labels. */
    const compact = this.w < 560;

    // routes: quiet unless running now (or the vehicle in focus)
    const routes = (res?.days ?? []).flatMap((d, vi) => {
      const col = vcolor(d.crew.vehicle.color);
      const o = off(vi);
      return d.runs.map((run) => {
        const ids = [run.start, ...run.stops.map((s) => s.place)].filter((p, i, a) => i === 0 || p !== a[i - 1]);
        const pts = ids.map((id) => dm.place.get(id)).filter((p): p is NonNullable<typeof p> => !!p).map((p) => S(p));
        if (pts.length < 2) return nothing;
        const now = t >= run.depart && t <= run.back;
        const past = t > run.back;
        const lit = focus ? focus === d.crew.vehicle.id : now;
        const op = focus ? (lit ? 1 : 0.08) : now ? 1 : past ? 0.16 : 0.42;
        const path = pts.map((p, i) => `${i ? "L" : "M"}${(p.x + o).toFixed(1)} ${(p.y + o).toFixed(1)}`).join(" ");
        const arrows = lit
          ? pts.slice(1).map((q, i) => {
              const p = pts[i]!;
              const len = Math.hypot(q.x - p.x, q.y - p.y);
              if (len < 40) return nothing;
              const a = (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI;
              return svg`<path d="M-5 -5 L2 0 L-5 5" fill="none" stroke=${col} stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
                transform="translate(${(p.x + q.x) / 2 + o} ${(p.y + q.y) / 2 + o}) rotate(${a})"></path>`;
            })
          : [];
        return svg`<g opacity=${op}>
          ${lit ? svg`<path class="route" d=${path} stroke="var(--map-halo)" stroke-width="7"></path>` : nothing}
          <path class="route" d=${path} stroke=${col} stroke-width=${lit ? 3.5 : 2} stroke-dasharray=${lit ? "none" : "5 6"}></path>
          ${arrows}
        </g>`;
      });
    });

    const schools = sc.schools.map((s) => {
      const p = S(s);
      const col = PALETTE[s.color % PALETTE.length]!;
      const out = s.out[day];
      const st = cnt?.schools.get(s.id);
      const waiting = st?.waiting ?? 0;
      const total = st?.total ?? 0;
      const allGone = !!st && st.total > 0 && st.gone === st.total;
      const longWait = waiting > 0 && (st?.maxWait ?? 0) > sc.rules.maxWait;
      const left = p.x > this.w - (compact ? 120 : 190);
      const anchor = left ? "end" : "start";
      const dx = left ? -17 : 17;
      const line2 = compact && !waiting ? "" : out == null ? L().map.noPickup : waiting ? L().map.waiting(waiting) : allGone ? L().map.allGone : t < out ? `${L().map.out} ${hhmm(out)} · ${total}` : `${hhmm(out)} · ${total}`;
      return svg`<g class="school" data-id=${s.id} opacity=${out == null || (!total && res) ? 0.55 : 1}>
        <circle cx=${p.x} cy=${p.y} r="16" fill="transparent"></circle>
        <circle class="mk" cx=${p.x} cy=${p.y} r="10.5" fill=${col}></circle>
        ${allGone ? svg`<path d="M${p.x - 4.5} ${p.y + 0.5} l3 3 l6 -6.5" fill="none" stroke=${inkOn(col)} stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"></path>` : nothing}
        ${
          waiting
            ? svg`<g transform="translate(${p.x + (left ? -9 : 9)} ${p.y - 12})">
              <rect x="-11" y="-9" width="22" height="18" rx="9" fill=${longWait ? "var(--bad)" : "var(--warn)"} stroke="var(--map-halo)" stroke-width="2"></rect>
              <text x="0" y="4.2" text-anchor="middle" font-size="11" font-weight="800" fill="#fff" font-family="var(--mono)">${waiting}</text></g>`
            : nothing
        }
        <text class="halo" x=${p.x + dx} y=${p.y + (line2 ? -2 : 4)} text-anchor=${anchor} font-size=${compact ? 11 : 12.5} font-weight="700">${s.name}</text>
        <text class="halo" x=${p.x + dx} y=${p.y + 12} text-anchor=${anchor} font-size="11" font-family="var(--mono)"
          fill=${waiting ? (longWait ? "var(--bad)" : "var(--warn-ink)") : "var(--dim)"} font-weight=${waiting ? 700 : 500}>${line2}</text>
      </g>`;
    });

    const bsos = sc.bsos.map((b) => {
      const p = S(b);
      const col = BSO_COLORS[b.color % BSO_COLORS.length]!;
      const st = cnt?.bsos.get(b.id);
      return svg`<g class="bso" data-id=${b.id}>
        <rect x=${p.x - 21} y=${p.y - 21} width="42" height="42" fill="transparent"></rect>
        <rect class="mk" x=${p.x - 16} y=${p.y - 16} width="32" height="32" rx="9" fill=${col}></rect>
        <g transform="translate(${p.x - 10} ${p.y - 10.5}) scale(0.84)" fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">${iconPaths("house")}</g>
        <text class="halo" x=${p.x} y=${p.y + 32} text-anchor="middle" font-size=${compact ? 11.5 : 13} font-weight="800">${b.name}</text>
        ${st && st.total ? svg`<text class="halo" x=${p.x} y=${p.y + 46} text-anchor="middle" font-size="11" font-family="var(--mono)" font-weight="700" fill=${st.in === st.total ? "var(--good)" : "var(--dim)"}>${L().map.arrived(st.in, st.total)}</text>` : nothing}
      </g>`;
    });

    // vehicles: parked ones in a row under their stop, moving ones on their line
    const parkedAt = new Map<string, number>();
    const vehicles = (res?.days ?? []).map((d, vi) => {
      const home = dm.place.get(d.crew.vehicle.home);
      if (!home) return nothing;
      const at = vehicleAt(d, home, t);
      const col = vcolor(d.crew.vehicle.color);
      let x: number, y: number;
      const sp = S(at);
      if (!at.moving && at.place) {
        const k = parkedAt.get(at.place) ?? 0;
        parkedAt.set(at.place, k + 1);
        const pl = dm.place.get(at.place);
        const base = pl ? S(pl) : sp;
        const isBso = pl?.kind === "bso";
        x = base.x - 34 + (k % 3) * 34 + (isBso ? 0 : 34);
        y = base.y + (isBso ? -38 : -28) - Math.floor(k / 3) * 24;
        if (!isBso) {
          x = base.x + 2 + k * 34 - 17;
          y = base.y + 26;
        }
      } else {
        // spread vehicles on the same stretch sideways, across their heading
        const to = at.heading ? S(at.heading) : sp;
        const len = Math.hypot(to.x - sp.x, to.y - sp.y) || 1;
        const side = (vi - (nV - 1) / 2) * 13;
        x = sp.x + off(vi) + (-(to.y - sp.y) / len) * side;
        y = sp.y + off(vi) + ((to.x - sp.x) / len) * side;
      }
      const dim = focus && focus !== d.crew.vehicle.id;
      const used = d.runs.length > 0;
      return svg`<g class="veh" data-id=${"veh:" + d.crew.vehicle.id} opacity=${dim ? 0.3 : used ? 1 : 0.55} transform="translate(${x} ${y})">
        <title>${d.crew.vehicle.name} · ${d.crew.driver.name}${at.load ? ` · ${at.load}` : ""}</title>
        ${at.moving ? svg`<rect x="-17" y="-11" width="34" height="22" rx="11" fill=${col} opacity="0.25" transform="scale(1.35)"></rect>` : nothing}
        <rect x="-16" y="-10" width="32" height="20" rx="7" fill=${col}></rect>
        ${
          at.load
            ? svg`<text x="0" y="4" text-anchor="middle" fill=${inkOn(col)}>${at.load}</text>`
            : svg`<g transform="translate(-7 -7) scale(0.58)" fill="none" stroke=${inkOn(col)} stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${iconPaths("bus")}</g>`
        }
      </g>`;
    });

    const placing = store.placing;
    const placingName = placing ? (placing.kind === "bso" ? sc.bsos.find((b) => b.id === placing.id)?.name : sc.schools.find((s) => s.id === placing.id)?.name) : "";
    const styleNext = { plain: "labels", labels: "off", off: "plain" } as const;
    const kmLabel = grid.step < 1 ? `${grid.step * 1000} m` : `${grid.step} km`;

    return html`<div
      class="stage ${this.gesture?.kind === "pan" && this.gesture.moved ? "panning" : ""} ${placing ? "placing" : ""} ${this.moveMode ? "moving" : ""}"
      @pointerdown=${this.down}
      @pointermove=${this.move}
      @pointerup=${this.up}
      @pointercancel=${this.up}
      @wheel=${this.wheel}
      @dblclick=${(e: MouseEvent) => this.zoomAt(this.local(e), this.view.zoom + 1)}
    >
      <div class="tiles ${store.prefs.map}">${repeat(tiles, (x) => x.key, (x) => html`<img src=${x.src} alt="" draggable="false" style="left:${x.left}px;top:${x.top}px;width:${x.size + 0.6}px;height:${x.size + 0.6}px" />`)}</div>
      <svg class="over ${this.moveMode ? "moving" : ""}" width=${this.w} height=${this.h} role="img" aria-label=${L().map.aria}>
        <g class="grid">${grid.lines}</g>
        ${routes} ${bsos} ${schools} ${vehicles}
      </svg>
    </div>
    <div class="ui search">
      <form @submit=${this.search}>
        ${icon("search", 16)}
        <input .value=${this.query} @input=${(e: Event) => (this.query = (e.target as HTMLInputElement).value)} placeholder=${L().map.search} aria-label=${L().map.search} />
        ${this.searching ? html`<span class="dim" style="font-size:.75rem;padding-right:8px">…</span>` : nothing}
      </form>
      ${this.found.length ? html`<div class="results">${this.found.map((f) => html`<button @click=${() => this.goTo(f)}>${f.name}</button>`)}</div>` : nothing}
    </div>
    <div class="ui tools">
      <button class="icon-btn" title=${L().map.zoomIn} @click=${() => this.zoomAt({ x: this.w / 2, y: this.h / 2 }, this.view.zoom + 1)}>${icon("plus")}</button>
      <button class="icon-btn" title=${L().map.zoomOut} @click=${() => this.zoomAt({ x: this.w / 2, y: this.h / 2 }, this.view.zoom - 1)}>${icon("minus")}</button>
      <button class="icon-btn" title=${L().map.fit} @click=${() => this.fitAll()}>${icon("fit")}</button>
      <button class="icon-btn ${store.prefs.map !== "off" ? "" : "on"}" title=${L().map.layer[store.prefs.map]} @click=${() => store.pref("map", styleNext[store.prefs.map])}>${icon("layers")}</button>
      <button class="icon-btn ${this.moveMode ? "on" : ""}" title=${L().map.moveMode} @click=${() => (this.moveMode = !this.moveMode)}>${icon("move")}</button>
    </div>
    <div class="ui clock">${hhmm(t)}</div>
    <div class="ui attrib">
      <span class="scale"><i style="width:${grid.px}px"></i>${kmLabel}</span>
      ${store.prefs.map !== "off" ? html`© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>` : L().map.noBasemap}
    </div>
    ${placing ? html`<div class="ui banner">${L().map.placeHint(placingName ?? "")}<button class="btn small" @click=${() => ((store.placing = null), store.notify())}>${L().cancel}</button></div>` : nothing}`;
  }
}
