// mechanism scenes: small simulations that SHOW the concept acting instead of describing it
const acc2 = th => (contrast(th.hi2, th.bg) > 1.6 && th.hi2 !== th.hi ? th.hi2 : th.fg);

// a range that keeps getting cut down, one row per cut: binary search, elimination, funnels
TYPES.narrow = (d, th, key) => {
  const ch = chrome(d, th), wd = ENV.font.wd, bodyH = ch.y1 - ch.y0, from = Number(d.from ?? 1), to = Number(d.to ?? 100), target = Number(d.target ?? to);
  const steps = []; let lo = from, hi = to;
  if (Array.isArray(d.steps) && d.steps.length) d.steps.slice(0, 8).forEach(s => steps.push({ lo: Number(s.lo ?? s[0]), hi: Number(s.hi ?? s[1]), mid: Number(s.mid ?? s[2] ?? s.hi ?? s[1]) }));
  else for (let k = 0; k < 8 && lo <= hi; k++) { const mid = Math.floor((lo + hi) / 2); if (target < mid) hi = mid - 1; else if (target > mid) lo = mid + 1; else lo = hi = mid; steps.push({ lo, hi, mid }); if (mid === target) break; }
  const n = steps.length, rows = n + 1, cH = 262, rh = clamp((bodyH - cH - 20) / rows - 14, 44, 118), blockH = cH + rows * (rh + 14) - 14, top = ch.y0 + (bodyH - blockH) / 2, rowY = r => top + cH + r * (rh + 14), X = v => M + (v - from) / ((to - from) || 1) * 900;
  const a = k => 0.9 + k * BEAT, tE = a(n - 1) + 0.5, rng = r => r === 0 ? { lo: from, hi: to } : steps[r - 1], last = steps[n - 1], cs = Math.min(48, rh * 0.5);
  const barR = (l, h, r) => { const w = Math.max(30, X(h) - X(l)); return { x: clamp(X(l) - (w <= 30 ? 15 : 0), M, W - M - w), y: rowY(r), w, h: rh, r: Math.min(rad(rh), w / 2) }; };
  ch.hug(top, top + blockH);
  return { beats: d.beats ?? clamp(n + 4, 6, 13), aIn: { x: M, y: rowY(0), w: 900, h: rh, r: rad(rh), fill: th.soft }, aOut: { ...barR(last.lo, last.hi, n), fill: th.hi }, draw(g, lt, st) {
    ch.draw(g, lt, BEAT * 2, tE);
    let cnt = 0, lastK = -1; steps.forEach((s, k) => { if (lt >= a(k)) { cnt++; lastK = k; } });
    const done = lt >= tE, dimC = mix(th.bg, th.hi, 0.38);
    for (let r = 0; r < rows; r++) {
      const t0 = r === 0 ? 0 : a(r - 1) + 0.18; if (lt < t0) continue;
      const e = r === 0 ? eIO(prog(lt, 0.3, 0.4)) : eIO(prog(lt, t0, 0.3)), p = rng(Math.max(0, r - 1)), q = rng(r);
      if (!(r === 0 && st.noIn)) rr(g, { x: M, y: rowY(r), w: 900 * (r === 0 ? 1 : ap(lt, t0, 0.25)), h: rh, r: rad(rh) }, { fill: mix(th.bg, th.soft, r === 0 ? 1 : 0.5) });
      const b = r === 0 ? { ...barR(from, to, 0), w: Math.max(1, 900 * e) } : barR(lerp(p.lo, q.lo, e), lerp(p.hi, q.hi, e), r), dim = r < n ? ap(lt, a(r) + 0.18, 0.3) : 0;
      if (!(r === n && st.noOut)) rr(g, b, { fill: mix(th.hi, dimC, dim) });
    }
    if (lt > 0.55) { tx(g, String(from), M + 28, rowY(0) + rh / 2 + cs * 0.36, cs, wd, th.onHi); tx(g, String(to), W - M - 28, rowY(0) + rh / 2 + cs * 0.36, cs, wd, th.onHi, 'end'); }
    steps.forEach((s, k) => { if (lt < a(k)) return; const e = ap(lt, a(k), 0.2), x = X(s.mid), y = rowY(k), fin = k === n - 1 && done;
      rr(g, { x: x - 5, y: y - 8 * e, w: 10, h: (rh + 16) * e }, { fill: th.fg });
      const txt = String(s.mid) + (fin ? ' ✓' : '?'), w = chipW(txt, cs), left = x > W / 2;
      chip(g, txt, left ? x - 18 - w : x + 18, y + rh / 2, cs, fin ? th.fg : th.bg, fin ? th.bg : th.fg, e, { plain: true }); });
    const pu = lastK >= 0 ? pulse(lt - a(lastK), 0, 0.09) : 1, big = 210, s1 = String(cnt), unit = d.unit || '번', w1 = tw(s1, big, wd) * pu, w2 = tw(unit, 90, wd), cx = W / 2 - (w1 + w2 + 16) / 2;
    if (d.label) kt(g, d.label, W / 2, top + 30, 56, 700, th.mute, 'middle', lt, 0.3);
    if (lt > 0.3) { tx(g, s1, cx, top + 222, big * pu, wd, done ? (th.hi === th.bg ? th.fg : markC(th)) : th.fg); tx(g, unit, cx + w1 + 16, top + 222, 90, wd, th.mute); }
  } };
};

// particles crossing (or failing to cross) a barrier: osmosis, diffusion, trade, migration, channels
TYPES.transfer = (d, th, key) => {
  const ch = chrome(d, th), wd = ENV.font.wd, bodyH = ch.y1 - ch.y0, L = d.left || {}, Rt = d.right || {}, dir = d.dir === 'left' ? -1 : 1, src = dir > 0 ? 0 : 1;
  const cnt = [clamp(Math.round(L.count ?? 9), 0, 12), clamp(Math.round(Rt.count ?? 3), 0, 12)], mv = clamp(Math.round(d.move ?? 4), 0, Math.min(cnt[src], 18 - cnt[1 - src])), B_ = d.blocked || null, bls = B_ ? [clamp(Math.round(B_.left ?? (B_.side === 'left' ? B_.count ?? 4 : 0)), 0, 6), clamp(Math.round(B_.right ?? (B_.side === 'left' ? 0 : B_.count ?? 4)), 0, 6)] : [0, 0];
  const cw = 410, hh = Math.min(980, bodyH - 330), top = ch.y0 + (bodyH - hh - 330) / 2 + 110, bx = [M, W - M - cw], PR = 30, tM = 1.3, win = 2.2, c2 = acc2(th);
  const pc = isCool(th.hi) || !isCool(c2) ? th.hi : c2, bc = pc === th.hi ? c2 : th.hi;
  const slotP = (side, i) => [bx[side] + 80 + (i % 3) * (cw - 160) / 2 + (rnd(key + 'jx' + side + i) - 0.5) * 44, 80 + Math.floor(i / 3) * (hh - 160) / 5 + (rnd(key + 'jy' + side + i) - 0.5) * 40];
  const t0 = j => tM + j * (win / Math.max(1, mv)), boxR = (side, sc) => ({ x: bx[side], y: top + hh * (1 - sc) / 2, w: cw, h: hh * sc, r: rad(150) });
  const endSc = d.shrink === false ? 1 : 1 - 0.26 * (mv / Math.max(1, cnt[src]));
  ch.hug && ch.hug(top - 110, top + hh + 220);
  return { beats: d.beats ?? 9, aIn: { ...boxR(0, 1), fill: th.card }, aOut: { ...boxR(1 - src, 1), fill: th.card }, draw(g, lt, st) {
    ch.draw(g, lt, BEAT * 2, tM + win * 0.7);
    let moved = 0; for (let j = 0; j < mv; j++) moved += eIO(prog(lt, t0(j), 0.55));
    const sc = [1, 1]; sc[src] = lerp(1, endSc, mv ? moved / mv : 0);
    [0, 1].forEach(s => { const r = boxR(s, sc[s]); if (!((s === 0 && st.noIn) || (s === 1 - src && st.noOut)) && (s === 0 || lt > 0.2)) card(g, s === 0 ? r : growR(r, spr(lt, 0.04, 16)), th.card);
      const lab = s === 0 ? L.label : Rt.label; if (lab) kt(g, lab, s === 0 ? bx[0] : bx[1] + cw, top - 44, 56, wd, th.fg, s === 0 ? 'start' : 'end', lt, 0.3 + s * 0.15); });
    el('line', { x1: W / 2, y1: top - 30, x2: W / 2, y2: top - 30 + (hh + 60) * eIO(prog(lt, 0.4, 0.5)), stroke: th.fg, 'stroke-width': 9, 'stroke-dasharray': '30 24', 'stroke-dashoffset': (-lt * 20).toFixed(1) }, g);
    const yOf = (s, y) => top + hh / 2 + (y - hh / 2) * sc[s], dr = (i, k) => 20 * Math.sin(lt * (2.6 + (i % 3) * 0.5) + i * 1.9 + k);
    [0, 1].forEach(s => { for (let i = 0; i < cnt[s]; i++) {
      const e = spr(lt, 0.22 + i * 0.03 + s * 0.12, 16); if (e <= 0.01) continue; let [x, y] = slotP(s, i); y = yOf(s, y);
      const j = s === src ? i - (cnt[s] - mv) : -1;
      if (j >= 0) { const m = eIO(prog(lt, t0(j), 0.75)), [x2, y2] = slotP(1 - s, cnt[1 - s] + j); x = lerp(x, x2, m); y = lerp(y, yOf(1 - s, y2), m) - Math.sin(m * Math.PI) * 40; if (m > 0.02 && m < 0.98) el('line', { x1: lerp(slotP(s, i)[0], x2, eIO(clamp(m * 1.6 - 0.6))).toFixed(1), y1: y.toFixed(1), x2: x.toFixed(1), y2: y.toFixed(1), stroke: pc, 'stroke-width': 14, 'stroke-linecap': 'round', opacity: 0.45 }, g); }
      el('circle', { cx: (x + dr(i, 0)).toFixed(1), cy: (y + dr(i, 2)).toFixed(1), r: (PR * e).toFixed(1), fill: pc }, g);
    } });
    [0, 1].forEach(bside => { const bl = bls[bside]; for (let i = 0; i < bl; i++) { const e = spr(lt, 0.8 + i * 0.06, 16); if (e <= 0.01) continue; const sp = slotP(bside, 17 - i), toM = bside === 0 ? 1 : -1, wall = bside === 0 ? bx[0] + cw - 40 : bx[1] + 40, lunge = Math.pow(Math.max(0, Math.sin(lt * 1.5 + i * 2.1)), 8), x = lerp(sp[0] + 10 * Math.sin(lt * 2 + i), wall, lunge * 0.92), y = yOf(bside, sp[1]) + 10 * Math.cos(lt * 1.7 + i * 2), sz = 50 * e;
      rr(g, { x: x - sz / 2, y: y - sz / 2, w: sz, h: sz, r: ENV.shape === 'sharp' ? 0 : 10 }, { fill: bc }); } });
    // live counts and legend
    [0, 1].forEach(s => { const v = Math.round(cnt[s] + (s === src ? -moved : moved)); if (lt > 0.6) tx(g, String(v), bx[s] + cw / 2, top + hh + 120, 120, wd, s === src ? th.fg : th.hi === th.bg ? th.fg : th.hi, 'middle'); });
    const ly = top + hh + 190; let lx = d.blocked ? W / 2 - 250 : W / 2 - 90; const bl = bls[0] + bls[1];
    if (lt > 0.9) { el('circle', { cx: lx, cy: ly, r: 20, fill: pc }, g); tx(g, d.particle || '', lx + 36, ly + 17, 48, 700, th.fg); if (d.blocked) { lx += 300; rr(g, { x: lx - 20, y: ly - 20, w: 40, h: 40, r: 6 }, { fill: bc }); tx(g, d.blocked.label || '', lx + 36, ly + 17, 48, 700, th.fg); } }
    if (d.barrier) chip(g, d.barrier, W / 2, top - 86, 44, th.fg, th.bg, ap(lt, 0.8), { anchor: 'middle', plain: true });
  } };
};

// limited slots: new items push old ones out; chunking makes them fit. working memory, caches, queues
TYPES.slots = (d, th, key) => {
  const ch = chrome(d, th), wd = ENV.font.wd, bodyH = ch.y1 - ch.y0, cap = clamp(Math.round(d.capacity ?? 4), 2, 6), items = (d.items || []).slice(0, 10).map(String), n = items.length, chunks = (d.chunks || []).slice(0, cap).map(String);
  const gap = 24, cs = Math.min(240, (900 - gap * (cap - 1)) / cap), tot = cs * cap + gap * (cap - 1), x0 = W / 2 - tot / 2, blockH = 110 + cs + 420, top = ch.y0 + (bodyH - blockH) / 2, sy = top + 110, floorY = sy + cs + 330;
  const slot = i => ({ x: x0 + i * (cs + gap), y: sy, w: cs, h: cs, r: rad(cs) }), a = i => 0.6 + i * BEAT * 0.75, tC = a(n) + 0.5, fs = Math.min(cs * 0.56, ...items.map(s => fit(s, cs - 36, cs * 0.56, 30, 1, wd).size));
  const over = Math.max(0, n - cap), CF = chunks.map(c => fit(c, cs - 30, cs * 0.4, 28, 2, wd));
  ch.hug && ch.hug(top, floorY + 90);
  return { beats: d.beats ?? clamp(Math.ceil((tC + (chunks.length ? 1.6 : 0.7)) / BEAT), 6, 13), aIn: { ...slot(0), fill: th.soft }, aOut: { ...slot(0), fill: chunks.length ? th.hi : th.card }, draw(g, lt, st) {
    ch.draw(g, lt, BEAT * 2, chunks.length ? tC : a(n));
    chip(g, d.labelCap || `칸 ${cap}개`, W / 2, top + 30, 50, th.fg, th.bg, ap(lt, 0.3), { anchor: 'middle', plain: true });
    for (let i = 0; i < cap; i++) { const e = i === 0 ? 1 : spr(lt, 0.2 + i * 0.07, 18); if (e <= 0.01 || (i === 0 && (st.noIn || st.noOut))) continue; rr(g, growR(slot(i), e), { fill: th.soft }); }
    let shift = 0; for (let j = cap; j < n; j++) shift += eIO(prog(lt, a(j), 0.3));
    const ck = chunks.map((c, k) => spr(lt, tC + k * 0.14, 14));
    if (over) { rr(g, { x: M, y: floorY, w: 900 * eIO(prog(lt, a(cap) - 0.2, 0.4)), h: 8, r: 4 }, { fill: th.fg }); kt(g, d.labelOut || '밀려남', M, floorY + 74, 50, 700, th.mute, 'start', lt, a(cap)); }
    items.forEach((s, i) => {
      const e = spr(lt, a(i), 14); if (e <= 0.01) return; const p = i - shift, out = clamp(-p), q = Math.max(p, 0), sx = x0 + q * (cs + gap), fall = eI(out);
      const x = lerp(sx + (1 - e) * 700, M + 50 + (i % 8) * 104, fall) + cs / 2 * (1 - fall), y = lerp(sy + cs / 2, floorY - 50, fall), k = lerp(1, 0.64, fall) * (chunks.length && out > 0.5 ? 1 - eIO(prog(lt, tC - 0.1, 0.35)) : 1), hid = chunks.length && p >= 0 ? clamp((ck[Math.min(chunks.length - 1, Math.round(q))] || 0) * 2) : 0;
      if (hid >= 1) return;
      const gg = G(g, { transform: `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(Math.sin(fall * Math.PI) * (i % 2 ? 14 : -12)).toFixed(1)}) scale(${(k * (1 - hid)).toFixed(3)})` });
      if (out < 0.02) card(gg, { x: -cs / 2 + 10, y: -cs / 2 + 10, w: cs - 20, h: cs - 20, r: rad(cs - 20) }, th.card);
      tx(gg, s, 0, fs * 0.36, fs, wd, out > 0.02 ? th.mute : th.onCard, 'middle');
    });
    chunks.forEach((c, k) => { const e = ck[k]; if (e <= 0.01) return; const r = slot(k); if (!(k === 0 && st.noOut)) card(g, growR(r, e), th.hi); if (e > 0.5) kblock(g, CF[k], r.x + cs / 2, r.y + cs / 2 - (CF[k].lines.length - 1) * CF[k].size * 0.6 + CF[k].size * 0.35, wd, th.onHi, 'middle', lt, tC + k * 0.14 + 0.1, { lh: 1.2 }); });
  } };
};

// two actors sending messages back and forth: handshakes, request/response, signalling, negotiation
TYPES.exchange = (d, th, key) => {
  const ch = chrome(d, th), wd = ENV.font.wd, wb = ENV.font.wb, bodyH = ch.y1 - ch.y0, A = d.left || {}, B = d.right || {}, msgs = (d.messages || []).slice(0, 5), n = msgs.length;
  const ps = 220, rowH = Math.min(300, (bodyH - ps - 150) / Math.max(1, n)), blockH = ps + 110 + rowH * n, top = ch.y0 + (bodyH - blockH) / 2, xa = M + ps / 2 + 20, xb = W - M - ps / 2 - 20, plate = x => ({ x: x - ps / 2, y: top, w: ps, h: ps, r: rad(ps) });
  const y0 = top + ps + 110, a = i => 0.9 + i * BEAT * 2, tE = a(n), MF = msgs.map(m => { let s = 60; while (s > 36 && chipW(m.text || '', s) > 520) s -= 2; return s; });
  const chipOf = i => { const w = chipW(msgs[i].text || '', MF[i]), h = MF[i] * 1.75, y = y0 + i * rowH + rowH / 2; return { x: W / 2 - w / 2, y: y - h - 22, w, h, r: rad(h) }; };
  ch.hug && ch.hug(top, y0 + rowH * n);
  return { beats: d.beats ?? clamp(n * 2 + 3, 6, 13), aIn: { ...plate(xa), fill: th.hi }, aOut: n ? { ...chipOf(n - 1), fill: msgs[n - 1].from === 'right' ? th.card : th.hi } : { ...plate(xa), fill: th.hi }, draw(g, lt, st) {
    ch.draw(g, lt, tE);
    const le = eIO(prog(lt, 0.4, 0.6));
    [xa, xb].forEach(x => rr(g, { x: x - 4, y: top + ps + 76, w: 8, h: (y0 + rowH * n - top - ps - 76) * le }, { fill: th.line }));
    [[A, xa, th.hi, th.onHi, 'left'], [B, xb, th.card, th.onCard, 'right']].forEach(([s, x, fill, ink, side], k) => {
      const e = k === 0 ? 1 : spr(lt, 0.25, 14); let pu = 1; msgs.forEach((m, i) => { if ((m.from === 'right' ? 'left' : 'right') === side && lt >= a(i) + 0.4) pu = Math.max(pu, 1 + 0.07 * Math.exp(-7 * (lt - a(i) - 0.4))); });
      const gg = G(g, { transform: `translate(${x} ${top + ps / 2}) scale(${(e * pu).toFixed(4)}) translate(${-x} ${-(top + ps / 2)})` });
      if (!(k === 0 && st.noIn)) card(gg, plate(x), fill);
      if (lt > 0.2 + k * 0.1) drawIcon(gg, s.icon || String(s.label || '?')[0], x, top + ps / 2, ps * 0.4, ink, k === 0 ? (contrast(th.hi2, th.hi) > 1.6 ? th.hi2 : th.onHi) : th.hi, fill);
      if (s.label) kt(g, s.label, x, top + ps + 58, 50, wd, th.fg, 'middle', lt, 0.3 + k * 0.1);
    });
    msgs.forEach((m, i) => {
      if (lt < a(i)) return; const fromR = m.from === 'right', x1 = fromR ? xb : xa, x2 = fromR ? xa : xb, y = y0 + i * rowH + rowH / 2, e = eIO(prog(lt, a(i), 0.45)), tip = lerp(x1, x2 + (fromR ? 34 : -34), e), sgn = fromR ? -1 : 1;
      rr(g, { x: Math.min(x1, tip), y: y - 5, w: Math.abs(tip - x1), h: 10 }, { fill: th.fg });
      el('path', { d: `M${tip + sgn * 30} ${y} l${-sgn * 36} -26 v52 z`, fill: th.fg }, g);
      const c = chipOf(i), cx = lerp(x1, W / 2, e) - c.w / 2;
      if (!(i === n - 1 && st.noOut)) card(g, { ...c, x: clamp(cx, M, W - M - c.w) }, fromR ? th.card : th.hi, { plain: !fromR });
      tx(g, m.text || '', clamp(cx, M, W - M - c.w) + MF[i] * 0.55, c.y + c.h / 2 + MF[i] * 0.35, MF[i], 700, fromR ? th.onCard : th.onHi);
      if (m.sub) kt(g, m.sub, W / 2, y + 66, 50, 700, th.mute, 'middle', lt, a(i) + 0.3);
    });
  } };
};

// a relationship drawn as a line: growth, decay, saturation, peaks, trade-offs
const CURVES = { up: x => x, down: x => 1 - x, exp: x => (Math.exp(3.4 * x) - 1) / (Math.exp(3.4) - 1), log: x => Math.log(1 + 24 * x) / Math.log(25), s: x => 1 / (1 + Math.exp(-11 * (x - 0.5))), bell: x => Math.exp(-Math.pow((x - 0.5) / 0.13, 2) / 2), wide: x => 0.5 * Math.exp(-Math.pow((x - 0.5) / 0.3, 2) / 2), flat: x => 0.5, u: x => 4 * (x - 0.5) * (x - 0.5), decay: x => Math.exp(-4.2 * x), peak: x => 4 * x * (1 - x) };
TYPES.curve = (d, th, key) => {
  const ch = chrome(d, th), bodyH = ch.y1 - ch.y0, wd = ENV.font.wd, S = Math.min(900, bodyH - 20), px = W / 2 - S / 2, py = ch.y0 + (bodyH - S) / 2, f1 = CURVES[d.shape] || CURVES.up, f2 = CURVES[d.to] || null, marks = (d.marks || []).slice(0, 3);
  const plane = { x: px, y: py, w: S, h: S, r: rad(160), fill: th.card }, X = x => px + 100 + x * (S - 190), Y = y => py + S - 150 - y * (S - 290), N = 64; let f = f1;
  const fo = marks.findIndex(m => m.focus), tD = 0.6, dD = 1.3, a = i => tD + dD + 0.1 + i * BEAT, tF = a(marks.length) + 0.2, tG = tF + 0.5;
  const cr = m => { const w = chipW(m.label || '', 46), x = X(clamp(m.at)), y = Y(f(clamp(m.at))), up = y - 130 > py + 40; return { x: clamp(x - w / 2, px + 20, px + S - 20 - w), y: up ? y - 130 : y + 50, w, h: 46 * 1.75, r: rad(80) }; };
  ch.hug && ch.hug(py, py + S);
  return { beats: d.beats ?? clamp(Math.ceil((tF + (f2 ? 2.4 : 1.0)) / BEAT), 6, 12), aIn: plane, aOut: fo >= 0 ? { ...cr(marks[fo]), fill: th.hi } : plane, draw(g, lt, st) {
    ch.draw(g, lt, BEAT * 2, f2 ? tG : tF);
    const gm = f2 ? spr(lt, tG, 6) : 0; f = f2 ? x => lerp(f1(x), f2(x), gm) : f1; const pts = Array.from({ length: N + 1 }, (_, i) => [X(i / N), Y(f(i / N))]);
    if (!(st.noIn || (st.noOut && fo < 0))) card(g, plane, th.card);
    if (f2 && gm > 0.01) { el('path', { d: 'M' + Array.from({ length: N + 1 }, (_, i) => X(i / N).toFixed(1) + ' ' + Y(f1(i / N)).toFixed(1)).join(' L'), fill: 'none', stroke: mix(th.card, th.onCard, 0.3), 'stroke-width': 8, 'stroke-dasharray': '4 22', 'stroke-linecap': 'round' }, g); }
    const e1 = eIO(prog(lt, 0.3, 0.5)), ax = th.onCard, e = eIO(prog(lt, tD, dD)), k = Math.max(1, Math.round(e * N));
    rr(g, { x: X(0) - 4, y: Y(1.08) + (Y(0) - Y(1.08)) * (1 - e1), w: 8, h: (Y(0) - Y(1.08)) * e1 }, { fill: ax }); rr(g, { x: X(0) - 4, y: Y(0) - 4, w: (X(1.04) - X(0)) * e1, h: 8 }, { fill: ax });
    const lab = mix(th.card, th.onCard, 0.62);
    if (d.yLabel) kt(g, d.yLabel, X(0) + 24, Y(1.08) + 30, 44, 700, lab, 'start', lt, 0.5); if (d.xLabel) kt(g, d.xLabel, X(1.04), Y(0) + 70, 44, 700, lab, 'end', lt, 0.6);
    if (e > 0) { const seg = pts.slice(0, k + 1), path = 'M' + seg.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L');
      el('path', { d: path + ` L${seg[seg.length - 1][0].toFixed(1)} ${Y(0)} L${X(0)} ${Y(0)} Z`, fill: mix(th.card, th.hi, 0.2) }, g);
      el('path', { d: path, fill: 'none', stroke: th.hi, 'stroke-width': 16, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
      const tip = seg[seg.length - 1], br = lt > tD + dD ? 1 + 0.25 * Math.exp(-6 * ((lt - tD - dD) % BEAT)) : 1; el('circle', { cx: tip[0].toFixed(1), cy: tip[1].toFixed(1), r: (26 * br).toFixed(1), fill: th.onCard }, g); }
    marks.forEach((m, i) => { const ee = spr(lt, a(i), 18); if (ee <= 0.01) return; const x = X(clamp(m.at)), y = Y(f(clamp(m.at))), fz = i === fo ? ap(lt, tF, 0.3) : 0, c = cr(m);
      el('circle', { cx: x, cy: y, r: (22 * ee).toFixed(1), fill: th.card, stroke: th.onCard, 'stroke-width': 8 }, g);
      if (!(i === fo && st.noOut)) { const gg = G(g, { 'clip-path': clipR(c.x - 12, c.y - 12, (c.w + 24) * ap(lt, a(i) + 0.05), c.h + 24) }); card(gg, c, mix(th.onCard, th.hi, fz), { plain: true }); tx(gg, m.label || '', c.x + 46 * 0.55, c.y + c.h / 2 + 46 * 0.35, 46, 700, mix(th.card, th.onHi, fz)); } });
  } };
};

// a seesaw: trade-offs, which side weighs more, equilibrium
TYPES.balance = (d, th, key) => {
  const ch = chrome(d, th), bodyH = ch.y1 - ch.y0, wd = ENV.font.wd, A = d.left || {}, B = d.right || {}, wa = Number(A.weight ?? 1), wb_ = Number(B.weight ?? 1), mx = Math.max(wa, wb_, 0.001);
  const sA = 190 + 150 * wa / mx, sB = 190 + 150 * wb_ / mx, blockH = 400 + 60 + 260, top = ch.y0 + (bodyH - blockH) / 2, pv = [W / 2, top + 420], ang = clamp((wb_ - wa) / mx * 20, -10, 10), heavy = wb_ > wa ? 1 : wa > wb_ ? 0 : -1, tT = 1.5;
  const rect = (k, s) => ({ x: pv[0] + (k ? 1 : -1) * 240 - s / 2, y: pv[1] - 18 - s, w: s, h: s, r: rad(s) }), FA = fit(A.label || '', sA - 40, 60, 28, 2, wd), FB = fit(B.label || '', sB - 40, 60, 28, 2, wd);
  ch.hug && ch.hug(top - 20, pv[1] + 280);
  return { beats: d.beats ?? 7, aIn: { ...rect(0, sA), fill: heavy === 0 ? th.hi : th.card }, aOut: { ...rect(Math.max(0, heavy), heavy === 1 ? sB : sA), fill: heavy >= 0 ? th.hi : th.card }, draw(g, lt, st) {
    ch.draw(g, lt, tT + 0.6);
    const k = spr(lt, tT, 7), wob = lt > tT ? Math.sin((lt - tT) * 5) * 1.6 * Math.exp(-1.2 * (lt - tT)) : 0, rot = ang * k + wob;
    el('path', { d: `M${pv[0]} ${pv[1] + 14} l120 230 h-240 z`, fill: th.fg }, g);
    const gg = G(g, { transform: `rotate(${rot.toFixed(3)} ${pv[0]} ${pv[1]})` });
    rr(gg, { x: pv[0] - 410 * eIO(prog(lt, 0.15, 0.5)), y: pv[1] - 18, w: 820 * eIO(prog(lt, 0.15, 0.5)), h: 36, r: rad(36) }, { fill: th.fg });
    [[A, sA, FA, 0], [B, sB, FB, 1]].forEach(([s, sz, F, i]) => {
      const e = i === 0 ? 1 : spr(lt, 0.7, 12), r = rect(i, sz), drop = (1 - e) * -500, w = heavy === i ? ap(lt, tT + 0.2, 0.3) : 0, fill = heavy === 0 && i === 0 ? th.hi : mix(th.card, th.hi, w), ink = heavy === 0 && i === 0 ? th.onHi : mix(th.onCard, th.onHi, w);
      if (i === 1 && e <= 0.01) return; const g2 = G(gg, { transform: `translate(0 ${drop.toFixed(1)})` });
      if (!((i === 0 && st.noIn) || (i === Math.max(0, heavy) && st.noOut))) card(g2, r, fill);
      if (lt > 0.3 + i * 0.4) kblock(g2, F, r.x + sz / 2, r.y + sz / 2 - (F.lines.length - 1) * F.size * 0.6 + F.size * 0.35 - (s.value != null ? 24 : 0), wd, ink, 'middle', lt, 0.32 + i * 0.4, { lh: 1.2 });
      if (s.value != null && lt > 0.5 + i * 0.4) tx(g2, String(s.value), r.x + sz / 2, r.y + sz - 34, 44, 700, mix(ink, fill, 0.25), 'middle');
    });
  } };
};

// end title, alternate form: the takeaway is the hero, the term is a tag
const endTerm = TYPES.end;
TYPES.end = (d, th, key) => {
  if (vOf(d, key, 3) === 0 || !d.takeaway) return endTerm(d, th, key);
  const wd = ENV.font.wd, al = ENV.align, x = al === 'center' ? W / 2 : M, an = al === 'center' ? 'middle' : 'start';
  const f = fit(d.takeaway, 900, 170, 84, 4, wd), hT = f.lines.length * f.size * 1.18, cs = 66, cw = chipW(d.term || '', cs), chh = cs * 1.75, y0 = 960 - (chh + 80 + hT) / 2;
  const plate = { x: al === 'center' ? W / 2 - cw / 2 : M, y: y0, w: cw, h: chh, r: rad(chh), fill: th.hi };
  return { beats: d.beats ?? 5, aIn: plate, aOut: plate, draw(g, lt, st) {
    if (!(st.noIn || st.noOut)) card(g, plate, th.hi, { plain: true });
    if (lt > 0.25) tx(g, d.term || '', plate.x + cs * 0.55, y0 + chh / 2 + cs * 0.35, cs, 700, th.onHi);
    kblock(g, f, x, y0 + chh + 80 + f.size * 0.9, wd, th.fg, an, lt, 0.4, { lh: 1.18, mark: d.mark, markFill: markC(th), stag: 0.06 });
  } };
};

// ---- worked examples: the PDF's own problems, shown right after the concept ----
// the problem statement, then a short "think first" count
TYPES.problem = (d, th, key) => {
  const wd = ENV.font.wd, wb = ENV.font.wb, f = fit(d.text || '', 880, 84, 50, 7, wb), giv = (d.given || []).slice(0, 6).map(String), hT = f.lines.length * f.size * 1.38;
  const gs = 54, gws = giv.map(s => chipW(s, gs)), gRows = []; giv.forEach((s, i) => { const last = gRows[gRows.length - 1]; if (last && last.w + 20 + gws[i] <= 900) { last.items.push(i); last.w += 20 + gws[i]; } else gRows.push({ items: [i], w: gws[i] }); });
  const gH = gRows.length * 120, af = d.ask ? fit(d.ask, 700, 70, 44, 1, wd) : null, aH = af ? 170 : 0, total = 150 + hT + 50 + gH + aH + 150, y0 = 960 - total / 2, ts = 60, tw_ = chipW('문제', ts);
  const tag = { x: M, y: y0, w: tw_, h: ts * 1.75, r: rad(ts * 1.75), fill: th.hi }, yG = y0 + 150 + hT + 50, yA = yG + gH + 20, askR = af ? { x: M, y: yA, w: 900, h: 130, r: rad(130), fill: th.card } : tag;
  const tT = 0.5 + f.lines.length * 0.25, tG = tT + 0.5, tA = tG + giv.length * 0.2 + 0.3, tC = tA + 0.8, yC = yA + aH + 70;
  return { beats: d.beats ?? Math.ceil((tC + (d.think === false ? 0.6 : 3 * BEAT * 2 + 0.5)) / BEAT), aIn: tag, aOut: askR, draw(g, lt, st) {
    if (!(st.noIn || (st.noOut && !af))) card(g, tag, th.hi, { plain: true });
    if (lt > 0.15) tx(g, '문제', tag.x + ts * 0.55, tag.y + tag.h / 2 + ts * 0.35, ts, 700, th.onHi);
    if (d.source) kt(g, d.source, tag.x + tag.w + 26, tag.y + tag.h / 2 + 16, 46, 700, th.mute, 'start', lt, 0.3);
    kblock(g, f, M, y0 + 150 + f.size * 0.9, wb, th.fg, 'start', lt, 0.4, { lh: 1.38, stag: 0.03, lstag: 0.25, mark: d.mark, markFill: markC(th) });
    gRows.forEach((row, r) => { let x = M; row.items.forEach(i => { chip(g, giv[i], x, yG + r * 120 + 50, gs, th.fg, th.bg, ap(lt, tG + i * 0.2), { plain: true }); x += gws[i] + 20; }); });
    if (af) { const e = ap(lt, tA, 0.4); if (e > 0 && !st.noOut) card(g, growR(askR, e, 'l'), th.card); if (lt > tA + 0.1) { tx(g, '구하는 것', M + 44, yA + 82, 44, 700, mix(th.card, th.onCard, 0.6)); kt(g, d.ask, W - M - 44, yA + 65 + af.size * 0.36, af.size, wd, th.onCard, 'end', lt, tA + 0.15); } }
    if (d.think !== false && lt > tC) { const k = Math.min(3, (lt - tC) / (BEAT * 2)); kt(g, d.think || '먼저 3초만 생각해 보기', M, yC + 18, 50, 700, th.mute, 'start', lt, tC); for (let i = 0; i < 3; i++) { const p = clamp(k - i), cx = W - M - 40 - (2 - i) * 84; el('circle', { cx, cy: yC, r: 30, fill: th.soft }, g); if (p > 0) el('circle', { cx, cy: yC, r: (30 * eO(p)).toFixed(1), fill: th.hi === th.bg ? th.fg : th.hi }, g); } }
  } };
};

// a calculation solved line by line; each line's result is carried to the right, the answer lands at the bottom
TYPES.solve = (d, th, key) => {
  const ch = chrome(d, th), wd = ENV.font.wd, wb = ENV.font.wb, steps = (d.steps || []).slice(0, 5), n = steps.length, bodyH = ch.y1 - ch.y0, ansH = d.answer != null ? 230 : 0, gap = 24;
  const rh = Math.min(240, (bodyH - ansH - gap * n) / Math.max(1, n)), blockH = n * rh + gap * (n - 1) + (ansH ? ansH + gap : 0), top = ch.y0 + (bodyH - blockH) / 2, R = steps.map((s, i) => ({ x: M, y: top + i * (rh + gap), w: 900, h: rh, r: rad(rh) }));
  const rs = Math.min(64, rh * 0.3), RW = steps.map(s => s.result != null ? chipW(String(s.result), rs) + 20 : 0), EF = steps.map((s, i) => fit(String(s.expr || ''), 900 - 150 - RW[i] - 50, Math.min(80, rh * 0.36), 40, 1, wd)), LF = steps.map((s, i) => fit(String(s.label || ''), 900 - 150 - RW[i] - 50, Math.min(52, rh * 0.24), 38, 1, wb));
  const a = i => 0.35 + i * BEAT * 3, tA = a(n), ans = ansH ? { x: M, y: top + n * (rh + gap), w: 900, h: ansH, r: rad(ansH), fill: th.hi } : null, af = ansH ? fit(String(d.answer), 620, 130, 60, 1, wd) : null;
  ch.hug(top, top + blockH);
  return { beats: d.beats ?? Math.ceil((tA + (ansH ? 1.4 : 0.6)) / BEAT), aIn: { ...R[0], fill: th.card }, aOut: ans || { ...R[n - 1], fill: th.card }, draw(g, lt, st) {
    ch.draw(g, lt, tA);
    steps.forEach((s, i) => {
      const r = R[i], e = i === 0 ? 1 : spr(lt, a(i), 16); if (e <= 0.01) return; const cur = lt >= a(i) && lt < a(i + 1), on = ap(lt, a(i) + 0.9, 0.3);
      if (!((i === 0 && st.noIn) || (i === n - 1 && st.noOut && !ans))) card(g, growR(r, e), th.card);
      if (e < 0.6) return; const cy = r.y + r.h / 2;
      drawIcon(g, String(i + 1), r.x + 84, cy, rh * 0.36, th.hi === th.card ? th.onCard : th.hi);
      kt(g, s.label || '', r.x + 160, cy - EF[i].size * 0.42, LF[i].size, wb, mix(th.card, th.onCard, 0.62), 'start', lt, a(i) + 0.1);
      kt(g, s.expr || '', r.x + 160, cy + EF[i].size * 0.72, EF[i].size, wd, th.onCard, 'start', lt, a(i) + 0.3);
      if (s.result != null && on > 0) { const w = RW[i] - 20, h = rs * 1.75, x = r.x + r.w - w - 36; rr(g, { x, y: cy - h / 2, w: w * on, h, r: rad(h) }, { fill: mix(th.hi, th.soft, i < n - 1 || ans ? ap(lt, a(i + 1), 0.3) : 0) }); if (on > 0.7) tx(g, String(s.result), x + rs * 0.55, cy + rs * 0.35, rs, 700, mix(th.onHi, th.onSoft, i < n - 1 || ans ? ap(lt, a(i + 1), 0.3) : 0)); }
    });
    if (ans) { const e = spr(lt, tA, 12); if (e > 0.01 && !st.noOut) card(g, growR(ans, e), th.hi, { plain: true }); if (lt > tA + 0.15) { tx(g, d.answerLabel || '답', ans.x + 56, ans.y + ansH / 2 + 22, 64, 700, mix(th.hi, th.onHi, 0.7)); kt(g, String(d.answer), ans.x + ans.w - 56, ans.y + ansH / 2 + af.size * 0.36, af.size, wd, th.onHi, 'end', lt, tA + 0.2); } }
  } };
};

// a small table that fills in column by column: values, then what you do to them, then the result
TYPES.table = (d, th, key) => {
  const ch = chrome(d, th), wd = ENV.font.wd, cols = (d.cols || []).slice(0, 4), nc = cols.length, nr = Math.min(6, Math.max(1, ...cols.map(c => (c.values || []).length))), bodyH = ch.y1 - ch.y0, resH = d.result ? 210 : 0, hh = 120;
  const rh = Math.min(150, (bodyH - hh - resH - 40) / nr), blockH = hh + nr * rh + (resH ? resH + 40 : 0), top = ch.y0 + (bodyH - blockH) / 2, cw = 900 / nc, head = { x: M, y: top, w: 900, h: hh, r: rad(hh), fill: th.soft };
  const a = c => 0.4 + c * BEAT * 3, tR = a(nc) + 0.2, res = resH ? { x: M, y: top + hh + nr * rh + 40, w: 900, h: resH - 40, r: rad(resH), fill: th.hi } : null, fs = Math.min(70, rh * 0.5), hs = cols.map(c => fit(String(c.head || ''), cw - 30, 48, 28, 1, 700).size);
  ch.hug(top, top + blockH);
  return { beats: d.beats ?? Math.ceil((tR + (res ? 1.4 : 0.6)) / BEAT), aIn: head, aOut: res || head, draw(g, lt, st) {
    ch.draw(g, lt, tR);
    if (!(st.noIn || (st.noOut && !res))) card(g, head, th.soft, { plain: true });
    for (let r = 1; r < nr; r++) rr(g, { x: M, y: top + hh + r * rh - 2, w: 900 * eIO(prog(lt, 0.3 + r * 0.05, 0.4)), h: 4 }, { fill: th.line });
    cols.forEach((c, k) => { if (lt < a(k)) return; const cx = M + cw * (k + 0.5), cur = lt < a(k + 1) || k === nc - 1, col = cur ? (th.hi === th.bg ? th.fg : markC(th)) : th.fg;
      kt(g, c.head || '', cx, top + hh / 2 + hs[k] * 0.36, hs[k], 700, th.onSoft, 'middle', lt, a(k));
      if (k > 0) rr(g, { x: M + cw * k - 2, y: top + hh + 10, w: 4, h: (nr * rh - 20) * eIO(prog(lt, a(k) - 0.1, 0.4)) }, { fill: th.line });
      (c.values || []).slice(0, nr).forEach((v, r) => { const e = spr(lt, a(k) + 0.25 + r * 0.14, 16); if (e <= 0.01) return; tx(g, String(v), cx, top + hh + r * rh + rh / 2 + fs * 0.36, fs * e, wd, col, 'middle'); }); });
    if (res) { const e = spr(lt, tR, 12); if (e > 0.01 && !st.noOut) card(g, growR(res, e), th.hi, { plain: true }); if (lt > tR + 0.15) { tx(g, String(d.result.label || ''), res.x + 50, res.y + res.h / 2 + 20, 56, 700, mix(th.hi, th.onHi, 0.75)); kt(g, String(d.result.value ?? ''), res.x + res.w - 50, res.y + res.h / 2 + 34, 96, wd, th.onHi, 'end', lt, tR + 0.2); } }
  } };
};
