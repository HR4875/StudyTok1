// Soundtrack written in code from the scene timeline: kick on every beat, hit on each scene change, riser into the last scene.
async function renderAudio(T, DUR, seed) {
  const SR = 48000, ctx = new OfflineAudioContext(2, Math.ceil(SR * DUR), SR);
  const master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination);
  const nb = ctx.createBuffer(1, SR * 2, SR), nd = nb.getChannelData(0); let s = 7 + (seed % 97);
  for (let i = 0; i < nd.length; i++) { s = (s * 16807) % 2147483647; nd[i] = (s / 2147483647) * 2 - 1; }
  const kick = t => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.9, t + 0.004); g.gain.exponentialRampToValueAtTime(0.001, t + 0.36); o.connect(g).connect(master); o.start(t); o.stop(t + 0.4); };
  const hat = (t, v) => { const b = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); b.buffer = nb; f.type = 'highpass'; f.frequency.value = 8000;
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05); b.connect(f).connect(g).connect(master); b.start(t, (t * 0.37) % 1.5, 0.06); };
  const hit = (t, big) => { const b = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); b.buffer = nb; f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.7;
    g.gain.setValueAtTime(big ? 0.9 : 0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + (big ? 0.7 : 0.32)); b.connect(f).connect(g).connect(master); b.start(t, 0.1, 0.8);
    const o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(big ? 98 : 196, t); o.frequency.exponentialRampToValueAtTime(big ? 49 : 98, t + 0.3);
    og.gain.setValueAtTime(0.45, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.45); o.connect(og).connect(master); o.start(t); o.stop(t + 0.5); };
  const bass = (t, fr, d) => { const o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain(); o.type = 'sawtooth'; o.frequency.value = fr; lp.type = 'lowpass'; lp.frequency.value = 320;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.2, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + d); o.connect(lp).connect(g).connect(master); o.start(t); o.stop(t + d + 0.02); };
  const pluck = (t, fr) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.value = fr; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + 0.005); g.gain.exponentialRampToValueAtTime(0.001, t + 0.22); o.connect(g).connect(master); o.start(t); o.stop(t + 0.25); };
  const progs = [[55, 43.65, 65.41, 49], [49, 58.27, 43.65, 65.41], [61.74, 46.25, 55, 41.2]], roots = progs[seed % progs.length], pent = [1, 1.2, 1.5, 1.8, 2];
  const nB = Math.floor(DUR / RB + 1e-6), last = T[T.length - 2];
  for (let i = 0; i < nB; i++) { const t = i * RB; let sc = 0; while (sc < T.length - 2 && t >= T[sc + 1]) sc++; const r = roots[sc % 4];
    kick(t); if (t + RB / 2 < DUR) { hat(t + RB / 2, 0.11); bass(t + RB / 2, r, 0.22); } if (i % 2 === 1 && t < DUR - 0.5) pluck(t, r * 4 * pent[(i * 3 + sc) % 5]); }
  T.slice(1, -1).forEach(t => hit(t, t === last));
  const r0 = Math.max(0, last - 2);
  if (last - r0 > 0.9) { const rs = ctx.createBufferSource(), rf = ctx.createBiquadFilter(), rg = ctx.createGain(); rs.buffer = nb; rs.loop = true; rf.type = 'bandpass'; rf.Q.value = 2;
    rf.frequency.setValueAtTime(300, r0); rf.frequency.exponentialRampToValueAtTime(7000, last); rg.gain.setValueAtTime(0.0001, r0); rg.gain.exponentialRampToValueAtTime(0.45, last - 0.02); rg.gain.linearRampToValueAtTime(0.0001, last + 0.02);
    rs.connect(rf).connect(rg).connect(master); rs.start(r0); rs.stop(last + 0.05); }
  const buf = await ctx.startRendering(), L = buf.getChannelData(0), R = buf.getChannelData(1), n = L.length;
  let peak = 0; for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i])); const gain = peak > 0 ? 0.89 / peak : 1;
  const ab = new ArrayBuffer(44 + n * 4), dv = new DataView(ab), ws = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, 'RIFF'); dv.setUint32(4, 36 + n * 4, true); ws(8, 'WAVE'); ws(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 2, true); dv.setUint32(24, SR, true);
  dv.setUint32(28, SR * 4, true); dv.setUint16(32, 4, true); dv.setUint16(34, 16, true); ws(36, 'data'); dv.setUint32(40, n * 4, true);
  let o = 44; for (let i = 0; i < n; i++) { dv.setInt16(o, Math.max(-1, Math.min(1, L[i] * gain)) * 32767, true); o += 2; dv.setInt16(o, Math.max(-1, Math.min(1, R[i] * gain)) * 32767, true); o += 2; }
  let bin = ''; const u8 = new Uint8Array(ab); for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(bin);
}
