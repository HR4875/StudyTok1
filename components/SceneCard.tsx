"use client";

import { Player, Thumbnail, type PlayerRef } from "@remotion/player";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { getTimeline } from "@/lib/compileVisual";
import type { Scene } from "@/lib/schema";
import { playSfx } from "@/lib/sfx";
import type { TextShort, VisualPlan } from "@/lib/visual";
import { ConceptScene, getCompiled } from "@/motion/ConceptScene";
import { bgCss } from "@/motion/palettes";
import { TemplateScene } from "@/motion/TemplateScene";
import { FPS, W, type Cue } from "@/motion/timeline";

/** 모션 카드에 넣을 것: AI가 직접 안무한 장면(scene) 또는 텍스트 숏츠 칸으로 만든 템플릿 모션 */
export type MotionSrc = { kind: "scene"; scene: Scene } | { kind: "template"; short: TextShort; plan?: Partial<VisualPlan> | null };

interface Props {
  src: MotionSrc;
  mode: "active" | "near" | "far";
  compHeight: number;
  speed: number;
  sound: boolean;
  captions: boolean;
  autoNext: boolean;
  onEnded: () => void;
  onProgress?: (p: number) => void;
}

function useMotion(src: MotionSrc, compHeight: number, captions: boolean) {
  const scene = src.kind === "scene" ? src.scene : null;
  const short = src.kind === "template" ? src.short : null;
  const plan = src.kind === "template" ? (src.plan ?? null) : null;
  return useMemo(() => {
    if (scene) {
      const c = getCompiled(scene);
      return {
        component: ConceptScene as unknown as React.FC<Record<string, unknown>>,
        total: c.total,
        cues: c.cues as Cue[],
        palette: scene.palette,
        term: scene.term,
        inputProps: { scene, height: compHeight, showCaptions: captions } as Record<string, unknown>,
      };
    }
    const tl = getTimeline(short!, plan);
    return {
      component: TemplateScene as unknown as React.FC<Record<string, unknown>>,
      total: tl.total,
      cues: tl.cues,
      palette: short!.palette,
      term: short!.term,
      inputProps: { short, plan, height: compHeight, showCaptions: captions } as Record<string, unknown>,
    };
  }, [scene, short, plan, compHeight, captions]);
}

export default function SceneCard({ src, mode, compHeight, speed, sound, captions, autoNext, onEnded, onProgress }: Props) {
  const m = useMotion(src, compHeight, captions);
  const ref = useRef<PlayerRef>(null);
  const [paused, setPaused] = useState(false);
  const last = useRef(-1);
  const soundRef = useRef(sound);
  const speedRef = useRef(speed);
  const endedRef = useRef(onEnded);
  const progressRef = useRef(onProgress);
  soundRef.current = sound;
  speedRef.current = speed;
  endedRef.current = onEnded;
  progressRef.current = onProgress;

  // frame-synced sound effects
  useEffect(() => {
    if (mode !== "active") return;
    const p = ref.current;
    if (!p) return;
    last.current = -1;
    const onFrame = (e: { detail: { frame: number } }) => {
      const fr = e.detail.frame;
      const prev = last.current;
      last.current = fr;
      progressRef.current?.(fr / Math.max(1, m.total - 1));
      if (!soundRef.current) return;
      let lo: number;
      if (fr >= prev && prev >= 0) {
        if (fr - prev > 12) return; // a seek or a stall: skip, don't fire a burst
        lo = prev;
      } else if (fr < prev) {
        lo = -1; // looped back to the start
        if (fr > 12) return;
      } else lo = fr - 1;
      for (const cue of m.cues) {
        if (cue.f > lo && cue.f <= fr) playSfx(cue.kind, cue.dur ?? 1, speedRef.current);
      }
    };
    const onEnd = () => endedRef.current();
    const onPause = () => setPaused(true);
    const onPlay = () => setPaused(false);
    p.addEventListener("frameupdate", onFrame);
    p.addEventListener("ended", onEnd);
    p.addEventListener("pause", onPause);
    p.addEventListener("play", onPlay);
    return () => {
      p.removeEventListener("frameupdate", onFrame);
      p.removeEventListener("ended", onEnd);
      p.removeEventListener("pause", onPause);
      p.removeEventListener("play", onPlay);
    };
  }, [mode, m]);

  // restart from the beginning whenever the card becomes active
  useEffect(() => {
    if (mode !== "active") return;
    const p = ref.current;
    if (!p) return;
    p.seekTo(0);
    p.play();
  }, [mode]);

  if (mode === "far") {
    return (
      <div className="flex h-full w-full items-center justify-center" style={{ background: bgCss(m.palette) }}>
        <span className="font-jua text-[44px] text-white/90 drop-shadow">{m.term}</span>
      </div>
    );
  }
  if (mode === "near") {
    return (
      <div className="h-full w-full" style={{ background: bgCss(m.palette) }}>
        <Thumbnail
          component={m.component}
          compositionWidth={W}
          compositionHeight={compHeight}
          frameToDisplay={Math.min(m.total - 1, 18)}
          durationInFrames={m.total}
          fps={FPS}
          inputProps={m.inputProps}
          style={{ width: "100%", height: "100%" }}
        />
      </div>
    );
  }
  return (
    <div className="relative h-full w-full" style={{ background: bgCss(m.palette) }}>
      <Player
        ref={ref}
        component={m.component}
        inputProps={m.inputProps}
        durationInFrames={m.total}
        compositionWidth={W}
        compositionHeight={compHeight}
        fps={FPS}
        style={{ width: "100%", height: "100%" }}
        loop={!autoNext}
        autoPlay
        playbackRate={speed}
        controls={false}
        clickToPlay={false}
        doubleClickToFullscreen={false}
        spaceKeyToPlayOrPause={false}
        moveToBeginningWhenEnded={false}
        acknowledgeRemotionLicense
      />
      {/* tap to pause / resume */}
      <button
        type="button"
        aria-label={paused ? "재생" : "일시정지"}
        className="absolute inset-x-0 bottom-[96px] top-[120px] z-10 cursor-pointer"
        onClick={() => {
          const p = ref.current;
          if (!p) return;
          if (p.isPlaying()) p.pause();
          else {
            if (p.getCurrentFrame() >= m.total - 1) p.seekTo(0);
            p.play();
          }
        }}
      />
      {paused ? (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 backdrop-blur-sm">
          <svg width="34" height="34" viewBox="0 0 34 34">
            <path d="M11 7 L27 17 L11 27 Z" fill="#fff" />
          </svg>
        </div>
      ) : null}
    </div>
  );
}
