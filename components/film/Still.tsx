"use client";
// 한 편의 포스터: 영상 속 질문 바로 앞(질문이 없으면 60% 지점)의 한 장면을 멈춘 그림으로 그린다.
import { useEffect, useRef } from "react";
import { createDirector, type FilmInfo } from "@/lib/film";
import { loadShort, skinFor } from "@/lib/film/store";

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** 포스터로 쓸 시각: 질문이 뜨기 직전이 그 편에서 그림이 가장 많이 차 있다 */
export function posterTime(info: FilmInfo): number {
  const a = info.asks[0];
  return clamp(a ? info.beats[a.beat].t0 - 0.6 : info.dur * 0.62, 0, Math.max(0, info.dur - 0.5));
}

/** 홈과 포스터가 같이 쓰는 멈춘 그림 설정: 꾸밈과 이름 없이, 기본 디자인으로 */
export const STILL_OPTS = { skin: "paper", interactive: false, fancy: false, brand: "" } as const;

export default function Still({ sid, k }: { sid: string; k: number }) {
  const ref = useRef<SVGSVGElement>(null);
  const sh = loadShort(sid, k);
  const script = sh && sh.scenes ? sh.script : null;
  const skin = skinFor(sid);
  useEffect(() => {
    const svg = ref.current;
    if (!svg || !script) return;
    let live = true;
    // createDirector가 svg를 비우고 시작하므로 두 번 불려도 그림은 하나만 남는다
    const dir = createDirector(svg, { fancy: false });
    dir
      .load(script, { ...STILL_OPTS, skin })
      .then((info) => {
        if (live) dir.seek(posterTime(info));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [script, skin]);
  return <svg ref={ref} className="st" aria-hidden="true" />;
}
