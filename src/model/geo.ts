/** Distances over the earth, and Web Mercator for the map. No roads: straight lines × a road factor. */
import type { Geo } from "./types";

const R = 6371.0088;
const rad = (d: number) => (d * Math.PI) / 180;

/** Kilometres as the crow flies. */
export function haversine(a: Geo, b: Geo): number {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Web Mercator: world pixels at zoom z (256 px tiles). */
export function project(g: Geo, z: number): { x: number; y: number } {
  const s = 256 * 2 ** z;
  const lat = Math.max(-85.0511, Math.min(85.0511, g.lat));
  const sin = Math.sin(rad(lat));
  return { x: ((g.lon + 180) / 360) * s, y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * s };
}
export function unproject(x: number, y: number, z: number): Geo {
  const s = 256 * 2 ** z;
  const lon = (x / s) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / s;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return { lat, lon };
}

/** Kilometres east and north of `o`: a flat local grid, good for a town. */
export function toLocal(g: Geo, o: Geo): { x: number; y: number } {
  return { x: (g.lon - o.lon) * 111.32 * Math.cos(rad(o.lat)), y: (g.lat - o.lat) * 110.574 };
}
export function fromLocal(x: number, y: number, o: Geo): Geo {
  return { lat: o.lat + y / 110.574, lon: o.lon + x / (111.32 * Math.cos(rad(o.lat))) };
}

export function centroid(gs: Geo[]): Geo {
  if (!gs.length) return { lat: 51.9914, lon: 4.4739 };
  return { lat: gs.reduce((s, g) => s + g.lat, 0) / gs.length, lon: gs.reduce((s, g) => s + g.lon, 0) / gs.length };
}

/** The zoom (fractional) and centre that fit all points into w × h pixels with `pad` around. */
export function fit(gs: Geo[], w: number, h: number, pad = 60): { lat: number; lon: number; zoom: number } {
  if (!gs.length) return { lat: 51.9914, lon: 4.4739, zoom: 13 };
  let lo = 2,
    hi = 18;
  for (let i = 0; i < 30; i++) {
    const z = (lo + hi) / 2;
    const ps = gs.map((g) => project(g, z));
    const dx = Math.max(...ps.map((p) => p.x)) - Math.min(...ps.map((p) => p.x));
    const dy = Math.max(...ps.map((p) => p.y)) - Math.min(...ps.map((p) => p.y));
    if (dx <= w - pad * 2 && dy <= h - pad * 2) lo = z;
    else hi = z;
  }
  const z = Math.min(16.5, lo);
  const ps = gs.map((g) => project(g, z));
  const cx = (Math.max(...ps.map((p) => p.x)) + Math.min(...ps.map((p) => p.x))) / 2;
  const cy = (Math.max(...ps.map((p) => p.y)) + Math.min(...ps.map((p) => p.y))) / 2;
  return { ...unproject(cx, cy, z), zoom: z };
}
