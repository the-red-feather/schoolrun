/**
 * Screenshots of the built app, with system Chrome:
 *   bun tools/shot.ts <url> <out.png> [width] [height] [tab] [theme] [lang] [day]
 */
import { chromium } from "playwright-core";
const [url, out, w = "1440", h = "900", tab = "plan", theme = "light", lang = "nl", day = "0", wait = "2500"] = process.argv.slice(2);
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: +w, height: +h }, colorScheme: theme === "dark" ? "dark" : "light", deviceScaleFactor: 1 });
page.on("console", (m) => (m.type() === "error" || m.type() === "warning") && console.log("console:", m.type(), m.text()));
page.on("pageerror", (e) => console.log("pageerror:", e.message));
await page.addInitScript(
  ([tab, theme, lang, day]) => {
    if (sessionStorage.getItem("shot")) return;
    sessionStorage.setItem("shot", "1");
    localStorage.clear();
    localStorage.setItem("schoolrun.v2.prefs", JSON.stringify({ tab, theme, lang, day: +day!, map: "plain", speed: 6 }));
  },
  [tab, theme, lang, day],
);
await page.goto(url!, { waitUntil: "networkidle" });
await page.waitForTimeout(+wait);
await page.screenshot({ path: out!, fullPage: true });
await browser.close();
