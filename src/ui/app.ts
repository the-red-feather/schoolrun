/**
 * The shell: the header (weekday, pages, language, theme, file), the page,
 * a toast, the file dialog (save, open, export, import, share, start over)
 * and the explanation.
 */
import { LitElement, css, html, nothing } from "lit";
import { customElement, query, state } from "lit/decorators.js";
import { L, type Lang } from "../i18n";
import { emptyScenario, randomScenario, sampleScenario } from "../model/sample";
import type { Day } from "../model/types";
import { store, StoreController, type Tab, type Theme } from "../store";
import { icon } from "./icons";
import { base } from "./shared";
import "./plan";
import "./kids";
import "./setup";

@customElement("sr-app")
export class SrApp extends LitElement {
  private ctl = new StoreController(this);
  @state() private dialog: "file" | "help" | null = null;
  @state() private saveName = "";
  @state() private link = "";
  @query("input[type=file]") private fileInput!: HTMLInputElement;

  static override styles = [
    base,
    css`
      :host {
        display: block;
        min-height: 100vh;
      }
      .top {
        background: var(--header);
        color: #fff;
        position: sticky;
        top: 0;
        z-index: 20;
      }
      .stripe {
        height: 6px;
        background: linear-gradient(90deg, var(--c0) 0 12.5%, var(--c1) 12.5% 25%, var(--c2) 25% 37.5%, var(--c3) 37.5% 50%, var(--c4) 50% 62.5%, var(--c5) 62.5% 75%, var(--c6) 75% 87.5%, var(--c9) 87.5% 100%);
      }
      .bar {
        max-width: 1560px;
        margin: 0 auto;
        padding: 10px var(--gutter);
        display: flex;
        align-items: center;
        gap: 14px;
        flex-wrap: wrap;
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-right: 6px;
      }
      .logo {
        display: grid;
        grid-template-columns: repeat(2, 13px);
        gap: 3px;
      }
      .logo i {
        width: 13px;
        height: 13px;
        border-radius: 4px;
      }
      .brand h1 {
        margin: 0;
        font-size: 1.35rem;
        font-weight: 800;
        letter-spacing: -0.02em;
        line-height: 1;
      }
      .brand small {
        display: block;
        font-size: 0.72rem;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.6);
        margin-top: 3px;
      }
      .days {
        display: flex;
        gap: 4px;
      }
      .days button {
        width: auto;
        height: 34px;
        min-width: 46px;
        padding: 0 10px;
        border-radius: 10px;
        border: 2px solid rgba(255, 255, 255, 0.16);
        background: transparent;
        color: rgba(255, 255, 255, 0.8);
        font-size: 0.86rem;
        font-weight: 700;
        cursor: pointer;
      }
      .days button:hover {
        border-color: var(--day);
        color: #fff;
      }
      .days button.on {
        background: var(--day);
        border-color: var(--day);
        color: #fff;
        box-shadow: 0 4px 14px color-mix(in oklab, var(--day) 45%, transparent);
      }
      nav {
        display: flex;
        gap: 4px;
      }
      nav button {
        border: none;
        background: transparent;
        color: rgba(255, 255, 255, 0.7);
        font-size: 0.95rem;
        font-weight: 700;
        padding: 7px 12px;
        border-radius: 10px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 7px;
        position: relative;
      }
      nav button:hover {
        color: #fff;
        background: rgba(255, 255, 255, 0.08);
      }
      nav button.on {
        color: #fff;
        background: rgba(255, 255, 255, 0.12);
      }
      nav button.on::after {
        content: "";
        position: absolute;
        left: 12px;
        right: 12px;
        bottom: -1px;
        height: 3px;
        border-radius: 2px;
        background: var(--tab);
      }
      .right {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-left: auto;
      }
      .top .seg {
        background: rgba(255, 255, 255, 0.08);
        border-color: rgba(255, 255, 255, 0.14);
      }
      .top .seg button {
        color: rgba(255, 255, 255, 0.7);
        padding: 3px 9px;
        font-size: 0.78rem;
      }
      .top .seg button.on {
        background: #fff;
        color: var(--header);
      }
      .top .icon-btn {
        color: rgba(255, 255, 255, 0.75);
      }
      .top .icon-btn:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #fff;
      }
      .top .icon-btn:disabled {
        opacity: 0.35;
        cursor: default;
      }
      .top .btn {
        background: rgba(255, 255, 255, 0.1);
        border-color: rgba(255, 255, 255, 0.18);
        color: #fff;
      }
      .top .btn:hover {
        background: #fff;
        color: var(--header);
      }
      .stored {
        font-size: 0.72rem;
        color: rgba(255, 255, 255, 0.55);
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }
      main {
        max-width: 1560px;
        margin: 0 auto;
        padding: 20px var(--gutter) 60px;
      }
      @media (max-width: 760px) {
        .brand small {
          display: none;
        }
        .right {
          margin-left: 0;
        }
      }
      .toast {
        position: fixed;
        left: 50%;
        bottom: 24px;
        transform: translateX(-50%);
        background: var(--ink);
        color: var(--bg);
        padding: 10px 18px;
        border-radius: 999px;
        font-weight: 600;
        font-size: 0.9rem;
        box-shadow: var(--shadow);
        z-index: 50;
      }
      .scrim {
        position: fixed;
        inset: 0;
        background: rgba(10, 10, 30, 0.45);
        z-index: 40;
        display: grid;
        place-items: center;
        padding: 16px;
      }
      .dialog {
        width: min(640px, 100%);
        max-height: calc(100vh - 32px);
        overflow: auto;
        background: var(--surface);
        border-radius: 20px;
        padding: 22px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        border-top: 8px solid var(--c6);
      }
      .dialog h2 {
        font-size: 1.3rem;
      }
      .dialog section {
        display: grid;
        gap: 8px;
        padding: 14px 0;
        border-bottom: 1px solid var(--hair);
      }
      .dialog section:last-child {
        border-bottom: none;
        padding-bottom: 0;
      }
      .saves {
        display: grid;
        gap: 4px;
      }
      .save {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 8px;
        border-radius: 10px;
        background: var(--surface-2);
        font-size: 0.88rem;
      }
      .save b {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .linkbox {
        font-family: var(--mono);
        font-size: 0.72rem;
        word-break: break-all;
        background: var(--surface-2);
        padding: 8px;
        border-radius: 8px;
        max-height: 80px;
        overflow: auto;
      }
      .help p,
      .help li {
        line-height: 1.55;
        font-size: 0.92rem;
      }
      .help ul {
        padding-left: 20px;
        margin: 6px 0;
      }
    `,
  ];

  override connectedCallback() {
    super.connectedCallback();
    addEventListener("keydown", this.keys);
    this.applyTheme();
    store.solve();
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => (this.applyTheme(), store.notify()));
    store.fromHash().then((sc) => {
      if (!sc) return;
      history.replaceState(null, "", location.pathname + location.search);
      if (confirm(L().file.loadShared(sc.name))) {
        store.replace(sc);
        store.say(L().file.loaded(sc.name));
      }
    });
  }
  override disconnectedCallback() {
    super.disconnectedCallback();
    removeEventListener("keydown", this.keys);
  }

  private keys = (e: KeyboardEvent) => {
    const typing = (e.composedPath()[0] as HTMLElement)?.matches?.("input, textarea, select");
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey && !typing) {
      e.preventDefault();
      store.undo();
    } else if (e.key === " " && !typing && store.prefs.tab === "plan") {
      e.preventDefault();
      store.togglePlay();
    } else if (e.key === "Escape") {
      this.dialog = null;
      if (store.placing) {
        store.placing = null;
        store.notify();
      }
    }
  };

  private applyTheme() {
    const t = store.prefs.theme;
    if (t === "auto") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = t;
  }

  private setTheme() {
    const next: Record<Theme, Theme> = { auto: "light", light: "dark", dark: "auto" };
    store.pref("theme", next[store.prefs.theme]);
    this.applyTheme();
  }

  override render() {
    const p = store.prefs;
    const tabs: { id: Tab; label: string; icon: "route" | "person" | "sparkle"; color: string }[] = [
      { id: "plan", label: L().tabs.plan, icon: "route", color: "var(--c2)" },
      { id: "kids", label: L().tabs.kids, icon: "person", color: "var(--c9)" },
      { id: "setup", label: L().tabs.setup, icon: "sparkle", color: "var(--c5)" },
    ];
    const themeIcon = { auto: "auto", light: "sun", dark: "moon" } as const;
    return html`<div class="top">
        <div class="bar">
          <div class="brand">
            <span class="logo"><i style="background:var(--c0)"></i><i style="background:var(--c2)"></i><i style="background:var(--c5)"></i><i style="background:var(--c9)"></i></span>
            <div><h1>Schoolrun</h1><small>${L().tagline}</small></div>
          </div>
          <div class="days" role="tablist" aria-label=${L().weekday}>
            ${L().days.map((d, i) => html`<button class=${p.day === i ? "on" : ""} style="--day:var(--d${i})" title=${d} @click=${() => store.pref("day", i as Day)}>${L().daysMid[i]}</button>`)}
          </div>
          <nav>${tabs.map((t) => html`<button class=${p.tab === t.id ? "on" : ""} style="--tab:${t.color}" @click=${() => store.pref("tab", t.id)}>${icon(t.icon, 17)}${t.label}</button>`)}</nav>
          <div class="right">
            <span class="stored" title=${store.stored ? L().file.storedTitle : L().file.notStoredTitle}>${store.stored ? icon("check", 13) : icon("warn", 13)}${store.stored ? L().file.stored : L().file.notStored}</span>
            <button class="icon-btn" title=${L().undo} ?disabled=${!store.canUndo} @click=${() => store.undo()}>${icon("restart")}</button>
            <button class="btn small" @click=${() => ((this.dialog = "file"), (this.saveName = store.sc.name), (this.link = ""))}>${icon("folder", 15)} ${L().file.button}</button>
            <div class="seg" role="group" aria-label="Taal / language">
              ${(["nl", "en"] as Lang[]).map((l) => html`<button class=${p.lang === l ? "on" : ""} @click=${() => store.pref("lang", l)}>${l.toUpperCase()}</button>`)}
            </div>
            <button class="icon-btn" title=${L().theme[p.theme]} @click=${() => this.setTheme()}>${icon(themeIcon[p.theme])}</button>
            <button class="icon-btn" title=${L().help.title} @click=${() => (this.dialog = "help")}>${icon("help")}</button>
          </div>
        </div>
        <div class="stripe"></div>
      </div>
      <main>${p.tab === "plan" ? html`<sr-plan></sr-plan>` : p.tab === "kids" ? html`<sr-kids></sr-kids>` : html`<sr-setup></sr-setup>`}</main>
      ${store.toast ? html`<div class="toast" role="status">${store.toast.text}</div>` : nothing}
      ${this.dialog ? html`<div class="scrim" @click=${(e: Event) => e.target === e.currentTarget && (this.dialog = null)}>${this.dialog === "file" ? this.fileDialog() : this.helpDialog()}</div>` : nothing}
      <input type="file" accept="application/json,.json" hidden @change=${this.imported} />`;
  }

  private async imported(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0];
    (e.target as HTMLInputElement).value = "";
    if (!f) return;
    const ok = await store.importFile(f);
    store.say(ok ? L().file.imported(store.sc.name) : L().file.importFailed);
    if (ok) this.dialog = null;
  }

  private fileDialog() {
    const F = L().file;
    const saves = store.saves();
    const fmt = (t: number) => new Date(t).toLocaleString(store.prefs.lang === "nl" ? "nl-NL" : "en-GB", { dateStyle: "medium", timeStyle: "short" });
    const startOver = (fn: () => void) => {
      if (!confirm(F.confirmReplace)) return;
      fn();
      this.dialog = null;
    };
    return html`<div class="dialog" role="dialog" aria-modal="true" aria-label=${F.title}>
      <div class="row"><h2 class="grow">${F.title}</h2><button class="icon-btn" @click=${() => (this.dialog = null)}>${icon("x")}</button></div>
      <p class="hint" style="margin-top:6px">${F.intro}</p>
      <section>
        <span class="label">${F.saveAs}</span>
        <div class="row">
          <input class="grow" .value=${this.saveName} @input=${(e: Event) => (this.saveName = (e.target as HTMLInputElement).value)} placeholder=${F.namePlaceholder} />
          <button
            class="btn primary"
            ?disabled=${!this.saveName.trim()}
            @click=${() => {
              const ok = store.saveAs(this.saveName.trim());
              store.say(ok ? F.saved(this.saveName.trim()) : F.notStoredTitle);
              this.requestUpdate();
            }}
          >
            ${icon("save", 16)} ${F.save}
          </button>
        </div>
        ${saves.length
          ? html`<div class="saves">
              ${saves.map(
                (s) => html`<div class="save">
                  <b>${s.name}</b><span class="dim" style="font-size:.78rem">${fmt(s.at)}</span>
                  <button class="btn small" @click=${() => (store.open(s.name), store.say(F.loaded(s.name)), (this.dialog = null))}>${F.open}</button>
                  <button class="icon-btn danger" title=${L().remove} @click=${() => confirm(F.confirmForget(s.name)) && store.forget(s.name)}>${icon("trash", 16)}</button>
                </div>`,
              )}
            </div>`
          : html`<p class="hint">${F.noSaves}</p>`}
      </section>
      <section>
        <span class="label">${F.fileTitle}</span>
        <p class="hint">${F.fileHint}</p>
        <div class="row wrap">
          <button class="btn" @click=${() => store.exportJson()}>${icon("download", 16)} ${F.export}</button>
          <button class="btn" @click=${() => this.fileInput.click()}>${icon("upload", 16)} ${F.import}</button>
        </div>
      </section>
      <section>
        <span class="label">${F.shareTitle}</span>
        <p class="hint">${F.shareHint}</p>
        <div class="row wrap">
          <button
            class="btn"
            @click=${async () => {
              this.link = await store.shareLink();
              try {
                await navigator.clipboard.writeText(this.link);
                store.say(F.copied);
              } catch {
                /* shown below to copy by hand */
              }
            }}
          >
            ${icon("link", 16)} ${F.share}
          </button>
        </div>
        ${this.link ? html`<div class="linkbox">${this.link}</div>` : nothing}
      </section>
      <section>
        <span class="label">${F.startOver}</span>
        <div class="row wrap">
          <button class="btn" @click=${() => startOver(() => store.replace(sampleScenario()))}>${icon("sparkle", 16)} ${F.sample}</button>
          <button class="btn" @click=${() => startOver(() => store.replace(randomScenario(Math.floor(Math.random() * 1e6), store.sc.bsos[0] ?? undefined)))}>${icon("dice", 16)} ${F.random}</button>
          <button class="btn" @click=${() => startOver(() => store.replace(emptyScenario(store.sc.bsos[0] ?? undefined)))}>${icon("x", 16)} ${F.empty}</button>
        </div>
      </section>
    </div>`;
  }

  private helpDialog() {
    const H = L().help;
    return html`<div class="dialog help" role="dialog" aria-modal="true" aria-label=${H.title}>
      <div class="row"><h2 class="grow">${H.title}</h2><button class="icon-btn" @click=${() => (this.dialog = null)}>${icon("x")}</button></div>
      ${H.body.map((b) => (Array.isArray(b) ? html`<ul>${b.map((li) => html`<li>${li}</li>`)}</ul>` : html`<p>${b}</p>`))}
    </div>`;
  }
}
