/** Line icons, 24×24, stroke = currentColor. */
import { svg, type SVGTemplateResult } from "lit";

const P: Record<string, SVGTemplateResult> = {
  bus: svg`<rect x="3" y="5" width="18" height="12" rx="3"/><path d="M3 11h18M8 5v6M14 5v6"/><circle cx="7.5" cy="18.5" r="1.5"/><circle cx="16.5" cy="18.5" r="1.5"/>`,
  house: svg`<path d="M4 11 12 4l8 7"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-5h4v5"/>`,
  school: svg`<path d="M3 9l9-5 9 5-9 5-9-5z"/><path d="M7 11.2V16c0 1.5 2.2 3 5 3s5-1.5 5-3v-4.8"/><path d="M21 9v5"/>`,
  person: svg`<circle cx="12" cy="7.5" r="3.5"/><path d="M5 20c.8-3.8 3.6-6 7-6s6.2 2.2 7 6"/>`,
  hand: svg`<circle cx="9" cy="6" r="2.5"/><path d="M4 20c.5-3.4 2.3-6 5-6 1.4 0 2.6.6 3.4 1.6"/><circle cx="17" cy="11" r="2"/><path d="M13.5 20c.3-2.6 1.6-4.3 3.5-4.3S20.2 17.4 20.5 20"/>`,
  play: svg`<path d="M7 4.5v15l12-7.5z" fill="currentColor"/>`,
  pause: svg`<path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor"/>`,
  restart: svg`<path d="M4 12a8 8 0 1 0 2.6-5.9"/><path d="M4 4v4.5h4.5"/>`,
  plus: svg`<path d="M12 5v14M5 12h14"/>`,
  minus: svg`<path d="M5 12h14"/>`,
  trash: svg`<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>`,
  fit: svg`<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>`,
  layers: svg`<path d="M12 4 3 9l9 5 9-5-9-5z"/><path d="m3 14 9 5 9-5"/>`,
  move: svg`<path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>`,
  search: svg`<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>`,
  download: svg`<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>`,
  upload: svg`<path d="M12 16V5M7 9.5l5-5 5 5M5 20h14"/>`,
  link: svg`<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>`,
  save: svg`<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>`,
  folder: svg`<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>`,
  sun: svg`<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>`,
  moon: svg`<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>`,
  auto: svg`<circle cx="12" cy="12" r="8"/><path d="M12 4v16" /><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/>`,
  warn: svg`<path d="M12 3.5 2.5 20h19z"/><path d="M12 10v4.5M12 17.2v.3"/>`,
  check: svg`<path d="m5 12.5 4.5 4.5L19 7.5"/>`,
  x: svg`<path d="M6 6l12 12M18 6 6 18"/>`,
  sync: svg`<path d="M20 11a8 8 0 0 0-14.3-4.3L4 8.5"/><path d="M4 4v4.5h4.5"/><path d="M4 13a8 8 0 0 0 14.3 4.3l1.7-1.8"/><path d="M20 20v-4.5h-4.5"/>`,
  clock: svg`<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/>`,
  grip: svg`<circle cx="9" cy="6" r="1.2" fill="currentColor"/><circle cx="15" cy="6" r="1.2" fill="currentColor"/><circle cx="9" cy="12" r="1.2" fill="currentColor"/><circle cx="15" cy="12" r="1.2" fill="currentColor"/><circle cx="9" cy="18" r="1.2" fill="currentColor"/><circle cx="15" cy="18" r="1.2" fill="currentColor"/>`,
  pin: svg`<path d="M12 21s-6.5-6.2-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 14.8 12 21 12 21z"/><circle cx="12" cy="9.8" r="2.3"/>`,
  away: svg`<circle cx="12" cy="12" r="8.5"/><path d="M6 18 18 6"/>`,
  paste: svg`<path d="M9 4h6v3H9z"/><path d="M9 5.5H6v15h12v-15h-3"/><path d="M9 12h6M9 16h4"/>`,
  help: svg`<circle cx="12" cy="12" r="8.5"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17v.3"/>`,
  dice: svg`<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1.2" fill="currentColor"/><circle cx="15" cy="15" r="1.2" fill="currentColor"/><circle cx="15" cy="9" r="1.2" fill="currentColor"/><circle cx="9" cy="15" r="1.2" fill="currentColor"/>`,
  sparkle: svg`<path d="M12 3c.6 4.4 2.6 6.4 7 7-4.4.6-6.4 2.6-7 7-.6-4.4-2.6-6.4-7-7 4.4-.6 6.4-2.6 7-7z"/>`,
  route: svg`<circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="6" r="2.2"/><path d="M8 18h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7"/>`,
  menu: svg`<path d="M4 7h16M4 12h16M4 17h16"/>`,
  chevron: svg`<path d="m9 6 6 6-6 6"/>`,
  copy: svg`<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>`,
};

export type IconName = keyof typeof P;

export function icon(name: IconName, size = 18) {
  return svg`<svg class="icon" width=${size} height=${size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name]}</svg>`;
}

/** The raw paths, for drawing inside another svg. */
export const iconPaths = (name: IconName) => P[name];
