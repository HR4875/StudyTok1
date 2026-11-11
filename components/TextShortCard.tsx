"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { visualSteps } from "@/lib/compileVisual";
import { playSfx } from "@/lib/sfx";
import type { TextShort } from "@/lib/visual";
import { NAVY, PALETTE_BG, YELLOW, bgCss, outlineShadow } from "@/motion/palettes";
import { textWidth } from "@/motion/timeline";
import { DW, JUA_FONT, drawVisual, textTiming } from "@/motion/VisualDraw";

/* ------------------------------------------------------------------ */
/*  텍스트 숏츠 카드 (기본 옵션)                                         */
/*  궁금증 질문 → 그림(코드 그래픽) → 큰 개념 이름 → 정의 한 줄 + 형광펜   */
/*  움직임은 CSS 등장 효과뿐이라 영상 렌더링이 없고 추가 비용도 없다.      */
/* ------------------------------------------------------------------ */

/** 설계 크기(DW×h)의 그림을 주어진 칸에 맞게 줄이거나 키운다 */
function FitBox({ h, children }: { h: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setBox({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);
  const s = box.w && box.h ? Math.min(1.3, box.w / DW, box.h / (h + 14)) : 1;
  return (
    <div ref={ref} style={{ position: "relative", width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: DW, height: h, transform: `scale(${s})`, transformOrigin: "center", flexShrink: 0, position: "relative" }}>{children}</div>
    </div>
  );
}

function termSize(term: string): { lines: string[]; size: number } {
  const maxW = 330;
  const one = textWidth(term, 1);
  const s1 = Math.min(66, maxW / Math.max(one, 0.01));
  if (s1 >= 44 || !/[\s(]/.test(term)) return { lines: [term], size: Math.max(30, s1) };
  // 공백이나 괄호 앞에서 두 줄로
  const cut = term.includes("(") ? term.indexOf("(") : -1;
  const candidates: [string, string][] = [];
  if (cut > 0) candidates.push([term.slice(0, cut).trim(), term.slice(cut).trim()]);
  const words = term.split(" ");
  for (let i = 1; i < words.length; i++) candidates.push([words.slice(0, i).join(" "), words.slice(i).join(" ")]);
  let best = { lines: [term], m: one };
  for (const [a, b] of candidates) {
    const m = Math.max(textWidth(a, 1), textWidth(b, 1));
    if (m < best.m) best = { lines: [a, b], m };
  }
  return { lines: best.lines, size: Math.max(30, Math.min(56, maxW / best.m)) };
}

/** 카드를 읽는 데 걸리는 시간(초): 자동 넘김과 진행 막대에 쓴다 */
export function dwellFor(s: TextShort): number {
  const v = JSON.stringify(s.visual).replace(/"(type|emoji|label|sub|name|x|y|focus|kind|from|value|illustrative|when|text|note|low|high)":/g, "");
  const chars = Array.from((s.hook ?? "") + s.term + s.definition).length + Math.min(160, Array.from(v.replace(/[^가-힣A-Za-z0-9]/g, "")).length);
  return Math.max(6, Math.min(11, 3.6 + chars * 0.045));
}

/** 텍스트 숏츠 한 장의 시간표: 그림 → 개념 이름 → 정의 → 형광펜 → 핵심 한 번 톡 */
function cardTiming(s: TextShort) {
  const n = visualSteps(s.visual).length;
  const tm = textTiming(n);
  const term = Math.max(1.25, tm.at(n - 1) + 0.4);
  return { tm: { ...tm, em: term + 1.0 }, term, def: term + 0.25, hl: term + 0.55 };
}

export interface TextShortCardProps {
  short: TextShort;
  mode: "active" | "near" | "far";
  sound?: boolean;
  speed?: number;
  /** 읽는 시간 진행(0~1). 자동 넘김과 아래 진행 막대에 쓴다 */
  onProgress?: (p: number) => void;
  onEnded?: () => void;
}

export default function TextShortCard({ short, mode, sound = true, speed = 1, onProgress, onEnded }: TextShortCardProps) {
  const [run, setRun] = useState(0);
  const active = mode === "active";
  const soundRef = useRef(sound);
  soundRef.current = sound;
  const progressRef = useRef(onProgress);
  progressRef.current = onProgress;
  const endedRef = useRef(onEnded);
  endedRef.current = onEnded;
  const timing = cardTiming(short);
  const dwell = dwellFor(short) / Math.max(0.5, speed);

  // 활성화될 때마다 등장 효과를 다시 재생하고, 효과음과 읽기 진행을 맞춘다
  useEffect(() => {
    if (!active) return;
    setRun((r) => r + 1);
    const timers: number[] = [];
    const cue = (t: number, k: Parameters<typeof playSfx>[0]) => timers.push(window.setTimeout(() => soundRef.current && playSfx(k), t * 1000));
    const n = visualSteps(short.visual).length;
    [0, Math.floor(n / 2), n - 1].filter((v, i, a) => a.indexOf(v) === i).forEach((i) => cue(timing.tm.at(i), "pop"));
    cue(timing.term, "impact");
    cue(timing.hl, "swish");
    let raf = 0;
    const t0 = performance.now();
    let done = false;
    const tick = () => {
      const p = Math.min(1, (performance.now() - t0) / (dwell * 1000));
      progressRef.current?.(p);
      if (p >= 1 && !done) {
        done = true;
        endedRef.current?.();
      }
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      timers.forEach((t) => clearTimeout(t));
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, dwell, short]);

  if (mode === "far") {
    return (
      <div className="flex h-full w-full items-center justify-center" style={{ background: bgCss(short.palette) }}>
        <span className="font-jua text-[44px] text-white/90 drop-shadow">{short.term}</span>
      </div>
    );
  }

  const pal = PALETTE_BG[short.palette] ?? PALETTE_BG.blue;
  const drawn = drawVisual(short.visual, timing.tm, { subs: true });
  const { lines, size } = termSize(short.term);
  const def = short.definition;
  const hl = short.highlight && def.includes(short.highlight) ? short.highlight : "";
  const hi = hl ? def.indexOf(hl) : -1;
  const defLen = Array.from(def).length;
  const defSize = defLen > 24 ? 17 : defLen > 18 ? 18.5 : 20;
  const dv = (t: number) => ({ ["--d" as string]: `${t.toFixed(2)}s` }) as React.CSSProperties;

  return (
    <div className="relative h-full w-full overflow-hidden" style={{ background: bgCss(short.palette) }}>
      <div className="pointer-events-none absolute -left-24 top-24 h-72 w-72 rounded-full" style={{ background: "radial-gradient(circle, rgba(255,255,255,0.20), rgba(255,255,255,0) 70%)" }} />
      <div className="pointer-events-none absolute -right-28 bottom-24 h-80 w-80 rounded-full" style={{ background: `radial-gradient(circle, ${pal.glow}, rgba(0,0,0,0) 70%)` }} />

      <div key={run} className={`relative flex h-full flex-col ${active ? "ts-anim" : ""}`}>
        <div className="shrink-0" style={{ height: "max(108px, calc(env(safe-area-inset-top) + 98px))" }} />
        {short.hook ? (
          <div className="flex shrink-0 justify-center px-5">
            <div
              className="ts-pop relative max-w-full rounded-[18px] bg-white px-4 py-2.5 text-center"
              style={{ border: `2.5px solid ${NAVY}`, boxShadow: `0 4px 0 ${NAVY}`, font: `400 17px/1.3 ${JUA_FONT}`, color: NAVY, wordBreak: "keep-all", ...dv(0) }}
            >
              {short.hook}
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  left: "50%",
                  bottom: -10,
                  width: 16,
                  height: 16,
                  background: "#fff",
                  borderRight: `2.5px solid ${NAVY}`,
                  borderBottom: `2.5px solid ${NAVY}`,
                  transform: "translateX(-50%) rotate(45deg)",
                }}
              />
            </div>
          </div>
        ) : null}
        <div className="relative min-h-0 flex-1 px-4 pb-2 pt-5">
          <FitBox h={drawn.h}>{drawn.node}</FitBox>
        </div>
        <div className="shrink-0 px-4 text-center">
          <div
            className="ts-slam"
            style={{
              font: `400 ${size}px/${size * 1.04}px ${JUA_FONT}`,
              color: "#fff",
              letterSpacing: size > 50 ? -1.5 : -0.8,
              textShadow: outlineShadow(Math.max(2, size / 22), Math.max(4, size / 12)),
              ...dv(timing.term),
            }}
          >
            {lines.map((l, i) => (
              <div key={i} style={{ whiteSpace: "nowrap" }}>
                {l}
              </div>
            ))}
          </div>
          <p
            className="ts-rise mx-auto mt-3 max-w-[340px]"
            style={{ font: `400 ${defSize}px/1.5 ${JUA_FONT}`, color: "#fff", textShadow: `0 2.5px 0 ${NAVY}`, wordBreak: "keep-all", textWrap: "balance", ...dv(timing.def) } as React.CSSProperties}
          >
            {hi >= 0 ? (
              <>
                {def.slice(0, hi)}
                <span
                  className="ts-hl"
                  style={{
                    color: NAVY,
                    textShadow: "none",
                    background: YELLOW,
                    border: `2.5px solid ${NAVY}`,
                    borderRadius: 9,
                    padding: "0 7px 1px",
                    margin: "0 2px",
                    boxShadow: `0 3px 0 ${NAVY}`,
                    boxDecorationBreak: "clone",
                    WebkitBoxDecorationBreak: "clone",
                    ...dv(timing.hl),
                  }}
                >
                  {hl}
                </span>
                {def.slice(hi + hl.length)}
              </>
            ) : (
              def
            )}
          </p>
        </div>
        <div className="shrink-0" style={{ height: "max(104px, calc(env(safe-area-inset-bottom) + 92px))" }} />
      </div>
    </div>
  );
}
