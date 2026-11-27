// Style A engine: timeline, scene-to-scene carrier transitions, camera, soundtrack plan.
const PRE = 0.2, TD = 0.5, FULL = { x: -40, y: -40, w: W + 80, h: H + 80, r: 0 };
const COLOR_OK = { narrow: 1, exchange: 1, balance: 1, slots: 1, hook: 1, define: 1, number: 1, end: 1, formula: 1, cycle: 1, scale: 1, chat: 1 };
let SC = [], T = [], DUR = 0, TR = [], SPEC = null;

function plan(spec) {
  SPEC = spec; ENV = makeLook(spec); twCache.clear();
  const sc = spec.scenes.filter(s => TYPES[s.type]), n = sc.length, seed = ENV.seed;
  sc.forEach(s => { if (s.value != null) s.value = Number(String(s.value).replace(/[^0-9.\-]/g, '')) || 0; (s.items || []).forEach(i => { if (i && i.value != null) i.value = Number(i.value) || 0; }); if (s.type === 'hook' || s.type === 'define' || s.type === 'end' || s.type === 'number') delete s.say; });
  // background per scene: paper by default, colour floods on scenes that can carry it
  const bg = []; const dark0 = rnd(seed + 'bg0') < 0.2;
  sc.forEach((s, i) => {
    if (['paper', 'a1', 'ink'].includes(s.bg)) return bg.push(s.bg);
    if (i === 0) return bg.push(dark0 ? 'ink' : 'paper');
    const prev = bg[i - 1], r = rnd(seed + 'bg' + i);
    if (prev !== 'paper') return bg.push(r < 0.75 ? 'paper' : prev);
    bg.push(COLOR_OK[s.type] && r < (s.type === 'end' || s.type === 'define' ? 0.7 : 0.4) ? (rnd(seed + 'bc' + i) < 0.6 ? 'a1' : 'ink') : 'paper');
  });
  TR = sc.map((s, i) => { const j = (i + 1) % n; const kind = j === 0 ? (bg[i] === bg[j] ? 'morph' : 'collapse') : bg[i] === bg[j] ? pickOf(['morph', 'morph', 'push', 'split', 'morph'], seed + 'tk' + i) : pickOf(['flood', 'bar', 'iris', 'collapse', 'zoom', 'push', 'split', 'barv', 'zoom', 'split', 'push', 'collapse'], seed + 'tk' + i); return { kind, exit: pickOf(['absorb', 'up', 'left', 'right', 'absorb', 'down'], seed + 'ex' + i) }; });
  SC = sc.map((s, i) => { const th = ENV.theme(bg[i]); ENV.strokeCol = strokeOf(th); const b = TYPES[s.type](s, th, 's' + i + s.type, { in: i === 0 ? 'self' : (TR[i - 1].kind !== 'morph' && TR[i - 1].kind !== 'collapse' ? 'self' : 'carrier') }); return Object.assign(b, { th, type: s.type, d: s }); });
  PACE = clamp(Number(spec.pace ?? 1.3), 1, 2); RB = BEAT * PACE;
  const SKIP = { type: 1, icon: 1, who: 1, from: 1, shape: 1, to: 1, dir: 1, bg: 1, side: 1, winner: 1 }, chars = o => typeof o === 'string' ? o.length : Array.isArray(o) ? o.reduce((t, v) => t + chars(v), 0) : o && typeof o === 'object' ? Object.keys(o).reduce((t, k) => t + (SKIP[k] ? 0 : chars(o[k])), 0) : 0;
  T = [0]; SC.forEach(s => { const read = chars(s.d) / 11 + 1.0, hold = Math.max(0, Math.ceil((read - s.beats * RB) / RB)) + (s.type === 'hook' ? 0 : 1); s.total = s.beats + Math.min(hold, 6); T.push(T[T.length - 1] + s.total * RB); }); DUR = T[n];
  return { DUR, T, look: { palette: ENV.pname, font: ENV.fname, shape: ENV.shape, style: ENV.look, type: ENV.kin, align: ENV.align, camera: ENV.cam }, bg, tr: TR.map(t => t.kind) };
}
const strokeOf = th => ENV.look === 'line' ? th.fg : (lum(th.bg) > 0.35 ? ENV.dark : mix(th.bg, '#000000', 0.5));
function allText(o, out = []) { if (typeof o === 'string') out.push(o); else if (o && typeof o === 'object') for (const k in o) allText(o[k], out); return out; }

function drawScene(i, lt, st, parent) { const s = SC[i]; ENV.strokeCol = strokeOf(s.th); const g = G(parent); s.draw(g, lt, st || {}); return g; }
function carrier(parent, r, thA, thB, m, plain) { ENV.strokeCol = mix(strokeOf(thA), strokeOf(thB), m); card(parent, r, r.fill, { plain }); }

// series badge: tells the student this short is part k of n, and what comes next
function overlay(t, i) {
  const sr = SPEC && SPEC.series; if (!sr || !sr.total) return; const th = SC[i].th, g = G(world), s = 44, txt = `${sr.name || ''} ${sr.index}/${sr.total}`, w = tw(txt, s, 700), n = Math.min(6, sr.total), x = M, y = 150;
  tx(g, txt, x, y + s * 0.36, s, 700, th.fg); for (let k = 0; k < n; k++) rr(g, { x: x + w + 28 + k * 52, y: y - 7, w: 42, h: 14, r: 7 }, { fill: k < sr.index ? (th.hi === th.bg ? th.fg : markC(th)) : mix(th.bg, th.fg, 0.2) });
  if (sr.next && i === SC.length - 1) { const lt = (t - T[i]) / PACE; if (lt > 1.6 && t < DUR - 0.5) chip(g, '다음 편 · ' + sr.next, M, 1640, 52, th.fg, th.bg, ap(lt, 1.6, 0.4), { plain: true }); }
}
function seek0(t) {
  t = clamp(t, 0, DUR - 1e-4); uid = 0;
  while (defs.firstChild) defs.removeChild(defs.firstChild);
  while (world.firstChild) world.removeChild(world.firstChild);
  const n = SC.length; let i = 0; while (i < n - 1 && t >= T[i + 1]) i++;
  const cs = ENV.cam === 'still' ? 1 : (ENV.cam === 'push' ? 1 + 0.045 * Math.min(1, t / (DUR - 0.5)) * (1 - eIO(prog(t, DUR - 0.5, 0.5))) : 1.045 - 0.045 * Math.min(1, t / (DUR - 0.5)) * (1 - eIO(prog(t, DUR - 0.5, 0.5))) - 0.045 * eIO(prog(t, DUR - 0.5, 0.5)) * 0);
  world.setAttribute('transform', `translate(${W / 2} ${H / 2}) scale(${cs.toFixed(5)}) translate(${-W / 2} ${-H / 2})`);
  let A = i, B = -1, x = 0;
  const outStart = i === n - 1 ? DUR - TD : T[i + 1] - PRE;
  if (t >= outStart) { B = (i + 1) % n; x = t - outStart; }
  else if (i > 0 && t < T[i] - PRE + TD) { A = i - 1; B = i; x = t - (T[i] - PRE); }
  if (B < 0) { bgL.setAttribute('fill', SC[i].th.bg); drawScene(i, (t - T[i]) / PACE, {}, world); return; }
  const a = SC[A], b = SC[B], tr = TR[A], ltA = (t - T[A]) / PACE, ltB = B === 0 ? -1 : (t - T[B]) / PACE, m = eIO(x / TD);
  if (tr.kind === 'morph') {
    bgL.setAttribute('fill', a.th.bg);
    const r = lerpR(a.aOut, b.aIn, m), xe = eI(prog(x, 0, 0.3)), xe0 = eI(prog(x - 1 / 90, 0, 0.3));
    if (xe < 1) {
      const gA = drawScene(A, ltA, { noOut: true }, world);
      if (tr.exit === 'absorb') { const cx = r.x + r.w / 2, cy = r.y + r.h / 2; gA.setAttribute('transform', `translate(${cx.toFixed(1)} ${cy.toFixed(1)}) scale(${(1 - xe).toFixed(4)}) translate(${(-cx).toFixed(1)} ${(-cy).toFixed(1)})`); }
      else { const dx = tr.exit === 'left' ? -1 : tr.exit === 'right' ? 1 : 0, dy = tr.exit === 'up' ? -1 : tr.exit === 'down' ? 1 : 0; gA.setAttribute('transform', `translate(${(dx * xe * W * 1.15).toFixed(1)} ${(dy * xe * H * 1.05).toFixed(1)})`); const f = blurF(dx * (xe - xe0) * W * 0.5, dy * (xe - xe0) * H * 0.5); if (f) gA.setAttribute('filter', f); }
    }
    carrier(world, r, a.th, b.th, m);
    if (ltB >= 0) drawScene(B, ltB, { noIn: true }, world);
  } else if (tr.kind === 'push') {
    const hz = tr.exit !== 'up' && tr.exit !== 'down', sg = tr.exit === 'right' || tr.exit === 'down' ? 1 : -1, D = hz ? W : H, off = sg * D * m, off0 = sg * D * eIO(Math.max(0, x - 1 / 120) / TD), bl = blurF(hz ? (off - off0) * 0.6 : 0, hz ? 0 : (off - off0) * 0.6);
    bgL.setAttribute('fill', a.th.bg);
    const gA = G(world, { transform: hz ? `translate(${off.toFixed(1)} 0)` : `translate(0 ${off.toFixed(1)})` }); if (bl) gA.setAttribute('filter', bl); drawScene(A, ltA, {}, gA);
    const gB = G(world, { transform: hz ? `translate(${(off - sg * D).toFixed(1)} 0)` : `translate(0 ${(off - sg * D).toFixed(1)})` }); if (bl) gB.setAttribute('filter', bl);
    el('rect', { x: 0, y: 0, width: W, height: H, fill: b.th.bg }, gB); if (ltB >= 0) drawScene(B, ltB, {}, gB);
  } else if (tr.kind === 'split') {
    const cy = clamp(a.aOut.y + a.aOut.h / 2, 300, H - 300), k = eIO(prog(x, 0, 0.44));
    bgL.setAttribute('fill', b.th.bg); if (ltB >= 0) drawScene(B, ltB, {}, world);
    if (k < 1) [[0, cy, -(cy + 40) * k], [cy, H - cy, (H - cy + 40) * k]].forEach(([y, h, dy]) => { const gg = G(world, { 'clip-path': clipR(-40, y - (y === 0 ? 40 : 0), W + 80, h + 40), transform: `translate(0 ${dy.toFixed(1)})` }); el('rect', { x: -40, y: -40, width: W + 80, height: H + 80, fill: a.th.bg }, gg); drawScene(A, ltA, {}, gg); el('rect', { x: -40, y: y === 0 ? cy - 5 : cy, width: W + 80, height: 5, fill: a.th.fg }, gg); });
  } else if (tr.kind === 'zoom') {
    const o = a.aOut, p = prog(x, 0, 0.42), cx = o.x + o.w / 2, cy = o.y + o.h / 2, S = Math.min(16, 1.1 * Math.max(2 * Math.max(cx, W - cx) / o.w, 2 * Math.max(cy, H - cy) / o.h)), s = lerp(1, S, eI(p));
    bgL.setAttribute('fill', a.th.bg);
    if (p < 1) { const gA = drawScene(A, ltA, { noOut: true }, world); gA.setAttribute('transform', `translate(${cx.toFixed(1)} ${cy.toFixed(1)}) scale(${s.toFixed(4)}) translate(${(-cx).toFixed(1)} ${(-cy).toFixed(1)})`); }
    const sr = { x: cx - o.w * s / 2, y: cy - o.h * s / 2, w: o.w * s, h: o.h * s, r: (o.r ?? 0) * s, fill: mix(o.fill, b.th.bg, eIO(p)) };
    carrier(world, lerpR(sr, { ...FULL, fill: b.th.bg }, p * p * p), a.th, b.th, eIO(p), true);
    if (ltB >= 0) drawScene(B, ltB, {}, world);
  } else if (tr.kind !== 'collapse') {
    bgL.setAttribute('fill', a.th.bg);
    const p = prog(x, 0, tr.kind === 'flood' ? 0.36 : 0.42), mf = eIO(p), o = a.aOut, full = { ...FULL, fill: b.th.bg }; let r;
    if (tr.kind === 'iris') { const cx = o.x + o.w / 2, cy = o.y + o.h / 2, D = Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy)) + 20; r = lerpR(o, { x: cx - D, y: cy - D, w: 2 * D, h: 2 * D, r: D, fill: b.th.bg }, eI(p) * 0.6 + mf * 0.4); }
    else if (tr.kind === 'bar' || tr.kind === 'barv') { const hz = tr.kind === 'bar', mid = hz ? { x: 0, y: o.y, w: W, h: o.h, r: 0, fill: mix(o.fill, b.th.bg, 0.5) } : { x: o.x, y: 0, w: o.w, h: H, r: 0, fill: mix(o.fill, b.th.bg, 0.5) }; r = p < 0.45 ? lerpR(o, mid, eIO(p / 0.45)) : lerpR(mid, full, eIO((p - 0.45) / 0.55)); }
    else r = lerpR(o, full, mf);
    if (p < 1) drawScene(A, ltA, { noOut: true }, world);
    carrier(world, r, a.th, b.th, mf, true);
    if (ltB >= 0) drawScene(B, ltB, {}, world);
  } else { // collapse: the old world shrinks into the next scene's anchor
    bgL.setAttribute('fill', b.th.bg);
    const r = lerpR({ ...FULL, fill: a.th.bg }, b.aIn, m);
    carrier(world, r, a.th, b.th, m, m < 0.5);
    if (m < 0.75) { const gc = G(world, { 'clip-path': clipR(r.x, r.y, r.w, r.h, r.r) }); const s = Math.max(r.w / FULL.w, r.h / FULL.h), cx = r.x + r.w / 2, cy = r.y + r.h / 2; const gA = drawScene(A, ltA, {}, gc); gA.setAttribute('transform', `translate(${cx.toFixed(1)} ${cy.toFixed(1)}) scale(${s.toFixed(4)}) translate(${-W / 2} ${-H / 2})`); }
    if (ltB >= 0) drawScene(B, ltB, { noIn: true }, world);
  }
}

async function loadSpec(spec) {
  svg = document.getElementById('stage'); defs = document.getElementById('defs'); bgL = document.getElementById('bg'); world = document.getElementById('world');
  if (!measurer) { measurer = el('text', { x: -9999, y: -9999, 'font-size': 100 }, svg); measurer.setAttribute('xml:space', 'preserve'); }
  ENV = makeLook(spec);
  const txt = allText(spec).join('') + '0123456789.,%/VS✓✕예시가상숫자출처한줄정리AI ';
  for (const w of [ENV.font.wd, ENV.font.wb, 700, 600]) await document.fonts.load(`${w} 40px ${ENV.font.ff}`, txt);
  await document.fonts.ready;
  const info = plan(spec); seek(0); return info;
}
function seek(t) { seek0(t); t = clamp(t, 0, DUR - 1e-4); let i = 0; while (i < SC.length - 1 && t >= T[i + 1] - PRE + TD * 0.5) i++; overlay(t, i); }
window.loadSpec = loadSpec; window.seek = seek;
