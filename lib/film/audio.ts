// @ts-nocheck
// Director 2 soundtrack. It is written in code, so every short gets music and effects cut to its own picture cues, at no cost.
// renderScore(score, seconds) plays the score offline and returns the samples (48 kHz stereo), already limited.
//
// score = {
//   bpm, root (MIDI note of the tonic), mode: 'major' | 'minor' | 'dorian' | 'lydian',
//   style: { lead: 'mallet'|'pluck'|'square'|'bell'|'sine', drums: 'full'|'soft'|'none', arpV, ... },
//   t0: seconds where bars[0] starts, bars: [[degree 1..7, level 0..3, 'thin'|'skip'|'half'|''], ...]  one entry per 4-beat bar
//   cues: [{ k: 'tick'|'thud'|'whoosh'|'note'|'chord'|'hit'|'run'|'pop'|..., t, ... }], end: { t, deg }, master, ceil
// }
let LIMIT = null;

// look-ahead limiter on the finished mix: the gain is already down when a peak arrives, so nothing clips
function limitStereo(L, R, SR, gain, ceil) {
  const n = L.length, look = Math.round(SR * 0.008), need = new Float32Array(n);
  for (let i = 0; i < n; i++) { L[i] *= gain; R[i] *= gain; const a = Math.max(Math.abs(L[i]), Math.abs(R[i])); need[i] = a > ceil ? ceil / a : 1; }
  const mn = new Float32Array(n), q = new Int32Array(n); let qh = 0, qt = 0;
  for (let i = n - 1; i >= 0; i--) { while (qt > qh && need[q[qt - 1]] >= need[i]) qt--; q[qt++] = i; while (q[qh] > i + look) qh++; mn[i] = need[q[qh]]; }
  const k = 1 - Math.exp(-1 / (SR * 0.15)); let r = 1;
  for (let i = 0; i < n; i++) { r = mn[i] < r ? mn[i] : r + (mn[i] - r) * k; mn[i] = r; }
  let acc = 0, lo = 1, cnt = 0;
  for (let i = 0; i < n; i++) { acc += mn[i]; if (i >= look) acc -= mn[i - look]; const g = acc / Math.min(i + 1, look); L[i] *= g; R[i] *= g; if (g < lo) lo = g; if (g < 0.891) cnt++; }
  LIMIT = { deepestDb: +(20 * Math.log10(lo)).toFixed(1), secondsOver1dB: +(cnt / SR).toFixed(2) };   // how hard the limiter worked, for tuning
}

export async function renderScore(S, DUR, seed = 3) {
  S = S || {}; const SR = 48000, N = Math.ceil(SR * DUR), ctx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(2, N, SR);
  const bpm = S.bpm || 120, q = 60 / bpm, barLen = 4 * q, root = S.root || 62;
  const SCALE = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], lydian: [0, 2, 4, 6, 7, 9, 11] }[S.mode || 'major'];
  const st = Object.assign({ lead: 'mallet', drums: 'full', arp: [0, 2, 1, 2, 3, 2, 1, 2], pad: 1, bass: 1, arpV: 1, kickV: 1, hatV: 1 }, S.style || {});
  const mf = m => 440 * Math.pow(2, (m - 69) / 12);
  const sc = (step, oct = 0) => { const n = SCALE.length, o = Math.floor(step / n), i = ((step % n) + n) % n; return root + SCALE[i] + 12 * (o + oct); };
  const voice = (pcs, lo, n) => { const out = []; for (let m = lo; out.length < n && m < lo + 40; m++) if (pcs.includes(((m % 12) + 12) % 12)) out.push(m); return out; };
  const chord = d => { const pcs = [sc(d - 1), sc(d + 1), sc(d + 3)].map(m => ((m % 12) + 12) % 12); return { r: mf(voice([pcs[0]], root - 24, 1)[0]), a: voice(pcs, root, 4).map(mf), p: voice(pcs, root - 12, 3).map(mf) }; };

  const bus = ctx.createGain(), comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -24; comp.knee.value = 8; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.16;
  bus.connect(comp).connect(ctx.destination);
  let s = 11 + (((seed | 0) % 89) + 89) % 89; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647 * 2 - 1; };
  const nb = ctx.createBuffer(1, SR * 2, SR), nd = nb.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = rnd();
  // a small soft room, built from filtered noise
  const ir = ctx.createBuffer(2, Math.floor(SR * 2.0), SR);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); let lp = 0; for (let i = 0; i < d.length; i++) { const x = i / SR; lp += 0.32 * (rnd() - lp); d[i] = lp * Math.exp(-x * 3.4) * (x < 0.012 ? x / 0.012 : 1); } }
  const conv = ctx.createConvolver(), wet = ctx.createGain(); conv.buffer = ir; wet.gain.value = 0.55; conv.connect(wet).connect(bus);
  const send = (node, amt) => { const g = ctx.createGain(); g.gain.value = amt; node.connect(g).connect(conv); };
  const env = (g, t, v, a, d) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); };
  const ok = t => t >= 0 && t < DUR - 0.02;

  // ---------- instruments ----------
  const tonal = (types, mults, vols, decs) => (t, f, v = 0.3, dec = 0.6, pan = 0, rev = 0.24, cut) => { if (!ok(t)) return; const p = ctx.createStereoPanner(); p.pan.value = pan; let outN = p;
    if (cut) { const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = cut; p.connect(lp); outN = lp; }
    outN.connect(bus); send(outN, rev);
    types.forEach((ty, i) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = ty; o.frequency.value = f * mults[i]; env(g, t, v * vols[i], 0.003, dec * decs[i]); o.connect(g).connect(p); o.start(t); o.stop(t + dec * decs[i] + 0.06); }); };
  const INST = {
    mallet: tonal(['sine', 'sine'], [1, 4], [1, 0.26], [1, 0.2]),
    bell: tonal(['sine', 'sine', 'sine'], [1, 2.76, 5.4], [1, 0.3, 0.1], [1.5, 0.7, 0.3]),
    sine: tonal(['sine'], [1], [1], [1]),
    pluck: (t, f, v = 0.3, dec = 0.5, pan = 0, rev = 0.24) => tonal(['triangle', 'sawtooth'], [1, 1], [1, 0.22], [0.8, 0.35])(t, f, v, dec, pan, rev, Math.min(6000, f * 5)),
    square: (t, f, v = 0.3, dec = 0.4, pan = 0, rev = 0.1) => tonal(['square'], [1], [0.42], [0.55])(t, f, v, dec, pan, rev, 3600),
  };
  const inst = name => INST[name] || INST[st.lead] || INST.mallet, ld = inst(st.lead);
  const kick = (t, v = 0.7) => { if (!ok(t)) return; const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(128, t); o.frequency.exponentialRampToValueAtTime(46, t + 0.1); env(g, t, v, 0.004, 0.26); o.connect(g).connect(bus); o.start(t); o.stop(t + 0.32); };
  const bass = (t, f, d = 0.3, v = 0.3) => { if (!ok(t)) return; const o = ctx.createOscillator(), o2 = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.value = f; o2.frequency.value = f; lp.type = 'lowpass'; lp.frequency.value = 520;
    const sg = ctx.createGain(); sg.gain.value = 0.3; env(g, t, v, 0.008, d); o.connect(lp).connect(g); o2.connect(sg).connect(g); g.connect(bus); o.start(t); o2.start(t); o.stop(t + d + 0.05); o2.stop(t + d + 0.05); };
  const noise = (t, off, dur, type, freq, Q, v, dec, rev = 0) => { if (!ok(t)) return; const b = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); b.buffer = nb; f.type = type; f.frequency.value = freq; if (Q) f.Q.value = Q;
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0005, t + dec); b.connect(f).connect(g).connect(bus); if (rev) send(g, rev); b.start(t, off % 1.8, dur); };
  const hat = (t, v = 0.05) => noise(t, t * 0.371, 0.05, 'highpass', 8500, 0, v, 0.04);
  const rim = (t, v = 0.1) => { if (!ok(t)) return; noise(t, 0.77, 0.09, 'bandpass', 2100, 1.2, v, 0.07, 0.25); const o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'triangle'; o.frequency.value = 330; env(og, t, v * 0.7, 0.001, 0.045); o.connect(og).connect(bus); o.start(t); o.stop(t + 0.07); };
  // every small state change: one dry tick; only its pitch differs, and it is tuned to the key
  const tick = (t, f = 2100, v = 0.14, d = 0.035) => { if (!ok(t)) return; const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.82, t + d); env(g, t, v, 0.001, d); o.connect(g).connect(bus); o.start(t); o.stop(t + d + 0.02); };
  // every arrival of something with weight: one soft thud
  const thud = (t, v = 0.4) => { if (!ok(t)) return; const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(104, t); o.frequency.exponentialRampToValueAtTime(58, t + 0.12); env(g, t, v, 0.003, 0.2); o.connect(g).connect(bus); o.start(t); o.stop(t + 0.26); noise(t, 0.21, 0.08, 'lowpass', 900, 0, v * 0.3, 0.06); };
  const whoosh = (t0, tp, t1, v = 0.22, f0 = 500, f1 = 3200, f2 = f0 * 1.4) => { if (!ok(t0)) return; const b = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); b.buffer = nb; b.loop = true; f.type = 'bandpass'; f.Q.value = 1.1;
    f.frequency.setValueAtTime(f0, t0); f.frequency.exponentialRampToValueAtTime(f1, tp); f.frequency.exponentialRampToValueAtTime(f2, t1);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v, tp); g.gain.exponentialRampToValueAtTime(0.0001, t1); b.connect(f).connect(g).connect(bus); send(g, 0.2); b.start(t0); b.stop(t1 + 0.02); };
  // a held chord: soft triangles through a low-pass, with slow edges so chords melt into each other
  const pad = (t0, t1, freqs, v = 0.05, cut = 900, edge = 0.35) => { t0 = Math.max(0, t0); t1 = Math.min(DUR - 0.05, t1); if (t1 - t0 < 0.1) return; freqs.forEach((fr, i) => { const o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain(), p = ctx.createStereoPanner(); o.type = 'triangle'; o.frequency.value = fr; o.detune.value = (i % 2 ? 5 : -5); lp.type = 'lowpass'; lp.frequency.value = cut; p.pan.value = (i - (freqs.length - 1) / 2) * 0.3;
    const a = Math.min(edge, (t1 - t0) * 0.45); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(v, t0 + a); g.gain.setValueAtTime(v, Math.max(t0 + a, t1 - a)); g.gain.linearRampToValueAtTime(0.0001, t1); o.connect(lp).connect(g).connect(p).connect(bus); send(p, 0.3); o.start(t0); o.stop(t1 + 0.02); }); };
  // a line that rises into a cue and stops just before it
  const riser = (t0, t1, v = 0.035) => { if (!ok(t0)) return; const o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.setValueAtTime(mf(sc(4, -1)), t0); o.frequency.exponentialRampToValueAtTime(mf(sc(4, 1)), t1); lp.type = 'lowpass'; lp.frequency.value = 2400;
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v, t1 - 0.02); g.gain.linearRampToValueAtTime(0.0001, t1 + 0.02); o.connect(lp).connect(g).connect(bus); o.start(t0); o.stop(t1 + 0.04); };
  // a run of ticks up (or down) the scale that slows as it lands
  const run = (t, d = 0.56, n = 11, v = 0.075, from = 7, down) => { for (let i = 0; i < n; i++) { const x = i / Math.max(1, n - 1), tt = t + 0.02 + d * (1 - Math.pow(1 - x, 2.2)); tick(tt, mf(sc(from + (down ? -i : i), 1)), v * (1 - 0.35 * x), 0.03); } };
  // the biggest moment of a film: low hit, noise, the chord
  const impact = (t, v = 1, deg = 1, withRun) => { if (!ok(t)) return; const ch = chord(deg); kick(t, 0.7 * v); bass(t, ch.r, 0.9, 0.3 * v);
    const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(82, t); o.frequency.exponentialRampToValueAtTime(36, t + 0.5); env(g, t, 0.3 * v, 0.004, 0.7); o.connect(g).connect(bus); o.start(t); o.stop(t + 0.8);
    noise(t, 0.3, 0.5, 'bandpass', 1500, 0.6, 0.3 * v, 0.4, 0.4);
    [...ch.a, ch.a[0] * 2].forEach((fr, i) => ld(t, fr, 0.2 * v, 1.3, (i - 2) * 0.2, 0.4)); if (withRun) run(t); };
  // split-flap, switch, latch: a dry mechanical click
  const flap = (t, v = 0.16) => { if (!ok(t)) return; noise(t, t * 0.613, 0.04, 'bandpass', 1900, 1.4, v, 0.03); const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(190, t); o.frequency.exponentialRampToValueAtTime(95, t + 0.05); env(g, t, v * 0.8, 0.001, 0.05); o.connect(g).connect(bus); o.start(t); o.stop(t + 0.08); };
  // liquid running: the pitch climbs as the vessel fills
  const pour = (t0, t1, v = 0.06, f = 1100) => { if (!ok(t0) || t1 - t0 < 0.1) return; const b = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain(); b.buffer = nb; b.loop = true; fl.type = 'bandpass'; fl.Q.value = 0.9; fl.frequency.setValueAtTime(f * 0.75, t0); fl.frequency.linearRampToValueAtTime(f * 1.35, t1);
    const a = Math.min(0.15, (t1 - t0) / 3); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(v, t0 + a); g.gain.setValueAtTime(v, t1 - a); g.gain.linearRampToValueAtTime(0.0001, t1); b.connect(fl).connect(g).connect(bus); send(g, 0.15); b.start(t0); b.stop(t1 + 0.02); };
  const pop = (t, f = 520, v = 0.12) => { if (!ok(t)) return; const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 1.8, t + 0.05); env(g, t, v, 0.002, 0.08); o.connect(g).connect(bus); send(g, 0.2); o.start(t); o.stop(t + 0.12); };
  const blip = (t, f = 880, v = 0.08, d = 0.07) => { if (!ok(t)) return; const o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain(); o.type = 'square'; o.frequency.value = f; lp.type = 'lowpass'; lp.frequency.value = 4200; env(g, t, v, 0.002, d); o.connect(lp).connect(g).connect(bus); o.start(t); o.stop(t + d + 0.03); };
  // a sound that is held and shaped by hand. pts: [[t, gain], ...] joined by straight lines
  const shaped = (g, pts) => { g.gain.setValueAtTime(0.0001, Math.max(0, pts[0][0] - 0.01)); pts.forEach(([t, v]) => g.gain.linearRampToValueAtTime(Math.max(0.0001, v), Math.max(0, t))); };
  const tone = (pts, f, type = 'sine', pan = 0) => { const o = ctx.createOscillator(), g = ctx.createGain(), p = ctx.createStereoPanner(); o.type = type; o.frequency.value = f; p.pan.value = pan; shaped(g, pts); o.connect(g).connect(p).connect(bus); send(p, 0.25); const t0 = Math.max(0, pts[0][0] - 0.01), t1 = Math.min(DUR - 0.02, pts[pts.length - 1][0] + 0.05); o.start(t0); o.stop(t1); };
  const hum = (pts, f = 110, nz = 0.5) => { [1, 2, 3].forEach((m, i) => tone(pts.map(([t, v]) => [t, v * [1, 0.45, 0.2][i]]), f * m, i ? 'sine' : 'triangle'));
    const b = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain(); b.buffer = nb; b.loop = true; fl.type = 'lowpass'; fl.frequency.value = 700; shaped(g, pts.map(([t, v]) => [t, v * nz])); b.connect(fl).connect(g).connect(bus); const t0 = Math.max(0, pts[0][0] - 0.01); b.start(t0); b.stop(Math.min(DUR - 0.02, pts[pts.length - 1][0] + 0.05)); };

  // ---------- one bar of groove. lvl 0: kick on 1 and 3 with bass. 1: four on the floor, hats, quiet arpeggio. 2: rim, sixteenths, fuller arpeggio. 3: the peak.
  const bar = (t0, deg, lvl, flags = '') => { const ch = chord(deg), thin = flags.includes('thin'), skip = flags.includes('skip'), beats = flags.includes('half') ? 2 : 4;
    if (st.pad) pad(t0 - 0.12, t0 + beats * q + 0.12, ch.p, [0.027, 0.035, 0.043, 0.08][lvl] * st.pad, lvl >= 3 ? 1700 : 1300);
    for (let k = 0; k < beats; k++) { const t = t0 + k * q, first = skip && k === 0;
      if (st.drums !== 'none') {
        if (!first && (lvl >= 1 || k % 2 === 0) && !(thin && k % 2)) kick(t, (lvl >= 3 ? 0.5 : 0.3) * st.kickV * (st.drums === 'soft' ? 0.7 : 1));
        if (lvl >= 1) hat(t + q / 2, (lvl >= 3 ? 0.07 : 0.055) * st.hatV);
        if (lvl >= 2 && !thin) { hat(t + q / 4, 0.028 * st.hatV); hat(t + 3 * q / 4, 0.028 * st.hatV); if (k % 2 && st.drums === 'full') rim(t, lvl >= 3 ? 0.11 : 0.07); }
      }
      if (st.bass && !first) bass(t, ch.r, (k % 2 === 0 ? 0.92 : 0.6) * q, (k % 2 === 0 ? 0.15 : 0.1) * (lvl >= 3 ? 1.7 : 1) * st.bass);
      if (st.bass && lvl >= 1 && !thin) bass(t + q / 2, ch.r * 2, 0.32 * q, 0.12 * st.bass);
      if (lvl >= 1) for (let e = 0; e < 2; e++) { const j = k * 2 + e, v = [0, 0.065, 0.095, 0.17][lvl] * (e ? 0.75 : 1) * st.arpV; ld(t + e * q / 2, ch.a[st.arp[j % st.arp.length] % ch.a.length], v, 0.5, j % 2 ? 0.28 : -0.28, 0.3); } } };
  (S.bars || []).forEach((b, i) => { if (b) bar((S.t0 || 0) + i * barLen, b[0], b[1], b[2] || ''); });

  // ---------- picture cues ----------
  (S.cues || []).forEach(c => { switch (c.k) {
    case 'tick': tick(c.t, c.f || mf(sc(c.step == null ? 7 : c.step, c.oct == null ? 2 : c.oct)), c.v || 0.1, c.d || 0.035); break;
    case 'thud': thud(c.t, c.v || 0.2); break;
    case 'whoosh': whoosh(c.t0, c.tp == null ? (c.t0 + c.t1) / 2 : c.tp, c.t1, c.v || 0.11, c.f0 || 380, c.f1 || 2400, c.f2); break;
    case 'lead': ld(c.t, mf(sc(c.step, c.oct || 0)), c.v || 0.24, c.dec || 1.0, c.pan || 0, 0.4); break;
    case 'note': inst(c.inst)(c.t, c.f || mf(sc(c.step || 0, c.oct || 0)), c.v || 0.15, c.dec || 0.6, c.pan || 0, c.rev == null ? 0.3 : c.rev); break;
    case 'chord': chord(c.deg || 1).a.forEach((fr, i) => inst(c.inst)(c.t + (c.strum || 0) * i, fr, c.v || 0.14, c.dec || 1.2, (i - 1.5) * 0.2, 0.4)); break;
    case 'hit': impact(c.t, c.v || 1, c.deg || 1, c.run); break;
    case 'run': run(c.t, c.d, c.n, c.v, c.from, c.down); break;
    case 'rise': riser(c.t0, c.t1, c.v); break;
    case 'pad': pad(c.t0, c.t1, chord(c.deg || 1).p, c.v || 0.025, c.cut || 800, c.edge || 0.5); break;
    case 'flap': flap(c.t, c.v); break;
    case 'pour': pour(c.t0, c.t1, c.v, c.f); break;
    case 'pop': pop(c.t, c.f || mf(sc(c.step || 0, c.oct == null ? 1 : c.oct)), c.v); break;
    case 'blip': blip(c.t, c.f || mf(sc(c.step || 0, c.oct == null ? 1 : c.oct)), c.v, c.d); break;
    case 'hum': hum(c.pts, c.f, c.noise); break;
    case 'tone': tone(c.pts, c.f || mf(sc(c.step || 0, c.oct || 0)), c.type, c.pan); break;
    case 'kick': kick(c.t, c.v || 0.5); break;
    case 'bass': bass(c.t, chord(c.deg || 1).r, c.d || 0.9, c.v || 0.2); break;
  } });

  // ---------- the ending subtracts: one soft chord is left ----------
  if (S.end) { const t = S.end.t, v = S.end.v || 1, ch = chord(S.end.deg || 1);
    ld(t, ch.a[3], 0.2 * v, 2.2, 0.08, 0.55); ld(t, ch.a[1], 0.1 * v, 2.0, -0.15, 0.5); ld(t, ch.a[0], 0.1 * v, 2.2, 0.15, 0.5); bass(t, ch.r, 1.6, 0.16 * v);
    pad(t, Math.min(DUR - 0.6, t + 3.2), ch.p, 0.022 * v, 800, 1.2); }

  const buf = await ctx.startRendering(), L = buf.getChannelData(0), R = buf.getChannelData(1), n = L.length, CEIL = S.ceil || 0.79;
  limitStereo(L, R, SR, S.master || 1.6, CEIL);
  for (let i = 0; i < 2400; i++) { const k = i / 2400, j = n - 480 - 2400 + i; if (j >= 0) { L[j] *= 1 - k; R[j] *= 1 - k; } }
  for (let i = Math.max(0, n - 480); i < n; i++) { L[i] = 0; R[i] = 0; }
  for (let i = 0; i < n; i++) { L[i] = Math.max(-CEIL, Math.min(CEIL, L[i])); R[i] = Math.max(-CEIL, Math.min(CEIL, R[i])); }
  return { L, R, SR, n, limit: LIMIT };
}

/** 16-bit stereo WAV as base64 (for writing a file next to a rendered video) */
export function toWavBase64(a) {
  const { L, R, SR, n } = a, ab = new ArrayBuffer(44 + n * 4), dv = new DataView(ab), ws = (o, str) => { for (let i = 0; i < str.length; i++) dv.setUint8(o + i, str.charCodeAt(i)); };
  ws(0, 'RIFF'); dv.setUint32(4, 36 + n * 4, true); ws(8, 'WAVE'); ws(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 2, true); dv.setUint32(24, SR, true);
  dv.setUint32(28, SR * 4, true); dv.setUint16(32, 4, true); dv.setUint16(34, 16, true); ws(36, 'data'); dv.setUint32(40, n * 4, true);
  let o = 44; for (let i = 0; i < n; i++) { dv.setInt16(o, L[i] * 32767, true); o += 2; dv.setInt16(o, R[i] * 32767, true); o += 2; }
  let bin = ''; const u8 = new Uint8Array(ab); for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(bin);
}
/** the same sound as a buffer a live AudioContext can play */
export function toAudioBuffer(ctx, a) { const b = ctx.createBuffer(2, a.n, a.SR); b.getChannelData(0).set(a.L); b.getChannelData(1).set(a.R); return b; }
