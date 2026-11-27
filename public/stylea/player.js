// Live player for Style A specs. Runs inside /player (an iframe) and is driven by the parent with postMessage.
// The parent owns sound and voice (its audio is already unlocked by a tap); this page only draws and keeps time.
(function () {
  let info = null, spec = null, playing = false, speed = 1, loop = true, t = 0, last = 0, raf = 0, scene = -1, sentAt = 0, token = 0;
  const post = (m) => parent.postMessage(Object.assign({ from: 'stylea' }, m), location.origin);
  const line = (s) => {
    if (!s) return '';
    if (typeof s.voice === 'string') return s.voice;
    const parts = [s.title, Array.isArray(s.lines) ? s.lines.join(' ') : s.text, s.term, s.desc, s.takeaway, s.say, s.say2, s.answerLabel && s.answer ? s.answerLabel + ' ' + s.answer : ''];
    return parts.filter((x) => typeof x === 'string' && x).join('. ');
  };
  const sceneAt = (x) => { let i = 0; while (i < info.T.length - 2 && x >= info.T[i + 1]) i++; return i; };
  function frame(now) {
    raf = 0;
    if (!info || !playing) return;
    t += Math.min(0.1, (now - last) / 1000) * speed; last = now;
    if (t >= info.DUR) {
      if (!loop) { t = info.DUR - 0.001; seek(t); playing = false; post({ type: 'progress', p: 1 }); post({ type: 'ended' }); return; }
      t = 0; scene = -1; post({ type: 'loop' });
    }
    try { seek(t); } catch (err) { playing = false; post({ type: 'error', message: String(err && err.message || err) }); return; }
    const i = sceneAt(t);
    if (i !== scene) { scene = i; post({ type: 'scene', index: i, line: line(spec.scenes[i]) }); }
    if (now - sentAt > 120) { sentAt = now; post({ type: 'progress', p: t / info.DUR }); }
    raf = requestAnimationFrame(frame);
  }
  const run = () => { if (!raf && playing && info) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  window.addEventListener('message', async (e) => {
    if (e.origin !== location.origin) return;
    const m = e.data; if (!m || m.to !== 'stylea') return;
    if (m.type === 'load') {
      const mine = ++token; playing = false; info = null; spec = m.spec;
      try {
        const got = await loadSpec(spec); if (mine !== token) return;
        // dry run: a spec the engine cannot draw is reported instead of freezing mid-play
        for (let k = 0; k <= 30; k++) seek(got.DUR * k / 30.5);
        info = got; t = 0; scene = -1; seek(Math.min(1.2, info.DUR / 2));
        post({ type: 'ready', dur: info.DUR, T: info.T });
      } catch (err) { post({ type: 'error', message: String(err && err.message || err) }); }
    } else if (m.type === 'set') {
      if (typeof m.speed === 'number') speed = m.speed;
      if (typeof m.loop === 'boolean') loop = m.loop;
      if (m.restart) { t = 0; scene = -1; }
      if (typeof m.playing === 'boolean') { playing = m.playing; if (playing) { if (info && t >= info.DUR - 0.01) { t = 0; scene = -1; } run(); } }
      if (info) post({ type: 'state', playing, t });
    } else if (m.type === 'audio') {
      if (!info) return;
      try { const b64 = await renderAudio(info.T, info.DUR, 3); post({ type: 'audio', wav: b64 }); } catch (err) { /* no sound */ }
    }
  });
  post({ type: 'boot' });
})();
