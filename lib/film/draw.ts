// @ts-nocheck
// Director 2 drawing: draws one frame of a prepared scene script into an <svg>. seek(t) is a pure function of t
// (and of the answers given to questions), so frames can be drawn in any order, live or for a video file.
import { W, H, ASK_Y, prep, stateOf, alive, camAt, anchorOf, boxOf, barSlot, normTerms, plotMap, lineY, tableDims, dotPos, fmtV, approxW, calcSize, noteBox, dotsDims, signAt, nodeHalf, lineEnds } from "./core";
const clamp2 = (v: number, lo: number, hi: number) => (hi < lo ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, v)));
import { clamp, lerp, E, seg, hitPulse, spring, mixHex, rgba, lum, dict } from "./ease";
import { ICONS } from "./icons";
import { skinOf } from "./skins";

const NS = "http://www.w3.org/2000/svg", F = 1 / 60;

export function createDirector(svg, opts = {}) {
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("xmlns", NS);
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  const mk = (tag) => document.createElementNS(NS, tag);
  const sdefs = mk("defs"), defs = mk("defs"), layer = mk("g");
  svg.appendChild(sdefs); svg.appendChild(defs); svg.appendChild(layer);
  const PID = "d" + Math.random().toString(36).slice(2, 7); // several players can share a page
  let uid = 0, M = null, SK = skinOf(opts.skin), FONT = SK.font, fancy = !!opts.fancy, brand = opts.brand || "", interactive = !!opts.interactive;
  const answers = new Map();

  // ---------- svg helpers ----------
  const n1 = (v) => (typeof v === "number" ? +v.toFixed(2) : v);
  function el(tag, attrs, parent) { const e = mk(tag); for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, n1(attrs[k])); (parent || layer).appendChild(e); return e; }
  const G = (parent, attrs) => el("g", attrs || {}, parent);
  const tf = (cx, cy, s = 1, rot = 0) => `translate(${n1(cx)} ${n1(cy)})${rot ? ` rotate(${n1(rot)})` : ""} scale(${+s.toFixed(5)}) translate(${n1(-cx)} ${n1(-cy)})`;
  const rr = (parent, x, y, w, h, r, attrs) => el("rect", Object.assign({ x, y, width: Math.max(0, w), height: Math.max(0, h), rx: Math.min(r, Math.max(0, h) / 2, Math.max(0, w) / 2), ry: Math.min(r, Math.max(0, h) / 2, Math.max(0, w) / 2) }, attrs || {}), parent);
  function text(str, x, y, size, weight, fill, anchor = "middle", parent) { const e = el("text", { x, y, "font-size": size, "font-weight": weight, fill, "text-anchor": anchor, "font-family": FONT, style: "white-space:pre" }, parent); e.textContent = str; return e; }
  // text width: measured on a canvas so it works even when the svg is not on screen yet
  let mctx = null; const mcache = new Map();
  function tw(str, size, weight = 800) {
    const key = weight + "|" + str; let v = mcache.get(key);
    if (v === undefined) {
      try { if (!mctx) mctx = document.createElement("canvas").getContext("2d"); mctx.font = `${weight} 100px ${FONT}`; v = mctx.measureText(str).width / 100; } catch (e) { v = 0; }
      if (!v && str) v = approxW(str, 1);
      mcache.set(key, v);
    }
    return v * size;
  }
  const fitSize = (str, maxW, maxSize, weight) => Math.min(maxSize, Math.floor(maxW / Math.max(1e-6, tw(str, 1, weight))));
  function wrapWords(str, maxW, size, weight) { const out = []; let cur = ""; for (const w of String(str).split(" ")) { const nxt = cur ? cur + " " + w : w; if (cur && tw(nxt, size, weight) > maxW) { out.push(cur); cur = w; } else cur = nxt; } if (cur) out.push(cur); return out; }
  // y is the vertical middle of the line
  function label(str, x, y, size, weight, fill, parent, anchor = "middle", maxW = 960, halo = false) {
    if (str == null || str === "") return 0; str = String(str); const s = Math.max(10, Math.min(size, fitSize(str, maxW, size, weight)));
    const e = text(str, x, y + s * 0.36, s, weight, fill, anchor, parent);
    // a caption keeps a rim of background colour, so a line that passes behind it does not cut through the letters
    if (halo) { e.setAttribute("stroke", SK.bg); e.setAttribute("stroke-width", n1(s * 0.34)); e.setAttribute("paint-order", "stroke"); e.setAttribute("stroke-linejoin", "round"); }
    return s;
  }
  // numbers with every digit the same width, so a counting number does not shake
  function numW(str, size, weight) { const dw = tw("0", size, weight); let w = 0; for (const ch of str) w += /\d/.test(ch) ? dw : tw(ch, size, weight); return w; }
  function number(str, x, y, size, weight, fill, parent, maxW) {
    if (maxW) size = Math.min(size, Math.floor((maxW / Math.max(1e-6, numW(str, 100, weight))) * 100));
    const dw = tw("0", size, weight), tot = numW(str, size, weight); let cx = x - tot / 2; const g = G(parent);
    for (const ch of str) { const isD = /\d/.test(ch), cw = isD ? dw : tw(ch, size, weight); text(ch, isD ? cx + dw / 2 : cx, y + size * 0.36, size, weight, fill, isD ? "middle" : "start", g); cx += cw; }
    return size;
  }
  function drawOn(e, len, p) { e.setAttribute("stroke-dasharray", `${n1(len)} ${n1(len)}`); e.setAttribute("stroke-dashoffset", n1(len * (1 - clamp(p)))); return e; }
  function blurF(sx, sy, box) {
    if (!fancy || (sx < 0.35 && sy < 0.35)) return null;
    const mx = sx * 3 + 6, my = sy * 3 + 6, id = PID + "b" + uid++;
    const f = el("filter", { id, filterUnits: "userSpaceOnUse", x: box[0] - mx, y: box[1] - my, width: box[2] + 2 * mx, height: box[3] + 2 * my }, defs);
    el("feGaussianBlur", { stdDeviation: sx.toFixed(2) + " " + sy.toFixed(2) }, f); return `url(#${id})`;
  }
  function gradDef(id, stops, x1 = 0, y1 = 0, x2 = 0, y2 = 1) { const g = el("linearGradient", { id: PID + id, x1, y1, x2, y2 }, sdefs); stops.forEach((s) => el("stop", { offset: s[0], "stop-color": s[1], "stop-opacity": s[2] == null ? 1 : s[2] }, g)); return `url(#${PID + id})`; }

  // ---------- colour ----------
  const NAMES = dict({ ink: "ink", blue: "primary", primary: "primary", pale: "soft", soft: "soft", yellow: "accent", accent: "accent", orange: "accent", green: "good", good: "good", red: "bad", bad: "bad", grey: "grey", gray: "grey", white: "white", line: "line", sub: "sub", bg: "bg", card: "card" });
  const col = (c, d) => { if (c == null || c === "") return d || SK.ink; const k = NAMES[String(c)]; if (k && typeof SK[k] === "string") return SK[k]; return /^#[0-9a-fA-F]{6}$/.test(String(c)) ? String(c) : d || SK.ink; };
  const colP = (p, d) => { const c = col(p.color, d); return p._prev && p._prev.color !== p.color ? mixHex(col(p._prev.color, d), c, p._u) : c; };
  const onFill = (hex) => (lum(hex) > 0.62 ? (SK.dark ? SK.bg : SK.ink) : "#FFFFFF");
  const softOf = (hex) => mixHex(hex, SK.bg, SK.dark ? 0.72 : 0.8);

  // ---------- pillars: Design F's bars ----------
  // Bars on one seat row (same y, lives that overlap) are one stage: they share a floor tile and a small camera of their own that pivots on
  // the middle of the row, so only the row turns 3D and the rest of the picture stays flat. The stage shows itself from straight above for a
  // moment (the bars land on the tile as squares), then tilts, and the squares stand up as pillars.
  // Yaw: a row's pillars stand on one line, so yaw tips the whole line and lifts one end. The binding limit is not the 40 px a seat may
  // wander but the room over the raised end: its number's pill reaches 95 px over the top, and that is all the room a row keeps (a caption
  // of the row above sits just over it). So each stage takes the largest yaw that lifts its end seats by at most LIFT px, and never more
  // than F's 22 + 12 degrees (kept here at 24 so a lone pillar's turned floor does not push its name down): a lone bar turns like F's pillars,
  // two bars (seats 250 px from the middle) get 3.5 degrees, a full row of three (340 px) 2.6; the perspective still shows the inner sides.
  // Two thirds of it arrive with the tilt, the last third is a slow drift, as F's 22 + 12.
  const PIL = { tilt: 58, yawMax: 24, lift: 8, foc: 2400, foot: 0.95, mx: 40, mz: 26, look: 0.7, drop: 1280, chip: 38 };
  const pilExpo = (x) => (x >= 1 ? 1 : x <= 0 ? 0 : 1 - Math.pow(2, -10 * x));
  const pilProg = (t, a, d) => clamp((t - a) / d);
  const pilSpring = (t, a, w) => { const s = t - a; return s <= 0 ? 0 : 1 - (1 + w * s) * Math.exp(-w * s); }; // critically damped, no overshoot
  const pilStages = new WeakMap(); // model -> (bar -> its stage); derived from the model once, not state between frames
  function pilStageOf(m, o) {
    let map = pilStages.get(m);
    if (!map) {
      map = new Map(); pilStages.set(m, map);
      const bars = m.list.filter((b) => b.type === "bar"), up = new Map(bars.map((b) => [b, b])), seat = (b) => b.keys[0].p;
      const root = (b) => { while (up.get(b) !== b) b = up.get(b); return b; };
      for (let i = 0; i < bars.length; i++) for (let j = i + 1; j < bars.length; j++) {
        const a = bars[i], b = bars[j];
        if (Math.abs((Number(seat(a).y) || 0) - (Number(seat(b).y) || 0)) < 2 && a.tAdd < b.tDel && b.tAdd < a.tDel) up.set(root(a), root(b));
      }
      const groups = new Map();
      bars.forEach((b) => { const r = root(b); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(b); });
      groups.forEach((mem) => {
        const first = mem.reduce((a, b) => (b.tAdd < a.tAdd ? b : a)), xs = mem.map((b) => Number(seat(b).x) || 0), px = (Math.min(...xs) + Math.max(...xs)) / 2;
        const half = Math.max(...xs.map((x) => Math.abs(x - px))), RAD = Math.PI / 180;
        const yaw = Math.min(PIL.yawMax * RAD, Math.asin(Math.min(1, PIL.lift / Math.max(1e-6, half * Math.cos(PIL.tilt * RAD)))));
        // a turned square looks wider (cos + sin of the yaw): the footprint shrinks so the pillar fills about its column
        const foot = PIL.foot / (Math.cos(yaw) + Math.sin(yaw)), rs = mem.map((b) => ((seat(b).w || 120) * foot) / 2);
        const x0 = Math.min(...xs.map((x, k) => x - rs[k])) - PIL.mx, x1 = Math.max(...xs.map((x, k) => x + rs[k])) + PIL.mx;
        const st = { t0: first.tAdd, px, py: Number(seat(first).y) || 0, x0, x1, fx: Number(seat(first).x) || 0, dz: Math.max(...rs) + PIL.mz, yaw, foot };
        mem.forEach((b) => map.set(b, st));
      });
    }
    return map.get(o);
  }
  function pilCam(st, t) {
    const a1 = pilSpring(t, st.t0 + PIL.look, 9), d = pilProg(t, st.t0 + PIL.look + 0.6, 12), RAD = Math.PI / 180;
    const tilt = a1 * PIL.tilt * RAD, yaw = st.yaw * ((2 / 3) * a1 + (1 / 3) * d * d * (3 - 2 * d));
    return { a1, px: st.px, py: st.py, cy: Math.cos(yaw), sy: Math.sin(yaw), ca: Math.cos(tilt), sa: Math.sin(tilt) };
  }
  /** x along the row from its middle, y up, z away from the viewer -> [screen x, screen y, depth (larger is nearer)] */
  function pilP(c, x, y, z) {
    const xr = x * c.cy - z * c.sy, zr = x * c.sy + z * c.cy, Y = -zr * c.ca - y * c.sa, D = -zr * c.sa + y * c.ca, k = PIL.foc / (PIL.foc - D);
    return [c.px + xr * k, c.py + Y * k, D];
  }
  /** the 3D height whose top shows hf px above its base once the row has tilted: bars still compare at a glance and keep to their column */
  function pilH(c, x, hf) {
    if (!(hf > 0)) return 0;
    const F = PIL.foc, s = Math.sin((PIL.tilt * Math.PI) / 180), co = Math.cos((PIL.tilt * Math.PI) / 180), zr = x * c.sy, a = zr * co, b = -zr * s, T = (-a * F) / (F - b) - hf;
    return Math.max(0, (T * (F - b) + a * F) / (T * co - s * F));
  }
  const pilPts = (arr) => arr.map((q) => n1(q[0]) + "," + n1(q[1])).join(" ");
  /** F's box(): a square footprint of half size r at x, height h, base lifted by y0; returns the projected top centre */
  function pilBox(parent, c, x, r, h, y0, top, side) {
    const v = (dx, dy, dz) => pilP(c, x + dx * r, y0 + dy * h, dz * r);
    const faces = [
      [[v(-1, 0, -1), v(1, 0, -1), v(1, 1, -1), v(-1, 1, -1)], 0, -1], [[v(1, 0, -1), v(1, 0, 1), v(1, 1, 1), v(1, 1, -1)], 1, 0],
      [[v(1, 0, 1), v(-1, 0, 1), v(-1, 1, 1), v(1, 1, 1)], 0, 1], [[v(-1, 0, 1), v(-1, 0, -1), v(-1, 1, -1), v(-1, 1, 1)], -1, 0],
    ];
    if (h > 0.5) for (const [p4, nx, nz] of faces) {
      const [a, b, q] = p4;
      if ((b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0]) >= 0) continue; // back face
      const fc = mixHex(side, "#000000", nx * 0.6 - nz * 0.8 > 0 ? 0.18 : 0.34); // F's light: from the front right
      el("polygon", { points: pilPts(p4), fill: fc, stroke: fc, "stroke-width": 1, "stroke-linejoin": "round" }, parent);
    }
    el("polygon", { points: pilPts([v(-1, 1, -1), v(1, 1, -1), v(1, 1, 1), v(-1, 1, 1)]), fill: top, stroke: top, "stroke-width": 1, "stroke-linejoin": "round" }, parent);
    return v(0, 1, 0);
  }
  // What the stages have drawn in this frame, keyed by the frame's own world group, so nothing carries over to the next frame.
  const pilFrames = new WeakMap();
  function pilFrame(world, st) { let fm = pilFrames.get(world); if (!fm) pilFrames.set(world, (fm = new Map())); let f = fm.get(st); if (!f) fm.set(st, (f = { tile: null, op: 0, kids: [] })); return f; }
  /** the floor of a stage: drawn once per frame behind everything, as strong as the strongest of its bars; it unfolds from the first bar's seat */
  function pilTile(world, st, c, t, op) {
    const f = pilFrame(world, st);
    if (!f.tile) {
      const u = pilSpring(t, st.t0, 16), fx = st.fx - st.px, x0 = lerp(fx - 10, st.x0 - st.px, u), x1 = lerp(fx + 10, st.x1 - st.px, u), d = lerp(10, st.dz, u);
      f.tile = el("polygon", { points: pilPts([pilP(c, x0, 0, -d), pilP(c, x1, 0, -d), pilP(c, x1, 0, d), pilP(c, x0, 0, d)]), fill: SK.card, stroke: SK.line, "stroke-width": 3, "stroke-linejoin": "round" }, world);
      world.insertBefore(f.tile, world.firstChild);
    }
    f.op = Math.max(f.op, op * clamp((t - st.t0) * 8)); f.tile.setAttribute("opacity", f.op.toFixed(3));
  }
  /** farther pillars of a stage first: a bar's group moves in front of the first nearer pillar already drawn */
  function pilSort(world, st, g, depth) {
    const f = pilFrame(world, st), k = f.kids.findIndex((q) => q.d > depth);
    if (k >= 0) { world.insertBefore(g, f.kids[k].g); f.kids.splice(k, 0, { g, d: depth }); } else f.kids.push({ g, d: depth });
  }
  /** F's chip: a pill on a short leader line above (ax, ay), wiping open from its middle */
  function pilChip(parent, str, ax, ay, e, fill, ink, maxW) {
    e = pilExpo(e); if (e <= 0.001) return;
    const size = PIL.chip, h = size + 22, dy = 28, w = Math.min(maxW, numW(str, size, 800) + 44), y = ay - dy - h;
    el("line", { x1: ax, y1: ay, x2: ax, y2: y + h, stroke: SK.ink, "stroke-width": 3, "stroke-dasharray": `${n1((dy + 4) * Math.min(1, e * 1.6))} 999` }, parent);
    const id = PID + "c" + uid++, cp = el("clipPath", { id }, defs);
    el("rect", { x: ax - (w / 2 + 4) * e, y: y - 4, width: (w + 8) * e, height: h + 8 }, cp);
    const cg = G(parent, { "clip-path": `url(#${id})` });
    rr(cg, ax - w / 2, y, w, h, h / 2, { fill, stroke: SK.ink, "stroke-width": 3 });
    number(str, ax, y + h / 2, size, 800, ink, cg, w - 32);
  }
  /** a bar as a pillar on its stage's floor. hv: its height in px now (it glides when "set" changes it); slot: the room it keeps */
  function pilBar(o, p, t, world, g, op, c, hv, slot) {
    const st = pilStageOf(M, o); if (!st) return false;
    const cam = pilCam(st, t), x = (Number(p.x) || 0) - st.px, r = ((p.w || 120) * st.foot) / 2, base = pilP(cam, x, 0, 0);
    pilTile(world, st, cam, t, op);
    pilSort(world, st, g, base[2]);
    const land = pilExpo(pilProg(t, o.tAdd, 0.35)), late = p.scale != null && o.keys[0].p.value == null; // late: it gets its number in a later scene
    const kv = p.scale == null ? null : o.keys.find((k) => k.p.value != null), tVal = p.scale == null ? o.tAdd : kv ? kv.t : Infinity;
    const has = p.scale == null || p.value != null, tilted = st.t0 + PIL.look + 0.3, rise0 = Math.max(late ? tVal : o.tAdd + 0.35, tilted);
    const stand = has ? pilSpring(t, rise0, 11) : 0, H = pilH(cam, x, Math.max(0, hv)) * stand;
    if (land > 0 && has) {
      const side = c === SK.ink && !SK.dark ? "#4A4A4F" : c, top = pilBox(g, cam, x, r, H, lerp(PIL.drop, 0, land), c, side);
      if (p.value != null) { const prim = c === SK.primary; pilChip(g, String(shownValue(o, p)), top[0], top[1], pilProg(t, rise0 + 0.3, 0.25), prim ? c : SK.card, prim ? onFill(c) : SK.ink, (p.w || 120) + 160); }
    }
    // F's ghost: the yellow dashed pillar that could stand here; the real one rises inside it and the ghost lets go when it reaches the top
    const Hs = late ? pilH(cam, x, Math.abs(slot)) : 0;
    if (Hs > 0 && stand < 0.96) {
      const gw = pilExpo(pilProg(t, Math.max(o.tAdd + 0.2, tilted - 0.1), 0.45)), gq = G(g, { opacity: (land * clamp((0.96 - stand) * 8)).toFixed(3) });
      const v = (dx, dy, dz) => pilP(cam, x + dx * r, lerp(H, Hs * gw, dy), dz * r), dash = { stroke: SK.accent, "stroke-width": 6, "stroke-dasharray": "14 12", "stroke-linecap": "round", fill: "none" };
      if (gw > 0.01) [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([dx, dz]) => { const a = v(dx, 1, dz), b = v(dx, 0, dz); el("line", Object.assign({ x1: a[0], y1: a[1], x2: b[0], y2: b[1] }, dash), gq); });
      el("polygon", Object.assign({ points: pilPts([v(-1, 1, -1), v(1, 1, -1), v(1, 1, 1), v(-1, 1, 1)]) }, dash), gq);
    }
    // the name stays plain text under the base, just clear of the floor's front edge, so it rides along as the floor tilts
    // (under the lowest point of the floor's front edge near it: a turned lone tile shows a corner there)
    const ex = (dx) => pilP(cam, clamp(x + dx, st.x0 - st.px, st.x1 - st.px), 0, -st.dz)[1];
    if (p.str) { const ny = Math.max(ex(-r - PIL.mx), ex(r + PIL.mx)); label(p.str, base[0], ny + 26, 42, 700, SK.sub, G(g, { opacity: clamp(land * 1.5).toFixed(3) }), "middle", (p.w || 120) + 120, true); }
    return true;
  }

  // ---------- one object ----------
  function shownValue(o, p) { // while a number counts, it shows as many decimals as the values it moves between
    if (p.value == null) return p.str;
    let dec = p.dec; if (dec == null) dec = Math.max(0, ...o.keys.map((k) => k.p.value).filter((v) => v != null).map((v) => (String(v).split(".")[1] || "").length));
    return (p.pre || "") + fmtV(Number(p.value), dec) + (p.suf || "");
  }
  function chip(parent, str, x, y, size, c, fill) { const w = tw(String(str), size, 800) + size * 0.9, h = size * 1.55; rr(parent, x - w / 2, y - h / 2, w, h, h / 2, { fill: fill || SK.card, stroke: c, "stroke-width": 4 }); label(str, x, y, size, 800, fill ? onFill(fill) : c, parent); return [w, h]; }
  function iconAt(parent, name, x, y, size, mainC, softC) { const ic = ICONS[name]; if (!ic) { el("circle", { cx: x, cy: y, r: size * 0.38, fill: softC, stroke: mainC, "stroke-width": 6 }, parent); return; } const g = G(parent, { transform: `translate(${n1(x - size / 2)} ${n1(y - size / 2)}) scale(${(size / 256).toFixed(5)})` }); if (ic[0]) el("path", { d: ic[0], fill: softC }, g); el("path", { d: ic[1], fill: mainC }, g); }
  function arrowHead(parent, tip, ux, uy, c, wdt, s = 26) { el("path", { d: `M ${n1(tip[0] - ux * s - uy * s * 0.6)} ${n1(tip[1] - uy * s + ux * s * 0.6)} L ${n1(tip[0])} ${n1(tip[1])} L ${n1(tip[0] - ux * s + uy * s * 0.6)} ${n1(tip[1] - uy * s - ux * s * 0.6)}`, stroke: c, "stroke-width": wdt, fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round" }, parent); }
  function checkMark(parent, x, y, s, c, cross) { el("path", { d: cross ? `M ${x - s} ${y - s} L ${x + s} ${y + s} M ${x + s} ${y - s} L ${x - s} ${y + s}` : `M ${x - s} ${y} L ${x - s * 0.3} ${y + s * 0.7} L ${x + s} ${y - s * 0.7}`, stroke: c, "stroke-width": s * 0.42, fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round" }, parent); }

  function drawObj(o, t, world, dim) {
    if (t < o.tAdd || t > o.tDel + 0.35) return;
    // Design F: nothing overshoots. ap grows with a critically damped spring; a placed thing opens out of the blue dot that brought it (expoOut)
    const p = stateOf(o, t), ap = springC(t, o.tAdd), out = 1 - seg(t, o.tDel, 0.3, E.exit), bn = BORN.get(o), grow = expoOut(prog(t, o.tAdd, 0.3));
    const op = clamp(bn ? 0.25 + grow * 3 : grow * 2.5) * out * (p.opacity == null ? 1 : p.opacity) * dim;
    if (op <= 0.003) return;
    const pl = o.pulses.reduce((mx, tp) => Math.max(mx, hitPulse(t, tp, 0.08, 0.25)), 0), sc = (bn ? 1 : lerp(0.6, 1, grow)) * (1 + 0.12 * pl);
    const c = colP(p), g = G(world, { opacity: op.toFixed(3), transform: bn && grow < 0.999 ? tf(bn.seat[0], bn.seat[1], lerp(bn.s0, 1, grow)) : null });
    switch (o.type) {
      case "text": { const q = G(g, { transform: tf(p.x, p.y, sc) }); label(p.str, p.x, p.y, p.size || 56, p.weight || 800, c, q, p.align === "left" ? "start" : "middle", p.maxW || 1000); break; }
      case "box": {
        const w = p.w || 240, h = p.h || 120, q = G(g, { transform: tf(p.x, p.y, sc) }), tone = p.tone || "solid";
        const fill = tone === "solid" ? c : tone === "soft" ? softOf(c) : SK.card, fg = tone === "solid" ? onFill(fill) : SK.ink;
        rr(q, p.x - w / 2, p.y - h / 2, w, h, SK.radius, { fill, stroke: tone === "line" ? c : p.outline ? col(p.outline) : "none", "stroke-width": tone === "line" ? 6 : 5 });
        const main = shownValue(o, p), s = p.size || 48;
        if (main != null && main !== "") { if (p.value != null) number(String(main), p.x, p.y + (p.sub ? -h * 0.17 : 0), s, 800, fg, q, w - 28); else label(main, p.x, p.y + (p.sub ? -h * 0.17 : 0), s, 800, fg, q, "middle", w - 28); }
        if (p.sub) label(p.sub, p.x, p.y + h * 0.24, Math.max(38, s * 0.74), 700, fg, q, "middle", w - 28);
        if (p.cap) label(p.cap, p.x, p.y + h / 2 + 40, 42, 700, SK.sub, q, "middle", 340, true);
        break;
      }
      case "node": {
        const r = p.r || 80, hw = nodeHalf(p), fitW = hw > r ? hw * 2 - r * 0.5 : r * 1.72, q = G(g, { transform: tf(p.x, p.y, sc) });
        if (p.frac != null && p.frac < 0.999) { // a part of a whole: the rest stays as an outline
          el("circle", { cx: p.x, cy: p.y, r, fill: softOf(c), stroke: c, "stroke-width": 6, "stroke-dasharray": "14 12" }, q);
          const f = clamp(p.frac), a = f * Math.PI * 2 - Math.PI / 2;
          if (f > 0.001) el("path", { d: `M ${n1(p.x)} ${n1(p.y)} L ${n1(p.x)} ${n1(p.y - r)} A ${r} ${r} 0 ${f > 0.5 ? 1 : 0} 1 ${n1(p.x + r * Math.cos(a))} ${n1(p.y + r * Math.sin(a))} Z`, fill: c }, q);
        } else if (hw > r) rr(q, p.x - hw, p.y - r, hw * 2, r * 2, r, { fill: c, stroke: p.outline ? col(p.outline) : "none", "stroke-width": 6 }); // a long value: the circle widens into a pill
        else el("circle", { cx: p.x, cy: p.y, r, fill: c, stroke: p.outline ? col(p.outline) : "none", "stroke-width": 6 }, q);
        const v = shownValue(o, p), fg = p.frac != null && p.frac < 0.999 ? SK.ink : onFill(c);
        // a circle written with only a dash for its value ("node pier -") is a stop on a path with nothing to say: it is drawn empty
        if (v != null && v !== "" && !/^[-–—·]$/.test(String(v).trim())) { if (p.value != null) number(String(v), p.x, p.y, p.size || r * 0.62, 800, fg, q, fitW); else label(v, p.x, p.y, p.size || r * 0.62, 800, fg, q, "middle", fitW); }
        if (p.cap) label(p.cap, p.x, p.y + r + 40, 42, 700, SK.sub, q, "middle", 340, true);
        break;
      }
      case "num": { const q = G(g, { transform: tf(p.x, p.y, sc) }), s = p.size || 120; number(String(shownValue(o, p)), p.x, p.y, s, 800, c, q, 980); if (p.cap) label(p.cap, p.x, p.y - s * 0.8, 44, 700, SK.sub, q); break; }
      case "icon": {
        const s = p.size || 160, q = G(g, { transform: tf(p.x, p.y, sc) }), main = p.color ? c : SK.ink;
        iconAt(q, p.name, p.x, p.y, s, main, p.color && p.color !== "ink" ? softOf(main) : SK.soft);
        if (p.cap) label(p.cap, p.x, p.y + s / 2 + 36, 42, 700, SK.sub, q, "middle", 340, true);
        if (p.badge != null && p.badge !== "") chip(q, p.badge, p.x + s * 0.36, p.y - s * 0.4, 38, SK.ink, SK.accent);
        break;
      }
      case "bar": {
        // a pillar on its row's floor (see pilBar); a bar that hangs below zero stays a flat column, as before
        const w = p.w || 120, hv = p.scale != null && p.value != null ? p.value * p.scale : p.h || 0, slot = barSlot(o, p);
        if (hv >= 0 && slot >= 0 && pilBar(o, p, t, world, g, op, c, hv, slot)) break;
        const filling = p._prev && p._prev.value == null && p.value != null ? clamp(p._u) : 1, grow = pilExpo(pilProg(t, o.tAdd, 0.4));
        const h = Math.abs(hv) * grow * filling, neg = hv < 0, q = G(g), cc = neg && !p.color ? SK.bad : c, sh = Math.abs(slot);
        if (sh > h + 2) rr(q, p.x - w / 2 + 2, slot < 0 ? p.y : p.y - sh, w - 4, sh, Math.min(14, SK.radius), { fill: "none", stroke: SK.sub, "stroke-opacity": 0.55, "stroke-width": 4, "stroke-dasharray": "16 12", "stroke-linecap": "round" });
        rr(q, p.x - w / 2, neg ? p.y : p.y - h, w, h, Math.min(14, SK.radius), { fill: cc });
        if (p.str) label(p.str, p.x, p.y + (neg ? -44 : 50), 42, 700, SK.sub, q, "middle", w + 120, true);
        if (p.value != null) number(String(shownValue(o, p)), p.x, neg ? p.y + h + 44 : p.y - h - 40, 48, 800, cc, q, w + 160);
        break;
      }
      case "arrow": case "line": {
        const A = p.from != null ? anchorOf(M, p.from, t) : { x: p.x, y: p.y, r: 0, box: null }, B = p.to != null ? anchorOf(M, p.to, t) : { x: p.x2, y: p.y2, r: 0, box: null };
        if (!A || !B || [A.x, A.y, B.x, B.y].some((v) => typeof v !== "number" || !isFinite(v))) return;
        const [a, b] = lineEnds(A, B, p);
        const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, wdt = p.width || SK.stroke, dp = seg(t, o.tAdd, 0.5, E.out), bend = Number(p.curve) || 0;
        const mx = (a[0] + b[0]) / 2 - uy * bend, my = (a[1] + b[1]) / 2 + ux * bend;
        const e = el("path", { d: bend ? `M ${n1(a[0])} ${n1(a[1])} Q ${n1(mx)} ${n1(my)} ${n1(b[0])} ${n1(b[1])}` : `M ${n1(a[0])} ${n1(a[1])} L ${n1(b[0])} ${n1(b[1])}`, stroke: c, "stroke-width": wdt, fill: "none", "stroke-linecap": "round" }, g);
        if (p.dash) e.setAttribute("stroke-dasharray", "4 20"); else drawOn(e, L * (bend ? 1.2 : 1) + 4, dp);
        if (o.type === "arrow" && dp > 0.9) { const ex = bend ? b[0] - mx : ux, ey = bend ? b[1] - my : uy, el2 = Math.hypot(ex, ey) || 1; arrowHead(g, b, ex / el2, ey / el2, c, wdt); if (p.both) { const sx = bend ? a[0] - mx : -ux, sy = bend ? a[1] - my : -uy, sl = Math.hypot(sx, sy) || 1; arrowHead(g, a, sx / sl, sy / sl, c, wdt); } }
        if (p.str) { const off = p.loff != null ? Number(p.loff) : bend < 0 ? -50 : 50, at = bend || p.lpos == null ? 0.5 : Number(p.lpos), tx = a[0] + (b[0] - a[0]) * at - uy * (bend * 0.5 + off), ty = a[1] + (b[1] - a[1]) * at + ux * (bend * 0.5 + off); const we = expoOut(prog(t, o.tAdd + 0.22, 0.3)); if (we > 0.002) { const cw = tw(String(p.str), 40, 800) + 36; chip(G(g, { "clip-path": clipR(tx - (cw / 2 + 4) * we, ty - 35, (cw + 8) * we, 70) }), p.str, tx, ty, 40, c); } } // the pill wipes open from its middle, as in Design F
        break;
      }
      case "brace": {
        const A = p.from != null ? anchorOf(M, p.from, t) : { x: p.x, y: p.y, r: 0, box: null }, B = p.to != null ? anchorOf(M, p.to, t) : { x: p.x2, y: p.y2, r: 0, box: null };
        if (!A || !B) return;
        const bx = (q) => q.box || { x0: q.x - (q.r || 0), x1: q.x + (q.r || 0), y0: q.y - (q.r || 0), y1: q.y + (q.r || 0) }, a = bx(A), b = bx(B), gap = p.gap == null ? 34 : p.gap;
        const side = p.side || (Math.abs(B.x - A.x) > Math.abs(B.y - A.y) ? "top" : "right"), dp = seg(t, o.tAdd, 0.5, E.out), wdt = 6, tk = 20;
        let d, lx, ly, len;
        if (side === "right" || side === "left") { const s = side === "right" ? 1 : -1, x = clamp2(s > 0 ? Math.max(a.x1, b.x1) + gap : Math.min(a.x0, b.x0) - gap, 30, W - 30); d = `M ${n1(x - s * tk)} ${n1(A.y)} L ${n1(x)} ${n1(A.y)} L ${n1(x)} ${n1(B.y)} L ${n1(x - s * tk)} ${n1(B.y)}`; len = Math.abs(B.y - A.y) + 2 * tk; const cw = tw(String(p.str || ""), 40, 800) + 36; lx = clamp2(x + s * (cw / 2 + 18), 24 + cw / 2, W - 24 - cw / 2); ly = (A.y + B.y) / 2; }
        else { const s = side === "bottom" ? 1 : -1, y = s > 0 ? Math.max(a.y1, b.y1) + gap : Math.min(a.y0, b.y0) - gap; d = `M ${n1(A.x)} ${n1(y - s * tk)} L ${n1(A.x)} ${n1(y)} L ${n1(B.x)} ${n1(y)} L ${n1(B.x)} ${n1(y - s * tk)}`; len = Math.abs(B.x - A.x) + 2 * tk; const cw = tw(String(p.str || ""), 40, 800) + 36; lx = clamp2((A.x + B.x) / 2, 24 + cw / 2, W - 24 - cw / 2); ly = y + s * 52; }
        drawOn(el("path", { d, stroke: c, "stroke-width": wdt, fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round" }, g), len, dp);
        if (p.str) { const q = G(g, { opacity: clamp((dp - 0.4) * 3).toFixed(3), transform: tf(lx, ly, 1 + 0.12 * pl) }); chip(q, p.str, lx, ly, 40, c, p.fill ? col(p.fill) : null); }
        break;
      }
      case "calc": {
        const s0 = p.size || 64, terms = normTerms(p), gap = s0 * 0.34, raw = terms.reduce((acc, q) => acc + tw(q.text, s0, 800), 0) + gap * Math.max(0, terms.length - 1), s = Math.min(calcSize(p), raw > 980 ? Math.floor((s0 * 980) / raw) : s0), g2 = s * 0.34;
        const ws = terms.map((q) => tw(q.text, s, 800)), total = ws.reduce((a, b) => a + b, 0) + g2 * Math.max(0, terms.length - 1), eq = terms.findIndex((q) => q.text === "=" || q.text === "≈");
        let x = p.x - total / 2;
        terms.forEach((q, k) => {
          const cx = x + ws[k] / 2, t0 = o.tAdd + 0.32 * k, isRes = eq >= 0 && k > eq, tc = q.color ? col(q.color) : isRes ? (p.color ? c : SK.primary) : q.kind === "op" ? SK.sub : SK.ink;
          if (t >= t0) {
            if (isRes) { const a2 = spring(t, t0 + 0.12, 300, 29, 0.7), hw = ws[k] / 2 + 14; rr(g, cx - hw, p.y + s * 0.18, hw * 2 * clamp(a2 * 1.4), s * 0.34, 6, { fill: SK.accent, opacity: clamp((t - t0 - 0.12) * 6) }); const gq = G(g, { transform: tf(cx, p.y, lerp(0.5, 1, a2)), opacity: clamp(a2 * 2).toFixed(3) }); label(q.text, cx, p.y, s, 800, tc, gq); }
            else if (q.from && anchorOf(M, q.from, t)) { const src = anchorOf(M, q.from, t), u = seg(t, t0, 0.5, E.rest), px = lerp(src.x, cx, u), py = lerp(src.y, p.y, u) - Math.sin(u * Math.PI) * 46; const gq = G(g, { opacity: clamp((t - t0) * 8).toFixed(3), transform: tf(px, py, lerp(0.8, 1, u)) }); label(q.text, px, py, s, 800, tc, gq); if (u < 1) el("circle", { cx: src.x, cy: src.y, r: (src.r || 60) * (1 + 0.5 * u), fill: "none", stroke: SK.primary, "stroke-width": 5, opacity: (0.6 * (1 - u)).toFixed(3) }, g); }
            else { const a2 = seg(t, t0, 0.3, E.out); const gq = G(g, { opacity: a2.toFixed(3), transform: `translate(0 ${n1((1 - a2) * 18)})` }); label(q.text, cx, p.y, s, 800, tc, gq); }
          }
          x += ws[k] + g2;
        });
        break;
      }
      case "note": {
        const nb = noteBox(M, p, t); if (!nb) return;
        const size = p.size || 40, cw = nb.w, ch = nb.h, x = nb.cx, y = nb.cy, tip = nb.tip;
        // Design F's chip: the stem draws out of the thing, then the pill wipes open from the stem's side (from its middle above or below)
        const q = G(g, { transform: tf(x, y, 1 + 0.12 * pl) }), nc = p.color ? c : SK.primary, we = expoOut(prog(t, o.tAdd, 0.32)), sd = String(p.side || "right");
        if (!p.push && !p.slide) el("line", { x1: tip[0], y1: tip[1], x2: x, y2: y, stroke: nc, "stroke-width": 5, "stroke-linecap": "round", "stroke-dasharray": `${n1(Math.hypot(x - tip[0], y - tip[1]) * Math.min(1, we * 1.6) + 1)} 9999` }, q); // a tag stacked on another tag needs no stem
        const ww = (cw + 8) * we, wx = sd === "right" ? x - cw / 2 - 4 : sd === "left" ? x + cw / 2 + 4 - ww : x - ww / 2, pg = G(q, { "clip-path": clipR(wx, y - ch / 2 - 4, ww, ch + 8) });
        rr(pg, x - cw / 2, y - ch / 2, cw, ch, ch / 2, { fill: SK.card, stroke: nc, "stroke-width": 4 }); label(p.str, x, y, size, 800, nc, pg, "middle", cw - size * 0.7);
        break;
      }
      case "sign": {
        let x = p.x, y = p.y;
        if (Array.isArray(p.between)) { const c2 = signAt(M, p, t); if (!c2) return; x = c2[0]; y = c2[1]; }
        const q = G(g, { transform: tf(x, y, sc) }); label(p.str || "=", x, y, p.size || 96, 800, p.color ? c : SK.primary, q);
        break;
      }
      case "axis": drawAxis(o, p, t, world, out); break; // the floor of the picture: born as a solid dot (no fade), drawn whole, and not dimmed when a scene points elsewhere
      case "plot": {
        const map = plotMap(p), q = G(g), ax = SK.ink, grey = SK.grey, zeroY = map.yr[0] < 0 && map.yr[1] > 0 ? map.sy(0) : map.y1, dp = seg(t, o.tAdd, 0.6, E.out);
        (Array.isArray(p.yt) ? p.yt : []).forEach((v) => { const y = map.sy(v); el("line", { x1: map.x0, y1: y, x2: map.x0 + map.w * dp, y2: y, stroke: SK.line, "stroke-width": 3 }, q); label(fmtV(v), map.x0 - 16, y, 36, 700, SK.sub, q, "end", 150); });
        (Array.isArray(p.xt) ? p.xt : []).forEach((v) => { const x = map.sx(v); el("line", { x1: x, y1: zeroY - 10, x2: x, y2: zeroY + 10, stroke: ax, "stroke-width": 4 }, q); label(fmtV(v), x, zeroY + 44, 36, 700, SK.sub, q, "middle", 160); });
        drawOn(el("line", { x1: map.x0, y1: map.y1, x2: map.x0, y2: map.y1 - map.h, stroke: ax, "stroke-width": 6, "stroke-linecap": "round" }, q), map.h, dp);
        drawOn(el("line", { x1: map.x0, y1: zeroY, x2: map.x0 + map.w, y2: zeroY, stroke: ax, "stroke-width": 6, "stroke-linecap": "round" }, q), map.w, dp);
        if (p.xl) label(p.xl, map.x0 + map.w, zeroY + (Array.isArray(p.xt) && p.xt.length ? 96 : 50), 40, 700, SK.sub, q, "end", map.w);
        if (p.yl) label(p.yl, map.x0 - 8, map.y1 - map.h - 38, 40, 700, SK.sub, q, "start", map.w);
        (Array.isArray(p.marks) ? p.marks : []).forEach((mk2) => { if (!mk2) return; const mc = mk2.color ? col(mk2.color) : grey;
          if (mk2.x != null) { const x = map.sx(mk2.x); el("line", { x1: x, y1: map.y1, x2: x, y2: map.y1 - map.h, stroke: mc, "stroke-width": 4, "stroke-dasharray": "6 14", "stroke-linecap": "round", opacity: dp }, q); if (mk2.str) chip(q, mk2.str, clamp(x, map.x0 + 60, map.x0 + map.w - 60), map.y1 - map.h - 6, 36, mc); }
          else if (mk2.y != null) { const y = map.sy(mk2.y); el("line", { x1: map.x0, y1: y, x2: map.x0 + map.w, y2: y, stroke: mc, "stroke-width": 4, "stroke-dasharray": "6 14", "stroke-linecap": "round", opacity: dp }, q); if (mk2.str) chip(q, mk2.str, map.x0 + map.w - 70, y - 40, 36, mc); } });
        const born = (id) => { for (const k of o.keys) if ((Array.isArray(k.p.lines) ? k.p.lines : []).some((l) => String(l.id) === String(id))) return k.t; return o.tAdd; };
        (Array.isArray(p.lines) ? p.lines : []).forEach((ln, li) => { if (!ln || !Array.isArray(ln.pts) || ln.pts.length < 2) return;
          let pts = ln.pts; const prev = p._prev && Array.isArray(p._prev.lines) ? p._prev.lines.find((l) => String(l.id) === String(ln.id)) : null;
          if (prev && Array.isArray(prev.pts) && prev.pts.length === pts.length) pts = pts.map((pt, k) => [lerp(prev.pts[k][0], pt[0], p._u), lerp(prev.pts[k][1], pt[1], p._u)]);
          const scr = pts.map((pt) => [map.sx(pt[0]), map.sy(pt[1])]), d = scr.map((s, k) => `${k ? "L" : "M"} ${n1(s[0])} ${n1(s[1])}`).join(" "); let len = 0; for (let k = 1; k < scr.length; k++) len += Math.hypot(scr[k][0] - scr[k - 1][0], scr[k][1] - scr[k - 1][1]);
          const tb = born(ln.id), lp = seg(t, tb + (tb === o.tAdd ? 0.45 + 0.3 * li : 0), 0.8, E.inOut), lc = ln.color ? col(ln.color) : SK.primary;
          const e = el("path", { d, stroke: lc, "stroke-width": ln.width || 9, fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round" }, q); if (ln.dash) { e.setAttribute("stroke-dasharray", "4 18"); e.setAttribute("opacity", lp.toFixed(3)); } else drawOn(e, len, lp);
          if (ln.str && lp > 0.85) { const last = scr[scr.length - 1]; const gq = G(q, { opacity: clamp((lp - 0.85) * 7).toFixed(3) }); label(ln.str, Math.min(last[0], map.x0 + map.w) - 8, last[1] - 34, 38, 800, lc, gq, "end", 420); } });
        break;
      }
      case "dot": {
        const c2 = dotPos(M, p, t); if (!c2) return; const po = M.objs.get(String(p.plot)), pp = stateOf(po, t), map = plotMap(pp), q = G(g), dc = p.color ? c : SK.accent;
        if (p.guide !== false) { const zeroY = map.yr[0] < 0 && map.yr[1] > 0 ? map.sy(0) : map.y1; el("line", { x1: c2[0], y1: c2[1], x2: c2[0], y2: zeroY, stroke: SK.grey, "stroke-width": 4, "stroke-dasharray": "4 12", "stroke-linecap": "round" }, q); }
        el("circle", { cx: c2[0], cy: c2[1], r: 20 * sc, fill: dc, stroke: SK.ink, "stroke-width": 6 }, q);
        let str = p.str; if (p.label) { let py = Number(p.py) || 0; if (p.line != null) { const ln = (Array.isArray(pp.lines) ? pp.lines : []).find((l) => String(l.id) === String(p.line)); if (ln) py = lineY(ln.pts, Number(p.px) || 0); } const v = p.label === "x" ? Number(p.px) : py; const dd = p.dec != null ? p.dec : Math.max(0, ...o.keys.map((k) => (String(k.p.px ?? "").split(".")[1] || "").length)); str = (p.pre || "") + (p.label !== "x" && p.sign && v > 0 ? "+" : "") + fmtV(v, dd) + (p.suf || ""); }
        if (str != null && str !== "") chip(q, str, clamp(c2[0], 110, W - 110), c2[1] - 62, 40, SK.ink, dc);
        break;
      }
      case "scale": { // a balance: the heavier side goes down
        const w = p.w || 700, hw = w / 2, tilt = clamp(Number(p.tilt) || 0, -1, 1), D = hw * 0.14 * tilt, q = G(g, { transform: tf(p.x, p.y, lerp(0.9, 1, ap)) });
        const ends = [[p.x - hw, p.y - D], [p.x + hw, p.y + D]], labs = [p.left, p.right], cols2 = [col(p.lc || "blue"), col(p.rc || "yellow")];
        el("path", { d: `M ${n1(p.x)} ${n1(p.y)} L ${n1(p.x)} ${n1(p.y + 250)} M ${n1(p.x - 120)} ${n1(p.y + 250)} L ${n1(p.x + 120)} ${n1(p.y + 250)}`, stroke: SK.ink, "stroke-width": 12, "stroke-linecap": "round", fill: "none" }, q);
        el("line", { x1: ends[0][0], y1: ends[0][1], x2: ends[1][0], y2: ends[1][1], stroke: SK.ink, "stroke-width": 12, "stroke-linecap": "round" }, q);
        el("circle", { cx: p.x, cy: p.y, r: 20, fill: SK.ink }, q);
        ends.forEach((e, k) => {
          const py = e[1] + 76;
          el("path", { d: `M ${n1(e[0])} ${n1(e[1])} L ${n1(e[0] - 120)} ${n1(py)} M ${n1(e[0])} ${n1(e[1])} L ${n1(e[0] + 120)} ${n1(py)}`, stroke: SK.ink, "stroke-width": 6, "stroke-linecap": "round", fill: "none" }, q);
          rr(q, e[0] - 150, py, 300, 112, SK.radius, { fill: softOf(cols2[k]), stroke: cols2[k], "stroke-width": 5 });
          label(labs[k] == null ? "" : labs[k], e[0], py + 56, 46, 800, SK.ink, q, "middle", 272);
        });
        break;
      }
      case "dots": { // "so many out of so many": a grid of dots with some of them coloured
        const d = dotsDims(p), q = G(g), x0 = p.x - d.w / 2, y0 = p.y - d.h / 2, hi = Math.floor((Number(p.hi) || 0) + 1e-6), hi2 = Math.floor((Number(p.hi2) || 0) + 1e-6), c1 = p.color ? c : SK.primary, c2 = col(p.c2 || "yellow");
        for (let k = 0; k < d.n; k++) {
          const a2 = spring(t, o.tAdd + (k / d.n) * 0.5, 320, 30, 0.7); if (a2 <= 0.01) continue; // critically damped: no overshoot (Design F)
          el("circle", { cx: x0 + (k % d.cols) * d.pitch + d.d / 2, cy: y0 + Math.floor(k / d.cols) * d.pitch + d.d / 2, r: (d.d / 2) * clamp(a2, 0, 1.15), fill: k < hi ? c1 : k < hi + hi2 ? c2 : SK.line }, q);
        }
        if (p.cap) label(p.cap, p.x, y0 + d.h + 44, 42, 700, SK.sub, q, "middle", 900, true);
        break;
      }
      case "table": {
        const d = tableDims(p), q = G(g, { transform: tf(p.x || 540, p.y || 1100, lerp(0.92, 1, ap)) }), size = p.size || 52, wsum = Array.isArray(p.colW) && p.colW.length === d.cols ? p.colW.reduce((a, b) => a + b, 0) : d.cols, cw = (k) => (Array.isArray(p.colW) && p.colW.length === d.cols ? p.colW[k] : 1) * d.w / wsum;
        const show = p.show == null ? d.nrows : p.show, hi = Array.isArray(p.hi) ? p.hi : [];
        rr(q, d.x0, d.y0, d.w, d.rowH * (d.head + Math.min(d.nrows, Math.ceil(show))), SK.radius, { fill: SK.card, stroke: SK.line, "stroke-width": 4 });
        if (d.head) {
          // the head band sits inside the card's border: round where the card is round, square where it meets the rows
          const hx0 = d.x0 + 2, hx1 = d.x0 + d.w - 2, hy0 = d.y0 + 2, hy1 = d.y0 + d.rowH, hr = Math.max(0, Math.min(SK.radius - 2, d.rowH - 2, (d.w - 4) / 2));
          if (Math.min(d.nrows, Math.ceil(show)) < 1) rr(q, hx0, hy0, d.w - 4, d.rowH - 4, hr, { fill: SK.soft }); // no row shown yet: the band is the whole card
          else el("path", { d: `M${n1(hx0)} ${n1(hy1)}V${n1(hy0 + hr)}A${n1(hr)} ${n1(hr)} 0 0 1 ${n1(hx0 + hr)} ${n1(hy0)}H${n1(hx1 - hr)}A${n1(hr)} ${n1(hr)} 0 0 1 ${n1(hx1)} ${n1(hy0 + hr)}V${n1(hy1)}Z`, fill: SK.soft }, q);
          let x = d.x0; (p.cols || []).forEach((cell, k) => { label(cell, x + cw(k) / 2, d.y0 + d.rowH / 2, size * 0.85, 800, SK.dark ? SK.ink : SK.primary, q, "middle", cw(k) - 20); x += cw(k); }); }
        (p.rows || []).forEach((row, r) => { const vis = clamp(show - r); if (vis <= 0) return; const y = d.y0 + d.rowH * (d.head + r), rg = G(q, { opacity: vis.toFixed(3) });
          if (r > 0 || d.head) el("line", { x1: d.x0 + 16, y1: y, x2: d.x0 + d.w - 16, y2: y, stroke: SK.line, "stroke-width": 3 }, rg);
          let x = d.x0; (row || []).forEach((cell, k) => { const on = hi.some((h2) => h2 && h2[0] === r && h2[1] === k) || p.hiRow === r || p.hiCol === k, cx = x + cw(k) / 2, cy = y + d.rowH / 2;
            if (on) rr(rg, x + 8, y + 8, cw(k) - 16, d.rowH - 16, Math.min(18, SK.radius), { fill: SK.accent });
            const sv = String(cell ?? ""); if (/^[✓✔oO○]$/.test(sv)) checkMark(rg, cx, cy, 24, SK.good); else if (/^[✗✘xX×]$/.test(sv)) checkMark(rg, cx, cy, 20, SK.bad, true); else label(sv, cx, cy, size, k === 0 ? 800 : 700, on ? (SK.dark ? SK.bg : SK.ink) : SK.ink, rg, "middle", cw(k) - 24);
            x += cw(k); }); });
        break;
      }
    }
  }

  // ---------- the time axis (Design F): a dot stretches into the line, the line turns from blue to ink, then the head, the ticks and the labels ----------
  // (expoOut is the one declared with the other Design F eases further down)
  /** a label that types itself in, one character at a time, from the left edge it will finally have */
  function typeIn(str, x0, y, size, fill, k, parent) { const ch = Array.from(String(str)), n = Math.round(ch.length * clamp(k)); if (n > 0) text(ch.slice(0, n).join(""), x0, y + size * 0.36, size, 700, fill, "start", parent); }
  function drawAxis(o, p, t, world, op) {
    if (op <= 0.003) return;
    const s = t - o.tAdd, x = p.x, y = p.y, x2 = p.x2, L = Math.max(0, x2 - x), R0 = 20, g = G(world, { opacity: op.toFixed(3) });
    const ink = mixHex(SK.primary, SK.ink, expoOut(clamp((s - 0.05) / 0.3))), th = lerp(2 * R0, 9, expoOut(clamp(s / 0.22))), len = L * expoOut(clamp(s / 0.3));
    rr(g, x - th / 2, y - th / 2, len + th, th, th / 2, { fill: ink }); // at s = 0 this is the dot itself, then it stretches to the right
    const ah = 20 * expoOut(clamp((s - 0.3) / 0.3));
    if (ah > 0.5) el("path", { d: `M ${n1(x2 + ah * 1.6)} ${n1(y)} L ${n1(x2 - 2)} ${n1(y - ah)} L ${n1(x2 - 2)} ${n1(y + ah)} Z`, fill: ink, "stroke-linejoin": "round" }, g);
    const xs = Array.isArray(p.xs) ? p.xs : [], labels = Array.isArray(p.labels) ? p.labels : [], gap = xs.length > 1 ? xs[1] - xs[0] : 300;
    xs.forEach((cx, k) => { const tk = 18 * expoOut(clamp((s - 0.3 - 0.06 * k) / 0.25)); if (tk > 0.5) el("line", { x1: cx, y1: y + 2, x2: cx, y2: y + 2 + tk, stroke: ink, "stroke-width": 6, "stroke-linecap": "round" }, g); });
    labels.forEach((str, k) => {
      if (xs[k] == null) return;
      const size = Math.max(24, Math.min(p.size || 40, fitSize(String(str), gap - 24, 40, 700))), w = tw(String(str), size, 700);
      typeIn(str, xs[k] - w / 2, y + 60, size, SK.ink, expoOut(clamp((s - 0.45 - 0.3 * k) / 0.25)), g);
    });
    if (p.vname != null && typeof p.y2 === "number") { // the vertical axis grows up out of the left end and names itself beside its top
      const H2 = Math.max(0, y - p.y2), up = H2 * expoOut(clamp((s - 0.35) / 0.3));
      if (up > 0.5) rr(g, x - 4.5, y - up, 9, up, 4.5, { fill: ink });
      const vh = 20 * expoOut(clamp((s - 0.65) / 0.3));
      if (vh > 0.5) el("path", { d: `M ${n1(x)} ${n1(p.y2 - vh * 1.6)} L ${n1(x - vh)} ${n1(p.y2 + 2)} L ${n1(x + vh)} ${n1(p.y2 + 2)} Z`, fill: ink }, g);
      typeIn(p.vname, x + 30, p.y2 - 4, 40, SK.ink, expoOut(clamp((s - 0.7) / 0.25)), g);
    }
  }

  // a small thing that travels from one object to another
  function drawSend(s, t, world) {
    if (t < s.t0 || t > s.t0 + s.dur + 0.25) return;
    const A = anchorOf(M, s.from, t), B = anchorOf(M, s.to, t); if (!A || !B) return;
    const u = seg(t, s.t0, s.dur, E.smooth), dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy) || 1, arc = Math.min(120, L * 0.18), x = lerp(A.x, B.x, u) + (dy / L) * Math.sin(u * Math.PI) * arc, y = lerp(A.y, B.y, u) - Math.abs(dx / L) * Math.sin(u * Math.PI) * arc - Math.sin(u * Math.PI) * 20;
    const fade = clamp((t - s.t0) * 8) * (1 - seg(t, s.t0 + s.dur, 0.2, E.lin)), c = s.color ? col(s.color) : SK.primary, g = G(world, { opacity: fade.toFixed(3), transform: tf(x, y, lerp(0.7, 1, clamp(u * 4)) * (1 + 0.25 * hitPulse(t, s.t0 + s.dur, 0.05, 0.12))) });
    const size = 40, hasI = !!(s.icon && ICONS[s.icon]), sw = s.str ? tw(String(s.str), size, 800) : 0, w = (hasI ? 64 : 0) + sw + (hasI && s.str ? 10 : 0) + 44, h = 84;
    rr(g, x - w / 2, y - h / 2, w, h, h / 2, { fill: SK.card, stroke: c, "stroke-width": 5 });
    if (hasI) iconAt(g, s.icon, x - w / 2 + 22 + 32, y, 60, SK.ink, softOf(c));
    if (s.str) label(s.str, x + (hasI ? 37 : 0), y, size, 800, SK.ink, g);
    if (u >= 1) { const k = clamp((t - s.t0 - s.dur) / 0.25); el("circle", { cx: B.x, cy: B.y, r: (B.r || 70) + 40 * k, fill: "none", stroke: c, "stroke-width": 6, opacity: (0.7 * (1 - k)).toFixed(3) }, world); }
  }

  // ---------- the sentence: arrives word by word, leaves together; *word* is in the main colour ----------
  function sayWords(lines, t, tIn, tOut, o) {
    if (t < tIn || t >= tOut + 14 * F) return;
    const size = o.size, weight = 800, gap = 4, nL = lines.length, pitch = size * 1.18, baseY = o.y - (nL - 1) * pitch, sp = tw(" ", size, weight) || size * 0.26;
    const out = seg(t, tOut, 10 * F, E.exit), midY = baseY + ((nL - 1) * pitch) / 2 - size * 0.36, creep = 1 + Math.min(0.03, 0.008 * (t - tIn)), sg = G(null, { transform: tf(W / 2, midY, creep) });
    let n = 0;
    lines.forEach((ln, li) => {
      const words = ln.split(" "), ws = words.map((w) => tw(w, size, weight)), total = ws.reduce((a, b) => a + b, 0) + sp * (words.length - 1);
      let x = W / 2 - total / 2;
      words.forEach((w, j) => {
        const s = t - (tIn + n * gap * F); n++;
        if (s > 0) {
          const p = E.out(clamp(s / (26 * F))), a = clamp(s / (7 * F)) * (1 - out), bl = 9 * (1 - clamp(s / (15 * F))), yy = baseY + li * pitch + (1 - p) * size * 0.32 - out * size * 0.24;
          const hot = o.mark.some((mm) => mm[0] === li && mm[1] === j);
          if (hot && o.marker) rr(sg, x - 8, yy - size * 0.82, (ws[j] + 16) * clamp(s / (16 * F)), size * 1.02, 10, { fill: SK.accent, opacity: a.toFixed(3) });
          const e = text(w, x, yy, size, weight, hot && !o.marker ? SK.primary : SK.ink, "start", sg); e.setAttribute("opacity", a.toFixed(3));
          const f = blurF(bl * 0.4, bl, [x - 4, yy - size, ws[j] + 8, size * 1.35]); if (f) e.setAttribute("filter", f);
        }
        x += ws[j] + sp;
      });
    });
  }
  function drawSay(s, t) {
    const plain = s.text.replace(/\*/g, ""); let size = 76, lines = wrapWords(plain, 940, size, 800);
    if (lines.length > 2) { size = 64; lines = wrapWords(plain, 960, size, 800); }
    if (lines.length > 2) { size = 54; lines = wrapWords(plain, 980, size, 800).slice(0, 3); }
    size = Math.min(size, ...lines.map((l) => fitSize(l, 980, size, 800)));
    const lw = lines.map((l) => l.split(" ").length), mark = []; let li = 0, wi = 0, on = false;
    s.text.split(" ").forEach((w) => { if (wi >= lw[li]) { li++; wi = 0; } const starts = (w.match(/\*/g) || []).length; if (starts || on) mark.push([li, wi]); if (starts % 2 === 1) on = !on; wi++; });
    sayWords(lines, t, s.t0, s.t1, { y: 273 + size * 0.36 + ((lines.length - 1) * size * 1.18) / 2, size, mark, marker: SK.dark });
  }

  // ---------- a question for the viewer ----------
  const askRects = (n) => Array.from({ length: n }, (_, k) => ({ x: 80, y: ASK_Y + 110 + k * 152, w: W - 160, h: 128 }));
  // The buttons wear the app's quiz style: a white box with an ink border and a numbered square. askRects() and the hit test stay as they are,
  // because the player's own HTML buttons sit on those rectangles.
  function drawAsk(a, t) {
    if (t < a.t0 - 0.35 || t > a.t1 + 0.3) return;
    const inn = seg(t, a.t0 - 0.35, 0.4, E.out), outt = seg(t, a.t1, 0.3, E.exit), k0 = inn * (1 - outt), g = G(null, { opacity: k0.toFixed(3), transform: `translate(0 ${n1((1 - inn) * 80)})` });
    el("rect", { x: 0, y: ASK_Y - 80, width: W, height: 90, fill: `url(#${PID}askveil)` }, g); el("rect", { x: 0, y: ASK_Y, width: W, height: H - ASK_Y, fill: SK.bg }, g);
    const got = answers.get(a.n), revealed = t >= a.hold && (!interactive || got != null), chosen = got == null ? -1 : got, rects = askRects(a.ask.choices.length), tr = a.hold;
    if (!revealed) { label(interactive ? "하나를 눌러 보세요" : "잠깐, 먼저 생각해 보세요", W / 2, ASK_Y + 36, 40, 700, SK.sub, g); if (!interactive) { const k = 1 - clamp((t - a.t0) / Math.max(0.1, a.hold - a.t0)); rr(g, W / 2 - 200, ASK_Y + 78, 400, 8, 4, { fill: SK.line }); rr(g, W / 2 - 200, ASK_Y + 78, 400 * k, 8, 4, { fill: SK.primary }); } }
    else { // the verdict in its colour, then the reason in ink, on one line
      const right = chosen < 0 || chosen === a.ask.answer, head = chosen < 0 ? `정답은 ${a.ask.answer + 1}번` : right ? "정답이에요!" : "아깝다!", why = String(a.ask.why || "").trim();
      const q = G(g, { opacity: clamp((t - tr) * 5).toFixed(3) }), sp = why ? tw(" ", 1, 800) : 0, size = Math.max(26, Math.min(44, Math.floor((W - 120) / Math.max(1e-6, tw(head, 1, 800) + sp + (why ? tw(why, 1, 700) : 0)))));
      const hw = tw(head, size, 800), tot = hw + (why ? sp * size + tw(why, size, 700) : 0), x0 = W / 2 - tot / 2, y = ASK_Y + 52 + size * 0.36;
      text(head, x0, y, size, 800, right ? SK.primary : SK.bad, "start", q); if (why) text(why, x0 + hw + sp * size, y, size, 700, SK.ink, "start", q);
    }
    a.ask.choices.forEach((c, k) => {
      const r = rects[k], ap = expoOut(prog(t, a.t0 + 0.08 * k, 0.35)), isAns = k === a.ask.answer, isPick = k === chosen, rv = revealed ? clamp((t - tr) * 5) : 0, cy = r.y + r.h / 2;
      const shake = revealed && isPick && !isAns && t - tr < 0.32 ? Math.sin(((t - tr) / 0.32) * Math.PI * 2) * 16 : 0, bump = revealed && isAns ? 1 + 0.04 * hitPulse(t, tr, 0.07, 0.2) : 1; // the wrong pick shakes once
      const on = revealed && isAns, bad = revealed && isPick && !isAns;
      const fill = on ? mixHex(SK.card, SK.soft, rv) : SK.card, stroke = on ? mixHex(SK.ink, SK.good, rv) : bad ? mixHex(SK.ink, SK.bad, rv) : SK.ink, fg = on ? mixHex(SK.ink, SK.good, rv) : bad ? mixHex(SK.ink, SK.bad, rv) : SK.ink;
      const q = G(g, { opacity: (clamp(ap * 2) * (revealed && !isAns && !isPick ? lerp(1, 0.35, rv) : 1)).toFixed(3), transform: `translate(${n1(shake)} ${n1((1 - ap) * 40)}) ${tf(r.x + r.w / 2, cy, bump)}` });
      rr(q, r.x, r.y, r.w, r.h, 44, { fill, stroke, "stroke-width": 7 });
      const bs = 64, bx = r.x + 30; rr(q, bx, cy - bs / 2, bs, bs, 16, { fill: SK.line }); label(String(k + 1), bx + bs / 2, cy, 38, 800, SK.ink, q);
      const tx = bx + bs + 28, s = label(c, tx, cy, 52, 800, fg, q, "start", r.x + r.w - 96 - tx), cw = tw(String(c), s, 800);
      if (on && rv > 0.4) checkMark(q, r.x + r.w - 62, cy, 20, SK.good);
      if (bad) el("line", { x1: tx - 6, y1: cy, x2: tx - 6 + (cw + 12) * rv, y2: cy, stroke: SK.bad, "stroke-width": 6, "stroke-linecap": "round" }, q);
    });
  }

  // ---------- Design F: the hook, birth from a dot, the end card ----------
  // Ported from the Design F reel (f_engine.js): no overshoot anywhere, a blue dot that survives from one thing to the next,
  // smear on fast moves and a slow push-in so the frame is never still. All of it is a pure function of t like the rest of the frame.
  const CX = 540, HCY = 860, BEAT = 0.5, DOT_R = 20, HW = 900; // HW: the weight of the hook and the card titles (Wanted Sans goes to 1000)
  const prog = (t, a, d) => clamp((t - a) / Math.max(1e-6, d));
  const expoOut = (x) => (x >= 1 ? 1 : x <= 0 ? 0 : 1 - Math.pow(2, -10 * x));
  const expoIn = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : Math.pow(2, 10 * x - 10));
  const expoInOut = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2);
  /** a critically damped spring from 0 to 1 that starts at time a */
  const springC = (t, a, w = 14) => { const s = t - a; return s <= 0 ? 0 : 1 - (1 + w * s) * Math.exp(-w * s); };
  function clipR(x, y, w, h) { const id = PID + "c" + uid++, cp = el("clipPath", { id }, defs); el("rect", { x, y, width: Math.max(0.01, w), height: Math.max(0.01, h) }, cp); return `url(#${id})`; }
  /** the blue dot, smeared along its path while it is fast: a capsule from where it was a frame ago to where it is */
  function capsule(parent, a, b, r, op = 1) {
    if (r <= 0.3 || op <= 0.01) return;
    const e = el("line", { x1: a[0], y1: a[1], x2: b[0], y2: b[1] + 0.001, stroke: SK.primary, "stroke-width": 2 * r, "stroke-linecap": "round", opacity: op < 1 ? op.toFixed(3) : null }, parent);
    const f = blurF(Math.abs(b[0] - a[0]) * 0.25, Math.abs(b[1] - a[1]) * 0.25, [Math.min(a[0], b[0]) - r, Math.min(a[1], b[1]) - r, Math.abs(b[0] - a[0]) + 2 * r, Math.abs(b[1] - a[1]) + 2 * r]);
    if (f) e.setAttribute("filter", f);
  }
  const PLACED_F = new Set(["node", "box", "icon", "num", "bar", "text", "table", "plot", "scale", "dots"]);
  let HK = null, HOOKTO = null, BORN = new Map(), HERO = null, CARDL = null;
  /** where a thing is born and where things that come from it start: a circle, icon, box or number at its middle, a column at its foot, a chart at the corner of its axes */
  function seatOf(o, p) {
    if (o.type === "bar") return [Number(p.x) || 0, Number(p.y) || 0];
    if (o.type === "plot") { const mp = plotMap(p); return [mp.x0, mp.y1]; }
    if (o.type === "table") return [p.x || 540, p.y || 1100];
    if (["node", "icon", "box", "num", "scale", "dots"].includes(o.type) || (o.type === "text" && p.align !== "left")) return [Number(p.x) || 0, Number(p.y) || 0];
    const b = boxOf(M, o, p, o.tAdd); return b ? [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2] : [Number(p.x) || 540, Number(p.y) || 960];
  }
  function centreOf(o, t) { const p = stateOf(o, t); if (o.type === "bar" || o.type === "plot") { const b = boxOf(M, o, p, t); if (b) return [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2]; } return seatOf(o, p); }
  const objAt = (id, t) => { let r = null; for (const q of M.list) if (q.id === String(id) && q.tAdd <= t + 1e-6) r = q; return r; };

  // The hook: the title as kinetic type, one chunk per beat, the stack pushes up, older lines turn grey, a blue hand-drawn ? or ! whose dot survives
  const MARK = { "?": { qw: 90, ox: 52, len: 190, d: "M -40 -96 C -40 -142 40 -142 40 -96 C 40 -64 0 -62 0 -34" }, "!": { qw: 60, ox: 34, len: 96, d: "M 0 -142 L 0 -46" }, ".": { qw: 52, ox: 34, len: 0, d: "" } };
  function layoutHook() {
    HK = null;
    const ch = M.hook && M.hook.len ? M.hook.chunks.map(String).filter(Boolean) : [];
    if (!ch.length) return;
    const words = ch.slice(0, 4), last = words[words.length - 1], mm = last.match(/[?!？！.]+$/);
    let mark = ".";
    if (mm) { mark = /[?？]/.test(mm[0]) ? "?" : /[!！]/.test(mm[0]) ? "!" : "."; words[words.length - 1] = last.slice(0, mm.index).trim() || last; }
    const n = words.length, mk = MARK[mark];
    const w1 = words.map((w, i) => tw(w, 1, HW) + (i === n - 1 ? mk.qw / 168 : 0));
    const fit = Math.min(200, Math.floor(900 / Math.max(1e-6, ...w1))), size = 96 * Math.max(...w1) <= 1000 ? Math.max(96, fit) : fit; // the size of the widest line, not under 96 px unless one unbreakable word needs it
    const qk = size / 168, pitch = Math.round(size * 1.12), w = words.map((x) => tw(x, size, HW));
    const yc = words.map((_, i) => HCY - ((n - 1) * pitch) / 2 + i * pitch);
    const total = w[n - 1] + mk.qw * qk, textX = CX - total / 2;
    HK = { words, n, size, qk, pitch, w, yc, textX, mark, qx: textX + w[n - 1] + mk.ox * qk, qy: yc[n - 1] + 0.37 * size - 18 * qk, dotR: 18 * qk, lastT: (n - 1) * BEAT };
  }
  /** where the surviving dot goes: the axis of a TIME film, else the first thing scene 1 places; it arrives when that thing appears */
  function hookTarget() {
    const ax = M.objs.get("_axis");
    if (ax && ax.beat === 0) { const p = ax.keys[0].p; return { o: ax, x: Number(p.x) || 540, y: Number(p.y) || 960, t: ax.tAdd }; }
    let first = null;
    for (const o of M.list) if (o.beat === 0 && PLACED_F.has(o.type) && (!first || o.tAdd < first.tAdd - 1e-6)) first = o;
    // a scene that opens with a calculation and places its thing later: the dot does not wait seconds for it, it goes to where the calculation starts
    let lead = null;
    for (const o of M.list) if (o.beat === 0 && o.type === "calc" && (!lead || o.tAdd < lead.tAdd - 1e-6)) lead = o;
    if (lead && (!first || first.tAdd > lead.tAdd + 0.6)) { const b = boxOf(M, lead, lead.keys[0].p, lead.tAdd); if (b) return { o: lead, x: b.x0 + 24, y: (b.y0 + b.y1) / 2, t: lead.tAdd }; }
    if (first) { const s = seatOf(first, first.keys[0].p); return { o: first, x: s[0], y: s[1], t: first.tAdd }; }
    const b0 = M.beats[0]; return { o: null, x: 540, y: 1100, t: (b0 ? b0.t0 : M.hook.len) + 0.25 };
  }
  const hookShift = (t) => { let s = ((HK.n - 1) * HK.pitch) / 2; for (let k = 1; k < HK.n; k++) s -= (HK.pitch / 2) * expoOut(prog(t, k * BEAT, 0.22)); return s; };
  const hookPop = (x, t0) => lerp(1.6, 1, expoOut(prog(x, t0, 0.22)));
  function drawHook(t) {
    if (!HK) return;
    const K = HK, n = K.n, size = K.size, mk = MARK[K.mark], push = 1 + 0.02 * t, SH = hookShift(t);
    if (t < 2.0) {
      const g = G(null, { transform: `translate(${CX} ${HCY}) scale(${push.toFixed(5)}) translate(${-CX} ${-HCY}) translate(0 ${n1(SH)})` });
      const exit = expoIn(prog(t, 1.75, 0.2)); // the words fold shut
      for (let i = 0; i < n; i++) {
        const t0 = i * BEAT;
        if (t < t0) continue;
        const isLast = i === n - 1, yc = K.yc[i], base = yc + 0.37 * size, cxw = isLast ? K.textX + K.w[i] / 2 : CX;
        const sc = i === 0 ? 1 : hookPop(t, t0), vs = i === 0 ? 0 : (hookPop(t - 1 / 180, t0) - sc) * 180;
        const fill = mixHex(SK.ink, SK.grey, (isLast ? 0 : expoOut(prog(t, t0 + BEAT, 0.18))) * 0.9);
        const wg = G(g, { transform: `translate(${n1(cxw)} ${n1(yc)}) scale(${Math.max(0.0001, sc * (1 - exit)).toFixed(4)} ${sc.toFixed(4)}) translate(${n1(-cxw)} ${n1(-yc)})` });
        const f = blurF(Math.abs(vs) * 5 + (exit > 0 ? 60 * exit : 0), Math.abs(vs) * 3, [0, yc - size * 1.2, W, size * 2.4]);
        if (f) wg.setAttribute("filter", f);
        const tx = isLast ? K.textX : CX, anchor = isLast ? "start" : "middle";
        if (i === 0) { // the dot stretches into a bar and sweeps the first chunk open
          const reveal = expoOut(prog(t, 0, 0.32)), x0 = cxw - K.w[0] / 2 - 20, x1 = cxw + K.w[0] / 2 + 20;
          text(K.words[0], tx, base, size, HW, fill, anchor, wg).setAttribute("clip-path", clipR(x0, yc - size, (x1 - x0) * reveal, size * 2));
          const mv = expoOut(prog(t, 0, 0.18)), bx = lerp(CX - DOT_R, x0 + (x1 - x0) * reveal - 2 * DOT_R, mv), bw = lerp(2 * DOT_R, 2 * DOT_R + 30 * (1 - reveal), mv), shrink = 1 - expoIn(prog(t, 0.25, 0.15));
          if (shrink > 0.01 && t < 0.4) rr(g, bx, yc - DOT_R * shrink, bw, 2 * DOT_R * shrink, DOT_R * shrink, { fill: SK.primary });
        } else text(K.words[i], tx, base, size, HW, fill, anchor, wg);
        if (isLast && mk.d) { // the mark is drawn by hand in blue so that its dot can survive; with 3 chunks it is drawn on the fourth beat
          const qg = G(g, { transform: `translate(${n1(K.qx)} ${n1(K.qy)}) scale(${(K.qk * hookPop(t, t0)).toFixed(4)})` });
          const on = n === 4 ? 1 : expoOut(prog(t, 1.5, 0.2)), ret = expoIn(prog(t, 1.75, 0.14));
          if (ret < 1 && on > 0) el("path", { d: mk.d, fill: "none", stroke: SK.primary, "stroke-width": 24, "stroke-linecap": "round", "stroke-dasharray": `${n1(mk.len * on * (1 - ret))} 999`, "stroke-dashoffset": n1(-mk.len * (1 - on)) }, qg);
        }
      }
    }
    // the surviving dot waits, then travels to the first thing of scene 1 and arrives exactly when that thing appears
    const T = HOOKTO;
    if (!T || t < K.lastT || t > T.t + 0.14) return;
    const ts = Math.max(1.82, T.t - 0.3), c = camF(T.t), tx = 540 + (T.x - c.x) * c.zoom, ty = 960 + (T.y - c.y) * c.zoom;
    const at = (x) => { const pu = 1 + 0.02 * Math.min(x, ts), sh = hookShift(Math.min(x, 2)), u = expoInOut(prog(x, ts, T.t - ts)); return [lerp(CX + (K.qx - CX) * pu, tx, u), lerp(HCY + (K.qy + sh - HCY) * pu, ty, u), u]; };
    const p = at(t), q = at(t - F), beat4 = n === 4 || mk.d ? 1 : 1 + 0.6 * (t >= 1.5 ? 1 - expoOut(prog(t, 1.5, 0.3)) : 0); // 3 chunks and a full stop: the dot itself takes the fourth beat
    const r = lerp(K.dotR * hookPop(t, K.lastT) * (1 + 0.02 * Math.min(t, ts)) * beat4, DOT_R * c.zoom, p[2]);
    capsule(null, q, p, r, 1 - prog(t, T.t, 0.12));
  }

  // Birth: a placed thing is brought by a blue dot from the thing it comes from, and opens out of it. Worked out once per film.
  function prepBirth() {
    BORN = new Map();
    for (const o of M.list) {
      if (!PLACED_F.has(o.type)) continue;
      const p0 = o.keys[0].p, seat = seatOf(o, p0), b = boxOf(M, o, p0, o.tAdd), ext = b ? Math.max(b.x1 - b.x0, b.y1 - b.y0) : 200;
      const rec = { seat, s0: clamp((2 * DOT_R) / Math.max(1, ext), 0.03, 0.7), from: null, hook: !!(HK && HOOKTO && HOOKTO.o === o) };
      if (!rec.hook) {
        const t1 = o.tAdd - 0.18, ok = (q) => q && q !== o && PLACED_F.has(q.type) && q.tAdd < o.tAdd - 0.05 && q.tDel > t1;
        let src = null;
        for (const l of M.list) { // an arrow or line of the same scene that joins something to it: the dot comes along that arrow
          if ((l.type !== "arrow" && l.type !== "line") || l.beat !== o.beat || String(l.keys[0].p.to) !== o.id || l.keys[0].p.from == null) continue;
          const f = objAt(l.keys[0].p.from, o.tAdd); if (ok(f)) { src = f; break; }
        }
        if (!src) for (const q of M.list) if (ok(q) && q.beat < o.beat && (!src || q.beat > src.beat || (q.beat === src.beat && q.order > src.order))) src = q; // the newest thing of the scenes before
        if (!src) for (const q of M.list) if (ok(q) && q.beat === o.beat && (!src || q.order > src.order)) src = q; // else the newest thing of this scene
        if (src) rec.from = centreOf(src, t1);
      }
      BORN.set(o, rec);
    }
  }
  function drawBirth(t, world, keepOf) {
    for (const [o, r] of BORN) {
      if (r.hook || t < o.tAdd - 0.18 || t > o.tAdd + 0.12) continue;
      const k = keepOf(o); if (k <= 0.01) continue;
      const at = (x) => { if (!r.from) return r.seat; const u = expoInOut(prog(x, o.tAdd - 0.18, 0.18)); return [lerp(r.from[0], r.seat[0], u), lerp(r.from[1], r.seat[1], u)]; };
      const rad = DOT_R * expoOut(prog(t, o.tAdd - 0.18, r.from ? 0.06 : 0.18));
      capsule(world, at(t - F), at(t), rad, k * (1 - prog(t, o.tAdd, 0.12)));
    }
  }

  // Never still: inside a scene the world pushes in slowly (at most +1.5 %); the next scene takes it back over the camera's own move.
  function creepAt(t) {
    let i = -1; for (let k = 0; k < M.beats.length; k++) if (t >= M.beats[k].t0) i = k;
    if (i < 0) return 0;
    const b = M.beats[i], r = clamp((t - b.t0) / Math.max(0.1, b.dur));
    return clamp(r + (i > 0 ? 1 - E.cam(clamp((t - b.t0) / 1.0)) : 0));
  }
  /** the camera the frame is drawn with (and judged with at the edges): the scene's camera, the push-in, and at the end the dive towards the hero */
  function camF(t, noDive) {
    const c0 = camAt(M, t); let x = c0.x, y = c0.y, z = c0.zoom;
    const push = (PX, PY, k) => { x += ((PX - 540) * (k - 1)) / (z * k); y += ((PY - 960) * (k - 1)) / (z * k); z *= k; };
    push(540, 1175, 1 + 0.015 * creepAt(t));
    if (!noDive && HERO && t > M.end.t0) { const d = expoInOut(prog(t, M.end.t0, 0.5)); if (d > 0) push(HERO.scr[0], HERO.scr[1], lerp(1, 2.6, d)); }
    return { x, y, zoom: z };
  }
  /** the hero of the end card: the last placed thing the last scene adds or changes, else the last placed thing still on screen */
  function prepHero() {
    HERO = null;
    const lb = M.beats[M.beats.length - 1], tE = M.end.t0 - 0.02;
    if (!lb) return;
    let best = null, bt = -1;
    for (const o of M.list) {
      if (!PLACED_F.has(o.type) || !(o.tAdd <= tE && o.tDel > tE)) continue;
      const tt = Math.max(o.beat === lb.i ? o.tAdd : -1, ...o.keys.filter((k) => k.t >= lb.t0).map((k) => k.t));
      if (tt >= 0 && tt >= bt) { best = o; bt = tt; }
    }
    if (!best) for (const o of M.list) if (PLACED_F.has(o.type) && o.tAdd <= tE && o.tDel > tE && (!best || o.order > best.order)) best = o;
    const c = camF(M.end.t0, true);
    if (!best) { HERO = { o: null, scr: [540, 960] }; return; }
    const ce = centreOf(best, M.end.t0);
    HERO = { o: best, scr: [540 + (ce[0] - c.x) * c.zoom, 960 + (ce[1] - c.y) * c.zoom] };
  }
  /** the hero's body on screen at time t, with its corner radius: the colour of the card grows out of it */
  function heroBox(t, c) {
    const o = HERO && HERO.o, S = (x, y) => [540 + (x - c.x) * c.zoom, 960 + (y - c.y) * c.zoom];
    if (!o) { const p = S(540, 960); return { x0: p[0] - DOT_R, y0: p[1] - DOT_R, x1: p[0] + DOT_R, y1: p[1] + DOT_R, r: DOT_R }; }
    const p = stateOf(o, t);
    let bx, r = 16;
    if (o.type === "node") { const R = p.r || 80, hw = nodeHalf(p); bx = { x0: p.x - hw, y0: p.y - R, x1: p.x + hw, y1: p.y + R }; r = R; }
    else if (o.type === "box") { const w = p.w || 240, h = p.h || 120; bx = { x0: p.x - w / 2, y0: p.y - h / 2, x1: p.x + w / 2, y1: p.y + h / 2 }; r = SK.radius; }
    else if (o.type === "icon") { const s = (p.size || 160) * 0.42; bx = { x0: p.x - s, y0: p.y - s, x1: p.x + s, y1: p.y + s }; r = s; }
    else bx = boxOf(M, o, p, t) || { x0: p.x - DOT_R, y0: p.y - DOT_R, x1: p.x + DOT_R, y1: p.y + DOT_R };
    const a = S(bx.x0, bx.y0), b = S(bx.x1, bx.y1);
    return { x0: a[0], y0: a[1], x1: b[0], y1: b[1], r: r * c.zoom };
  }

  // The end card: big title (the first TERM) rising letter by letter in white, then the first sentence of END wiping in under it,
  // with the yellow highlight behind its key part. Without a term the sentence itself is the big text.
  function layoutCard() {
    CARDL = null;
    const sc = M.script || {}, given = sc.card, str = (v) => String(v == null ? "" : v).replace(/\*/g, "").replace(/\s+/g, " ").trim();
    let big = "", toks = [];
    const words = (s, hi) => str(s).split(" ").filter(Boolean).map((w) => ({ s: w, hi: !!hi, sp: true, nb: /^(수|것|때|뿐|줄|데|등|만큼)/.test(w) && w.length <= 3 })); // "알 수 있어요": a bound word never starts a line
    if (Array.isArray(given) && given.length) { big = str(given[0]); toks = words(given[1], true); if (toks.length > 1) toks = [{ s: toks.map((x) => x.s).join(" "), hi: true, sp: true }]; toks = toks.concat(words(given[2])); }
    else {
      const terms = sc.plan && Array.isArray(sc.plan.terms) ? sc.plan.terms : [];
      big = terms.length && terms[0] ? str(terms[0].t) : "";
      const end = str(sc.takeaway), m1 = end.match(/^(.+?[.?!。])(?=\s|$)/), first = m1 ? m1[1] : end;
      // the word that is the title gets the highlight; a Korean particle stuck to it (콜옵션은) stays outside the highlight
      let at = -1;
      if (big) for (let k = first.indexOf(big); k >= 0; k = first.indexOf(big, k + 1)) { const rest = first.slice(k + big.length).split(" ")[0].replace(/[.,?!]+$/, ""); if ((k === 0 || first[k - 1] === " ") && [...rest].length <= 2) { at = k; break; } }
      if (at < 0) toks = words(first);
      else { const tail = first.slice(at + big.length), glue = tail.split(" ")[0]; toks = words(first.slice(0, at)).concat([{ s: big, hi: true, sp: true }], glue ? [{ s: glue, hi: false, sp: false }] : [], words(tail.slice(glue.length))); }
    }
    if (!big && !toks.length) return;
    const wrap = (ts, size, wt, maxW) => { const out = []; let cur = [], cw = 0; const sp = tw(" ", size, wt); for (const tk of ts) { const w = tw(tk.s, size, wt), add = (cur.length && tk.sp ? sp : 0) + w; if (cur.length && tk.sp && !tk.nb && cw + add > maxW) { out.push(cur); cur = []; cw = 0; } const x = cw + (cur.length && tk.sp ? sp : 0); cur.push({ ...tk, x, w }); cw = x + w; } if (cur.length) out.push(cur); return out.map((ln) => ({ toks: ln, w: ln.length ? ln[ln.length - 1].x + ln[ln.length - 1].w : 0 })); };
    let bigL = null, subL = null;
    if (big) { // one line if it reads at 120 px or more, else two lines cut at a space
      let lines = [big], bw = tw(big, 1, HW), size = Math.min(200, Math.floor(920 / Math.max(1e-6, bw)));
      if (size < 120 && big.includes(" ")) { const ws = big.split(" "); let bestK = 1, bm = Infinity; for (let k = 1; k < ws.length; k++) { const m = Math.max(tw(ws.slice(0, k).join(" "), 1, HW), tw(ws.slice(k).join(" "), 1, HW)); if (m < bm) { bm = m; bestK = k; } } lines = [ws.slice(0, bestK).join(" "), ws.slice(bestK).join(" ")]; size = Math.min(200, Math.floor(920 / bm)); }
      size = Math.max(64, size);
      bigL = { lines, size, pitch: Math.round(size * 1.1) };
    }
    if (toks.length) {
      const asBig = !big, wt = asBig ? HW : 700;
      let size = asBig ? 104 : 66, lines = wrap(toks, size, wt, 920);
      while ((lines.length > 3 || lines.some((l) => l.w > 940)) && size > (asBig ? 56 : 42)) { size -= 4; lines = wrap(toks, size, wt, 920); }
      subL = { lines: lines.slice(0, 3), size, wt, pitch: Math.round(size * (asBig ? 1.18 : 1.42)), asBig };
    }
    // the block sits a little above the middle, as in Design F
    const hB = bigL ? (bigL.lines.length - 1) * bigL.pitch + bigL.size * 0.8 : 0, hS = subL ? (subL.lines.length - 1) * subL.pitch + subL.size * 0.8 : 0, gap = bigL && subL ? 96 : 0;
    const top = 900 - (hB + gap + hS) / 2;
    CARDL = { big: bigL, sub: subL, bigY: top + (bigL ? bigL.size * 0.8 : 0), subY: top + hB + gap + (subL ? subL.size * 0.8 : 0) };
  }
  function drawEnd(t) {
    if (t < M.end.t0) return;
    // a dark skin's main colour is light, so white letters would not read on it: its card takes a deeper shade
    const t0 = M.end.t0, d = expoInOut(prog(t, t0, 0.5)), c = camF(t), hb = heroBox(t, c), pad = 6;
    rr(null, lerp(hb.x0, -pad, d), lerp(hb.y0, -pad, d), lerp(hb.x1 - hb.x0, W + 2 * pad, d), lerp(hb.y1 - hb.y0, H + 2 * pad, d), lerp(hb.r, 0, d), { fill: SK.dark ? mixHex(SK.primary, SK.bg, 0.45) : SK.primary, opacity: clamp(prog(t, t0, 0.1)).toFixed(3) });
    if (!CARDL) return;
    const s = 1 + 0.025 * Math.max(0, t - t0 - 0.4), g = G(null, { transform: tf(540, 900, s) }); // the card keeps a slow push so it is never still
    const L = CARDL;
    let k = 0;
    const rise = (line, base, size, wt, t1, parent, fill) => { // letters rise one by one out of a slot
      const chars = [...line], lw = tw(line, size, wt), x0 = 540 - lw / 2, tg = G(parent, { "clip-path": clipR(0, base - size * 1.02, W, size * 1.2) });
      chars.forEach((ch, i) => { const p = expoOut(prog(t, t1 + k++ * 0.025, 0.24)); if (ch !== " " && p > 0) text(ch, x0 + tw(chars.slice(0, i).join(""), size, wt), base + lerp(size * 1.1, 0, p), size, wt, fill, "start", tg); });
    };
    if (L.big) L.big.lines.forEach((line, li) => rise(line, L.bigY + li * L.big.pitch, L.big.size, HW, t0 + 0.42 + li * 0.05, g, "#FFFFFF"));
    if (L.sub) {
      const S = L.sub, t1 = L.big ? t0 + 0.72 + 0.025 * Math.min(12, k) : t0 + 0.42;
      S.lines.forEach((ln, li) => {
        const y = L.subY + li * S.pitch, x0 = 540 - ln.w / 2, sp = expoOut(prog(t, t1 + li * 0.12, 0.3));
        if (sp <= 0) return;
        const lg = G(g, { "clip-path": clipR(x0 - 30, y - S.size * 1.2, (ln.w + 60) * sp, S.size * 1.7) }); // the line wipes in from the left
        const hit = 1 + 0.07 * (t >= t1 + 0.35 ? 1 - expoOut(prog(t, t1 + 0.35, 0.22)) : 0);
        ln.toks.forEach((tk, j) => {
          const tx = x0 + tk.x;
          if (tk.hi) { const pw = S.size * 0.24, pr = ln.toks[j + 1] && !ln.toks[j + 1].sp ? S.size * 0.04 : pw, hh = S.size * 1.29, rw = tk.w + pw + pr; rr(lg, tx - pw - (rw * (hit - 1)) / 2, y - S.size * 0.95 - (hh * (hit - 1)) / 2, rw * hit, hh * hit, 10, { fill: SK.accent }); }
          text(tk.s, tx, y, S.size, S.wt, tk.hi ? (SK.dark ? SK.bg : SK.ink) : "#FFFFFF", "start", lg);
        });
      });
    }
  }

  // ---------- the edges of the frame ----------
  // The top of the stage belongs to the sentence and the bottom to the floor (during a question, to the buttons): the picture fades out there.
  // A thing left half under such a fade reads as a mistake, so a thing is drawn whole or not at all. When less than about half of it is clear
  // of the fades the whole thing steps out, smoothly, so a moving camera does not make it pop.
  const EDGE_TOP = 556, EDGE_BOT = 1796;
  /** the lower edge of the clear part of the stage at time t: a question's buttons take the lower part while they are up */
  function clearBottom(t) {
    let y = EDGE_BOT;
    for (const a of M.asks) { if (t < a.t0 - 0.35 || t > a.t1 + 0.3) continue; const k = seg(t, a.t0 - 0.35, 0.4, E.out) * (1 - seg(t, a.t1, 0.3, E.exit)); y = Math.min(y, lerp(EDGE_BOT, ASK_Y - 80, k)); }
    return y;
  }
  /** how much of its own strength a thing keeps at the edges: 1 when most of it is clear of the fades, 0 when most of it is under one */
  function edgeKeep(o, t, cam, bot, memo) {
    if (memo.has(o)) return memo.get(o);
    memo.set(o, 1); // a thing that points at itself is left alone
    let k = 1;
    const p = stateOf(o, t);
    if (o.type === "arrow" || o.type === "line" || o.type === "brace") { // a link stays while either of its ends stays
      const ends = [p.from, p.to].concat(Array.isArray(p.between) ? p.between : []).filter((x) => x != null).map((x) => M.objs.get(String(x))).filter((x) => x && alive(x, t));
      if (ends.length) k = Math.max(...ends.map((e) => edgeKeep(e, t, cam, bot, memo)));
    } else {
      const b = o.type === "note" ? noteBox(M, p, t) : boxOf(M, o, p, t);
      if (b) {
        const y0 = 960 + (b.y0 - cam.y) * cam.zoom, y1 = 960 + (b.y1 - cam.y) * cam.zoom;
        const clear = (Math.min(y1, bot) - Math.max(y0, EDGE_TOP)) / Math.max(1, y1 - y0);
        k = clamp((clear - 0.4) / 0.15);
      }
      const hostId = o.type === "note" ? p.to : o.type === "dot" ? p.plot : null; // a tag leaves with its thing, a point with its chart
      if (k > 0 && hostId != null) { const host = M.objs.get(String(hostId)); if (host && host !== o && alive(host, t)) k = Math.min(k, edgeKeep(host, t, cam, bot, memo)); }
    }
    memo.set(o, k);
    return k;
  }

  // ---------- frame ----------
  // One thing that cannot be drawn must not take the film with it: the rest of the frame still draws, and the player's clock
  // keeps running so the viewer still reaches the end screen and its questions.
  let warned = false;
  const skipped = (e) => { if (!warned) { warned = true; console.warn("[film] skipped something that could not be drawn:", e); } };
  const safe = (fn) => { try { fn(); } catch (e) { skipped(e); } };
  function seek(tPublic) { try { frame(tPublic); } catch (e) { skipped(e); } }
  function frame(tPublic) {
    if (!M) return;
    const t = clamp(tPublic * M.speed, 0, M.DUR - 1e-4);
    while (layer.firstChild) layer.removeChild(layer.firstChild);
    while (defs.firstChild) defs.removeChild(defs.firstChild);
    uid = 0;
    el("rect", { x: 0, y: 0, width: W, height: H, fill: SK.bg });
    if (SK.deco !== "none") el("rect", { x: 0, y: 0, width: W, height: H, fill: `url(#${PID}deco)` });
    const c = camF(t), world = G(null, { transform: `translate(540 960) scale(${c.zoom.toFixed(4)}) translate(${(-c.x).toFixed(1)} ${(-c.y).toFixed(1)})` });
    // focus: while a scene points at some objects, the rest step back
    let fIds = null, fk = 0;
    let fI = -1;
    for (const f of M.focus) if (t >= f.t0 - 0.05 && t < f.t1 + 0.3) { fIds = f.ids; fI = f.i; fk = Math.min(seg(t, f.t0, 0.3, E.out), 1 - seg(t, f.t1, 0.3, E.out)); }
    const dimOf = (o) => { if (!fIds || fk <= 0) return 1; if (fIds.has(o.id) || o.beat === fI) return 1; const p = o.keys[0].p; if ((o.type === "arrow" || o.type === "line" || o.type === "brace") && p.from != null && p.to != null && fIds.has(String(p.from)) && fIds.has(String(p.to))) return 1; if (o.type === "note" && fIds.has(String(p.to))) return 1; if (o.type === "dot" && fIds.has(String(p.plot))) return 1; return lerp(1, 0.3, fk); };
    const order = (o) => (o.type === "arrow" || o.type === "line" ? 0 : o.type === "note" || o.type === "calc" || o.type === "sign" || o.type === "dot" || o.type === "brace" ? 2 : 1);
    const bot = clearBottom(t), kept = new Map(), covered = t > M.end.t0 + 0.5; // once the end card covers the screen the world is not drawn
    if (!covered) {
      M.list.slice().sort((a, b) => order(a) - order(b) || a.order - b.order).forEach((o) => safe(() => { if (t < o.tAdd || t > o.tDel + 0.35) return; drawObj(o, t, world, dimOf(o) * edgeKeep(o, t, c, bot, kept)); }));
      safe(() => drawBirth(t, world, (o) => dimOf(o) * edgeKeep(o, t, c, bot, kept)));
      M.sends.forEach((s) => safe(() => drawSend(s, t, world)));
    }
    el("rect", { x: 0, y: 0, width: W, height: 556, fill: `url(#${PID}veil)` });
    el("rect", { x: 0, y: 1796, width: W, height: H - 1796, fill: `url(#${PID}floor)` }); // a picture taller than the frame fades out at the bottom edge
    safe(() => drawHook(t));
    M.says.forEach((s) => safe(() => drawSay(s, t)));
    M.asks.forEach((a) => safe(() => drawAsk(a, t)));
    safe(() => drawEnd(t));
    if (brand) { const g = G(null, { opacity: 0.55 }); label(brand, W / 2, H - 56, 34, 800, t > M.end.t0 + 0.3 ? "#FFFFFF" : SK.sub, g); }
  }

  async function load(script, o = {}) {
    if (o.skin || script.skin) SK = skinOf(o.skin || script.skin);
    if (o.fancy != null) fancy = !!o.fancy; if (o.brand != null) brand = o.brand; if (o.interactive != null) interactive = !!o.interactive;
    FONT = SK.font; mcache.clear(); answers.clear();
    M = prep(script, { speed: o.speed, hook: o.hook });
    while (sdefs.firstChild) sdefs.removeChild(sdefs.firstChild);
    gradDef("veil", [[0, SK.bg, 1], [0.84, SK.bg, 1], [1, SK.bg, 0]]);
    gradDef("floor", [[0, SK.bg, 0], [0.75, SK.bg, 1], [1, SK.bg, 1]]);
    gradDef("askveil", [[0, SK.bg, 0], [1, SK.bg, 1]]);
    if (SK.deco === "dots") { const pt = el("pattern", { id: PID + "deco", width: 54, height: 54, patternUnits: "userSpaceOnUse" }, sdefs); el("circle", { cx: 27, cy: 27, r: 3, fill: SK.line }, pt); }
    if (SK.deco === "grid") { const pt = el("pattern", { id: PID + "deco", width: 60, height: 60, patternUnits: "userSpaceOnUse" }, sdefs); el("path", { d: "M 60 0 L 0 0 0 60", fill: "none", stroke: SK.line, "stroke-width": 2 }, pt); }
    if (SK.deco === "glow") { const rg = el("radialGradient", { id: PID + "deco", cx: 0.5, cy: 0.56, r: 0.62 }, sdefs); el("stop", { offset: 0, "stop-color": mixHex(SK.bg, SK.primary, 0.2) }, rg); el("stop", { offset: 1, "stop-color": SK.bg }, rg); }
    try { const sample = JSON.stringify(script) + " 0123456789,.%+-=×÷()−≈"; await Promise.all([700, 800, HW].map((w) => document.fonts.load(`${w} 100px 'Wanted Sans Variable'`, sample).catch(() => null))); await document.fonts.ready; } catch (e) { /* fonts are a nicety */ }
    mcache.clear();
    // Design F's parts are measured once the fonts are in; each may fail alone without taking the film with it
    HK = null; HOOKTO = null; BORN = new Map(); HERO = null; CARDL = null;
    safe(layoutHook); safe(() => { HOOKTO = HK ? hookTarget() : null; }); safe(prepBirth); safe(prepHero); safe(layoutCard);
    seek(0);
    return info();
  }
  const info = () => ({ dur: M.dur, DUR: M.dur, speed: M.speed, skin: SK.id, beats: M.beats.map((b) => ({ t0: b.t0 / M.speed, dur: b.dur / M.speed, say: b.b.say || (b.b.ask && b.b.ask.q) || "" })), T: [0, ...M.beats.map((b) => b.t0 / M.speed), M.end.t0 / M.speed, M.dur], hook: { t0: M.hook.t0 / M.speed, len: M.hook.len / M.speed }, end: { t0: M.end.t0 / M.speed }, asks: M.asks.map((a) => ({ n: a.n, beat: a.i, t0: a.t0 / M.speed, hold: a.hold / M.speed, t1: a.t1 / M.speed, answer: a.ask.answer, choices: a.ask.choices })), warn: M.warn });
  /** which question (if any) is waiting for an answer at time t */
  function pendingAsk(tPublic) { if (!M || !interactive) return null; const t = tPublic * M.speed; for (const a of M.asks) if (answers.get(a.n) == null && t >= a.t0 && t <= a.t1) return { n: a.n, hold: a.hold / M.speed, rects: askRects(a.ask.choices.length) }; return null; }
  /** a tap at stage coordinates: returns the choice index if it hit an answer button of the waiting question */
  function hitAsk(tPublic, x, y) { const p = pendingAsk(tPublic); if (!p) return null; const k = p.rects.findIndex((r) => x >= r.x && x <= r.x + r.w && y >= r.y - 10 && y <= r.y + r.h + 10); return k < 0 ? null : { n: p.n, choice: k }; }
  function answer(n, choice) { answers.set(n, choice); const a = M.asks[n]; return a ? { correct: a.ask.answer === choice, resume: a.hold / M.speed } : null; }
  /** the soundtrack for this script in this skin, in the format audio.ts plays */
  function score() {
    const sp = M.speed, au = SK.audio, DURp = M.dur, bpm = au.bpm * sp, barLen = 240 / bpm, bars = Math.max(1, Math.ceil((DURp - 1.4) / barLen)), prog = [1, 6, 4, 5];
    const tk = (c) => { const q = Object.assign({}, c); for (const k of ["t", "t0", "t1", "tp"]) if (q[k] != null) q[k] = q[k] / sp; return q; };
    return { bpm, root: au.root, mode: au.mode, style: { lead: au.lead, drums: au.drums, arpV: 0.7 }, t0: 0.3 / sp, bars: Array.from({ length: bars }, (_, i) => [prog[i % 4], i < 1 ? 1 : 2, i === bars - 1 ? "thin" : ""]), cues: M.cues.map(tk), end: { t: Math.max(0.2, DURp - 1.2), deg: 1 }, master: 1.25 };
  }
  return { load, seek, info, pendingAsk, hitAsk, answer, score, get model() { return M; }, get skin() { return SK; }, setInteractive(v) { interactive = !!v; } };
}
