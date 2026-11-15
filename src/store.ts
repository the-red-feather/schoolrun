/**
 * The app's state, in one place: the week (scenario), the weekday shown, the
 * solved plan, the clock, and the preferences. Saved in localStorage as you
 * go; named saves, JSON export/import and share links on top. Components
 * subscribe with StoreController and re-render on every change.
 */
import type { ReactiveController, ReactiveControllerHost } from "lit";
import { checkScenario } from "./model/check";
import { buildDay, type DayModel } from "./model/day";
import { OLD_SAMPLE_NAMES, sampleScenario } from "./model/sample";
import { finalize, type Plan, type Result } from "./model/schedule";
import { trips, type Trip } from "./model/sim";
import { Solver } from "./model/solver";
import type { Day, MapView, Scenario } from "./model/types";
import { L, setLang, type Lang } from "./i18n";

const KEY = "schoolrun.v2";
const ATTEMPTS = 3;
const PREFS = "schoolrun.v2.prefs";
const SAVES = "schoolrun.v2.saves";

export type Tab = "plan" | "kids" | "setup";
export type Theme = "auto" | "light" | "dark";
export type MapStyle = "plain" | "labels" | "off";
export interface Prefs {
  lang: Lang;
  theme: Theme;
  day: Day;
  tab: Tab;
  map: MapStyle;
  speed: number;
}
export interface Saved {
  name: string;
  at: number;
  scenario: Scenario;
}

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function write(key: string, v: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(v));
    return true;
  } catch {
    return false;
  }
}

const today = (): Day => {
  const d = new Date().getDay();
  return (d >= 1 && d <= 5 ? d - 1 : 0) as Day;
};

function defaultLang(): Lang {
  return "nl";
}

/** Dark, after the theme preference and the system's. */
export function isDark(): boolean {
  const t = store.prefs.theme;
  return t === "dark" || (t === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
}

class Store {
  sc: Scenario;
  prefs: Prefs;
  /** Today's puzzle, for the week as it is now. */
  dm!: DayModel;
  /** The puzzle the shown plan was solved for (lags dm by a moment after an edit). */
  rdm!: DayModel;
  /** Bumped when a whole new week is loaded: the map fits itself to it. */
  fitNonce = 0;
  private history: Scenario[] = [];
  res: Result | null = null;
  trips: Map<string, Trip> = new Map();
  progress = 1;
  t = 14 * 60;
  playing = false;
  /** A vehicle in focus (its routes lit, the others quiet). */
  focus: string | null = null;
  /** Placing a BSO or school: the next click on the map puts it there. */
  placing: { kind: "bso" | "school"; id: string } | null = null;
  /** Saved to this browser (false: storage full or blocked). */
  stored = true;
  toast: { text: string; at: number } | null = null;

  /** Which try this is: a plan with problems gets up to ATTEMPTS fresh starts. */
  attempt = 1;
  /** The wand is at work (three tries, keep the best). */
  wanding = false;
  private wandFrom: number | undefined;
  private plans = new Map<string, { plan: Plan; vehicles: string[] }>();
  private solver: Solver | null = null;
  private seed = 1;
  private timer = 0;
  private frame = 0;
  private listeners = new Set<() => void>();

  constructor() {
    const stored = checkScenario(read(KEY));
    if (stored && OLD_SAMPLE_NAMES.includes(stored.name)) {
      // the example moved: keep the old one as a save, start from the new one
      const saves = read<Saved[]>(SAVES) ?? [];
      write(SAVES, [{ name: `${stored.name} (oud voorbeeld)`, at: Date.now(), scenario: stored }, ...saves]);
      this.sc = sampleScenario();
      write(KEY, this.sc);
    } else this.sc = stored ?? sampleScenario();
    const p = read<Partial<Prefs>>(PREFS) ?? {};
    this.prefs = {
      lang: p.lang === "en" || p.lang === "nl" ? p.lang : defaultLang(),
      theme: p.theme === "light" || p.theme === "dark" ? p.theme : "auto",
      day: typeof p.day === "number" && p.day >= 0 && p.day <= 4 ? (p.day as Day) : today(),
      tab: p.tab === "kids" || p.tab === "setup" ? p.tab : "plan",
      map: p.map === "labels" || p.map === "off" ? p.map : "plain",
      speed: typeof p.speed === "number" && p.speed > 0 ? p.speed : 6,
    };
    setLang(this.prefs.lang);
    this.dm = buildDay(this.sc, this.prefs.day);
    this.rdm = this.dm;
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  notify() {
    for (const fn of this.listeners) fn();
  }

  // ── preferences ──
  pref<K extends keyof Prefs>(k: K, v: Prefs[K]) {
    this.prefs = { ...this.prefs, [k]: v };
    if (k === "lang") setLang(v as Lang);
    write(PREFS, this.prefs);
    if (k === "day") {
      this.dm = buildDay(this.sc, this.prefs.day);
      this.res = null;
      this.solve();
    }
    this.notify();
  }

  say(text: string) {
    this.toast = { text, at: Date.now() };
    this.notify();
    setTimeout(() => {
      if (this.toast && Date.now() - this.toast.at >= 2400) {
        this.toast = null;
        this.notify();
      }
    }, 2500);
  }

  // ── the week ──
  /** Change the week: keep it, rebuild today's puzzle, solve again shortly. */
  edit(fn: (sc: Scenario) => void, opts: { now?: boolean; quiet?: boolean; noUndo?: boolean } = {}) {
    if (!opts.quiet && !opts.noUndo) this.checkpoint();
    const next = structuredClone(this.sc);
    fn(next);
    this.sc = checkScenario(next) ?? next;
    this.stored = write(KEY, this.sc);
    if (opts.quiet) {
      this.notify();
      return;
    }
    this.dm = buildDay(this.sc, this.prefs.day);
    this.solver = null;
    clearTimeout(this.timer);
    if (opts.now) this.solve();
    else this.timer = window.setTimeout(() => this.solve(), 300);
    this.notify();
  }

  /** Remember the week as it is now, for undo. */
  checkpoint() {
    this.history.push(this.sc);
    if (this.history.length > 50) this.history.shift();
  }
  get canUndo() {
    return this.history.length > 0;
  }
  undo() {
    const prev = this.history.pop();
    if (!prev) return;
    this.sc = prev;
    this.stored = write(KEY, this.sc);
    this.dm = buildDay(this.sc, this.prefs.day);
    this.solve();
    this.notify();
  }

  /** Only the map view changed: keep it, nothing to solve. */
  setView(v: MapView) {
    this.sc = { ...this.sc, view: v };
    this.stored = write(KEY, this.sc);
  }

  replace(sc: Scenario) {
    this.checkpoint();
    this.fitNonce++;
    this.plans.clear();
    this.res = null;
    this.focus = null;
    this.placing = null;
    this.sc = checkScenario(structuredClone(sc)) ?? sc;
    this.stored = write(KEY, this.sc);
    this.dm = buildDay(this.sc, this.prefs.day);
    this.solve();
    this.notify();
  }

  // ── solving ──
  private planKey() {
    return String(this.prefs.day);
  }

  /** Solve the day again, from the last plan for this weekday (or from scratch), a few milliseconds a frame. */
  solve(fresh = false, attempt = 1, wand = false) {
    clearTimeout(this.timer);
    if (fresh) this.seed++;
    const prev = fresh ? undefined : this.plans.get(this.planKey());
    const s = new Solver(this.dm, { seed: this.seed, from: prev?.plan, vehicles: prev?.vehicles, pins: this.sc.pins[this.prefs.day] });
    this.solver = s;
    this.attempt = attempt;
    this.wanding = wand;
    // a later attempt (or the wand) only replaces the plan shown when it's better
    const keep = (attempt > 1 || wand) && this.res && this.rdm === s.dm ? this.res.cost : Infinity;
    const better = () => s.bestResult.cost < keep - 1e-9;
    if (better()) this.adopt(s);
    this.progress = s.finished ? 1 : 0;
    const tick = () => {
      if (this.solver !== s) return;
      const t0 = performance.now();
      let improved = false;
      while (!s.finished && performance.now() - t0 < 12) improved = s.step(200) || improved;
      if (improved && better()) this.adopt(s);
      this.progress = s.finished ? 1 : s.done / s.total;
      if (s.finished) {
        this.solver = null;
        // still trouble? try again from scratch, another way (twice at most), keep the best
        const r = this.res;
        if (r && attempt < ATTEMPTS && (wand || r.lateKids || r.escortMissing || r.ridesLate || r.overtime > 0.5)) {
          this.solve(true, attempt + 1, wand);
          return;
        }
        if (wand) {
          this.wanding = false;
          const before = this.wandFrom ?? Infinity;
          this.say(r && r.cost < before - 0.5 ? L().assign.wandBetter(Math.round(((before - r.cost) / before) * 100)) : L().assign.wandSame);
        }
      } else requestAnimationFrame(tick);
      this.notify();
    };
    requestAnimationFrame(tick);
  }

  /** The magic wand: three fresh tries from scratch, the pins kept, the best plan (the current one included) wins. */
  wand() {
    this.wandFrom = this.res && this.rdm === this.dm ? this.res.cost : undefined;
    this.solve(true, 1, true);
    this.notify();
  }

  // ── editing the plan by hand ──
  /** The pickups of a job in the plan shown, in pickup order: who, how many, pinned. */
  pieces(key: string): { vehicle: string; n: number; pin: boolean; pickup: number }[] {
    const out: { vehicle: string; n: number; pin: boolean; pickup: number }[] = [];
    for (const d of this.res?.days ?? []) for (const r of d.runs) for (const b of r.boards) if (b.key === key) out.push({ vehicle: d.crew.vehicle.id, n: b.n, pin: !!b.pin, pickup: b.pickup });
    return out.sort((a, b) => a.pickup - b.pickup);
  }

  /**
   * Change one pickup of a job by hand: another vehicle, another count, pinned
   * or not. A change pins it; the pinned pickups of the job are stored, the
   * rest is left to the solver.
   */
  setPiece(key: string, index: number, change: { vehicle?: string; n?: number; pin?: boolean; split?: boolean }) {
    const ps = this.pieces(key).map((p) => ({ ...p }));
    const p = ps[index];
    const total = this.rdm.jobs.get(key)?.total ?? 0;
    if (!p || !total) return;
    if (change.vehicle) {
      p.vehicle = change.vehicle;
      p.pin = true;
    }
    if (change.n != null) {
      const others = ps.reduce((n, q, i) => n + (i !== index && q.pin ? q.n : 0), 0);
      p.n = Math.max(1, Math.min(Math.round(change.n), total - others));
      p.pin = true;
    }
    if (change.split && p.n > 1) {
      // half stays (pinned), the other half is for the solver, or for you to give to someone else
      p.n = Math.ceil(p.n / 2);
      p.pin = true;
    }
    if (change.pin != null) p.pin = change.pin;
    const pins = ps.filter((q) => q.pin).map((q) => ({ key, vehicle: q.vehicle, n: q.n }));
    const day = this.prefs.day;
    this.edit((sc) => (sc.pins[day] = [...sc.pins[day].filter((x) => x.key !== key), ...pins]), { now: true });
  }

  unpinAll() {
    const day = this.prefs.day;
    this.edit((sc) => (sc.pins[day] = []), { now: true });
  }

  private adopt(s: Solver) {
    const first = !this.res;
    this.rdm = s.dm;
    this.res = finalize(s.dm, s.bestResult);
    this.trips = trips(this.res);
    this.plans.set(this.planKey(), { plan: s.best, vehicles: s.dm.crew.map((c) => c.vehicle.id) });
    const [lo, hi] = this.span();
    if (first || this.t < lo || this.t > hi) this.t = this.res.runs ? this.res.first : lo;
  }

  get solving() {
    return this.progress < 1;
  }

  // ── time ──
  /** The afternoon the timeline shows, on quarter hours. */
  span(): [number, number] {
    const day = this.prefs.day;
    const outs = this.sc.schools.map((s) => s.out[day]).filter((o): o is number => o != null);
    const res = this.res;
    const lo = Math.min(res?.runs ? res.first : Infinity, ...outs);
    const hi = Math.max(res?.runs ? Math.max(res.done, ...res.days.map((d) => (d.runs.length ? d.home : -Infinity))) : -Infinity, ...outs.map((o) => o + 20));
    const a = Number.isFinite(lo) ? Math.floor((lo - 5) / 15) * 15 : 14 * 60;
    const b = Number.isFinite(hi) ? Math.ceil((hi + 5) / 15) * 15 : a + 120;
    return [a, Math.max(b, a + 60)];
  }

  setTime(t: number) {
    const [lo, hi] = this.span();
    this.t = Math.min(hi, Math.max(lo, t));
    this.notify();
  }

  togglePlay() {
    if (this.playing) {
      this.playing = false;
      cancelAnimationFrame(this.frame);
      this.notify();
      return;
    }
    const [lo, hi] = this.span();
    if (this.t >= hi - 0.5) this.t = lo;
    this.playing = true;
    let last = performance.now();
    const step = (now: number) => {
      if (!this.playing) return;
      const [, end] = this.span();
      this.t = Math.min(end, this.t + ((now - last) / 1000) * this.prefs.speed);
      last = now;
      if (this.t >= end) this.playing = false;
      else this.frame = requestAnimationFrame(step);
      this.notify();
    };
    this.frame = requestAnimationFrame(step);
    this.notify();
  }

  stop() {
    if (!this.playing) return;
    this.playing = false;
    cancelAnimationFrame(this.frame);
  }

  // ── saves ──
  saves(): Saved[] {
    const s = read<Saved[]>(SAVES);
    return Array.isArray(s) ? s.filter((x) => x && typeof x.name === "string" && x.scenario) : [];
  }
  saveAs(name: string) {
    const list = this.saves().filter((s) => s.name !== name);
    list.unshift({ name, at: Date.now(), scenario: { ...this.sc, name } });
    this.sc = { ...this.sc, name };
    write(KEY, this.sc);
    return write(SAVES, list.slice(0, 40));
  }
  open(name: string) {
    const s = this.saves().find((x) => x.name === name);
    const sc = s && checkScenario(s.scenario);
    if (sc) this.replace(sc);
    return !!sc;
  }
  forget(name: string) {
    write(
      SAVES,
      this.saves().filter((s) => s.name !== name),
    );
    this.notify();
  }

  exportJson() {
    const blob = new Blob([JSON.stringify(this.sc, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    const slug = this.sc.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "schoolrun";
    a.href = URL.createObjectURL(blob);
    a.download = `schoolrun-${slug}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  async importFile(f: File): Promise<boolean> {
    try {
      const sc = checkScenario(JSON.parse(await f.text()));
      if (!sc) return false;
      this.replace(sc);
      return true;
    } catch {
      return false;
    }
  }

  /** A link that carries the whole week, gzipped in the #hash: nothing leaves the browser until you send it. */
  async shareLink(): Promise<string> {
    const json = new TextEncoder().encode(JSON.stringify(this.sc));
    const gz = new Uint8Array(await new Response(new Blob([json]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer());
    let bin = "";
    for (const b of gz) bin += String.fromCharCode(b);
    const b64 = btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    return `${location.origin}${location.pathname}#s=${b64}`;
  }

  /** A week from a share link in the hash, if there is one. */
  async fromHash(): Promise<Scenario | null> {
    const m = /[#&]s=([A-Za-z0-9_-]+)/.exec(location.hash);
    if (!m) return null;
    try {
      const b64 = m[1]!.replace(/-/g, "+").replace(/_/g, "/");
      const bin = atob(b64 + "===".slice((b64.length + 3) % 4));
      const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
      const text = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
      return checkScenario(JSON.parse(text));
    } catch {
      return null;
    }
  }
}

export const store = new Store();

/** Re-render the host on every change of the store. */
export class StoreController implements ReactiveController {
  private off?: () => void;
  constructor(private host: ReactiveControllerHost) {
    host.addController(this);
  }
  hostConnected() {
    this.off = store.subscribe(() => this.host.requestUpdate());
  }
  hostDisconnected() {
    this.off?.();
  }
}
