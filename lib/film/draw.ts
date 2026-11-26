// @ts-nocheck
// Director 2 drawing: draws one frame of a prepared scene script into an <svg>. seek(t) is a pure function of t
// (and of the answers given to questions), so frames can be drawn in any order, live or for a video file.
import { W, H, ASK_Y, prep, stateOf, alive, camAt, anchorOf, boxOf, normTerms, plotMap, lineY, tableDims, dotPos, fmtV, approxW, calcSize, noteBox, dotsDims, signAt, nodeHalf, lineEnds } from "./core";
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
    const p = stateOf(o, t), ap = spring(t, o.tAdd, 260, 16, 0.7), out = 1 - seg(t, o.tDel, 0.3, E.exit);
    const op = clamp(ap * 2) * out * (p.opacity == null ? 1 : p.opacity) * dim;
    if (op <= 0.003) return;
    const pl = o.pulses.reduce((mx, tp) => Math.max(mx, hitPulse(t, tp, 0.08, 0.25)), 0), sc = lerp(0.6, 1, ap) * (1 + 0.12 * pl);
    const c = colP(p), g = G(world, { opacity: op.toFixed(3) });
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
        if (v != null && v !== "") { if (p.value != null) number(String(v), p.x, p.y, p.size || r * 0.62, 800, fg, q, fitW); else label(v, p.x, p.y, p.size || r * 0.62, 800, fg, q, "middle", fitW); }
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
        const w = p.w || 120, hv = p.scale != null && p.value != null ? p.value * p.scale : p.h || 0, h = Math.abs(hv) * clamp(ap), neg = hv < 0, q = G(g), cc = neg && !p.color ? SK.bad : c;
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
        if (p.str) { const off = p.loff != null ? Number(p.loff) : bend < 0 ? -50 : 50, at = bend || p.lpos == null ? 0.5 : Number(p.lpos), tx = a[0] + (b[0] - a[0]) * at - uy * (bend * 0.5 + off), ty = a[1] + (b[1] - a[1]) * at + ux * (bend * 0.5 + off); const q = G(g, { opacity: clamp((dp - 0.5) * 3).toFixed(3) }); chip(q, p.str, tx, ty, 40, c); }
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
            if (isRes) { const a2 = spring(t, t0 + 0.12, 300, 14, 0.7), hw = ws[k] / 2 + 14; rr(g, cx - hw, p.y + s * 0.18, hw * 2 * clamp(a2 * 1.4), s * 0.34, 6, { fill: SK.accent, opacity: clamp((t - t0 - 0.12) * 6) }); const gq = G(g, { transform: tf(cx, p.y, lerp(0.5, 1, a2)), opacity: clamp(a2 * 2).toFixed(3) }); label(q.text, cx, p.y, s, 800, tc, gq); }
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
        const q = G(g, { transform: tf(x, y, sc) }), nc = p.color ? c : SK.primary;
        if (!p.push && !p.slide) el("line", { x1: tip[0], y1: tip[1], x2: x, y2: y, stroke: nc, "stroke-width": 5, "stroke-linecap": "round" }, q); // a tag stacked on another tag needs no stem
        rr(q, x - cw / 2, y - ch / 2, cw, ch, ch / 2, { fill: SK.card, stroke: nc, "stroke-width": 4 }); label(p.str, x, y, size, 800, nc, q, "middle", cw - size * 0.7);
        break;
      }
      case "sign": {
        let x = p.x, y = p.y;
        if (Array.isArray(p.between)) { const c2 = signAt(M, p, t); if (!c2) return; x = c2[0]; y = c2[1]; }
        const q = G(g, { transform: tf(x, y, sc) }); label(p.str || "=", x, y, p.size || 96, 800, p.color ? c : SK.primary, q);
        break;
      }
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
          const a2 = spring(t, o.tAdd + (k / d.n) * 0.5, 320, 18, 0.7); if (a2 <= 0.01) continue;
          el("circle", { cx: x0 + (k % d.cols) * d.pitch + d.d / 2, cy: y0 + Math.floor(k / d.cols) * d.pitch + d.d / 2, r: (d.d / 2) * clamp(a2, 0, 1.15), fill: k < hi ? c1 : k < hi + hi2 ? c2 : SK.line }, q);
        }
        if (p.cap) label(p.cap, p.x, y0 + d.h + 44, 42, 700, SK.sub, q, "middle", 900, true);
        break;
      }
      case "table": {
        const d = tableDims(p), q = G(g, { transform: tf(p.x || 540, p.y || 1100, lerp(0.92, 1, ap)) }), size = p.size || 52, wsum = Array.isArray(p.colW) && p.colW.length === d.cols ? p.colW.reduce((a, b) => a + b, 0) : d.cols, cw = (k) => (Array.isArray(p.colW) && p.colW.length === d.cols ? p.colW[k] : 1) * d.w / wsum;
        const show = p.show == null ? d.nrows : p.show, hi = Array.isArray(p.hi) ? p.hi : [];
        rr(q, d.x0, d.y0, d.w, d.rowH * (d.head + Math.min(d.nrows, Math.ceil(show))), SK.radius, { fill: SK.card, stroke: SK.line, "stroke-width": 4 });
        if (d.head) { rr(q, d.x0, d.y0, d.w, d.rowH, SK.radius, { fill: SK.soft }); let x = d.x0; (p.cols || []).forEach((cell, k) => { label(cell, x + cw(k) / 2, d.y0 + d.rowH / 2, size * 0.85, 800, SK.dark ? SK.ink : SK.primary, q, "middle", cw(k) - 20); x += cw(k); }); }
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
  function drawAsk(a, t) {
    if (t < a.t0 - 0.35 || t > a.t1 + 0.3) return;
    const inn = seg(t, a.t0 - 0.35, 0.4, E.out), outt = seg(t, a.t1, 0.3, E.exit), k0 = inn * (1 - outt), g = G(null, { opacity: k0.toFixed(3), transform: `translate(0 ${n1((1 - inn) * 80)})` });
    el("rect", { x: 0, y: ASK_Y - 80, width: W, height: 90, fill: `url(#${PID}askveil)` }, g); el("rect", { x: 0, y: ASK_Y, width: W, height: H - ASK_Y, fill: SK.bg }, g);
    const got = answers.get(a.n), revealed = t >= a.hold && (!interactive || got != null), chosen = got == null ? -1 : got, rects = askRects(a.ask.choices.length), tr = a.hold;
    if (!revealed) { label(interactive ? "하나를 눌러 보세요" : "잠깐, 먼저 생각해 보세요", W / 2, ASK_Y + 36, 40, 700, SK.sub, g); if (!interactive) { const k = 1 - clamp((t - a.t0) / Math.max(0.1, a.hold - a.t0)); rr(g, W / 2 - 200, ASK_Y + 78, 400, 8, 4, { fill: SK.line }); rr(g, W / 2 - 200, ASK_Y + 78, 400 * k, 8, 4, { fill: SK.primary }); } }
    else { const right = chosen < 0 || chosen === a.ask.answer, msg = (chosen < 0 ? "" : right ? "정답! " : "아쉬워요. ") + (a.ask.why || ""); const q = G(g, { opacity: clamp((t - tr) * 5).toFixed(3) }); label(msg || (right ? "정답!" : "정답은 이것"), W / 2, ASK_Y + 52, 44, 800, right ? SK.good : SK.bad, q, "middle", W - 120); }
    a.ask.choices.forEach((c, k) => {
      const r = rects[k], ap = spring(t, a.t0 + 0.12 * k, 260, 18, 0.7), isAns = k === a.ask.answer, isPick = k === chosen, rv = revealed ? clamp((t - tr) * 5) : 0;
      const shake = revealed && isPick && !isAns ? Math.sin((t - tr) * 46) * 14 * Math.exp(-(t - tr) * 7) : 0, bump = revealed && isAns ? 1 + 0.05 * hitPulse(t, tr, 0.07, 0.2) : 1;
      const fill = revealed && isAns ? mixHex(SK.card, SK.good, rv) : revealed && isPick ? mixHex(SK.card, SK.bad, rv) : SK.card, fg = revealed && (isAns || isPick) ? mixHex(SK.ink, "#FFFFFF", rv) : SK.ink;
      const q = G(g, { opacity: (clamp(ap * 2) * (revealed && !isAns && !isPick ? lerp(1, 0.35, rv) : 1)).toFixed(3), transform: `translate(${n1(shake)} ${n1((1 - ap) * 40)}) ${tf(r.x + r.w / 2, r.y + r.h / 2, bump)}` });
      rr(q, r.x, r.y, r.w, r.h, 40, { fill, stroke: revealed && (isAns || isPick) ? "none" : SK.ink, "stroke-width": 5 });
      label(c, r.x + r.w / 2, r.y + r.h / 2, 52, 800, fg, q, "middle", r.w - 150);
      if (revealed && isAns && rv > 0.5) checkMark(q, r.x + r.w - 70, r.y + r.h / 2, 20, "#FFFFFF"); else if (revealed && isPick && !isAns && rv > 0.5) checkMark(q, r.x + r.w - 70, r.y + r.h / 2, 16, "#FFFFFF", true);
    });
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
    const c = camAt(M, t), world = G(null, { transform: `translate(540 960) scale(${c.zoom.toFixed(4)}) translate(${(-c.x).toFixed(1)} ${(-c.y).toFixed(1)})` });
    // focus: while a scene points at some objects, the rest step back
    let fIds = null, fk = 0;
    let fI = -1;
    for (const f of M.focus) if (t >= f.t0 - 0.05 && t < f.t1 + 0.3) { fIds = f.ids; fI = f.i; fk = Math.min(seg(t, f.t0, 0.3, E.out), 1 - seg(t, f.t1, 0.3, E.out)); }
    const dimOf = (o) => { if (!fIds || fk <= 0) return 1; if (fIds.has(o.id) || o.beat === fI) return 1; const p = o.keys[0].p; if ((o.type === "arrow" || o.type === "line" || o.type === "brace") && p.from != null && p.to != null && fIds.has(String(p.from)) && fIds.has(String(p.to))) return 1; if (o.type === "note" && fIds.has(String(p.to))) return 1; if (o.type === "dot" && fIds.has(String(p.plot))) return 1; return lerp(1, 0.3, fk); };
    const order = (o) => (o.type === "arrow" || o.type === "line" ? 0 : o.type === "note" || o.type === "calc" || o.type === "sign" || o.type === "dot" || o.type === "brace" ? 2 : 1);
    const bot = clearBottom(t), kept = new Map();
    M.list.slice().sort((a, b) => order(a) - order(b) || a.order - b.order).forEach((o) => safe(() => { if (t < o.tAdd || t > o.tDel + 0.35) return; drawObj(o, t, world, dimOf(o) * edgeKeep(o, t, c, bot, kept)); }));
    M.sends.forEach((s) => safe(() => drawSend(s, t, world)));
    el("rect", { x: 0, y: 0, width: W, height: 556, fill: `url(#${PID}veil)` });
    el("rect", { x: 0, y: 1796, width: W, height: H - 1796, fill: `url(#${PID}floor)` }); // a picture taller than the frame fades out at the bottom edge
    M.says.forEach((s) => safe(() => drawSay(s, t)));
    M.asks.forEach((a) => safe(() => drawAsk(a, t)));
    if (brand) { const g = G(null, { opacity: 0.55 }); label(brand, W / 2, H - 56, 34, 800, SK.sub, g); }
  }

  async function load(script, o = {}) {
    if (o.skin || script.skin) SK = skinOf(o.skin || script.skin);
    if (o.fancy != null) fancy = !!o.fancy; if (o.brand != null) brand = o.brand; if (o.interactive != null) interactive = !!o.interactive;
    FONT = SK.font; mcache.clear(); answers.clear();
    M = prep(script, { speed: o.speed });
    while (sdefs.firstChild) sdefs.removeChild(sdefs.firstChild);
    gradDef("veil", [[0, SK.bg, 1], [0.84, SK.bg, 1], [1, SK.bg, 0]]);
    gradDef("floor", [[0, SK.bg, 0], [0.75, SK.bg, 1], [1, SK.bg, 1]]);
    gradDef("askveil", [[0, SK.bg, 0], [1, SK.bg, 1]]);
    if (SK.deco === "dots") { const pt = el("pattern", { id: PID + "deco", width: 54, height: 54, patternUnits: "userSpaceOnUse" }, sdefs); el("circle", { cx: 27, cy: 27, r: 3, fill: SK.line }, pt); }
    if (SK.deco === "grid") { const pt = el("pattern", { id: PID + "deco", width: 60, height: 60, patternUnits: "userSpaceOnUse" }, sdefs); el("path", { d: "M 60 0 L 0 0 0 60", fill: "none", stroke: SK.line, "stroke-width": 2 }, pt); }
    if (SK.deco === "glow") { const rg = el("radialGradient", { id: PID + "deco", cx: 0.5, cy: 0.56, r: 0.62 }, sdefs); el("stop", { offset: 0, "stop-color": mixHex(SK.bg, SK.primary, 0.2) }, rg); el("stop", { offset: 1, "stop-color": SK.bg }, rg); }
    try { const sample = JSON.stringify(script) + " 0123456789,.%+-=×÷()−≈"; await Promise.all([700, 800].map((w) => document.fonts.load(`${w} 100px 'Wanted Sans Variable'`, sample).catch(() => null))); await document.fonts.ready; } catch (e) { /* fonts are a nicety */ }
    mcache.clear();
    seek(0);
    return info();
  }
  const info = () => ({ dur: M.dur, DUR: M.dur, speed: M.speed, skin: SK.id, beats: M.beats.map((b) => ({ t0: b.t0 / M.speed, dur: b.dur / M.speed, say: b.b.say || (b.b.ask && b.b.ask.q) || "" })), T: [0, ...M.beats.map((b) => b.t0 / M.speed), M.dur], asks: M.asks.map((a) => ({ n: a.n, beat: a.i, t0: a.t0 / M.speed, hold: a.hold / M.speed, t1: a.t1 / M.speed, answer: a.ask.answer, choices: a.ask.choices })), warn: M.warn });
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
