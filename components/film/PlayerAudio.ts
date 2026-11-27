"use client";
// 재생기의 소리. 배경음은 편·디자인·속도마다 한 번만 만들어 두고, 재생할 때마다 그 자리부터 튼다.
// 브라우저는 사용자가 누르기 전에 만든 소리를 막으므로, 소리 장치는 누른 뒤에 처음 만든다.
import { renderScore, toAudioBuffer, type FilmScore } from "@/lib/film";
import { getPrefs } from "@/lib/film/store";

type AudioCtor = typeof AudioContext;

// 화면이 살아 있는 동안 하나만 쓴다 (브라우저마다 만들 수 있는 수가 적다)
let ctx: AudioContext | null = null;
// 앞뒤 편을 오갈 때 다시 만들지 않도록 최근 둘만 둔다 (한 편에 십몇 MB)
const have = new Map<string, AudioBuffer>();
let want: { key: string; p: Promise<AudioBuffer | null> } | null = null;

/** 사용자가 누른 동작 안에서만 부른다 */
export function openAudio(): AudioContext | null {
  try {
    if (!ctx) {
      const C: AudioCtor | undefined = window.AudioContext ?? (window as Window & { webkitAudioContext?: AudioCtor }).webkitAudioContext;
      if (!C) return null;
      ctx = new C();
    }
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx;
  } catch {
    return null;
  }
}

const seedOf = (s: string) => {
  let x = 7;
  for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) % 9973;
  return x;
};

/** 이미 만들어 둔 배경음 (없으면 null) */
export const bufferOf = (key: string): AudioBuffer | null => have.get(key) ?? null;

/** 배경음을 만든다. 같은 것을 만드는 중이면 그 결과를 같이 기다린다 */
export function prepareBuffer(key: string, score: FilmScore, dur: number): Promise<AudioBuffer | null> {
  const got = have.get(key);
  if (got) return Promise.resolve(got);
  if (want && want.key === key) return want.p;
  const c = ctx;
  if (!c) return Promise.resolve(null);
  const job: { key: string; p: Promise<AudioBuffer | null> } = { key, p: Promise.resolve(null) };
  job.p = renderScore(score, dur, seedOf(key)).then(
    (a) => {
      // 그사이 다른 편으로 넘어갔으면 버린다
      if (want !== job) return null;
      const buf = toAudioBuffer(c, a);
      have.delete(key);
      have.set(key, buf);
      for (const old of have.keys()) if (have.size > 2) have.delete(old);
      want = null;
      return buf;
    },
    () => {
      if (want === job) want = null;
      return null;
    },
  );
  want = job;
  return job.p;
}

/** 기다리던 재생기가 닫혔다: 만드는 중인 배경음은 끝나도 버린다 */
export function forgetBuffer(key: string): void {
  if (want && want.key === key) want = null;
}

/** 재생기 하나의 배경음 재생. 한 번에 하나만 울린다 */
export interface Voice {
  start(buf: AudioBuffer, offset: number): void;
  stop(): void;
}

export function createVoice(): Voice {
  let src: { node: AudioBufferSourceNode; g: GainNode } | null = null;
  const stop = () => {
    const s = src;
    if (!s || !ctx) return;
    src = null;
    try {
      // 바로 끊으면 딸깍 소리가 나서 아주 짧게 줄인다
      const c = ctx.currentTime;
      s.g.gain.cancelScheduledValues(c);
      s.g.gain.setValueAtTime(s.g.gain.value, c);
      s.g.gain.linearRampToValueAtTime(0.0001, c + 0.05);
      s.node.stop(c + 0.07);
    } catch {
      /* 이미 멈췄다 */
    }
  };
  const start = (buf: AudioBuffer, offset: number) => {
    stop();
    const c = ctx;
    if (!c) return;
    try {
      const node = c.createBufferSource();
      const g = c.createGain();
      node.buffer = buf;
      node.connect(g);
      g.connect(c.destination);
      g.gain.setValueAtTime(0.0001, c.currentTime);
      g.gain.linearRampToValueAtTime(1, c.currentTime + 0.06);
      node.start(0, Math.max(0, offset));
      src = { node, g };
    } catch {
      src = null;
    }
  };
  return { start, stop };
}

/** 답이 맞았는지 틀렸는지 알려 주는 짧은 소리 */
export function blip(ok: boolean): void {
  if (!getPrefs().sound || !ctx) return;
  try {
    const c = ctx;
    const t = c.currentTime + 0.01;
    const tone = (f: number, at: number, d: number, v: number, type: OscillatorType) => {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type;
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(v, at + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, at + d);
      o.connect(g);
      g.connect(c.destination);
      o.start(at);
      o.stop(at + d + 0.03);
    };
    if (ok) {
      tone(784, t, 0.24, 0.13, "sine");
      tone(1175, t + 0.09, 0.32, 0.11, "sine");
    } else {
      tone(294, t, 0.3, 0.09, "triangle");
      tone(247, t + 0.11, 0.36, 0.08, "triangle");
    }
  } catch {
    /* 소리는 없어도 된다 */
  }
}
