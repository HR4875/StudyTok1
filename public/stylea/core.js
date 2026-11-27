// Style A engine core. Every visual value is a pure function of t inside seek(t).
const W = 1080, H = 1920, BEAT = 0.5, M = 90;
let PACE = 1.3, RB = BEAT * PACE; // PACE slows every scene's internal clock; RB is the real length of a beat
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const prog = (t, a, d) => clamp((t - a) / d);
const eO = x => x >= 1 ? 1 : x <= 0 ? 0 : 1 - Math.pow(2, -10 * x);
const eI = x => x <= 0 ? 0 : x >= 1 ? 1 : Math.pow(2, 10 * x - 10);
const eIO = x => x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2;
const spr = (t, a, w = 16) => { const s = t - a; return s <= 0 ? 0 : 1 - (1 + w * s) * Math.exp(-w * s); };
const lerp = (a, b, x) => a + (b - a) * x;
const ap = (lt, a, d = 0.42) => eO(prog(lt, a, d));
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const mix = (h1, h2, x) => { const a = hex(h1), b = hex(h2); return '#' + a.map((v, i) => Math.round(lerp(v, b[i], clamp(x))).toString(16).padStart(2, '0')).join(''); };
const lum = h => { const [r, g, b] = hex(h).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const rnd = key => { let x = hash(String(key)); x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return (x % 100000) / 100000; };

// ---------- look: palettes, typefaces, shape language. Chosen by seed, overridable from the spec ----------
const PALETTES = {
  ocean:  { paper: '#F4F3EF', ink: '#232325', a1: '#0A5FC2', a2: '#FFD43B', a3: '#C9E2FF' },
  tomato: { paper: '#FBF5E6', ink: '#1E1B16', a1: '#EE4A2B', a2: '#0E7C7B', a3: '#F3D9A4' },
  violet: { paper: '#F1F2F6', ink: '#12183A', a1: '#5B3DF5', a2: '#C6F432', a3: '#DAD3FF' },
  forest: { paper: '#EEF5EE', ink: '#10231B', a1: '#0B8F5A', a2: '#FF8A1F', a3: '#C9E9D5' },
  candy:  { paper: '#FFF2EC', ink: '#2A1A1F', a1: '#E3256B', a2: '#1F4FE0', a3: '#FFC9B5' },
  night:  { paper: '#0F1535', ink: '#F5F3EA', a1: '#FF5A3C', a2: '#FFD43B', a3: '#2B3A8C' },
  carbon: { paper: '#131416', ink: '#F2F2EE', a1: '#19C37D', a2: '#F4E04D', a3: '#2C2F33' },
  kraft:  { paper: '#EDE6D8', ink: '#2B2622', a1: '#2F5D50', a2: '#E2A93B', a3: '#CFDAD0' },
};
const FONTS = {
  wanted:     { ff: "'Wanted Sans Variable','Wanted Sans',sans-serif", wd: 900, wb: 600 },
  pretendard: { ff: "'Pretendard Variable',Pretendard,sans-serif", wd: 900, wb: 600 },
  noto:       { ff: "'Noto Sans KR',sans-serif", wd: 900, wb: 500 },
  plex:       { ff: "'IBM Plex Sans KR',sans-serif", wd: 700, wb: 500 },
};
const pickOf = (arr, key) => arr[Math.floor(rnd(key) * arr.length) % arr.length];

let ENV = null; // look of the current video
function makeLook(spec) {
  const seed = spec.seed ?? hash(spec.title || 'x');
  const L = spec.look || {};
  const pname = PALETTES[L.palette] ? L.palette : pickOf(Object.keys(PALETTES), seed + 'pal');
  const P = PALETTES[pname];
  const fname = FONTS[L.font] ? L.font : pickOf(Object.keys(FONTS), seed + 'font');
  const dark = lum(P.paper) < lum(P.ink) ? P.paper : P.ink, light = dark === P.paper ? P.ink : P.paper;
  const on = c => contrast(c, dark) >= contrast(c, '#FFFFFF') ? dark : '#FFFFFF';
  const isDark = dark === P.paper;
  const card = isDark ? mix(P.paper, '#FFFFFF', 0.12) : '#FFFFFF';
  const best = (bg, cands) => cands.slice().sort((a, b) => contrast(b, bg) - contrast(a, bg))[0];
  const theme = key => {
    const bg = P[key];
    const fg = on(bg) === dark ? (isDark ? dark : P.ink) : (isDark ? P.ink : '#FFFFFF');
    const cands = [P.a1, P.a2].filter(c => c !== bg && contrast(c, bg) >= 1.6);
    const hi = cands[0] || best(bg, [P.a1, P.a2, fg]);
    const hi2 = cands[1] || fg;
    return { key, bg, fg, hi, onHi: on(hi), hi2, onHi2: on(hi2), soft: key === 'paper' ? P.a3 : mix(bg, fg, 0.16), onSoft: on(key === 'paper' ? P.a3 : mix(bg, fg, 0.16)),
      card, onCard: on(card), mute: mix(bg, fg, 0.68), line: mix(bg, fg, 0.2), dark, light };
  };
  return {
    seed, P, pname, fname, font: FONTS[fname], on, theme, dark, light,
    shape: ['sharp', 'soft', 'pill'].includes(L.shape) ? L.shape : pickOf(['sharp', 'soft', 'soft', 'pill'], seed + 'shape'),
    look: ['flat', 'line', 'block'].includes(L.style) ? L.style : pickOf(['flat', 'line', 'block'], seed + 'style'),
    kin: ['rise', 'drop', 'wipe', 'grow'].includes(L.type) ? L.type : pickOf(['rise', 'rise', 'drop', 'wipe', 'grow'], seed + 'kin'),
    align: ['left', 'center'].includes(L.align) ? L.align : pickOf(['left', 'center'], seed + 'align'),
    cam: ['push', 'pull', 'still'].includes(L.camera) ? L.camera : pickOf(['push', 'pull', 'push'], seed + 'cam'),
    v: (key, n) => Math.floor(rnd(seed + ':' + key) * n) % n, // seeded variant index
  };
}
const rad = h => ENV.shape === 'sharp' ? Math.min(8, h / 2) : ENV.shape === 'pill' ? Math.min(h / 2, 64) : Math.min(h / 2, 30);

// ---------- DOM ----------
const NS = 'http://www.w3.org/2000/svg';
let svg, defs, bgL, world, uid = 0, measurer;
function el(tag, attrs, parent) { const e = document.createElementNS(NS, tag); for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]); (parent || world).appendChild(e); return e; }
const G = (parent, attrs) => el('g', attrs || {}, parent);
function blurF(sx, sy) {
  sx = Math.min(14, Math.abs(sx)); sy = Math.min(14, Math.abs(sy));
  if (sx < 0.6 && sy < 0.6) return null;
  const id = 'b' + (uid++);
  const f = el('filter', { id, x: '-40%', y: '-40%', width: '180%', height: '180%' }, defs);
  el('feGaussianBlur', { stdDeviation: sx.toFixed(1) + ' ' + sy.toFixed(1) }, f);
  return 'url(#' + id + ')';
}
function clipR(x, y, w, h, r) { const id = 'c' + (uid++); const cp = el('clipPath', { id }, defs); el('rect', { x, y, width: Math.max(0.01, w), height: Math.max(0.01, h), rx: r || 0 }, cp); return 'url(#' + id + ')'; }
const twCache = new Map();
function tw(str, size, wt) {
  const k = wt + '|' + str; let v = twCache.get(k);
  if (v == null) { measurer.setAttribute('font-size', 100); measurer.setAttribute('font-weight', wt); measurer.setAttribute('font-family', ENV.font.ff); measurer.textContent = str.replace(/ /g, ' '); v = measurer.getComputedTextLength(); twCache.set(k, v); }
  return v * size / 100;
}
function tx(g, str, x, y, size, wt, fill, anchor = 'start', extra) {
  const e = el('text', Object.assign({ x: x.toFixed(1), y: y.toFixed(1), 'font-size': size.toFixed(1), 'font-weight': wt, fill, 'text-anchor': anchor, 'font-family': ENV.font.ff }, extra || {}), g);
  e.setAttribute('xml:space', 'preserve'); e.textContent = str; return e;
}
function rr(g, r, attrs) { if (r.w <= 0.2 || r.h <= 0.2) return null; return el('rect', Object.assign({ x: r.x.toFixed(1), y: r.y.toFixed(1), width: r.w.toFixed(1), height: r.h.toFixed(1), rx: Math.min(r.r ?? 0, r.w / 2, r.h / 2).toFixed(1) }, attrs), g); }
// a surface in the look of this video (flat fill / ink outline / hard offset shadow)
function card(g, r, fill, o = {}) {
  if (r.w <= 0.2 || r.h <= 0.2) return;
  const stroke = o.stroke ?? ENV.strokeCol;
  if (ENV.look === 'block' && !o.plain) { const d = Math.min(12, r.h * 0.12, r.w * 0.12) * (o.sh ?? 1); rr(g, { x: r.x + d, y: r.y + d, w: r.w, h: r.h, r: r.r }, { fill: stroke }); }
  rr(g, r, Object.assign({ fill }, ENV.look === 'line' && !o.plain ? { stroke, 'stroke-width': o.sw ?? 5 } : {}));
}
const lerpR = (a, b, x) => ({ x: lerp(a.x, b.x, x), y: lerp(a.y, b.y, x), w: lerp(a.w, b.w, x), h: lerp(a.h, b.h, x), r: lerp(a.r ?? 0, b.r ?? 0, x), fill: mix(a.fill, b.fill, x) });
const growR = (r, e, from = 'c') => from === 'l' ? { ...r, w: r.w * e } : from === 't' ? { ...r, h: r.h * e } : from === 'b' ? { ...r, y: r.y + r.h * (1 - e), h: r.h * e } : from === 'r' ? { ...r, x: r.x + r.w * (1 - e), w: r.w * e }
  : { x: r.x + r.w * (1 - e) / 2, y: r.y + r.h * (1 - e) / 2, w: r.w * e, h: r.h * e, r: (r.r ?? 0) * e };

// ---------- text ----------
function wrap(str, maxW, size, wt) {
  const words = String(str).split(' '); const lines = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (cur && tw(t, size, wt) > maxW) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur); return lines;
}
function fit(str, maxW, maxS, minS, maxLines, wt) {
  str = String(str ?? '');
  for (let s = maxS; s >= minS; s -= 2) {
    for (let n = 1; n <= maxLines; n++) { // prefer fewer lines, but balanced
      const L = wrap(str, maxW, s, wt);
      if (L.length <= n && L.every(l => tw(l, s, wt) <= maxW)) {
        if (L.length > 1) { // balance: shrink width until line count would change
          let lo = maxW; for (let w = maxW * 0.95; w > maxW * 0.45; w -= maxW * 0.05) { const L2 = wrap(str, w, s, wt); if (L2.length !== L.length || !L2.every(l => tw(l, s, wt) <= maxW)) break; lo = w; }
          const Lb = wrap(str, lo, s, wt); return { lines: Lb, size: s, w: Math.max(...Lb.map(l => tw(l, s, wt))) };
        }
        return { lines: L, size: s, w: tw(L[0], s, wt) };
      }
    }
  }
  const L = wrap(str, maxW, minS, wt).slice(0, maxLines); return { lines: L, size: minS, w: Math.min(maxW, Math.max(...L.map(l => tw(l, minS, wt)))) };
}
// kinetic line: words enter one after another in the motion language of this video
function kt(g, str, x, y, size, wt, fill, anchor, lt, a, o = {}) {
  str = String(str);
  const words = str.split(' '), sp = tw(' ', size, wt) || size * 0.26, ws = words.map(w => tw(w, size, wt));
  const total = ws.reduce((s, w) => s + w, 0) + sp * (words.length - 1);
  let cx = anchor === 'middle' ? x - total / 2 : anchor === 'end' ? x - total : x; const x0 = cx;
  const stag = o.stag ?? 0.07, d = o.d ?? 0.42, kin = o.kin || ENV.kin;
  let mk = null;
  if (o.mark && str.includes(o.mark)) {
    const ms = str.indexOf(o.mark), me = ms + o.mark.length; let off = 0, xx = x0, a0 = null, a1 = null;
    words.forEach((w, k) => { const s = off, e = off + w.length; if (e > ms && s < me) { if (a0 == null) a0 = xx; a1 = xx + ws[k]; } off = e + 1; xx += ws[k] + sp; });
    if (a0 != null) mk = { x0: a0, x1: a1, ms, me };
  }
  const half = mk && lum(o.markFill) > 0.45 && contrast(fill, o.markFill) > 3;
  if (mk && half) { const e = eO(prog(lt, a + (o.markAt ?? 0.5), 0.35)); rr(g, { x: mk.x0 - 6, y: y - size * 0.36, w: (mk.x1 - mk.x0 + 12) * e, h: size * 0.46 }, { fill: o.markFill }); }
  let off = 0;
  words.forEach((w, k) => {
    const ak = a + k * stag, e = eO(prog(lt, ak, d)), e0 = eO(prog(lt - 1 / 90, ak, d));
    const s = off, en = off + w.length; off = en + 1;
    const marked = mk && en > mk.ms && s < mk.me;
    const f = marked && !half ? mix(fill, o.markFill, eO(prog(lt, a + (o.markAt ?? 0.5), 0.3))) : fill;
    const wx = cx; cx += ws[k] + sp;
    if (e <= 0) return;
    if (kin === 'grow') { const gg = G(g, { transform: `translate(${(wx + ws[k] / 2).toFixed(1)} ${(y - size * 0.34).toFixed(1)}) scale(${e.toFixed(4)})` }); tx(gg, w, -ws[k] / 2, size * 0.34, size, wt, f); return; }
    if (kin === 'wipe') { const gg = G(g, { 'clip-path': clipR(wx - 4, y - size * 1.05, (ws[k] + 8) * e, size * 1.45) }); tx(gg, w, wx, y, size, wt, f); return; }
    const dir = kin === 'drop' ? -1 : 1, dy = (1 - e) * size * 1.12 * dir;
    const gg = G(g, { 'clip-path': clipR(wx - size * 0.2, y - size * 1.0, ws[k] + size * 0.4, size * 1.32) });
    const fl = blurF(0, (e - e0) * size * 0.5); tx(gg, w, wx, y + dy, size, wt, f, 'start', fl ? { filter: fl } : null);
  });
  return { x: x0, w: total };
}
function kblock(g, f, x, y, wt, fill, anchor, lt, a, o = {}) { // f = fit result; y = first baseline
  const lh = o.lh ?? 1.16; f.lines.forEach((l, i) => kt(g, l, x, y + i * f.size * lh, f.size, wt, fill, anchor, lt, a + i * (o.lstag ?? 0.12), o));
  return f.lines.length * f.size * lh;
}
const num = (v, dec) => { const s = Number(v).toFixed(dec); const [i, f] = s.split('.'); return i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (f ? '.' + f : ''); };
const decOf = v => { const s = String(v); const i = s.indexOf('.'); return i < 0 ? 0 : Math.min(2, s.length - i - 1); };
const pulse = (lt, from, k = 0.03) => lt < from ? 1 : 1 + k * Math.exp(-9 * ((lt - from) % BEAT));
const isEmoji = s => /\p{Extended_Pictographic}/u.test(s || '');

// title + caption shared by most scenes. Returns the free body band and a draw function.
const hueOf = h => { const [r, g, b] = hex(h).map(v => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b); if (mx - mn < 0.08) return -1; const u = mx === r ? ((g - b) / (mx - mn)) % 6 : mx === g ? (b - r) / (mx - mn) + 2 : (r - g) / (mx - mn) + 4; return (u * 60 + 360) % 360; }, isCool = h => { const u = hueOf(h); return u >= 150 && u <= 275; };
const q30 = t => Math.floor(t * 30 + 1e-6) / 30;
const markC = th => contrast(th.hi, th.bg) >= 2.4 ? th.hi : (contrast(th.hi2, th.bg) >= 2.4 ? th.hi2 : th.fg);
function chrome(d, th) {
  const al = ENV.align, x = al === 'center' ? W / 2 : M, an = al === 'center' ? 'middle' : 'start';
  let y0 = 330, y1 = 1700, tf = null, sf = null;
  if (d.title) { tf = fit(d.title, 900, 104, 60, 2, ENV.font.wd); y0 = 330 + tf.lines.length * tf.size * 1.16 + 56; }
  let sf2 = null; if (d.say) { sf = fit(d.say, 900, 66, 42, 2, ENV.font.wb); if (d.say2) { sf2 = fit(d.say2, 900, 66, 42, 2, ENV.font.wb); sf2.size = sf.size = Math.min(sf.size, sf2.size); } y1 = 1700 - Math.max(sf.lines.length, sf2 ? sf2.lines.length : 0) * sf.size * 1.32 - 56; }
  let ty = 330, sy = y1 + 56;
  return {
    y0, y1, x, an,
    hug(a, b) { if (tf) ty = clamp(a - 64 - tf.lines.length * tf.size * 1.16, 330, 760); if (sf) sy = clamp(b + 64, 900, y1 + 56); },
    draw(g, lt, sayAt, say2At) {
      if (sf2 && say2At != null && lt >= say2At) { if (tf) kblock(g, tf, x, ty + tf.size * 0.92, ENV.font.wd, th.fg, an, lt, 0.12, { mark: d.titleMark, markFill: markC(th) }); kblock(g, sf2, x, sy + sf2.size * 1.0, ENV.font.wb, th.fg, an, lt, say2At, { lh: 1.32, mark: d.say2Mark, markFill: markC(th), stag: 0.05 }); return; }
      if (tf) kblock(g, tf, x, ty + tf.size * 0.92, ENV.font.wd, th.fg, an, lt, 0.12, { mark: d.titleMark, markFill: markC(th) });
      if (sf) kblock(g, sf, x, sy + sf.size * 1.0, ENV.font.wb, th.fg, an, lt, sayAt ?? BEAT * 2, { lh: 1.32, mark: d.sayMark, markFill: markC(th), stag: 0.05 });
    },
  };
}
// small label that grows out of its left edge
function chip(g, str, x, y, size, fill, ink, e, o = {}) {
  if (e <= 0.001) return { w: 0, h: 0 };
  const w = tw(str, size, 700) + size * 1.1, h = size * 1.75;
  const rx = o.anchor === 'middle' ? x - w / 2 : o.anchor === 'end' ? x - w : x;
  const gg = G(g, { 'clip-path': clipR(rx - 14, y - h / 2 - 14, (w + 28) * e, h + 28) });
  card(gg, { x: rx, y: y - h / 2, w, h, r: rad(h) }, fill, o);
  tx(gg, str, rx + size * 0.55, y + size * 0.35, size, 700, ink);
  return { x: rx, y: y - h / 2, w, h };
}
const chipW = (str, size) => tw(str, size, 700) + size * 1.1;

// ---------- 3D: world plane (x right, z up-screen, y toward the viewer) ----------
const FOCAL = 6;
function P3(cam, x, y, z) {
  const c = Math.cos(cam.yaw), s = Math.sin(cam.yaw), xr = x * c - z * s, zr = x * s + z * c;
  const ca = Math.cos(cam.tilt), sa = Math.sin(cam.tilt), Y = -zr * ca - y * sa, D = -zr * sa + y * ca, k = FOCAL / (FOCAL - D);
  return [cam.cx + xr * cam.s * k, cam.cy + Y * cam.s * k, D];
}
const pts = a => a.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
function box3(g, cam, b) { // centre (x,z), half sizes rx,rz, base y0, height h
  const v = (dx, dy, dz) => P3(cam, b.x + dx * b.rx, b.y0 + dy * b.h, b.z + dz * b.rz);
  const faces = [[v(-1, 0, -1), v(1, 0, -1), v(1, 1, -1), v(-1, 1, -1), -0.18], [v(1, 0, -1), v(1, 0, 1), v(1, 1, 1), v(1, 1, -1), -0.34], [v(1, 0, 1), v(-1, 0, 1), v(-1, 1, 1), v(1, 1, 1), -0.18], [v(-1, 0, 1), v(-1, 0, -1), v(-1, 1, -1), v(-1, 1, 1), -0.34]];
  const st = b.stroke ? { stroke: b.stroke, 'stroke-width': b.sw || 4, 'stroke-linejoin': 'round' } : {};
  if (cam.tilt > 0.02 && b.h > 0.002) for (const f of faces) {
    const [p, q, r] = f; if ((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]) >= 0) continue;
    const col = mix(b.side, '#000000', -f[4]); el('polygon', Object.assign({ points: pts(f.slice(0, 4)), fill: col, stroke: col, 'stroke-width': 1 }, st), g);
  }
  el('polygon', Object.assign({ points: pts([v(-1, 1, -1), v(1, 1, -1), v(1, 1, 1), v(-1, 1, 1)]), fill: b.top, stroke: b.top, 'stroke-width': 1 }, st), g);
  return { c: v(0, 1, 0), at: (u, w) => P3(cam, b.x + u * b.rx, b.y0 + b.h, b.z + w * b.rz) };
}
// affine matrix that lays 2D content flat on the plane y=const around (x,z); 1 world unit = cam.s px at tilt 0
function planeM(cam, x, y, z, ref) {
  const o = P3(cam, x, y, z), ex = P3(cam, x + 0.01, y, z), ez = P3(cam, x, y, z - 0.01), k = 100 / (ref || cam.s);
  return `matrix(${((ex[0] - o[0]) * k).toFixed(5)} ${((ex[1] - o[1]) * k).toFixed(5)} ${((ez[0] - o[0]) * k).toFixed(5)} ${((ez[1] - o[1]) * k).toFixed(5)} ${o[0].toFixed(2)} ${o[1].toFixed(2)})`;
}
