"use client";
// 사운드: 파일 없이 Web Audio 로 짧은 효과음을 합성한다. 음성: Web Speech API (무료, 브라우저 내장).
let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = "sine", gain = 0.15) {
  const a = audio();
  if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(gain, a.currentTime + start);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + start + dur);
  o.connect(g).connect(a.destination);
  o.start(a.currentTime + start);
  o.stop(a.currentTime + start + dur + 0.02);
}

function noise(dur: number, vol: number, hp: number) {
  const a = audio();
  if (!a) return;
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = a.createBufferSource();
  const f = a.createBiquadFilter();
  const g = a.createGain();
  f.type = "highpass";
  f.frequency.value = hp;
  g.gain.value = vol;
  src.buffer = buf;
  src.connect(f).connect(g).connect(a.destination);
  src.start();
}

const SCALE = [523, 587, 659, 698, 784, 880, 988, 1047];

export const sfx = {
  // 콤보가 오를수록 음이 올라간다
  correct(combo = 1) {
    const f = SCALE[Math.min(Math.max(combo, 1) - 1, SCALE.length - 1)];
    tone(f, 0, 0.12, "triangle");
    tone(f * 1.5, 0.07, 0.18, "triangle");
  },
  wrong() {
    tone(196, 0, 0.22, "sine", 0.2);
  },
  swipe() {
    noise(0.12, 0.05, 2500);
  },
  finish() {
    [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.12, 0.25, "triangle"));
  },
};

export function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window) || !text) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "ko-KR";
  u.rate = 1.05;
  window.speechSynthesis.speak(u);
}

export function stopSpeaking() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}

export function vibrate(ms: number | number[]) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(ms);
}
