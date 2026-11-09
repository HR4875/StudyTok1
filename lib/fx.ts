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

export const sfx = {
  correct() {
    tone(660, 0, 0.12, "triangle");
    tone(880, 0.1, 0.12, "triangle");
    tone(1320, 0.2, 0.22, "triangle");
  },
  wrong() {
    tone(220, 0, 0.18, "sawtooth", 0.08);
    tone(160, 0.15, 0.25, "sawtooth", 0.08);
  },
  pop() {
    tone(520, 0, 0.06, "square", 0.05);
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
