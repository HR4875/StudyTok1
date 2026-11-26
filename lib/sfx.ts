"use client";

import type { SfxKind } from "@/motion/timeline";

/* Small Web Audio synth: every sound effect is generated on the fly (no audio files). */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let enabled = true;

export function setSoundEnabled(on: boolean) {
  enabled = on;
}

export function unlockAudio() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.55;
      master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    /* audio unavailable */
  }
}

function tone(freq: number, dur: number, opts: { type?: OscillatorType; gain?: number; to?: number; delay?: number; attack?: number } = {}) {
  if (!ctx || !master) return;
  const t0 = ctx.currentTime + (opts.delay ?? 0);
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = opts.type ?? "sine";
  osc.frequency.setValueAtTime(freq, t0);
  if (opts.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.to), t0 + dur);
  const peak = opts.gain ?? 0.3;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + (opts.attack ?? 0.008));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function noise(dur: number, opts: { from?: number; to?: number; q?: number; gain?: number; type?: BiquadFilterType; delay?: number } = {}) {
  if (!ctx || !master || !noiseBuf) return;
  const t0 = ctx.currentTime + (opts.delay ?? 0);
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const filter = ctx.createBiquadFilter();
  filter.type = opts.type ?? "bandpass";
  filter.Q.value = opts.q ?? 1.2;
  filter.frequency.setValueAtTime(opts.from ?? 800, t0);
  if (opts.to) filter.frequency.exponentialRampToValueAtTime(opts.to, t0 + dur);
  const g = ctx.createGain();
  const peak = opts.gain ?? 0.25;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + dur * 0.35);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter).connect(g).connect(master);
  src.start(t0);
  src.stop(t0 + dur + 0.05);
}

export function playSfx(kind: SfxKind | "correct" | "wrong" | "tap" | "swipe", dur = 1, rate = 1) {
  if (!enabled) return;
  unlockAudio();
  if (!ctx) return;
  const d = Math.max(0.2, dur / Math.max(0.25, rate));
  switch (kind) {
    case "hook":
      tone(520, 0.12, { gain: 0.22, to: 780 });
      tone(780, 0.16, { gain: 0.18, to: 1040, delay: 0.09 });
      break;
    case "pop":
      tone(420 + Math.random() * 120, 0.11, { gain: 0.26, to: 900 });
      break;
    case "whoosh":
      noise(0.38, { from: 300, to: 2600, gain: 0.16, q: 0.8 });
      break;
    case "tick":
      tone(1700, 0.05, { type: "square", gain: 0.06 });
      tone(1250, 0.12, { gain: 0.14, delay: 0.03 });
      break;
    case "out":
      tone(600, 0.12, { gain: 0.12, to: 300 });
      break;
    case "draw":
      noise(0.28, { from: 1800, to: 5200, gain: 0.08, type: "highpass" });
      break;
    case "boop":
      tone(330, 0.14, { gain: 0.22, to: 220 });
      break;
    case "shimmer":
      [1320, 1760, 2217, 2637].forEach((f, i) => tone(f, 0.5, { gain: 0.07, delay: i * 0.05 }));
      break;
    case "buzz":
      tone(140, 0.28, { type: "sawtooth", gain: 0.12, to: 110 });
      tone(147, 0.28, { type: "square", gain: 0.05, to: 115 });
      break;
    case "flip":
      tone(500, 0.08, { gain: 0.16, to: 1000 });
      tone(1000, 0.09, { gain: 0.12, to: 700, delay: 0.08 });
      break;
    case "count": {
      const n = Math.min(10, Math.max(3, Math.round(d * 7)));
      for (let i = 0; i < n; i++) tone(1100 + i * 40, 0.04, { type: "square", gain: 0.05, delay: (i * d) / n });
      tone(1600, 0.18, { gain: 0.14, delay: d });
      break;
    }
    case "rise":
      tone(260, d, { gain: 0.14, to: 820, attack: 0.05 });
      break;
    case "ding":
      tone(1318, 0.7, { gain: 0.2 });
      tone(1975, 0.6, { gain: 0.1, delay: 0.01 });
      break;
    case "sparkle":
      for (let i = 0; i < 6; i++) tone(1800 + Math.random() * 1600, 0.12, { gain: 0.06, delay: i * 0.05 });
      break;
    case "impact":
      tone(150, 0.45, { gain: 0.5, to: 40 });
      noise(0.25, { from: 1200, to: 200, gain: 0.25, type: "lowpass" });
      tone(880, 0.6, { gain: 0.06, delay: 0.05 });
      break;
    case "swish":
      noise(0.3, { from: 2500, to: 800, gain: 0.08 });
      break;
    case "correct": {
      // 콤보마다 한 단계(반음 2개)씩 높아지고, 5콤보부터 반짝이가 붙는다 (11/26 확정 A안). dur = 지금 콤보 수
      const combo = Math.max(1, Math.round(dur));
      const k = Math.pow(2, (Math.min(combo - 1, 4) * 2) / 12);
      [523, 659, 784, 1046].forEach((f, i) => tone(f * k, 0.22, { gain: 0.17, delay: i * 0.065 }));
      if (combo >= 5) [2093, 2637, 3136, 2637].forEach((f, i) => tone(f, 0.35, { gain: 0.06, delay: 0.3 + i * 0.05 }));
      break;
    }
    case "wrong":
      // 혼나는 버저 대신 부드러운 '뿅' 두 음 (11/26 확정 1안). 화면에는 "오답노트에 담았어요" 안내
      tone(523, 0.16, { gain: 0.16, to: 494, attack: 0.02 });
      tone(392, 0.28, { gain: 0.14, to: 370, delay: 0.13, attack: 0.02 });
      break;
    case "tap":
      tone(900, 0.05, { gain: 0.08 });
      break;
    case "swipe":
      noise(0.2, { from: 600, to: 2000, gain: 0.06 });
      break;
  }
}

/* ---- 스타일A 배경 사운드: 재생 화면이 만든 WAV를 여기(이미 탭으로 풀린 오디오)에서 튼다 ---- */
let music: { src: AudioBufferSourceNode; gain: GainNode; id: number } | null = null;
let musicSeq = 0;

export async function decodeWav(b64: string): Promise<AudioBuffer | null> {
  if (!ctx) return null;
  try {
    const bin = atob(b64);
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return await ctx.decodeAudioData(u8.buffer);
  } catch {
    return null;
  }
}

/** id를 주면 그 재생이 아직 살아 있을 때만 끈다 (다른 카드의 소리를 끄지 않도록) */
export function stopMusic(id?: number) {
  if (!music || (id !== undefined && music.id !== id)) return;
  try {
    music.src.stop();
  } catch {
    /* already stopped */
  }
  music = null;
}

/** offset 초 지점부터 재생. 목소리가 켜져 있으면 소리를 낮춘다 */
export function playMusic(buf: AudioBuffer, offset: number, rate: number, quiet: boolean) {
  stopMusic();
  if (!ctx || !master || !enabled) return 0;
  const src = ctx.createBufferSource();
  const gain = ctx.createGain();
  gain.gain.value = quiet ? 0.28 : 0.9;
  src.buffer = buf;
  src.playbackRate.value = rate;
  src.connect(gain).connect(master);
  src.start(0, Math.max(0, Math.min(buf.duration - 0.05, offset)));
  music = { src, gain, id: ++musicSeq };
  return music.id;
}

/* ---- 무료 기기 음성 (브라우저 내장 읽어 주기) ---- */
export const canSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window;

/** 사용자의 탭 안에서 한 번 불러 두면 이후 자동 재생이 막히지 않는다 */
export function primeVoice() {
  if (!canSpeak()) return;
  try {
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    window.speechSynthesis.speak(u);
  } catch {
    /* unavailable */
  }
}

export function stopVoice() {
  if (canSpeak()) window.speechSynthesis.cancel();
}

export function speak(text: string, rate = 1) {
  if (!canSpeak() || !text) return;
  try {
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ko-KR";
    const ko = synth.getVoices().find((v) => v.lang?.toLowerCase().startsWith("ko"));
    if (ko) u.voice = ko;
    u.rate = Math.min(2, 1.08 * rate);
    synth.speak(u);
  } catch {
    /* unavailable */
  }
}
