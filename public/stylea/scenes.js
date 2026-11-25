// Style A scene vocabulary. Each builder returns { beats, aIn, aOut, draw(g, lt, st) }.
// aIn / aOut are the rects that carry the picture in from the previous scene and out to the next one.
const TYPES = {};
const OPS = /^[=+\-−×÷→←↑↓><≠≈≥≤·:\/∝]+$/;
const vOf = (d, key, n) => Number.isInteger(d.variant) ? d.variant % n : ENV.v(key, n);
const drawIcon = (g, s, cx, cy, size, fill, c2, c0) => { if (ICONS[s]) return icon(g, s, cx, cy, size * 1.45, fill, c2 || fill, c0 || 'none'); tx(g, s, cx, cy + size * 0.36, size, isEmoji(s) ? 400 : ENV.font.wd, fill, 'middle'); };

TYPES.hook = (d, th, key, io) => {
  const wd = ENV.font.wd, al = ENV.align, v = vOf(d, key, 4), lines = Array.isArray(d.lines) && d.lines.length ? d.lines.slice(0, 3).map(String) : fit(d.text || '', 900, 200, 80, 3, wd).lines, n = lines.length;
  let ai = d.accent ? lines.findIndex(l => l.includes(d.accent)) : -1; if (ai < 0) ai = n - 1;
  const fitS = (l, max) => { let s = max; while (s > 70 && tw(l, s, wd) > (v >= 2 ? 840 : 900)) s -= 4; return s; }, base = Math.min(...lines.map(l => fitS(l, 210)));
  const sizes = lines.map((l, i) => v === 1 && n > 1 ? (i === ai ? fitS(l, 340) : Math.round(Math.min(base, 190) * 0.62)) : base), lh = v >= 2 ? 1.24 : 1.14;
  const bh0 = sizes.reduce((t, z) => t + z * lh, 0), yTop = 950 - bh0 / 2, x = al === 'center' ? W / 2 : (v >= 2 ? M + 30 : M), an = al === 'center' ? 'middle' : 'start', tops = []; sizes.reduce((y, z, i) => { tops[i] = y; return y + z * lh; }, yTop);
  const lastW = tw(lines[n - 1], sizes[n - 1], wd), lx = al === 'center' ? W / 2 - lastW / 2 : x, bh = Math.max(20, Math.round(sizes[n - 1] * 0.13));
  const aw = tw(lines[ai], sizes[ai], wd), ax = al === 'center' ? W / 2 - aw / 2 : x, plate = { x: ax - 30, y: tops[ai] + sizes[ai] * 0.02, w: aw + 60, h: sizes[ai] * 1.14, r: rad(sizes[ai] * 1.14), fill: th.hi };
  const bar = v >= 2 ? plate : { x: lx, y: yTop + bh0 + sizes[n - 1] * 0.1, w: lastW, h: bh, r: rad(bh), fill: th.hi }, sq = { ...bar, w: v >= 2 ? 26 : bh }, tB = (v >= 2 ? ai : n) * BEAT;
  return { beats: d.beats ?? Math.max(4, n + 2), aIn: sq, aOut: bar, draw(g, lt, st) {
    if (d.kicker) chip(g, d.kicker, x, yTop - 100, 50, th.soft, th.onSoft, ap(lt, 0.1), { anchor: an });
    const bw = lerp(sq.w, bar.w, eIO(prog(lt, tB, 0.5)));
    if (v >= 2 && !st.noOut && !st.noIn) card(g, { ...bar, w: bw }, th.hi, { plain: true });
    lines.forEach((l, i) => { const band = v >= 2 && i === ai, lab = v === 3 && i !== ai; let gg = band ? G(g, { 'clip-path': clipR(bar.x, bar.y - 40, bw, bar.h + 80) }) : g;
      if (lab) { const wi = tw(l, sizes[i], wd), px = (al === 'center' ? W / 2 - wi / 2 : x) - 30, pw = (wi + 60) * eIO(prog(lt, i * BEAT, 0.45)), py = tops[i] + sizes[i] * 0.02, ph = sizes[i] * 1.14; rr(g, { x: px, y: py, w: pw, h: ph, r: rad(ph) }, { fill: th.fg }); gg = G(g, { 'clip-path': clipR(px, py - 40, pw, ph + 80) }); }
      kt(gg, l, x, tops[i] + sizes[i] * 0.9, sizes[i], wd, band ? th.onHi : lab ? th.bg : th.fg, an, lt, 0.08 + i * BEAT, band || lab ? {} : { mark: d.accent, markFill: markC(th), markAt: 0.25 }); });
    if (v < 2 && !st.noOut && !st.noIn) card(g, { ...bar, w: bw }, th.hi, { plain: true });
  } };
};

function termBlock(d, th, key, kicker) {
  const wd = ENV.font.wd, wb = ENV.font.wb, v3 = vOf(d, key, 3), v = v3 === 2 ? 0 : v3, al = v === 1 ? 'left' : ENV.align;
  const mw = v === 0 ? 760 : 800, t1 = fit(d.term || '', mw, 330, 120, 1, wd), tf = tw(d.term || '', t1.size, wd) <= mw ? t1 : fit(d.term || '', mw, 240, 84, 2, wd), tH = tf.lines.length * tf.size * 1.1;
  const body = d.desc ?? d.takeaway ?? '', df = fit(body, 900, 76, 46, 3, wb), dH = df.lines.length * df.size * 1.34;
  const top = d.full || kicker, padX = 56, padY = 40, pH = tH + padY * 2, total = (top ? 80 : 0) + pH + 70 + dH, y0 = 960 - total / 2, py = y0 + (top ? 80 : 0);
  const plate = v3 === 2 ? { x: -40, y: py, w: W + 80, h: pH, r: 0, fill: th.hi } : v === 0 ? { x: al === 'center' ? W / 2 - tf.w / 2 - padX : M, y: py, w: tf.w + padX * 2, h: pH, r: rad(pH), fill: th.hi } : { x: M, y: py, w: 30, h: pH, r: rad(30), fill: th.hi };
  const txX = v3 === 2 ? (al === 'center' ? W / 2 : M) : v === 0 ? (al === 'center' ? W / 2 : M + padX) : M + 30 + 44, txA = v === 0 && al === 'center' ? 'middle' : 'start';
  const dX = v === 0 ? (al === 'center' ? W / 2 : M) : txX, dA = v === 0 && al === 'center' ? 'middle' : 'start';
  return { plate, draw(g, lt, st, hide) {
    if (top) kt(g, d.full || kicker, dX, y0 + 50, 56, 700, th.mute, dA, lt, 0.1);
    if (!hide) card(g, plate, th.hi, { plain: v === 1 });
    kblock(g, tf, txX, py + padY + tf.size * 0.86, wd, v === 0 ? th.onHi : th.fg, txA, lt, 0.0, { lh: 1.1 });
    kblock(g, df, dX, py + pH + 70 + df.size * 0.9, wb, th.fg, dA, lt, BEAT * 2, { lh: 1.34, mark: d.mark, markFill: markC(th), stag: 0.05 });
  } };
}
TYPES.define = (d, th, key) => { const b = termBlock(d, th, key); return { beats: d.beats ?? 4, aIn: b.plate, aOut: b.plate, draw(g, lt, st) { b.draw(g, lt, st, st.noIn || st.noOut); } }; };
TYPES.end = (d, th, key) => { const b = termBlock(d, th, key, d.kicker || '한 줄 정리'); return { beats: d.beats ?? 5, aIn: b.plate, aOut: b.plate, draw(g, lt, st) { b.draw(g, lt, st, st.noIn || st.noOut); } }; };

TYPES.flow = (d, th, key) => {
  const ch = chrome(d, th), steps = (d.steps || []).slice(0, 5), n = steps.length, v = vOf(d, key, 3), bodyH = ch.y1 - ch.y0, wd = ENV.font.wd, wb = ENV.font.wb;
  const a = i => 0.32 + i * BEAT, fin = d.focus != null ? clamp(d.focus, 0, n - 1) : n - 1, tF = a(n - 1) + BEAT;
  const wOn = (lt, i) => { let w = ap(lt, a(i), 0.25) * (i < n - 1 ? 1 - ap(lt, a(i + 1), 0.25) : 1); const f = ap(lt, tF, 0.25); if (fin !== n - 1) { if (i === n - 1) w *= 1 - f; if (i === fin) w = Math.max(w, f); } return w; };
  let rects, lay;
  if (v === 0) {
    const rowH = Math.min(300, bodyH / n), top = ch.y0 + (bodyH - rowH * n) / 2, bs = Math.min(156, rowH * 0.62);
    rects = steps.map((s, i) => ({ x: M, y: top + i * rowH + (rowH - bs) / 2, w: bs, h: bs, r: ENV.shape === 'sharp' ? 8 : bs / 2 }));
    lay = steps.map((s, i) => ({ lf: fit(s.label, 900 - bs - 44, 88, 44, 1, wd), sf: s.sub ? fit(s.sub, 900 - bs - 44, 56, 34, 1, wb) : null }));
  } else {
    const gap = 44, chh = Math.min(270, (bodyH - gap * (n - 1)) / n), cw = 720, top = ch.y0 + (bodyH - (chh * n + gap * (n - 1))) / 2;
    rects = steps.map((s, i) => ({ x: v === 1 ? (i % 2 ? W - M - cw : M) : M + (n > 1 ? i * (900 - cw) / (n - 1) : 0), y: top + i * (chh + gap), w: cw, h: chh, r: rad(chh) }));
    lay = steps.map((s, i) => ({ lf: fit(s.label, cw - 220, 80, 40, 1, wd), sf: s.sub ? fit(s.sub, cw - 220, 52, 32, 1, wb) : null }));
  }
  ch.hug(rects[0].y, rects[n - 1].y + rects[n - 1].h);
  return { beats: d.beats ?? clamp(n + 2, 4, 7), aIn: { ...rects[0], fill: th.hi }, aOut: { ...rects[fin], fill: th.hi }, draw(g, lt, st) {
    ch.draw(g, lt, a(n - 1) + 0.25);
    // connectors
    for (let i = 0; i < n - 1; i++) {
      const e = eIO(prog(lt, a(i) + 0.12, 0.38)); if (e <= 0) continue; const p = rects[i], q = rects[i + 1];
      if (v === 0) rr(g, { x: p.x + p.w / 2 - 4, y: p.y + p.h, w: 8, h: (q.y - p.y - p.h) * e }, { fill: th.fg });
      else { const x1 = p.x + p.w / 2, x2 = q.x + q.w / 2, y1 = p.y + p.h, y2 = q.y, ym = (y1 + y2) / 2; el('path', { d: `M${x1} ${y1} V${ym} H${x2} V${y2}`, fill: 'none', stroke: th.fg, 'stroke-width': 8, pathLength: 1, 'stroke-dasharray': 1, 'stroke-dashoffset': (1 - e).toFixed(4) }, g); }
    }
    steps.forEach((s, i) => {
      const e = i === 0 ? 1 : spr(lt, a(i), 18), w = wOn(lt, i), r = rects[i], L = lay[i];
      if (i > 0 && e <= 0.001) return;
      const fill = mix(th.card, th.hi, w), ink = mix(th.onCard, th.onHi, w), pu = i === fin ? pulse(lt, tF + 0.3, 0.025) : 1;
      const hideCard = (i === 0 && st.noIn) || (i === fin && st.noOut);
      const gg = G(g, { transform: `translate(${(r.x + r.w / 2).toFixed(1)} ${(r.y + r.h / 2).toFixed(1)}) scale(${(e * pu).toFixed(4)}) translate(${(-r.x - r.w / 2).toFixed(1)} ${(-r.y - r.h / 2).toFixed(1)})` });
      if (!hideCard) card(gg, r, fill);
      const te = i === 0 ? 0.08 : a(i) + 0.08;
      if (v === 0) {
        if (lt >= te) drawIcon(gg, s.icon || String(i + 1), r.x + r.w / 2, r.y + r.h / 2, r.w * (isEmoji(s.icon) ? 0.5 : 0.46), ink, mix(th.hi, th.onHi === ink ? th.hi2 : th.onHi, w), fill);
        const lx = r.x + r.w + 44, ly = r.y + r.h / 2 + (L.sf ? -6 : L.lf.size * 0.34);
        kt(g, s.label, lx, ly, L.lf.size, wd, th.fg, 'start', lt, te);
        if (L.sf) kt(g, s.sub, lx, ly + L.sf.size * 1.35, L.sf.size, wb, th.mute, 'start', lt, te + 0.12);
      } else {
        if (lt >= te) if (ICONS[s.icon]) drawIcon(gg, s.icon, r.x + 100, r.y + r.h / 2, r.h * 0.42, ink, mix(th.hi, contrast(th.hi2, th.hi) > 1.6 ? th.hi2 : th.onHi, w), fill); else drawIcon(gg, s.icon || String(i + 1), r.x + 100, r.y + r.h / 2, r.h * 0.44, mix(th.hi, th.onHi, w));
        const lx = r.x + 190, ly = r.y + r.h / 2 + (L.sf ? -4 : L.lf.size * 0.34);
        kt(gg, s.label, lx, ly, L.lf.size, wd, ink, 'start', lt, te);
        if (L.sf) kt(gg, s.sub, lx, ly + L.sf.size * 1.4, L.sf.size, wb, mix(mix(th.card, th.onCard, 0.62), th.onHi, w), 'start', lt, te + 0.12);
      }
    });
  } };
};

TYPES.compare = (d, th, key) => {
  const ch = chrome(d, th), bodyH = ch.y1 - ch.y0, wd = ENV.font.wd, wb = ENV.font.wb, A = d.left || {}, B = d.right || {};
  const pa = (A.points || []).slice(0, 3), pb = (B.points || []).slice(0, 3), mp = Math.max(pa.length, pb.length);
  const longest = Math.max(0, ...pa.concat(pb).map(s => String(s).length)), v = Number.isInteger(d.variant) ? d.variant % 2 : (longest > 7 ? 1 : vOf(d, key, 2));
  let RA, RB;
  if (v === 0) { const cw = 430, hh = Math.min(bodyH, 380 + mp * 230), y = ch.y0 + (bodyH - hh) / 2; RA = { x: M, y, w: cw, h: hh, r: rad(120) }; RB = { ...RA, x: M + cw + 40 }; }
  else { const hh = (Math.min(bodyH, 600 + mp * 300) - 40) / 2, y = ch.y0 + (bodyH - hh * 2 - 40) / 2; RA = { x: M, y, w: 900, h: hh, r: rad(120) }; RB = { ...RA, y: y + hh + 40 }; }
  const pad = 44, iw = RA.w - pad * 2;
  let shrink = 1; const L = side => { const p = side === A ? pa : pb; const lf = fit(side.label || '', iw - (ICONS[side.icon] ? (v === 0 ? 120 : 170) : 0), v === 0 ? 76 : 92, 40, 2, wd); const pfs = p.map(s => fit(s, iw - 44, (v === 0 ? 54 : 68) * shrink, 30, 2, wb)); const need = pad * 2 + 36 + lf.lines.length * lf.size * 1.12 + 60 + pfs.reduce((t, f) => t + f.lines.length * f.size * 1.28 + 30, 0); return { lf, pfs, need }; };
  let LA = L(A), LB = L(B); while (shrink > 0.5 && Math.max(LA.need, LB.need) > RA.h) { shrink -= 0.08; LA = L(A); LB = L(B); }
  const win = d.winner === 'left' ? 0 : d.winner === 'right' ? 1 : -1, tV = 0.55 + mp * 0.4 + 0.75;
  ch.hug(RA.y, RB.y + RB.h);
  return { beats: d.beats ?? clamp(Math.ceil((tV + 0.9) / BEAT), 4, 8), aIn: { ...RA, fill: th.card }, aOut: { ...(win === 1 ? RB : RA), fill: win >= 0 ? th.hi : th.card }, draw(g, lt, st) {
    ch.draw(g, lt, tV);
    const sp = spr(lt, 0.25, 14), rb = lerpR({ ...RA, fill: th.card }, { ...RB, fill: th.card }, sp);
    [[A, RA, LA, pa, 0], [B, rb, LB, pb, 1]].forEach(([s, r, Ls, p, k]) => {
      const w = win === k ? ap(lt, tV, 0.3) : 0, fill = mix(th.card, th.hi, w), ink = mix(th.onCard, th.onHi, w), head = mix(k === 0 ? th.hi : (contrast(th.hi2, th.card) > 2 ? th.hi2 : th.onCard), th.onHi, w);
      const hide = (k === 0 && st.noIn) || (win === k && st.noOut) || (win < 0 && k === 0 && st.noOut);
      const pu = win === k ? pulse(lt, tV + 0.3, 0.02) : 1;
      const gg = G(g, pu !== 1 ? { transform: `translate(${r.x + r.w / 2} ${r.y + r.h / 2}) scale(${pu.toFixed(4)}) translate(${-r.x - r.w / 2} ${-r.y - r.h / 2})` } : {});
      if (!hide && (k === 0 || sp > 0.01)) card(gg, r, fill);
      const t0 = 0.22 + k * 0.2; let y = r.y + pad + Ls.lf.size * 0.9;
      kblock(gg, Ls.lf, r.x + pad, y, wd, head, 'start', lt, t0, { lh: 1.12 });
      if (ICONS[s.icon] && lt > t0) { const ie = spr(lt, t0, 16), isz = v === 0 ? 110 : 150; icon(gg, s.icon, r.x + r.w - pad - isz / 2, r.y + pad + isz / 2 - 6, isz * ie, ink, mix(th.hi, contrast(th.hi2, th.hi) > 1.6 ? th.hi2 : th.onHi, w), fill); }
      y += Ls.lf.lines.length * Ls.lf.size * 1.12 + 22;
      const le = eO(prog(lt, t0 + 0.2, 0.4)); rr(gg, { x: r.x + pad, y: y - Ls.lf.size * 0.55, w: iw * le, h: 5 }, { fill: mix(mix(th.card, th.onCard, 0.2), th.onHi, w) });
      y += 34;
      p.forEach((s, i) => {
        const f = Ls.pfs[i], ta = 0.55 + i * 0.4 + k * 0.2, e = ap(lt, ta, 0.3), sz = f.size;
        if (e > 0) rr(gg, { x: r.x + pad, y: y + sz * 0.9 - sz * 0.5, w: 20 * e, h: 20 * e, r: ENV.shape === 'sharp' ? 0 : 8 }, { fill: head });
        kblock(gg, f, r.x + pad + 44, y + sz * 0.9, wb, ink, 'start', lt, ta, { lh: 1.28, stag: 0.04 });
        y += f.lines.length * sz * 1.28 + 30;
      });
    });
    if (d.vs !== false) { const e = spr(lt, 0.55, 16); if (e > 0.01) { const cx = v === 0 ? M + 430 + 20 : W / 2, cy = v === 0 ? RA.y + 70 : RA.y + RA.h + 20, s = 84 * e; card(g, { x: cx - s / 2, y: cy - s / 2, w: s, h: s, r: s / 2 }, th.fg, { plain: true }); if (e > 0.6) tx(g, 'VS', cx, cy + 11, 30, 900, th.bg, 'middle'); } }
  } };
};

TYPES.bars = (d, th, key, io) => {
  const ch = chrome(d, th), items = (d.items || []).slice(0, 5), n = items.length, v = vOf(d, key, 2), wd = ENV.font.wd, wb = ENV.font.wb;
  const max = Math.max(...items.map(i => Math.abs(i.value)), 1e-9), fo = d.focus != null ? clamp(d.focus, 0, n - 1) : items.findIndex(i => Math.abs(i.value) === max);
  const dec = Math.max(...items.map(i => decOf(i.value))), unit = d.unit || '', step = n > 4 ? 0.36 : BEAT, a = i => 0.3 + i * step;
  const bodyH = ch.y1 - ch.y0; let R, lab;
  if (v === 0) {
    const base = ch.y1 - 120, top = ch.y0 + 150, slot = 900 / n, bw = Math.min(180, slot * 0.64);
    R = items.map((it, i) => { const h = Math.max(10, Math.abs(it.value) / max * (base - top)); return { x: M + slot * i + (slot - bw) / 2, y: base - h, w: bw, h, r: Math.min(rad(bw), 18) }; });
    lab = items.map(it => fit(it.label, slot - 16, 46, 26, 2, wb));
  } else {
    const rowH = Math.min(250, (bodyH - 60) / n), top = ch.y0 + 60 + (bodyH - 60 - rowH * n) / 2, bh = Math.min(92, rowH * 0.4);
    R = items.map((it, i) => ({ x: M, y: top + i * rowH + rowH - bh - 24, w: Math.max(14, Math.abs(it.value) / max * 700), h: bh, r: Math.min(rad(bh), 18) }));
    lab = items.map(it => fit(it.label, 880, 54, 32, 1, wb));
  }
  const tag = d.source ? '출처: ' + d.source : (d.illustrative === false ? '' : '예시 · 가상 숫자');
  return { beats: d.beats ?? clamp(Math.ceil((a(n - 1) + 1.4) / BEAT), 4, 7), aIn: { ...R[0], fill: fo === 0 ? th.hi : th.soft }, aOut: { ...R[fo], fill: th.hi }, draw(g, lt, st) {
    ch.draw(g, lt, a(n - 1) + 0.3);
    if (tag) kt(g, tag, W - M, ch.y0 + 40, 34, 600, th.mute, 'end', lt, 0.2, { kin: 'wipe' });
    if (v === 0) rr(g, { x: M, y: R[0].y + R[0].h, w: 900 * eIO(prog(lt, 0.1, 0.5)), h: 6 }, { fill: th.fg });
    items.forEach((it, i) => {
      const carried = i === 0 && io.in === 'carrier', e = carried ? 1 : eO(prog(lt, a(i), 0.55)), ec = eO(prog(lt, a(i), 0.7)); if (lt < a(i) && !carried) return;
      const r = R[i], fill = i === fo ? th.hi : th.soft, pu = i === fo ? pulse(lt, a(n - 1) + 0.6, 0.04) : 1;
      const hide = (i === 0 && st.noIn) || (i === fo && st.noOut);
      const rc = v === 0 ? growR({ ...r, h: r.h * pu, y: r.y - r.h * (pu - 1) }, e, 'b') : growR({ ...r, w: r.w * pu }, e, 'l');
      if (!hide) card(g, rc, fill, { sh: 0.6 });
      const val = num(it.value * eO(prog(q30(lt), a(i), 0.7)), dec) + unit;
      if (lt >= a(i)) {
        if (v === 0) { tx(g, val, r.x + r.w / 2, rc.y - 24, Math.min(68, 900 / n * 0.3), wd, i === fo ? th.fg : th.mute, 'middle'); kblock(g, lab[i], r.x + r.w / 2, r.y + r.h + 22 + lab[i].size, wb, th.fg, 'middle', lt, a(i), { lh: 1.2 }); }
        else { kt(g, it.label, M, r.y - 22, lab[i].size, wb, th.fg, 'start', lt, a(i)); tx(g, val, rc.x + rc.w + 22, r.y + r.h / 2 + 22, 62, wd, i === fo ? th.fg : th.mute, 'start'); }
      }
    });
  } };
};

TYPES.number = (d, th, key) => {
  const wd = ENV.font.wd, wb = ENV.font.wb, v = vOf(d, key, 2), dec = decOf(d.value), unit = d.unit || '', pre = d.prefix || '';
  const full = pre + num(d.value, dec), nf = fit(full + unit, 860, 400, 140, 1, wd), al = ENV.align, x = al === 'center' ? W / 2 : M, an = al === 'center' ? 'middle' : 'start';
  const ratio = d.ratio != null ? clamp(d.ratio) : (unit === '%' ? clamp(d.value / 100) : null);
  const lf = fit(d.label || '', 900, 66, 40, 3, wb), kf = d.title ? fit(d.title, 900, 64, 44, 2, wd) : null;
  const total = (kf ? kf.lines.length * kf.size * 1.16 + 50 : 0) + nf.size * 0.86 + 70 + 48 + 70 + lf.lines.length * lf.size * 1.34, y0 = 940 - total / 2;
  const yNum = y0 + (kf ? kf.lines.length * kf.size * 1.16 + 50 : 0) + nf.size * 0.8, track = { x: M, y: yNum + 70, w: 900, h: 48, r: rad(48), fill: th.soft };
  const fillR = { ...track, w: 900 * (ratio ?? 1), fill: th.hi };
  return { beats: d.beats ?? 4, aIn: track, aOut: fillR, draw(g, lt, st) {
    if (kf) kblock(g, kf, x, y0 + kf.size * 0.9, wd, th.fg, an, lt, 0.12);
    const e = eO(prog(lt, 0.3, 1.0)), s = pre + num(d.value * eO(prog(q30(lt), 0.3, 1.0)), dec);
    const fw = tw(full + unit, nf.size, wd), sx = al === 'center' ? W / 2 - fw / 2 : M, uw = tw(unit, nf.size, wd);
    if (lt > 0.28) { tx(g, s, sx + fw - uw, yNum, nf.size, wd, th.fg, 'end'); if (unit) tx(g, unit, sx + fw - uw, yNum, nf.size, wd, th.hi, 'start'); }
    if (!st.noIn) { if (v === 0 || ratio == null) card(g, track, th.soft, { plain: true }); else for (let i = 0; i < 10; i++) rr(g, { x: M + i * 91.2, y: track.y, w: 79, h: 48, r: rad(48) / 2 }, { fill: th.soft }); }
    if (!st.noOut && lt > 0.3) { if (v === 0 || ratio == null) card(g, { ...fillR, w: Math.max(0.3, fillR.w * e) }, th.hi, { plain: true }); else { const k = (ratio * 10) * e; for (let i = 0; i < 10; i++) { const p = clamp(k - i); rr(g, { x: M + i * 91.2, y: track.y, w: 79 * p, h: 48, r: rad(48) / 2 }, { fill: th.hi }); } } }
    kblock(g, lf, x, track.y + 48 + 70 + lf.size * 0.9, wb, th.fg, an, lt, BEAT * 2, { lh: 1.34, mark: d.mark, markFill: markC(th), stag: 0.05 });
  } };
};

TYPES.grid = (d, th, key) => {
  const ch = chrome(d, th), total = clamp(Math.round(d.total || 10), 2, 100), part = clamp(Math.round(d.part || 1), 0, total), v = vOf(d, key, 2), wd = ENV.font.wd;
  const cols = total <= 4 ? total : total <= 9 ? 3 : total === 10 ? 5 : total <= 16 ? 4 : total <= 30 ? 5 : 10, rows = Math.ceil(total / cols), bodyH = ch.y1 - ch.y0;
  const cs = Math.min(900 / cols, (bodyH - 330) / rows, 230), big = cs * rows < 560 ? 300 : 190, gw = cs * cols, gx = W / 2 - gw / 2, headH = big + 40, gy = ch.y0 + (bodyH - (headH + cs * rows + 130)) / 2 + headH, dsz = cs * 0.8;
  const cell = k => ({ x: gx + (k % cols) * cs + (cs - dsz) / 2, y: gy + Math.floor(k / cols) * cs + (cs - dsz) / 2, w: dsz, h: dsz, r: v === 0 ? dsz / 2 : Math.min(rad(dsz), dsz * 0.22) });
  const tP = 1.0, dP = Math.min(1.2, 0.3 + part * 0.05), tL = tP + dP + 0.2, cw = d.labelPart ? chipW(d.labelPart, 56) : 0;
  const chipR = { x: W / 2 - cw / 2, y: gy + cs * rows + 50, w: cw, h: 56 * 1.75, r: rad(98), fill: th.hi };
  ch.hug(gy - headH, gy + cs * rows + (d.labelPart ? 150 : 20));
  return { beats: d.beats ?? clamp(Math.ceil((tL + 1.1) / BEAT), 5, 7), aIn: { ...cell(0), fill: th.soft }, aOut: d.labelPart ? chipR : { ...cell(0), fill: th.hi }, draw(g, lt, st) {
    ch.draw(g, lt, tL + 0.3);
    let lit = 0;
    for (let k = 0; k < total; k++) {
      const e = k === 0 ? 1 : spr(lt, 0.3 + k / total * 0.5, 20); if (e <= 0.01) continue;
      const on = k < part ? ap(lt, tP + (part > 1 ? k / (part - 1) : 0) * dP, 0.18) : 0; if (on > 0.5) lit++;
      if ((k === 0 && st.noIn) || (k === 0 && st.noOut && !d.labelPart)) continue;
      rr(g, growR(cell(k), e), { fill: mix(th.soft, th.hi, on) });
    }
    const s1 = String(lit), w1 = tw(s1, big, wd), s2 = ' / ' + total, w2 = tw(s2, big * 0.44, wd), cx = W / 2 - (w1 + w2) / 2;
    if (lt > 0.3) { tx(g, s1, cx, gy - 60, big, wd, th.hi === th.bg ? th.fg : th.hi); tx(g, s2, cx + w1, gy - 60, big * 0.44, wd, th.mute); }
    if (d.labelPart && !st.noOut) chip(g, d.labelPart, W / 2, chipR.y + chipR.h / 2, 56, th.hi, th.onHi, ap(lt, tL), { anchor: 'middle' });
    else if (d.labelPart && lt > tL) { /* carrier is the chip */ }
  } };
};

TYPES.formula = (d, th, key) => {
  const ch = chrome(d, th), wd = ENV.font.wd, wb = ENV.font.wb, toks = (d.tokens || []).slice(0, 9).map(t => typeof t === 'string' ? { t } : t), n = toks.length, bodyH = ch.y1 - ch.y0;
  const isOp = t => OPS.test(t.t), hasIcon = toks.some(t => ICONS[t.icon]); let size = hasIcon ? 96 : 150, rows;
  const measure = s => toks.map(t => isOp(t) ? tw(t.t, s, wd) + s * 0.3 : Math.max(tw(t.t, s, wd) + s * 0.9, hasIcon ? s * 2.5 : 0));
  const pack = s => { const ws = measure(s), gap = s * 0.2, out = [[]]; let x = 0; toks.forEach((t, i) => { if (x + ws[i] > 900 && out[out.length - 1].length) { out.push([]); x = 0; } out[out.length - 1].push(i); x += ws[i] + gap; }); return out; };
  for (; size >= 48; size -= 4) { rows = pack(size); const okH = rows.length * size * (hasIcon ? 4.3 : 2.3) <= bodyH; if (rows.length <= 3 && okH && measure(size).every(w => w <= 900) && (rows.length === 1 || size <= (hasIcon ? 88 : 132))) break; }
  const ws = measure(size), gap = size * 0.2, ph = size * (hasIcon ? 3.5 : 1.7), rowH = ph + (toks.some(t => t.sub) ? 74 : 40), y0 = ch.y0 + (bodyH - rows.length * rowH) / 2;
  const R = []; rows.forEach((row, ri) => { const tot = row.reduce((s, i) => s + ws[i], 0) + gap * (row.length - 1); let x = (ENV.align === 'center' || rows.length > 1) ? W / 2 - tot / 2 : M; row.forEach(i => { R[i] = { x, y: y0 + ri * rowH, w: ws[i], h: ph, r: rad(ph) }; x += ws[i] + gap; }); });
  const eq = toks.findIndex(t => t.t === '=' || t.t === '→'), terms = toks.map((t, i) => isOp(t) ? -1 : i).filter(i => i >= 0);
  const res = d.result != null ? clamp(d.result, 0, n - 1) : (eq > 0 && eq < n - 1 && eq <= 1 ? terms[0] : terms[terms.length - 1]);
  const a = i => 0.3 + i * 0.25, tR = a(n) + 0.15, first = terms[0] ?? 0;
  ch.hug(y0, y0 + rows.length * rowH - 40);
  return { beats: d.beats ?? clamp(Math.ceil((tR + 1.1) / BEAT), 4, 8), aIn: { ...R[first], fill: th.card }, aOut: { ...R[res], fill: th.hi }, draw(g, lt, st) {
    ch.draw(g, lt, tR + 0.1);
    toks.forEach((t, i) => {
      const r = R[i], e = i === first ? 1 : spr(lt, a(i), 18); if (e <= 0.01) return;
      const w = i === res ? ap(lt, tR, 0.3) : 0, pu = i === res ? pulse(lt, tR + 0.3, 0.035) : 1;
      const gg = G(g, { transform: `translate(${(r.x + r.w / 2).toFixed(1)} ${(r.y + r.h / 2).toFixed(1)}) scale(${(e * pu).toFixed(4)}) translate(${(-r.x - r.w / 2).toFixed(1)} ${(-r.y - r.h / 2).toFixed(1)})` });
      if (isOp(t)) { const up = t.t === '↑', dn = t.t === '↓', dy = (up ? -1 : dn ? 1 : 0) * 10 * Math.sin(lt * Math.PI * 2); tx(gg, t.t, r.x + r.w / 2, r.y + r.h / 2 + size * 0.36 + dy, size, wd, up || dn ? th.hi : th.fg, 'middle'); return; }
      if (!((i === first && st.noIn) || (i === res && st.noOut))) card(gg, r, mix(th.card, th.hi, w));
      if (lt >= a(i) + (i === first ? 0.02 : 0)) { tx(gg, t.t, r.x + r.w / 2, hasIcon ? r.y + r.h - size * 0.55 : r.y + r.h / 2 + size * 0.36, size, wd, mix(th.onCard, th.onHi, w), 'middle'); if (ICONS[t.icon]) icon(gg, t.icon, r.x + r.w / 2, r.y + size * 1.25, size * 1.6, mix(th.onCard, th.onHi, w), mix(th.hi, contrast(th.hi2, th.hi) > 1.6 ? th.hi2 : th.onHi, w), mix(th.card, th.hi, w)); }
      if (t.sub) { const sf = fit(t.sub, Math.max(r.w + 60, 200), 34, 24, 1, wb); kt(g, t.sub, r.x + r.w / 2, r.y + r.h + 46, sf.size, wb, th.mute, 'middle', lt, a(i) + 0.15); }
    });
  } };
};

TYPES.chat = (d, th, key) => {
  const ch = chrome(d, th), wb = ENV.font.wb, msgs = (d.messages || []).slice(0, 3), n = msgs.length, bodyH = ch.y1 - ch.y0;
  const L = msgs.map(m => { const f = fit(m.text, 740, 80, 46, 4, wb), w = Math.max(f.w + 110, 220), h = f.lines.length * f.size * 1.32 + 84; return { f, w, h }; });
  const noteH = d.note ? 140 : 0, total = L.reduce((s, l) => s + l.h, 0) + 90 * (n - 1) + noteH; let y = ch.y0 + (bodyH - total) / 2;
  const R = msgs.map((m, i) => { const me = m.who === 'me', r = { x: me ? W - M - L[i].w : M, y, w: L[i].w, h: L[i].h, r: Math.min(rad(L[i].h), 44) }; y += L[i].h + 90; return r; });
  const a = i => 0.3 + i * BEAT * 2, tN = a(n - 1) + 1.0;
  ch.hug(R[0].y - 50, R[n - 1].y + R[n - 1].h + noteH);
  return { beats: d.beats ?? clamp(n * 2 + 2 + (d.note ? 1 : 0), 4, 9), aIn: { ...R[0], fill: msgs[0].who === 'me' ? th.hi : th.card }, aOut: { ...R[n - 1], fill: msgs[n - 1].who === 'me' ? th.hi : th.card }, draw(g, lt, st) {
    ch.draw(g, lt, tN);
    msgs.forEach((m, i) => {
      const me = m.who === 'me', r = R[i], e = i === 0 ? 1 : spr(lt, a(i), 18); if (e <= 0.01) return;
      const gg = G(g, { transform: `translate(${me ? r.x + r.w : r.x} ${r.y + r.h}) scale(${e.toFixed(4)}) translate(${-(me ? r.x + r.w : r.x)} ${-r.y - r.h})` });
      if (!((i === 0 && st.noIn) || (i === n - 1 && st.noOut))) card(gg, r, me ? th.hi : th.card);
      const who = m.name || (me ? '' : 'AI'); if (who && lt > a(i)) tx(g, who, me ? r.x + r.w : r.x + 8, r.y - 22, 48, 700, th.mute, me ? 'end' : 'start');
      kblock(gg, L[i].f, r.x + 55, r.y + 40 + L[i].f.size, wb, me ? th.onHi : th.onCard, 'start', lt, a(i) + 0.1, { lh: 1.32, kin: 'wipe', stag: 0.09, lstag: 0.25, d: 0.25 });
    });
    if (d.note) { const last = R[n - 1], ok = d.note.ok !== false; chip(g, (ok ? '✓ ' : '✕ ') + d.note.text, last.x, last.y + last.h + 84, 50, ok ? th.hi2 : th.fg, ok ? th.onHi2 : th.bg, ap(lt, tN)); }
  } };
};

TYPES.list = (d, th, key) => {
  const ch = chrome(d, th), wb = ENV.font.wb, wd = ENV.font.wd, items = (d.items || []).slice(0, 5).map(i => typeof i === 'string' ? { text: i } : i), n = items.length, bodyH = ch.y1 - ch.y0;
  const gap = 30, rh = Math.min(236, (bodyH - gap * (n - 1)) / n), top = ch.y0 + (bodyH - rh * n - gap * (n - 1)) / 2, pick = d.pick != null ? clamp(d.pick, 0, n - 1) : -1;
  const hasVal = items.some(i => i.value != null), R = items.map((it, i) => ({ x: M, y: top + i * (rh + gap), w: 900, h: rh, r: rad(rh) }));
  const F = items.map(it => fit(it.text, 900 - 170 - (hasVal ? 230 : it.tag ? chipW(it.tag, 38) + 56 : 40), 68, 36, 2, wb));
  const a = i => 0.3 + i * 0.3, tP = a(n - 1) + 0.7;
  ch.hug(top, top + rh * n + gap * (n - 1));
  return { beats: d.beats ?? clamp(Math.ceil((tP + (pick >= 0 ? 1.2 : 0.7)) / BEAT), 4, 7), aIn: { ...R[0], fill: th.card }, aOut: { ...R[Math.max(0, pick)], fill: pick >= 0 ? th.hi : th.card }, draw(g, lt, st) {
    ch.draw(g, lt, tP);
    items.forEach((it, i) => {
      const r = R[i], e = i === 0 ? 1 : eO(prog(lt, a(i), 0.45)); if (e <= 0.001) return;
      const w = i === pick ? ap(lt, tP, 0.3) : 0, ink = mix(th.onCard, th.onHi, w), pu = i === pick ? pulse(lt, tP + 0.3, 0.02) : 1;
      const gg = G(g, { 'clip-path': clipR(r.x - 20, r.y - 20, (r.w + 40) * e, r.h + 40), transform: pu !== 1 ? `translate(${r.x + r.w / 2} ${r.y + r.h / 2}) scale(${pu.toFixed(4)}) translate(${-r.x - r.w / 2} ${-r.y - r.h / 2})` : null });
      if (!((i === 0 && st.noIn) || (i === Math.max(0, pick) && st.noOut))) card(gg, r, mix(th.card, th.hi, w));
      const cx = r.x + 88, cy = r.y + r.h / 2, m = eIO(prog(lt, a(i) + 0.2, 0.3)), mc = it.ok === false ? mix(th.card, th.onCard, 0.45) : (w > 0.5 ? th.onHi : th.hi);
      if (it.ok === true) el('path', { d: `M${cx - 24} ${cy} l17 18 l31 -36`, fill: 'none', stroke: mc, 'stroke-width': 11, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', pathLength: 1, 'stroke-dasharray': 1, 'stroke-dashoffset': (1 - m).toFixed(3) }, gg);
      else if (it.ok === false) el('path', { d: `M${cx - 20} ${cy - 20} l40 40 M${cx + 20} ${cy - 20} l-40 40`, fill: 'none', stroke: mc, 'stroke-width': 11, 'stroke-linecap': 'round', pathLength: 1, 'stroke-dasharray': 1, 'stroke-dashoffset': (1 - m).toFixed(3) }, gg);
      else if (lt > a(i) + 0.1) { if (ICONS[it.icon]) drawIcon(gg, it.icon, cx, cy, 68, ink, w > 0.5 ? (contrast(th.hi2, th.hi) > 1.6 ? th.hi2 : th.onHi) : th.hi, mix(th.card, th.hi, w)); else drawIcon(gg, it.icon || String(i + 1), cx, cy, isEmoji(it.icon) ? 76 : 72, mc); }
      const f = F[i], ty = cy - (f.lines.length - 1) * f.size * 0.63 + f.size * 0.35;
      kblock(gg, f, r.x + 170, ty, wb, it.ok === false ? mix(th.card, th.onCard, 0.55) : ink, 'start', lt, a(i) + 0.1, { lh: 1.26, stag: 0.04 });
      if (it.value != null) { const vv = clamp(it.value), ev = eO(prog(lt, a(i) + 0.25, 0.6)); rr(gg, { x: r.x + r.w - 240, y: cy + 26, w: 196, h: 16, r: 8 }, { fill: mix(th.card, th.onCard, 0.14) }); rr(gg, { x: r.x + r.w - 240, y: cy + 26, w: 196 * vv * ev, h: 16, r: 8 }, { fill: mc }); tx(gg, num(it.value * ev, 2), r.x + r.w - 44, cy + 6, 56, wd, ink, 'end'); }
      else if (it.tag) { const tw_ = chipW(it.tag, 38); if (lt > a(i) + 0.25) { rr(gg, { x: r.x + r.w - tw_ - 36, y: cy - 33, w: tw_, h: 66, r: rad(66) }, { fill: mix(th.card, th.onCard, w > 0.5 ? 0.9 : 0.1) }); tx(gg, it.tag, r.x + r.w - tw_ / 2 - 36, cy + 13, 38, 700, w > 0.5 ? th.card : th.onCard, 'middle'); } }
    });
  } };
};

TYPES.cycle = (d, th, key) => {
  const ch = chrome(d, th), nodes = (d.nodes || []).slice(0, 5).map(x => typeof x === 'string' ? { label: x } : x), n = nodes.length, bodyH = ch.y1 - ch.y0, wd = ENV.font.wd;
  const R = Math.min(330, bodyH / 2 - 90), cx = W / 2, cy = (ch.y0 + ch.y1) / 2, ang = k => (-90 + k * 360 / n) * Math.PI / 180, pos = k => [cx + R * Math.cos(ang(k)), cy + R * Math.sin(ang(k))];
  const cs = nodes.map(nd => { let s = 52; while (s > 30 && chipW(nd.label, s) > 360) s -= 2; return s; });
  const disc = { x: cx - 125, y: cy - 125, w: 250, h: 250, r: 125, fill: th.hi }, cf = d.center ? fit(d.center, 200, 60, 28, 2, wd) : null;
  const a = i => 0.35 + i * 0.25, tM = a(n) + 0.15, circ = 2 * Math.PI * R;
  ch.hug(cy - R - 70, cy + R + 70);
  return { beats: d.beats ?? clamp(Math.ceil((tM + (n + 0.6) * BEAT) / BEAT), 5, 8), aIn: disc, aOut: disc, draw(g, lt, st) {
    ch.draw(g, lt, tM);
    const er = eIO(prog(lt, 0.2, 0.7));
    el('circle', { cx, cy, r: R, fill: 'none', stroke: th.line, 'stroke-width': 10, 'stroke-dasharray': `${(circ * er).toFixed(1)} ${circ.toFixed(1)}`, transform: `rotate(-90 ${cx} ${cy})` }, g);
    const stepF = lt < tM ? 0 : Math.floor((lt - tM) / BEAT) + eIO(prog((lt - tM) % BEAT, 0, 0.4)), mAng = -Math.PI / 2 + stepF * 2 * Math.PI / n, act = Math.round(stepF) % n;
    if (lt >= tM) { const arc = Math.min(stepF, n) / n * circ; el('circle', { cx, cy, r: R, fill: 'none', stroke: th.fg, 'stroke-width': 10, 'stroke-dasharray': `${arc.toFixed(1)} ${circ.toFixed(1)}`, transform: `rotate(-90 ${cx} ${cy})` }, g); }
    if (!(st.noIn || st.noOut)) card(g, disc, th.hi, { plain: true });
    if (cf && lt > 0.3) kblock(g, cf, cx, cy - (cf.lines.length - 1) * cf.size * 0.56 + cf.size * 0.35, wd, th.onHi, 'middle', lt, 0.32, { lh: 1.12 });
    nodes.forEach((nd, k) => {
      const e = spr(lt, a(k), 18); if (e <= 0.01) return; const [px, py] = pos(k), on = lt >= tM && act === k ? ap((lt - tM) % BEAT + (stepF >= 1 || k === 0 ? 0.3 : 0), 0.3, 0.2) : 0, isOn = lt >= tM && act === k;
      const w = chipW(nd.label, cs[k]), h = cs[k] * 1.75, gg = G(g, { transform: `translate(${px.toFixed(1)} ${py.toFixed(1)}) scale(${(e * (isOn ? 1.06 : 1)).toFixed(3)})` });
      card(gg, { x: -w / 2, y: -h / 2, w, h, r: rad(h) }, isOn ? th.fg : th.card); tx(gg, nd.label, 0, cs[k] * 0.35, cs[k], 700, isOn ? th.bg : th.onCard, 'middle');
    });
    if (lt >= tM - 0.2) { const e = spr(lt, tM - 0.2, 18), mr = R - 64; el('circle', { cx: (cx + mr * Math.cos(mAng)).toFixed(1), cy: (cy + mr * Math.sin(mAng)).toFixed(1), r: (20 * e).toFixed(1), fill: th.hi }, g); }
  } };
};

TYPES.quadrant = (d, th, key) => {
  const ch = chrome(d, th), bodyH = ch.y1 - ch.y0, S = Math.min(860, bodyH - 60), px = W / 2 - S / 2, py = ch.y0 + (bodyH - S) / 2, pts_ = (d.points || []).slice(0, 5), wb = ENV.font.wb;
  const plane = { x: px, y: py, w: S, h: S, r: rad(160), fill: th.card }, xa = d.xAxis || ['', ''], ya = d.yAxis || ['', ''];
  const fo = pts_.findIndex(p => p.focus), a = i => 0.9 + i * 0.3, tF = a(pts_.length) + 0.2, X = p => px + 50 + clamp(p.x) * (S - 100), Y = p => py + S - 50 - clamp(p.y) * (S - 100);
  const cr = p => { const w = chipW(p.label, 42), left = X(p) > W / 2 + 60; return { x: left ? X(p) - 36 - w : X(p) + 36, y: Y(p) - 37, w, h: 73.5, r: rad(73) }; };
  ch.hug(py, py + S);
  return { beats: d.beats ?? clamp(Math.ceil((tF + 1.2) / BEAT), 5, 8), aIn: plane, aOut: fo >= 0 ? { ...cr(pts_[fo]), fill: th.hi } : plane, draw(g, lt, st) {
    ch.draw(g, lt, tF);
    if (!(st.noIn || (st.noOut && fo < 0))) card(g, plane, th.card);
    const e1 = eIO(prog(lt, 0.3, 0.5)), ax = mix(th.card, th.onCard, 0.85);
    rr(g, { x: px + 30, y: py + S / 2 - 3, w: (S - 60) * e1, h: 6 }, { fill: ax }); rr(g, { x: W / 2 - 3, y: py + S - 30 - (S - 60) * e1, w: 6, h: (S - 60) * e1 }, { fill: ax });
    const lab = mix(th.card, th.onCard, 0.6);
    kt(g, xa[0], px + 36, py + S / 2 - 22, 38, 700, lab, 'start', lt, 0.5); kt(g, xa[1], px + S - 36, py + S / 2 - 22, 38, 700, lab, 'end', lt, 0.55);
    kt(g, ya[1], W / 2 + 20, py + 62, 38, 700, lab, 'start', lt, 0.6); kt(g, ya[0], W / 2 + 20, py + S - 40, 38, 700, lab, 'start', lt, 0.65);
    pts_.forEach((p, i) => {
      const e = spr(lt, a(i), 18); if (e <= 0.01) return; const f = i === fo ? ap(lt, tF, 0.3) : 0, c = cr(p);
      if (i === fo && lt > tF) { const k = ((lt - tF) % BEAT) / BEAT; el('circle', { cx: X(p), cy: Y(p), r: 22 + 40 * eO(k), fill: 'none', stroke: th.hi, 'stroke-width': 6 * (1 - k) }, g); }
      el('circle', { cx: X(p), cy: Y(p), r: (20 * e).toFixed(1), fill: mix(th.onCard, th.hi, f) }, g);
      if (!(i === fo && st.noOut)) { const gg = G(g, { 'clip-path': clipR(c.x - 14, c.y - 14, (c.w + 28) * ap(lt, a(i) + 0.08), c.h + 28) }); card(gg, c, mix(th.bg, th.hi, f), { sh: 0.5 }); tx(gg, p.label, c.x + 42 * 0.55, c.y + c.h / 2 + 42 * 0.35, 42, 700, mix(th.fg, th.onHi, f)); }
    });
  } };
};

TYPES.scale = (d, th, key) => {
  const ch = chrome(d, th), bodyH = ch.y1 - ch.y0, marks = (d.marks || []).slice(0, 4), n = marks.length, wb = ENV.font.wb, cy = ch.y0 + bodyH / 2 + 40;
  const track = { x: M, y: cy - 28, w: 900, h: 56, r: rad(56), fill: th.soft }, fo = Math.max(0, marks.findIndex(m => m.focus) >= 0 ? marks.findIndex(m => m.focus) : n - 1);
  const order = marks.map((m, i) => i).filter(i => i !== fo).concat([fo]), a = k => 0.8 + k * BEAT, tE = a(n);
  const X = m => M + 30 + clamp(m.at) * 840, sorted = marks.map((m, i) => i).sort((p, q) => marks[p].at - marks[q].at), lvl = {}; sorted.forEach((i, k) => lvl[i] = k % 2);
  ch.hug(cy - 420, cy + 170);
  return { beats: d.beats ?? clamp(Math.ceil((tE + 1.0) / BEAT), 4, 7), aIn: track, aOut: track, draw(g, lt, st) {
    ch.draw(g, lt, tE);
    if (!(st.noIn || st.noOut)) card(g, track, th.soft, { plain: true });
    let kx = M + 30; order.forEach((i, k) => { kx = lerp(kx, X(marks[i]), eIO(prog(lt, a(k) - 0.1, 0.42))); });
    if (lt > 0.3) rr(g, { x: M, y: cy - 28, w: Math.max(56, kx - M + 28), h: 56, r: rad(56) }, { fill: th.hi });
    kt(g, d.left || '', M, cy + 130, 58, 700, th.fg, 'start', lt, 0.4); kt(g, d.right || '', W - M, cy + 130, 58, 700, th.fg, 'end', lt, 0.5);
    order.forEach((i, k) => {
      const m = marks[i], e = ap(lt, a(k) + 0.15), x = X(m), up = lvl[i] === 0, yy = cy - (up ? 170 : 320); if (e <= 0) return;
      rr(g, { x: x - 4, y: yy + (cy - 40 - yy) * (1 - e), w: 8, h: (cy - 40 - yy) * e }, { fill: th.fg });
      const w = chipW(m.label, 54), bx = clamp(x - w / 2, M, W - M - w), isF = i === fo && lt > tE - 0.3;
      chip(g, m.label, bx, yy - 40, 54, isF ? th.fg : th.card, isF ? th.bg : th.onCard, e);
    });
    if (lt > 0.3) { const e = spr(lt, 0.3, 18), pu = pulse(lt, tE, 0.06); el('circle', { cx: kx.toFixed(1), cy, r: (56 * e * pu).toFixed(1), fill: th.fg }, g); el('circle', { cx: kx.toFixed(1), cy, r: (22 * e).toFixed(1), fill: th.bg }, g); }
  } };
};

// the 2D-to-3D moment: a flat list tilts up into an exploded stack of slabs
TYPES.stack = (d, th, key) => {
  const ch = chrome({ title: d.title }, th), layers = (d.layers || []).slice(0, 4), n = layers.length, wd = ENV.font.wd, wb = ENV.font.wb, bodyH = 1690 - ch.y0;
  const S0 = 340, cy0 = ch.y0 + (bodyH - 170) / 2, zOf = i => ((n - 1) / 2 - i) * 0.74, t3 = 1.0, a = i => t3 + 0.75 + i * BEAT, fo = d.focus != null ? clamp(d.focus, 0, n - 1) : -1, tF = a(n);
  const LF = layers.map(l => fit(l.label, 720, 80, 40, 1, wd)), SF = layers.map(l => l.sub ? fit(l.sub, 900, 64, 40, 2, wb) : null), capY = 1690 - 170;
  const flat = i => ({ x: W / 2 - 1.25 * S0, y: cy0 - zOf(i) * S0 - 0.3 * S0, w: 2.5 * S0, h: 0.6 * S0, r: 0 });
  const ul = { x: ENV.align === 'center' ? W / 2 - 110 : M, y: capY + 130, w: 220, h: 18, r: rad(18), fill: th.hi };
  return { beats: d.beats ?? clamp(Math.ceil((tF + (fo >= 0 ? 1.0 : 0.5)) / BEAT), 6, 9), aIn: { ...flat(0), fill: th.card }, aOut: ul, draw(g, lt, st) {
    ch.draw(g, lt);
    const k = spr(lt, t3, 7), cam = { tilt: 56 * k * Math.PI / 180, yaw: -32 * k * Math.PI / 180 - 0.06 * clamp(lt - t3, 0, 9) * k, s: lerp(S0, 310, k), cx: W / 2 - 50 * k, cy: cy0 + 190 * k };
    const cur = lt < a(0) ? -1 : (lt >= tF && fo >= 0 ? fo : Math.min(n - 1, Math.floor((lt - a(0)) / BEAT)));
    for (let i = n - 1; i >= 0; i--) {
      const e = i === 0 ? 1 : spr(lt, 0.25 + i * 0.15, 18); if (e <= 0.01) continue;
      const tOn = i === fo && lt >= tF ? tF : a(i), on = cur === i ? ap(lt, tOn, 0.25) : 0, lift = (n - 1 - i) * 0.8 * k + on * 0.12 * k;
      if (i === 0 && st.noIn) continue;
      const top = mix(th.card, th.hi, on), b = { x: on * 0.16 * k, z: zOf(i) * (1 - k), rx: lerp(1.25, 1.08, k) * e, rz: lerp(0.3, 0.36, k) * e, y0: lift, h: 0.17 * k, top, side: mix(top, th.dark, 0.25), stroke: ENV.look === 'line' ? th.fg : null };
      box3(g, cam, b);
      if (lt > 0.3 + i * 0.15) { const gg = G(g, { transform: planeM(cam, b.x, lift + b.h, b.z, S0) }); tx(gg, layers[i].label, 0, LF[i].size * 0.35, LF[i].size, wd, mix(th.onCard, th.onHi, on), 'middle'); }
    }
    // caption for the layer in focus (screen space)
    const x = ENV.align === 'center' ? W / 2 : M, an = ENV.align === 'center' ? 'middle' : 'start';
    layers.forEach((l, i) => { if (!SF[i]) return; const t0 = i === fo && lt >= tF ? tF : a(i); if (cur !== i) return; kblock(g, SF[i], x, capY + (SF[i].lines.length === 1 ? 60 : 20), wb, th.fg, an, lt, t0 + 0.05, { lh: 1.3, stag: 0.04 }); });
    if (!st.noOut && lt > a(0)) card(g, { ...ul, w: 220 * ap(lt, a(0)) }, th.hi, { plain: true });
  } };
};

// one big pictogram with callouts: the "look at this thing" scene
TYPES.picture = (d, th, key) => {
  const ch = chrome(d, th), bodyH = ch.y1 - ch.y0, wd = ENV.font.wd, v = vOf(d, key, 2), calls = (d.callouts || []).slice(0, 3), lf = d.label ? fit(d.label, 900, 96, 50, 1, wd) : null;
  const S = Math.min(600, bodyH - (lf ? 190 : 40)), py = ch.y0 + (bodyH - S - (lf ? 150 : 0)) / 2, plate = { x: W / 2 - S / 2, y: py, w: S, h: S, r: ENV.shape === 'sharp' ? 8 : ENV.shape === 'pill' ? S / 2 : 90, fill: v === 0 ? th.hi : th.card };
  const c1 = v === 0 ? th.onHi : th.onCard, c2 = v === 0 ? (contrast(th.hi2, th.hi) > 1.6 ? th.hi2 : th.onHi) : th.hi;
  const slots = [[M - 30, py + 30, 'start'], [W - M + 30, py + S - 60, 'end'], [M - 30, py + S * 0.62, 'start']], a = k => 1.0 + k * BEAT;
  ch.hug(py, py + S + (lf ? 170 : 0));
  return { beats: d.beats ?? clamp(4 + calls.length + (d.change ? 2 : 0), 4, 8), aIn: plate, aOut: plate, draw(g, lt, st) {
    ch.draw(g, lt, a(calls.length));
    const pu = pulse(lt, 1.0, 0.02), gp = G(g, { transform: `translate(${W / 2} ${py + S / 2}) scale(${pu.toFixed(4)}) translate(${-W / 2} ${-(py + S / 2)})` });
    if (!(st.noIn || st.noOut)) card(gp, plate, plate.fill);
    const cg = d.change ? spr(lt, a(calls.length), 6) : 0, e = spr(lt, 0.3, 14) * (d.change === 'shrink' ? 1 - 0.42 * cg : d.change === 'grow' ? 1 + 0.3 * cg : 1); if (e > 0.01) { if (!icon(gp, d.icon, W / 2, py + S / 2, S * 0.66 * e, c1, c2, plate.fill)) tx(gp, d.icon || '?', W / 2, py + S / 2 + S * 0.18 * e, S * 0.5 * e, isEmoji(d.icon) ? 400 : wd, c1, 'middle'); }
    if (lf) kt(g, d.label, W / 2, py + S + 70 + lf.size * 0.8, lf.size, wd, th.fg, 'middle', lt, 0.5);
    calls.forEach((c, k) => { const [x, y, an] = slots[k]; chip(g, c, x, y, 58, th.fg, th.bg, ap(lt, a(k)), { anchor: an, plain: true }); });
  } };
};

// dots on a number line: distributions, spread, "where do the values sit"
TYPES.dots = (d, th, key) => {
  const ch = chrome(d, th), bodyH = ch.y1 - ch.y0, wb = ENV.font.wb, wd = ENV.font.wd, groups = (d.groups || []).slice(0, 3).map(g => ({ ...g, values: (g.values || []).slice(0, 14).map(Number) })), ng = groups.length;
  const all = groups.flatMap(g => g.values), lo = d.min ?? Math.min(...all), hi = d.max ?? Math.max(...all), span = (hi - lo) || 1, X = v => M + 60 + (v - lo) / span * 780;
  const rowH = Math.min(ng === 1 ? 620 : 470, bodyH / ng), top = ch.y0 + (bodyH - rowH * ng) / 2, a = gi => 0.4 + gi * BEAT * 2, tE = a(ng);
  let R = 28, rows; const mk = () => groups.map((g, gi) => { const y = top + gi * rowH + rowH - 70, sorted = g.values.slice().sort((p, q) => p - q), placed = [];
    const dots = sorted.map(v => { const sx = M + 60 + Math.round((X(v) - M - 60) / (R * 2 + 4)) * (R * 2 + 4); let lvl = 0; while (placed.some(p => p.lvl === lvl && Math.abs(p.x - sx) < R * 2)) lvl++; const o = { x: sx, lvl, v }; placed.push(o); return o; });
    const mean = g.values.reduce((s, v) => s + v, 0) / Math.max(1, g.values.length); const sd = Math.sqrt(g.values.reduce((s, v) => s + (v - mean) * (v - mean), 0) / Math.max(1, g.values.length)); return { y, dots, mean, sd, min: sorted[0], max: sorted[sorted.length - 1], top: Math.max(...dots.map(p => p.lvl)) }; });
  R = 28; rows = mk(); rows.forEach(r => { r.sp = Math.min(R * 2 + 4, (rowH - 250 - R * 2) / Math.max(1, r.top)); });
  const line0 = { x: M, y: rows[0].y + R + 14, w: 900, h: 8, r: 4, fill: th.fg }, colOf = gi => gi === 0 ? th.hi : (contrast(th.hi2, th.bg) > 1.6 && th.hi2 !== th.fg ? th.hi2 : th.fg);
  const band = { x: X(rows[ng - 1].min) - R, y: rows[ng - 1].y - R * 4.2, w: X(rows[ng - 1].max) - X(rows[ng - 1].min) + R * 2, h: 20, r: 10, fill: colOf(ng - 1) };
  ch.hug(top + 60, top + rowH * ng + 40);
  return { beats: d.beats ?? clamp(Math.ceil((tE + (d.deviation ? 2.4 : d.say2 ? 2.2 : 1.2)) / BEAT), 5, 12), aIn: line0, aOut: band, draw(g, lt, st) {
    ch.draw(g, lt, BEAT * 2, tE + (d.deviation ? 0.4 : 0.9));
    rows.forEach((r, gi) => {
      const G0 = groups[gi], col = colOf(gi), t0 = a(gi), ly = r.y + R + 14;
      if (!(gi === 0 && st.noIn)) rr(g, { x: M, y: ly, w: 900 * (gi === 0 ? 1 : eIO(prog(lt, t0 - 0.2, 0.4))), h: 8, r: 4 }, { fill: th.fg });
      kt(g, G0.label || '', M, r.y - rowH + 170, 68, wd, th.fg, 'start', lt, t0);
      if (d.deviation) { const td = tE + 0.3 + gi * 0.3; r.dots.forEach(p => { const ed = eIO(prog(lt, td, 0.5)), yy = r.y - p.lvl * r.sp; if (ed > 0 && Math.abs(p.x - X(r.mean)) > 4) el('line', { x1: X(r.mean), y1: yy, x2: lerp(X(r.mean), p.x, ed).toFixed(1), y2: yy, stroke: col, 'stroke-width': 12, 'stroke-linecap': 'round', opacity: 0.55 }, g); }); chip(g, (d.sdLabel || '평균 거리') + ' ' + num(r.sd, 1), M + tw(G0.label || '', 68, wd) + 34, r.y - rowH + 148, 46, col, contrast(col, th.bg) > 2 ? th.bg : th.fg, ap(lt, td + 0.4), { plain: true }); }
      r.dots.forEach((p, k) => { const e = spr(lt, t0 + 0.1 + k * (0.7 / r.dots.length), 14); if (e <= 0.01) return; const yy = r.y - p.lvl * r.sp; el('circle', { cx: p.x.toFixed(1), cy: (yy - (1 - e) * 220).toFixed(1), r: (R * Math.min(1, e * 1.4)).toFixed(1), fill: col, stroke: th.bg, 'stroke-width': 5 }, g); });
      const tm = t0 + 0.95, em = eIO(prog(lt, tm, 0.35));
      if (em > 0) { const maxL = Math.max(...r.dots.map(p => p.lvl)), bt = r.y - maxL * r.sp - R - 26; if (!(gi === ng - 1 && st.noOut)) rr(g, { x: X(r.mean) - (X(r.mean) - (X(r.min) - R)) * em, y: gi === ng - 1 ? band.y : bt - 20, w: (X(r.max) - X(r.min) + R * 2) * em, h: 20, r: 10 }, { fill: col });
        rr(g, { x: X(r.mean) - 4, y: ly - (ly - bt + 60) * em, w: 8, h: (ly - bt + 60) * em }, { fill: th.fg }); if (d.meanLabel !== false) chip(g, (d.meanLabel || '평균') + ' ' + num(r.mean, decOf(Math.round(r.mean * 10) / 10)), X(r.mean) + 14, bt - 92, 48, th.fg, th.bg, ap(lt, tm + 0.2), { plain: true }); }
    });
    if (lt > 0.5) { const ty = rows[ng - 1].y + R + 82, u = d.unit ? String(d.unit).replace(/\s*\(예시\)/, '') : ''; tx(g, num(lo, decOf(lo)) + u, X(lo), ty, 46, 700, th.mute, 'middle'); tx(g, num(hi, decOf(hi)) + u, X(hi), ty, 46, 700, th.mute, 'middle'); }
  } };
};
