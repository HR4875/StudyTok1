"use client";

import React, { useMemo } from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame } from "remotion";
import { getTimeline, type VisualTimeline } from "@/lib/compileVisual";
import type { Scene } from "@/lib/schema";
import type { TextShort, VisualPlan } from "@/lib/visual";
import { TermBlock } from "./ConceptScene";
import { NAVY, OCEAN } from "./palettes";

/** 영상 바탕 (2026-11-23 확정): 아주 연한 하늘 #F5F9FF + 잉크 글자 + 오션 블루 제목·자막 */
const VIDEO_BG = "#F5F9FF";
import { BASE_H, CAPTION_Y, FPS, HOOK_Y, STAGE, W } from "./timeline";
import { DW, drawVisual, type DrawTiming } from "./VisualDraw";

/* ------------------------------------------------------------------ */
/*  템플릿 모션: 텍스트 숏츠와 같은 카드 칸으로 만드는 영상 (Remotion)     */
/*  훅 → 그림이 단계별로 등장(자막) → 핵심 강조 → 개념 이름 쾅 + 형광펜     */
/*  그림 요소의 움직임은 CSS 효과를 프레임(--t)에 맞춰 멈춰 세워서 그린다. */
/*  그래서 미리보기·재생·영상 내보내기가 모두 같은 프레임을 낸다.          */
/* ------------------------------------------------------------------ */

// 영상 글자: Wanted Sans 800 (2026-11-23 확정, Jua에서 교체). 외곽선·글자 그림자 없음
const JUA = "'Wanted Sans Variable', 'Wanted Sans', 'Pretendard Variable', 'Pretendard', sans-serif";
const PRE = "'Pretendard Variable', 'Pretendard', -apple-system, sans-serif";
const CL = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export interface TemplateSceneProps {
  short: TextShort;
  plan?: Partial<VisualPlan> | null;
  height?: number;
  showCaptions?: boolean;
  [key: string]: unknown;
}

export function motionTiming(tl: VisualTimeline): DrawTiming {
  const last = tl.steps[tl.steps.length - 1];
  return {
    at: (s, k = 0) => {
      const st = tl.steps[s];
      const base = st ? st.t : last ? last.t + last.d : tl.d0;
      return base + k * 0.1;
    },
    em: tl.em,
    motion: true,
    slow: 1.3,
  };
}

export const TemplateScene: React.FC<TemplateSceneProps> = ({ short, plan, height = BASE_H, showCaptions = true }) => {
  const fr = useCurrentFrame();
  const tl = useMemo(() => getTimeline(short, plan), [short, plan]);
  const drawn = useMemo(() => drawVisual(short.visual, motionTiming(tl), { subs: false }), [short, tl]);
  const H = height;
  const oy = Math.round((H - BASE_H) / 2);
  const d0f = Math.round(tl.d0 * FPS);
  const termF = Math.round(tl.termAt * FPS);
  const drift = Math.sin(fr / 40) * 40;

  const hookIn = spring({ frame: fr - 2, fps: FPS, config: { damping: 13, stiffness: 140, mass: 0.7 } });
  const hookOut = interpolate(fr, [d0f - 12, d0f], [1, 0], CL);
  const shrink = interpolate(fr, [termF - 6, termF + 10], [0, 1], { ...CL, easing: Easing.out(Easing.cubic) });
  const endFade = interpolate(fr, [tl.total - 8, tl.total - 1], [1, 0], CL);

  // 그림을 무대(960×860)에 맞춰 키운다. 설계 폭 340px → 약 2.8배
  const s = Math.min(STAGE.w / DW, (STAGE.h - 40) / (drawn.h + 12), 3.1);
  const left = (W - DW * s) / 2;
  const top = STAGE.y0 + (STAGE.h - drawn.h * s) / 2;

  return (
    <AbsoluteFill style={{ background: VIDEO_BG, overflow: "hidden", fontFamily: PRE }}>
      <div
        style={{
          position: "absolute",
          left: -260 + drift,
          top: oy + 180,
          width: 760,
          height: 760,
          borderRadius: 760,
          background: "radial-gradient(circle, rgba(201,226,255,0.35), rgba(201,226,255,0) 70%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          right: -300 - drift,
          top: oy + 1180,
          width: 900,
          height: 900,
          borderRadius: 900,
          background: "radial-gradient(circle, rgba(201,226,255,0.30), rgba(201,226,255,0) 70%)",
        }}
      />

      <div style={{ position: "absolute", inset: 0, opacity: endFade }}>
        {short.hook && fr < d0f ? (
          <div
            style={{
              position: "absolute",
              top: oy + HOOK_Y,
              left: 60,
              width: W - 120,
              textAlign: "center",
              font: `800 104px/1.14 ${JUA}`,
              color: NAVY,
              textShadow: "none",
              opacity: Math.min(hookIn, 1) * hookOut,
              transform: `translateY(calc(-50% + ${(1 - hookIn) * 70 - (1 - hookOut) * 60}px)) scale(${(0.85 + 0.15 * hookIn) * (0.9 + 0.1 * hookOut)})`,
              wordBreak: "keep-all",
              textWrap: "balance",
            } as React.CSSProperties}
          >
            {short.hook}
          </div>
        ) : null}

        {/* 무대: CSS 효과를 이 프레임 시각(--t)에 멈춰 세운다 */}
        <div
          className="ts-anim ts-seek v-paper"
          style={
            {
              position: "absolute",
              left: 0,
              top: oy,
              width: W,
              height: BASE_H,
              transformOrigin: `${W / 2}px ${STAGE.y0}px`,
              transform: `translateY(${-40 * shrink}px) scale(${1 - 0.14 * shrink})`,
              "--t": `${(fr / FPS).toFixed(3)}s`,
            } as React.CSSProperties
          }
        >
          <div style={{ position: "absolute", left, top, width: DW, height: drawn.h, transform: `scale(${s})`, transformOrigin: "0 0" }}>{drawn.node}</div>
        </div>

        {showCaptions
          ? tl.captions.map((cap, i) => {
              if (fr < cap.f0 || fr >= cap.f1 || fr >= termF) return null;
              const inP = spring({ frame: fr - cap.f0 - 1, fps: FPS, config: { damping: 14, stiffness: 180, mass: 0.7 } });
              const outP = interpolate(fr, [cap.f1 - 6, cap.f1], [1, 0], CL);
              const isEm = tl.em != null && cap.f0 === Math.round(tl.em * FPS) && cap.text === tl.emCaption;
              return (
                <div
                  key={i}
                  style={
                    {
                      position: "absolute",
                      top: oy + CAPTION_Y,
                      left: W / 2,
                      transform: `translate(-50%, calc(-50% + ${(1 - Math.min(inP, 1)) * 30}px))`,
                      opacity: Math.min(inP, 1) * outP,
                      maxWidth: 940,
                      width: "max-content",
                      padding: "18px 40px 20px",
                      // 각진 말풍선 자막 (2026-11-23 확정): 모서리 작게, 위쪽 꼬리로 그림을 가리킴
                      borderRadius: 14,
                      background: isEm ? NAVY : OCEAN,
                      font: isEm ? `800 58px/1.25 ${JUA}` : `700 54px/1.32 ${PRE}`,
                      letterSpacing: isEm ? 0 : -1,
                      color: "#fff",
                      textAlign: "center",
                      wordBreak: "keep-all",
                      textWrap: "balance",
                    } as React.CSSProperties
                  }
                >
                  <span
                    aria-hidden
                    style={{
                      position: "absolute",
                      left: "50%",
                      top: -22,
                      marginLeft: -24,
                      borderLeft: "24px solid transparent",
                      borderRight: "24px solid transparent",
                      borderBottom: `24px solid ${isEm ? NAVY : OCEAN}`,
                    }}
                  />
                  {cap.text}
                </div>
              );
            })
          : null}

        <TermBlock scene={short as unknown as Scene} fr={fr} termAt={termF} oy={oy} light />
      </div>
    </AbsoluteFill>
  );
};

export default TemplateScene;
