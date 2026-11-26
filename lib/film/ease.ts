// Motion and colour helpers shared by the director core and its drawing code. No DOM.

export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a: number, b: number, x: number) => a + (b - a) * x;
/** scales move in log space */
export const lmix = (a: number, b: number, x: number) => Math.exp(lerp(Math.log(a), Math.log(b), x));

export function bez(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const fx = (u: number) => ((ax * u + bx) * u + cx) * u, fy = (u: number) => ((ay * u + by) * u + cy) * u;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0, hi = 1, u = x;
    for (let i = 0; i < 22; i++) { u = (lo + hi) / 2; if (fx(u) < x) lo = u; else hi = u; }
    return fy(u);
  };
}

export const E = {
  lin: (x: number) => x,
  out: bez(0.16, 1, 0.3, 1), // arrivals
  exit: bez(0.55, 0.055, 0.675, 0.19), // leaving
  inOut: bez(0.87, 0, 0.13, 1), // whips and morphs
  smooth: bez(0.65, 0, 0.35, 1), // drifts
  cam: bez(0.48, 0.1, 0, 0.9), // camera
  rest: bez(0.45, 0, 0.1, 1), // a move that ends at rest
  back: bez(0.34, 1.56, 0.64, 1), // small overshoot
};

/** progress of a move that starts at t0 and lasts d seconds, eased */
export const seg = (t: number, t0: number, d: number, e?: (x: number) => number) => (e || E.lin)(clamp((t - t0) / d));

/** pulse that peaks `attack` after the cue and decays with time constant tau (seconds) */
export const hitPulse = (t: number, t0: number, attack = 2 / 60, tau = 5 / 60) => {
  const s = t - t0;
  if (s <= 0) return 0;
  return s < attack ? Math.sin((Math.PI / 2) * s / attack) : Math.exp(-(s - attack) / tau);
};

/** step response of a damped spring, 0 -> 1 */
export const spring = (t: number, t0: number, k = 260, c = 18, m = 0.7) => {
  const s = t - t0;
  if (s <= 0) return 0;
  const w = Math.sqrt(k / m), z = c / (2 * Math.sqrt(k * m));
  if (z >= 1) return 1 - Math.exp(-w * s) * (1 + w * s);
  const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * s) * (Math.cos(wd * s) + ((z * w) / wd) * Math.sin(wd * s));
};

export const hexRgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
export const mixHex = (h1: string, h2: string, x: number) => {
  const a = hexRgb(h1), b = hexRgb(h2);
  return "#" + a.map((v, i) => Math.round(lerp(v, b[i], clamp(x))).toString(16).padStart(2, "0")).join("");
};
export const rgba = (h: string, a: number) => `rgba(${hexRgb(h).join(",")},${(+a).toFixed(3)})`;
/** perceived lightness 0..1 */
export const lum = (h: string) => { const [r, g, b] = hexRgb(h); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
