"use client";

import React from "react";
import type { Visual } from "@/lib/visual";
import { NAVY, YELLOW, outlineShadow } from "./palettes";
import { textWidth } from "./timeline";

/* ------------------------------------------------------------------ */
/*  그림 틀 12종 그리기 (텍스트 숏츠와 템플릿 모션이 같이 쓴다)           */
/*                                                                    */
/*  AI는 칸만 채우고, 배치·크기·등장 순서는 전부 여기서 정한다.            */
/*  등장 순서는 "단계(step)" 번호로 정하고, 시각은 DrawTiming이 준다.     */
/*    - 텍스트 숏츠: textTiming() → 1초 안에 전부 등장, 정지 화면으로 읽기 */
/*    - 템플릿 모션: compileVisual()의 시간표 → 자막과 맞춰 하나씩 등장    */
/*  단계 번호는 lib/compileVisual.ts의 visualSteps()와 1:1로 맞춘다.     */
/* ------------------------------------------------------------------ */

type CSS = React.CSSProperties;

export const EMOJI_FONT = "'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif";
export const JUA_FONT = "'Jua','Pretendard Variable',Pretendard,sans-serif";
const PRE = "'Pretendard Variable',Pretendard,sans-serif";
/** 그림 설계 폭(px). 화면에 맞춰 바깥에서 줄이거나 키운다. */
export const DW = 340;
const SERIES = [YELLOW, "#5B8CFF", "#2BD576", "#FF5A6A", "#A78BFA"];
const SOFT = { yellow: "#FFE27A", blue: "#CFE0FF" };

export interface DrawTiming {
  /** 단계 step의 k번째 요소가 등장하는 시각(초). 모션에서는 영상 시작 기준 */
  at: (step: number, k?: number) => number;
  /** 강조 시작 시각(초). null이면 강조 없음 */
  em: number | null;
  /** true면 템플릿 모션: 한 줄 설명(sub)은 자막으로 빠지고, 강조 때 나머지가 흐려진다 */
  motion: boolean;
  /** 움직임 길이 배율 (모션은 조금 느리게) */
  slow: number;
}
export type Drawn = { h: number; node: React.ReactNode };

/** 텍스트 숏츠용 시간표: 1초 안팎에 전부 나오고, 2.35초에 핵심을 한 번 톡 친다 */
export function textTiming(stepCount: number): DrawTiming {
  const gap = Math.min(0.16, 0.95 / Math.max(1, stepCount - 1));
  return { at: (s, k = 0) => 0.12 + s * gap + k * 0.05, em: 2.35, motion: false, slow: 1 };
}

const dv = (t: number, dur?: number): CSS =>
  ({ ["--d" as string]: `${t.toFixed(3)}s`, ...(dur ? { ["--dur" as string]: `${dur.toFixed(2)}s` } : {}) }) as CSS;
const ev = (t: number | null): CSS => (t == null ? {} : ({ ["--e" as string]: `${t.toFixed(3)}s` } as CSS));

const lbl: CSS = {
  font: `800 14.5px/1.2 ${PRE}`,
  color: "#fff",
  textAlign: "center",
  letterSpacing: -0.3,
  textShadow: "0 2px 0 rgba(27,27,58,0.45)",
  wordBreak: "keep-all",
};
const subStyle: CSS = {
  font: `700 11.5px/1.3 ${PRE}`,
  color: "rgba(255,255,255,0.88)",
  textAlign: "center",
  wordBreak: "keep-all",
};
const valBox: CSS = {
  background: "#fff",
  color: NAVY,
  border: `2.5px solid ${NAVY}`,
  boxShadow: `0 3px 0 ${NAVY}`,
  borderRadius: 12,
  padding: "5px 9px 6px",
  font: `800 13.5px/1.2 ${PRE}`,
  textAlign: "center",
  maxWidth: 124,
  wordBreak: "keep-all",
};

/* ------------------------------------------------------------------ */
/*  부품                                                               */
/* ------------------------------------------------------------------ */

function Sticker({
  size,
  emoji,
  fill = "#fff",
  round = false,
  focus = false,
  d,
  tm,
  cls = "ts-pop",
  style,
}: {
  size: number;
  emoji: string;
  fill?: string;
  round?: boolean;
  focus?: boolean;
  d: number;
  tm: DrawTiming;
  cls?: string;
  style?: CSS;
}) {
  const isNum = /^\d{1,2}$/.test(emoji);
  const body = (
    <div
      className={cls}
      style={{
        width: size,
        height: size,
        boxSizing: "border-box",
        borderRadius: round ? size : size * 0.24,
        background: focus ? SOFT.yellow : fill,
        border: `3px solid ${NAVY}`,
        boxShadow: `0 4px 0 ${NAVY}${focus ? ", 0 0 0 5px rgba(255,212,59,0.55)" : ""}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        font: isNum ? `400 ${size * 0.5}px/1 ${JUA_FONT}` : `${size * 0.48}px/1 ${EMOJI_FONT}`,
        color: NAVY,
        flexShrink: 0,
        position: "relative",
        ...dv(d, 0.5 * tm.slow),
        ...style,
      }}
    >
      {emoji}
    </div>
  );
  if (!focus || tm.em == null) return body;
  return (
    <div className="ts-em" style={{ position: "relative", flexShrink: 0, ...ev(tm.em) }}>
      {body}
      <span className="ts-ringfx" style={{ position: "absolute", inset: -8, borderRadius: round ? size : size * 0.34, border: `4px solid ${YELLOW}`, ...ev(tm.em) }} />
    </div>
  );
}

const ARROW_D = (w: number) => `M2 11 H${w - 8} M${w - 14} 4 L${w - 5} 11 L${w - 14} 18`;
function Arrow({ w = 26, d, style }: { w?: number; d: number; style?: CSS }) {
  return (
    <svg className="ts-pop" width={w} height={22} viewBox={`0 0 ${w} 22`} style={{ flexShrink: 0, overflow: "visible", ...dv(d), ...style }} aria-hidden>
      <path d={ARROW_D(w)} stroke={NAVY} strokeWidth={8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d={ARROW_D(w)} stroke="#fff" strokeWidth={3.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DownArrow({ h = 20, d, style }: { h?: number; d: number; style?: CSS }) {
  const p = `M11 1 V${h - 6} M4 ${h - 12} L11 ${h - 4} L18 ${h - 12}`;
  return (
    <svg className="ts-pop" width={22} height={h} viewBox={`0 0 22 ${h}`} style={{ overflow: "visible", ...dv(d), ...style }} aria-hidden>
      <path d={p} stroke={NAVY} strokeWidth={8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d={p} stroke="#fff" strokeWidth={3.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Chip({ children, tone = "white", d, cls = "ts-pop", style }: { children: React.ReactNode; tone?: "white" | "navy" | "yellow"; d: number; cls?: string; style?: CSS }) {
  const bg = tone === "navy" ? NAVY : tone === "yellow" ? YELLOW : "#fff";
  const fg = tone === "navy" ? YELLOW : NAVY;
  return (
    <span
      className={cls}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "4px 11px 5px",
        borderRadius: 999,
        background: bg,
        color: fg,
        border: `2.5px solid ${tone === "navy" ? "#fff" : NAVY}`,
        boxShadow: `0 3px 0 ${tone === "navy" ? "rgba(27,27,58,0.45)" : NAVY}`,
        font: `400 14px/1.15 ${JUA_FONT}`,
        whiteSpace: "nowrap",
        ...dv(d),
        ...style,
      }}
    >
      {children}
    </span>
  );
}

/** 강조 때 흐려질 묶음 (모션에서만). 핵심이 따로 있을 때만 쓴다 */
function dimmer(tm: DrawTiming, hasFocus: boolean, isFocus: boolean) {
  return tm.motion && tm.em != null && hasFocus && !isFocus ? "ts-dim" : "";
}

const ExampleTag = ({ show, d, right = false }: { show: boolean; d: number; right?: boolean }) =>
  show ? (
    <span className="ts-fade" style={{ position: "absolute", ...(right ? { right: 0, bottom: 0 } : { left: 0, bottom: -4 }), font: `700 10.5px/1 ${PRE}`, color: "rgba(255,255,255,0.74)", ...dv(d) }}>
      모양만 보여 주는 예시 값
    </span>
  ) : null;

/* ------------------------------------------------------------------ */
/*  1. 단계 flow · 단계 i = 항목 i                                       */
/* ------------------------------------------------------------------ */

function drawFlow(v: Extract<Visual, { type: "flow" }>, tm: DrawTiming, subs: boolean): Drawn {
  const steps = v.steps.slice(0, 5);
  const hasF = v.focus >= 0 && v.focus < steps.length;
  if (steps.length <= 3) {
    const n = steps.length;
    const size = n === 2 ? 86 : 74;
    const col = (DW - (n - 1) * 30) / n;
    return {
      h: subs ? 178 : 150,
      node: (
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "center", width: DW }}>
          {steps.map((s, i) => (
            <React.Fragment key={i}>
              {i > 0 ? <Arrow w={26} d={tm.at(i)} style={{ marginTop: size / 2 - 11, marginInline: 2 }} /> : null}
              <div className={dimmer(tm, hasF, v.focus === i)} style={{ width: col, display: "flex", flexDirection: "column", alignItems: "center", ...ev(tm.em) }}>
                <Sticker size={size} emoji={s.emoji || `${i + 1}`} focus={v.focus === i} d={tm.at(i, 1)} tm={tm} />
                <div className="ts-pop" style={{ ...lbl, marginTop: 10, fontSize: 15.5, ...dv(tm.at(i, 2)) }}>
                  {s.label}
                </div>
                {subs && s.sub ? (
                  <div className="ts-pop" style={{ ...subStyle, marginTop: 3, ...dv(tm.at(i, 2)) }}>
                    {s.sub}
                  </div>
                ) : null}
              </div>
            </React.Fragment>
          ))}
        </div>
      ),
    };
  }
  // 4~5단계: 위→아래 목록 (번호와 점선으로 순서가 한눈에). 가운데 정렬
  const five = steps.length === 5;
  const row = tm.motion ? (five ? 62 : 70) : five ? (subs ? 58 : 54) : subs ? 64 : 58;
  const size = tm.motion ? (five ? 50 : 56) : five ? 46 : 50;
  const labelSize = tm.motion ? 21 : subs ? 17.5 : 19;
  return {
    h: steps.length * row,
    node: (
      <div style={{ width: DW, display: "flex", justifyContent: "center" }}>
        <div style={{ position: "relative", width: "max-content", minWidth: 210, maxWidth: DW }}>
          <svg width={60} height={steps.length * row} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} aria-hidden>
            {steps.slice(1).map((_, i) => {
              const y0 = i * row + row / 2 + size / 2 + 3;
              const y1 = (i + 1) * row + row / 2 - size / 2 - 3;
              return (
                <path
                  key={i}
                  d={`M${4 + size / 2} ${y0} V${y1}`}
                  stroke="rgba(255,255,255,0.7)"
                  strokeWidth={3}
                  pathLength={1}
                  className="ts-draw"
                  style={dv(tm.at(i + 1), 0.3 * tm.slow)}
                />
              );
            })}
          </svg>
          {steps.map((s, i) => {
            const f = v.focus === i;
            return (
              <div key={i} className={dimmer(tm, hasF, f)} style={{ display: "flex", alignItems: "center", gap: 12, height: row, paddingLeft: 4, position: "relative", ...ev(tm.em) }}>
                <Sticker size={size} emoji={s.emoji || `${i + 1}`} focus={f} d={tm.at(i, 1)} tm={tm} />
                <div className="ts-left" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", minWidth: 0, ...dv(tm.at(i, 2), 0.45 * tm.slow) }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{ font: `400 ${tm.motion ? 15 : 13}px/1 ${JUA_FONT}`, color: NAVY, background: f ? YELLOW : "#fff", borderRadius: 9, padding: "3px 6px 2px" }}>{i + 1}</span>
                    <span style={{ ...lbl, fontSize: labelSize, textAlign: "left", color: f ? YELLOW : "#fff", whiteSpace: "nowrap" }}>{s.label}</span>
                  </div>
                  {subs && s.sub ? <span style={{ ...subStyle, textAlign: "left", fontSize: 12.5, marginTop: 3 }}>{s.sub}</span> : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    ),
  };
}

/* ------------------------------------------------------------------ */
/*  2. 주고받기 exchange · 단계 0 = 두 주체, 1+j = 메시지 j              */
/* ------------------------------------------------------------------ */

function drawExchange(v: Extract<Visual, { type: "exchange" }>, tm: DrawTiming): Drawn {
  const msgs = v.messages.slice(0, 4);
  const top = 104;
  const gap = 50;
  const h = top + msgs.length * gap + 6;
  const L = 52;
  const R = DW - 52;
  return {
    h,
    node: (
      <div style={{ width: DW, height: h, position: "relative" }}>
        {[v.left, v.right].map((a, i) => (
          <div key={i} style={{ position: "absolute", left: (i ? R : L) - 50, width: 100, top: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <Sticker size={60} emoji={a.emoji || (i ? "🅱️" : "🅰️")} d={tm.at(0, i * 2)} tm={tm} cls={i ? "ts-right" : "ts-left"} />
            <div className="ts-pop" style={{ ...lbl, marginTop: 7, fontSize: 14, ...dv(tm.at(0, i * 2 + 1)) }}>
              {a.label}
            </div>
          </div>
        ))}
        <svg width={DW} height={h} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} aria-hidden>
          {[L, R].map((x, i) => (
            <line key={x} className="ts-fade" style={dv(tm.at(0, 2 + i))} x1={x} x2={x} y1={92} y2={h - 2} stroke="rgba(255,255,255,0.5)" strokeWidth={3} strokeDasharray="5 6" />
          ))}
          {msgs.map((m, i) => {
            const y = top + i * gap + 30;
            const ltr = m.from === "left";
            const x1 = ltr ? L + 6 : R - 6;
            const x2 = ltr ? R - 8 : L + 8;
            const head = ltr ? `M${x2 - 10} ${y - 8} L${x2} ${y} L${x2 - 10} ${y + 8}` : `M${x2 + 10} ${y - 8} L${x2} ${y} L${x2 + 10} ${y + 8}`;
            const d = `M${x1} ${y} L${x2} ${y}`;
            const t0 = tm.at(1 + i);
            const color = i % 2 ? YELLOW : "#fff";
            return (
              <g key={i}>
                <path d={d} stroke={NAVY} strokeWidth={8} fill="none" strokeLinecap="round" pathLength={1} className="ts-draw" style={dv(t0, 0.45 * tm.slow)} />
                <path d={d} stroke={color} strokeWidth={3.6} fill="none" strokeLinecap="round" pathLength={1} className="ts-draw" style={dv(t0, 0.45 * tm.slow)} />
                <path d={head} stroke={NAVY} strokeWidth={8} fill="none" strokeLinecap="round" strokeLinejoin="round" className="ts-pop" style={dv(t0 + 0.4 * tm.slow)} />
                <path d={head} stroke={color} strokeWidth={3.6} fill="none" strokeLinecap="round" strokeLinejoin="round" className="ts-pop" style={dv(t0 + 0.4 * tm.slow)} />
              </g>
            );
          })}
        </svg>
        {msgs.map((m, i) => (
          <div key={i} style={{ position: "absolute", left: 0, width: DW, top: top + i * gap + 2, display: "flex", justifyContent: "center" }}>
            <Chip tone={i % 2 ? "yellow" : "white"} d={tm.at(1 + i) + 0.22 * tm.slow} style={{ fontSize: 14 }}>
              <span style={{ opacity: 0.6, fontSize: 11.5 }}>{i + 1}</span> {m.text}
            </Chip>
          </div>
        ))}
      </div>
    ),
  };
}

/* ------------------------------------------------------------------ */
/*  3. 비교 versus · 0 = A, 1 = B, 2 = VS, 3+r = 비교 줄 r               */
/* ------------------------------------------------------------------ */

function drawVersus(v: Extract<Visual, { type: "versus" }>, tm: DrawTiming, subs: boolean): Drawn {
  const rows = v.rows.slice(0, 3);
  const head = subs ? 150 : 128;
  const rh = 46;
  return {
    h: head + rows.length * rh,
    node: (
      <div style={{ width: DW, position: "relative" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", height: head }}>
          {[v.a, v.b].map((s, i) => (
            <div key={i} style={{ width: 140, display: "flex", flexDirection: "column", alignItems: "center", order: i ? 3 : 1 }}>
              <Sticker size={72} emoji={s.emoji || (i ? "B" : "A")} fill={i ? SOFT.blue : SOFT.yellow} d={tm.at(i)} tm={tm} cls={i ? "ts-right" : "ts-left"} />
              <div className="ts-pop" style={{ font: `400 21px/1.1 ${JUA_FONT}`, color: "#fff", marginTop: 9, textShadow: outlineShadow(2, 3), textAlign: "center", wordBreak: "keep-all", ...dv(tm.at(i, 1)) }}>
                {s.label}
              </div>
              {subs && s.sub ? (
                <div className="ts-pop" style={{ ...subStyle, marginTop: 4, ...dv(tm.at(i, 2)) }}>
                  {s.sub}
                </div>
              ) : null}
            </div>
          ))}
          <div
            className="ts-slam"
            style={{
              order: 2,
              marginTop: 16,
              width: 44,
              height: 44,
              borderRadius: 44,
              background: YELLOW,
              border: `3px solid ${NAVY}`,
              boxShadow: `0 4px 0 ${NAVY}`,
              font: `400 17px/38px ${JUA_FONT}`,
              color: NAVY,
              textAlign: "center",
              flexShrink: 0,
              ...dv(tm.at(2)),
            }}
          >
            VS
          </div>
        </div>
        {rows.map((r, i) => (
          <div key={i} className="ts-rise" style={{ display: "flex", alignItems: "center", height: rh, gap: 6, ...dv(tm.at(3 + i), 0.45 * tm.slow) }}>
            <div style={{ flex: 1, display: "flex", justifyContent: "flex-end" }}>
              <span style={valBox}>{r.a}</span>
            </div>
            <span
              style={{
                width: 70,
                flexShrink: 0,
                textAlign: "center",
                font: `400 12.5px/1.15 ${JUA_FONT}`,
                color: YELLOW,
                background: NAVY,
                borderRadius: 10,
                padding: "5px 4px 4px",
                border: "2px solid rgba(255,255,255,0.85)",
                wordBreak: "keep-all",
              }}
            >
              {r.name}
            </span>
            <div style={{ flex: 1, display: "flex", justifyContent: "flex-start" }}>
              <span style={valBox}>{r.b}</span>
            </div>
          </div>
        ))}
      </div>
    ),
  };
}

/* ------------------------------------------------------------------ */
/*  4. 그래프 chart · 0 = 축, 1+i = x 항목 i, 메모는 강조 때               */
/* ------------------------------------------------------------------ */

/** 점들을 지나는 부드러운 곡선을 구간별로 나눠 돌려준다(구간마다 따로 그려 시간 맞추기) */
function smoothSegments(pts: [number, number][]): string[] {
  const out: string[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    out.push(`M${p1[0]} ${p1[1]} C${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${p2[0]} ${p2[1]}`);
  }
  return out;
}

function drawChart(v: Extract<Visual, { type: "chart" }>, tm: DrawTiming, noteAt: number): Drawn {
  const cats = v.categories.slice(0, 6);
  const series = v.series.slice(0, 2).map((s) => ({ ...s, values: cats.map((_, i) => Number(s.values[i] ?? 0) || 0) }));
  const all = series.flatMap((s) => s.values);
  const maxV = Math.max(...all, 1);
  const minV = Math.min(0, ...all);
  const H = 278;
  const x0 = 34;
  const x1 = DW - 10;
  const yTop = 44;
  const yBot = 214;
  const span = maxV * 1.08 - minV || 1;
  const Y = (val: number) => yBot - ((val - minV) / span) * (yBot - yTop);
  const slot = (x1 - x0) / Math.max(1, cats.length);
  const X = (i: number) => x0 + slot * (i + 0.5);
  const zeroY = Y(0);
  const focus = v.focus >= 0 && v.focus < cats.length ? v.focus : -1;
  const focusTop = focus >= 0 ? Math.min(...series.map((s) => Y(s.values[focus]))) : 0;
  const bw = Math.min(40, (slot * 0.62) / Math.max(1, series.length));
  const seg = 0.42 * tm.slow;
  return {
    h: H,
    node: (
      <div style={{ width: DW, height: H, position: "relative" }}>
        <svg width={DW} height={H} style={{ position: "absolute", inset: 0, overflow: "visible" }} aria-hidden>
          <g className="ts-fade" style={dv(tm.at(0))}>
            <path d={`M${x0} ${yTop - 18} V${yBot} H${x1}`} stroke={NAVY} strokeWidth={7} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.5} />
            <path d={`M${x0} ${yTop - 18} V${yBot} H${x1}`} stroke="#fff" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            {minV < 0 ? <line x1={x0} x2={x1} y1={zeroY} y2={zeroY} stroke="rgba(255,255,255,0.75)" strokeWidth={2} strokeDasharray="4 5" /> : null}
          </g>
          {focus >= 0 ? (
            <line className="ts-fade" style={dv(noteAt)} x1={X(focus)} x2={X(focus)} y1={v.note ? 30 : focusTop - 6} y2={yBot} stroke={YELLOW} strokeWidth={3} strokeDasharray="5 5" />
          ) : null}
          {v.kind === "bar"
            ? series.map((s, si) =>
                s.values.map((val, i) => {
                  const bx = X(i) - (bw * series.length) / 2 + si * bw;
                  const top = Math.min(Y(val), zeroY);
                  const hgt = Math.max(3, Math.abs(Y(val) - zeroY));
                  return (
                    <rect
                      key={`${si}-${i}`}
                      className="ts-grow"
                      style={{ ...dv(tm.at(1 + i, si), 0.5 * tm.slow), transformOrigin: `0px ${zeroY}px`, transformBox: "view-box" } as CSS}
                      x={bx + 2}
                      y={top}
                      width={Math.max(4, bw - 4)}
                      height={hgt}
                      rx={6}
                      fill={i === focus && series.length === 1 ? YELLOW : SERIES[series.length === 1 ? 1 : si]}
                      stroke={NAVY}
                      strokeWidth={3}
                    />
                  );
                }),
              )
            : series.map((s, si) => {
                const pts = s.values.map((val, i) => [X(i), Y(val)] as [number, number]);
                const segs = smoothSegments(pts);
                return (
                  <g key={si}>
                    {segs.map((d, i) => (
                      <g key={i}>
                        <path d={d} stroke={NAVY} strokeWidth={10} fill="none" strokeLinecap="round" pathLength={1} className="ts-draw" style={dv(tm.at(2 + i) - seg, seg)} />
                        <path d={d} stroke={SERIES[si]} strokeWidth={5.5} fill="none" strokeLinecap="round" pathLength={1} className="ts-draw" style={dv(tm.at(2 + i) - seg, seg)} />
                      </g>
                    ))}
                    {pts.map(([px, py], i) => (
                      <circle
                        key={i}
                        className="ts-pop"
                        style={dv(tm.at(1 + i, si))}
                        cx={px}
                        cy={py}
                        r={i === focus ? 8 : 5.5}
                        fill={i === focus ? YELLOW : "#fff"}
                        stroke={NAVY}
                        strokeWidth={3}
                      />
                    ))}
                  </g>
                );
              })}
        </svg>
        <span className="ts-fade" style={{ ...lbl, position: "absolute", left: x0 + 8, top: yTop - 28, fontSize: 12.5, textAlign: "left", ...dv(tm.at(0)) }}>
          ↑ {v.yLabel}
        </span>
        <span className="ts-fade" style={{ ...lbl, position: "absolute", right: 0, top: yBot + 26, fontSize: 12, opacity: 0.85, ...dv(tm.at(0)) }}>
          {v.xLabel} →
        </span>
        {minV < 0 ? (
          <span className="ts-fade" style={{ ...subStyle, position: "absolute", left: 14, top: zeroY - 8, fontSize: 11, ...dv(tm.at(0)) }}>
            0
          </span>
        ) : null}
        {cats.map((c, i) => (
          <span
            key={i}
            className="ts-pop"
            style={{ ...lbl, position: "absolute", left: X(i) - slot / 2, width: slot, top: yBot + 8, fontSize: cats.length > 4 ? 11.5 : 13, color: i === focus ? YELLOW : "#fff", ...dv(tm.at(1 + i)) }}
          >
            {c}
          </span>
        ))}
        {series.length > 1 ? (
          <div className="ts-fade" style={{ position: "absolute", left: x0 + 2, top: yBot + 30, display: "flex", gap: 10, ...dv(tm.at(0, 1)) }}>
            {series.map((s, si) => (
              <span key={si} style={{ display: "inline-flex", alignItems: "center", gap: 5, ...lbl, fontSize: 12.5 }}>
                <span style={{ width: 16, height: 6, borderRadius: 4, background: SERIES[si], border: `2px solid ${NAVY}` }} />
                {s.name}
              </span>
            ))}
          </div>
        ) : null}
        {focus >= 0 && v.note ? (
          <div style={{ position: "absolute", left: Math.max(0, Math.min(DW - 160, X(focus) - 80)), width: 160, top: 6, display: "flex", justifyContent: "center" }}>
            <span className="ts-em" style={{ display: "inline-flex", ...ev(tm.em) }}>
              <Chip tone="yellow" d={noteAt + 0.1} style={{ fontSize: 13.5 }}>
                {v.note}
              </Chip>
            </span>
          </div>
        ) : null}
        <ExampleTag show={v.illustrative} d={tm.at(0)} right />
      </div>
    ),
  };
}

/* ------------------------------------------------------------------ */
/*  5. 순환 cycle · i = 노드 i(앞 노드에서 오는 화살표 포함), n = 되돌아오기 */
/* ------------------------------------------------------------------ */

function drawCycle(v: Extract<Visual, { type: "cycle" }>, tm: DrawTiming, subs: boolean): Drawn {
  const nodes = v.nodes.slice(0, 5);
  const n = nodes.length;
  const H = 300;
  const cx = DW / 2;
  const cy = 136;
  const R = n === 3 ? 92 : 104;
  const size = n === 5 ? 52 : 58;
  const ang = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const pos = (i: number) => [cx + R * Math.cos(ang(i)), cy + R * Math.sin(ang(i))] as const;
  const gapA = (size / 2 + 12) / R;
  const arc = (i: number) => {
    const a0 = ang(i) + gapA;
    const a1 = ang(i + 1) - gapA;
    const p0 = [cx + R * Math.cos(a0), cy + R * Math.sin(a0)];
    const p1 = [cx + R * Math.cos(a1), cy + R * Math.sin(a1)];
    // 화살촉: 끝점에서 시계 방향 접선
    const tx = -Math.sin(a1);
    const ty = Math.cos(a1);
    const nx = -ty;
    const ny = tx;
    const hx = p1[0] - tx * 9;
    const hy = p1[1] - ty * 9;
    const head = `M${hx + nx * 7} ${hy + ny * 7} L${p1[0]} ${p1[1]} L${hx - nx * 7} ${hy - ny * 7}`;
    return { d: `M${p0[0]} ${p0[1]} A${R} ${R} 0 0 1 ${p1[0]} ${p1[1]}`, head };
  };
  // 화살표 i(노드 i → i+1)는 노드 i+1과 함께, 마지막 화살표(끝 → 처음)는 단계 n에
  const arcStep = (i: number) => (i + 1 < n ? i + 1 : n);
  const seg = 0.45 * tm.slow;
  return {
    h: H,
    node: (
      <div style={{ width: DW, height: H, position: "relative" }}>
        <svg width={DW} height={H} style={{ position: "absolute", inset: 0, overflow: "visible" }} aria-hidden>
          {nodes.map((_, i) => {
            const a = arc(i);
            const t0 = tm.at(arcStep(i)) - (i + 1 < n ? 0.12 : 0);
            return (
              <g key={i}>
                <path d={a.d} stroke={NAVY} strokeWidth={8.5} fill="none" strokeLinecap="round" pathLength={1} className="ts-draw" style={dv(t0, seg)} opacity={0.55} />
                <path d={a.d} stroke={i === n - 1 ? YELLOW : "#fff"} strokeWidth={4} fill="none" strokeLinecap="round" pathLength={1} className="ts-draw" style={dv(t0, seg)} />
                <path d={a.head} stroke={NAVY} strokeWidth={8} fill="none" strokeLinecap="round" strokeLinejoin="round" className="ts-pop" style={dv(t0 + seg * 0.85)} opacity={0.55} />
                <path d={a.head} stroke={i === n - 1 ? YELLOW : "#fff"} strokeWidth={3.6} fill="none" strokeLinecap="round" strokeLinejoin="round" className="ts-pop" style={dv(t0 + seg * 0.85)} />
              </g>
            );
          })}
        </svg>
        {tm.motion ? (
          // 한 바퀴 도는 작은 공: "끝이 다시 처음으로"
          <div className="ts-orbit" style={{ position: "absolute", left: cx, top: cy, width: 0, height: 0, ...dv(tm.at(n) + 0.35, 1.7) }}>
            <span style={{ position: "absolute", left: -9, top: -R - 9, width: 18, height: 18, borderRadius: 18, background: YELLOW, border: `3px solid ${NAVY}`, boxShadow: `0 0 0 5px rgba(255,212,59,0.35)` }} />
          </div>
        ) : null}
        {v.center ? (
          <div
            className="ts-pop"
            style={{
              position: "absolute",
              left: cx - 70,
              width: 140,
              top: cy - 16,
              textAlign: "center",
              font: `400 19px/1.15 ${JUA_FONT}`,
              color: "#fff",
              textShadow: outlineShadow(2, 3),
              wordBreak: "keep-all",
              ...dv(tm.at(n, 2)),
            }}
          >
            <span className="ts-em" style={{ display: "inline-block", ...ev(tm.em) }}>
              {v.center}
            </span>
          </div>
        ) : null}
        {nodes.map((s, i) => {
          const [x, y] = pos(i);
          return (
            <div key={i} style={{ position: "absolute", left: x - 55, top: y - size / 2, width: 110, display: "flex", flexDirection: "column", alignItems: "center" }}>
              <Sticker size={size} emoji={s.emoji || `${i + 1}`} round d={tm.at(i)} tm={tm} />
              <div className="ts-pop" style={{ ...lbl, fontSize: 13.5, marginTop: 5, ...dv(tm.at(i, 1)) }}>
                {s.label}
              </div>
              {subs && s.sub && n <= 4 ? (
                <div className="ts-pop" style={{ ...subStyle, fontSize: 10.5, marginTop: 2, ...dv(tm.at(i, 1)) }}>
                  {s.sub}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    ),
  };
}

/* ------------------------------------------------------------------ */
/*  6. 분류 tree · 0 = 뿌리, 1 = 가지선, 2+i = 갈래 i                    */
/* ------------------------------------------------------------------ */

function drawTree(v: Extract<Visual, { type: "tree" }>, tm: DrawTiming, subs: boolean): Drawn {
  const kids = v.children.slice(0, 4);
  const n = Math.max(1, kids.length);
  const size = n === 4 ? 58 : 66;
  const colW = DW / n;
  const busY = 74;
  const kidTop = 96;
  const H = kidTop + size + (subs ? 76 : 50);
  const bus = `M${DW / 2} 48 V${busY} M${colW / 2} ${busY} H${DW - colW / 2}`;
  const drops = kids.map((_, i) => `M${colW * (i + 0.5)} ${busY} V${kidTop - 4}`);
  return {
    h: H,
    node: (
      <div style={{ width: DW, height: H, position: "relative" }}>
        <svg width={DW} height={H} style={{ position: "absolute", inset: 0, overflow: "visible" }} aria-hidden>
          <path d={bus} stroke={NAVY} strokeWidth={8} fill="none" strokeLinecap="round" opacity={0.55} pathLength={1} className="ts-draw" style={dv(tm.at(1), 0.4 * tm.slow)} />
          <path d={bus} stroke="#fff" strokeWidth={3.6} fill="none" strokeLinecap="round" pathLength={1} className="ts-draw" style={dv(tm.at(1), 0.4 * tm.slow)} />
          {drops.map((d, i) => (
            <g key={i}>
              <path d={d} stroke={NAVY} strokeWidth={8} fill="none" strokeLinecap="round" opacity={0.55} pathLength={1} className="ts-draw" style={dv(tm.at(2 + i) - 0.1, 0.2)} />
              <path d={d} stroke="#fff" strokeWidth={3.6} fill="none" strokeLinecap="round" pathLength={1} className="ts-draw" style={dv(tm.at(2 + i) - 0.1, 0.2)} />
            </g>
          ))}
        </svg>
        <div style={{ position: "absolute", left: 0, width: DW, top: 0, display: "flex", justifyContent: "center" }}>
          <Chip tone="navy" d={tm.at(0)} style={{ fontSize: 22, padding: "6px 16px 7px" }}>
            {v.root.emoji ? <span style={{ font: `20px/1 ${EMOJI_FONT}` }}>{v.root.emoji}</span> : null}
            {v.root.label}
          </Chip>
        </div>
        {kids.map((k, i) => (
          <div key={i} style={{ position: "absolute", left: colW * i, width: colW, top: kidTop, display: "flex", flexDirection: "column", alignItems: "center", paddingInline: 2 }}>
            <Sticker size={size} emoji={k.emoji || `${i + 1}`} d={tm.at(2 + i)} tm={tm} cls="ts-drop" />
            <div className="ts-pop" style={{ font: `400 18px/1.1 ${JUA_FONT}`, color: "#fff", textShadow: outlineShadow(1.6, 2.6), marginTop: 9, textAlign: "center", wordBreak: "keep-all", ...dv(tm.at(2 + i, 1)) }}>
              {k.label}
            </div>
            {subs && k.sub ? (
              <div className="ts-pop" style={{ ...subStyle, fontSize: n === 4 ? 11 : 12, marginTop: 4, ...dv(tm.at(2 + i, 2)) }}>
                {k.sub}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    ),
  };
}

/* ------------------------------------------------------------------ */
/*  7. 2축 지도 matrix · 0 = 판·축, 1+i = 대상 i, 1+m = 빈 자리          */
/* ------------------------------------------------------------------ */

const axisTag: CSS = { position: "absolute", font: `800 11px/1 ${PRE}`, color: "rgba(255,255,255,0.9)", whiteSpace: "nowrap" };
const axisName: CSS = {
  position: "absolute",
  font: `400 12.5px/1 ${JUA_FONT}`,
  color: NAVY,
  background: "rgba(255,255,255,0.94)",
  borderRadius: 8,
  padding: "4px 7px 3px",
  whiteSpace: "nowrap",
};

function drawMatrix(v: Extract<Visual, { type: "matrix" }>, tm: DrawTiming): Drawn {
  const H = 294;
  const px0 = 18;
  const px1 = DW - 18;
  const py0 = 30;
  const py1 = 260;
  const mx = (px0 + px1) / 2;
  const my = (py0 + py1) / 2;
  const PX = (x: number) => px0 + (Math.max(0, Math.min(100, x)) / 100) * (px1 - px0);
  const PY = (y: number) => py1 - (Math.max(0, Math.min(100, y)) / 100) * (py1 - py0);
  const items = v.items.slice(0, 5).map((it) => {
    const w = textWidth(it.label, 12.5) + (it.emoji ? 22 : 0) + 22;
    return { it, w, h: 30, x: PX(it.x), y: PY(it.y) };
  });
  const hasGap = !!v.gap?.label;
  const gap = hasGap ? { w: 74, h: 96, x: PX(v.gap.x), y: PY(v.gap.y) } : null;
  const boxes = [...items, ...(gap ? [gap] : [])];
  // 겹치지 않게 살짝 밀어내기
  for (let k = 0; k < 40; k++) {
    let moved = false;
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        const ox = (a.w + b.w) / 2 + 6 - Math.abs(a.x - b.x);
        const oy = (a.h + b.h) / 2 + 6 - Math.abs(a.y - b.y);
        if (ox > 0 && oy > 0) {
          moved = true;
          if (oy < ox) {
            const s = a.y <= b.y ? -1 : 1;
            a.y += (s * oy) / 2;
            b.y -= (s * oy) / 2;
          } else {
            const s = a.x <= b.x ? -1 : 1;
            a.x += (s * ox) / 2;
            b.x -= (s * ox) / 2;
          }
        }
      }
    for (const b of boxes) {
      b.x = Math.max(px0 + b.w / 2, Math.min(px1 - b.w / 2, b.x));
      b.y = Math.max(py0 + b.h / 2, Math.min(py1 - b.h / 2, b.y));
    }
    if (!moved) break;
  }
  const hasF = v.focus >= 0 && v.focus < items.length;
  const gapStep = 1 + items.length;
  const axes = `M${px0 + 4} ${my} H${px1 - 4} M${mx} ${py1 - 4} V${py0 + 4}`;
  return {
    h: H,
    node: (
      <div style={{ width: DW, height: H, position: "relative" }}>
        <svg width={DW} height={H} style={{ position: "absolute", inset: 0, overflow: "visible" }} aria-hidden>
          <g className="ts-fade" style={dv(tm.at(0))}>
            <rect x={px0} y={py0} width={px1 - px0} height={py1 - py0} rx={16} fill="rgba(255,255,255,0.10)" stroke="rgba(255,255,255,0.35)" strokeWidth={2} />
            <rect x={px0} y={py0} width={(px1 - px0) / 2} height={(py1 - py0) / 2} rx={16} fill="rgba(255,255,255,0.06)" />
            <rect x={mx} y={my} width={(px1 - px0) / 2} height={(py1 - py0) / 2} rx={16} fill="rgba(255,255,255,0.06)" />
          </g>
          <path d={axes} stroke={NAVY} strokeWidth={7} opacity={0.45} strokeLinecap="round" fill="none" pathLength={1} className="ts-draw" style={dv(tm.at(0), 0.55 * tm.slow)} />
          <path d={axes} stroke="#fff" strokeWidth={3} strokeLinecap="round" fill="none" pathLength={1} className="ts-draw" style={dv(tm.at(0), 0.55 * tm.slow)} />
        </svg>
        <span className="ts-fade" style={{ ...axisTag, left: px0 + 6, top: my + 7, ...dv(tm.at(0, 3)) }}>
          ◀ {v.x.low}
        </span>
        <span className="ts-fade" style={{ ...axisTag, right: DW - px1 + 6, top: my + 7, ...dv(tm.at(0, 3)) }}>
          {v.x.high} ▶
        </span>
        <span className="ts-fade" style={{ ...axisTag, left: mx + 7, top: py0 + 5, ...dv(tm.at(0, 4)) }}>
          ▲ {v.y.high}
        </span>
        <span className="ts-fade" style={{ ...axisTag, left: mx + 7, bottom: H - py1 + 5, ...dv(tm.at(0, 4)) }}>
          ▼ {v.y.low}
        </span>
        <span className="ts-pop" style={{ ...axisName, left: mx, top: 3, translate: "-50% 0", ...dv(tm.at(0, 5)) }}>
          ↕ {v.y.name}
        </span>
        <span className="ts-pop" style={{ ...axisName, left: px1, top: py1 + 7, translate: "-100% 0", ...dv(tm.at(0, 5)) }}>
          ↔ {v.x.name}
        </span>
        {gap && v.gap ? (
          <div style={{ position: "absolute", left: gap.x - 37, top: gap.y - 48, width: 74, height: 96 }}>
            <div className="ts-pop" style={{ position: "absolute", left: 0, top: 0, width: 74, height: 74, ...dv(tm.at(gapStep)) }}>
              <div
                className="ts-pulse"
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: 74,
                  border: `3px dashed ${YELLOW}`,
                  background: "rgba(255,212,59,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  font: v.gap.emoji ? `26px/1 ${EMOJI_FONT}` : `400 30px/1 ${JUA_FONT}`,
                  color: YELLOW,
                  ...dv(tm.at(gapStep) + 0.5),
                }}
              >
                {v.gap.emoji || "?"}
              </div>
              <span className="ts-ringfx" style={{ position: "absolute", inset: -6, borderRadius: 90, border: `4px solid ${YELLOW}`, ...ev(tm.em) }} />
            </div>
            <div
              className="ts-pop"
              style={{
                position: "absolute",
                left: -44,
                right: -44,
                top: 78,
                textAlign: "center",
                font: `400 14px/1.1 ${JUA_FONT}`,
                color: YELLOW,
                textShadow: outlineShadow(1.4, 2.4),
                wordBreak: "keep-all",
                ...dv(tm.at(gapStep, 1)),
              }}
            >
              {v.gap.label}
            </div>
          </div>
        ) : null}
        {items.map((b, i) => {
          const f = v.focus === i;
          return (
            <div
              key={i}
              className={dimmer(tm, hasF || hasGap, f)}
              style={{ position: "absolute", left: b.x - b.w / 2, top: b.y - b.h / 2, width: b.w, height: b.h, ...ev(tm.em) }}
            >
              <span className={f ? "ts-em" : ""} style={{ display: "block", width: "100%", height: "100%", ...ev(tm.em) }}>
                <span
                  className="ts-drop"
                  style={{
                    width: "100%",
                    height: "100%",
                    boxSizing: "border-box",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 3,
                    borderRadius: 999,
                    background: f ? YELLOW : "#fff",
                    border: `2.5px solid ${NAVY}`,
                    boxShadow: `0 3px 0 ${NAVY}`,
                    font: `800 12.5px/1 ${PRE}`,
                    color: NAVY,
                    whiteSpace: "nowrap",
                    ...dv(tm.at(1 + i)),
                  }}
                >
                  {b.it.emoji ? <span style={{ font: `14px/1 ${EMOJI_FONT}` }}>{b.it.emoji}</span> : null}
                  {b.it.label}
                </span>
              </span>
            </div>
          );
        })}
      </div>
    ),
  };
}

/* ------------------------------------------------------------------ */
/*  8. 공식 formula · 0 = 결과 =, 1+i = 항 i, 1+T = 숫자 예시             */
/* ------------------------------------------------------------------ */

function drawFormula(v: Extract<Visual, { type: "formula" }>, tm: DrawTiming): Drawn {
  const terms = v.terms.slice(0, 3);
  const frac = v.op === "÷" && terms.length === 2;
  const termPill = (t: { text: string; note: string }, i: number) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <Chip d={tm.at(1 + i, 1)} style={{ fontSize: 18, padding: "6px 13px 7px" }}>
        {t.text}
      </Chip>
      {t.note ? (
        <span className="ts-pop" style={{ ...subStyle, fontSize: 11.5, marginTop: 5, ...dv(tm.at(1 + i, 2)) }}>
          {t.note}
        </span>
      ) : null}
    </div>
  );
  const result = (
    <span className="ts-em" style={{ display: "inline-flex", ...ev(tm.em) }}>
      <Chip tone="yellow" d={tm.at(0)} style={{ fontSize: 21, padding: "7px 14px 8px" }}>
        {v.result}
      </Chip>
    </span>
  );
  const eq = (
    <span className="ts-pop" style={{ font: `400 36px/1 ${JUA_FONT}`, color: "#fff", textShadow: outlineShadow(2, 3), ...dv(tm.at(0, 1)) }}>
      =
    </span>
  );
  return {
    h: frac ? 210 : 220,
    node: (
      <div style={{ width: DW, display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
        {frac ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {result}
            {eq}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              {termPill(terms[0], 0)}
              <div className="ts-wipe" style={{ width: 150, height: 5, borderRadius: 4, background: "#fff", boxShadow: `0 3px 0 rgba(27,27,58,0.45)`, ...dv(tm.at(2), 0.35) }} />
              {termPill(terms[1], 1)}
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {result}
              {eq}
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
              {terms.map((t, i) => (
                <React.Fragment key={i}>
                  {i > 0 ? (
                    <span className="ts-pop" style={{ font: `400 28px/38px ${JUA_FONT}`, color: YELLOW, textShadow: outlineShadow(1.6, 2.6), ...dv(tm.at(1 + i)) }}>
                      {v.op}
                    </span>
                  ) : null}
                  {termPill(t, i)}
                </React.Fragment>
              ))}
            </div>
          </>
        )}
        {v.example ? (
          <span className="ts-rise" style={{ ...valBox, maxWidth: DW, fontSize: 13.5, background: "rgba(255,255,255,0.96)", ...dv(tm.at(1 + terms.length)) }}>
            예) {v.example}
          </span>
        ) : null}
      </div>
    ),
  };
}

/* ------------------------------------------------------------------ */
/*  9. 원인→결과 chain · i = 고리 i                                      */
/* ------------------------------------------------------------------ */

function drawChain(v: Extract<Visual, { type: "chain" }>, tm: DrawTiming, subs: boolean): Drawn {
  const links = v.links.slice(0, 4);
  const showSub = subs && links.some((l) => l.sub);
  const row = showSub ? 60 : 52;
  const gap = 24;
  return {
    h: links.length * row + (links.length - 1) * gap,
    node: (
      <div style={{ width: DW, display: "flex", flexDirection: "column", alignItems: "center" }}>
        {links.map((l, i) => {
          const last = i === links.length - 1;
          return (
            <React.Fragment key={i}>
              {i > 0 ? (
                <div style={{ height: gap, display: "flex", alignItems: "center", gap: 6 }}>
                  <DownArrow h={22} d={tm.at(i)} />
                  <span className="ts-pop" style={{ ...subStyle, fontSize: 11, ...dv(tm.at(i)) }}>
                    그래서
                  </span>
                </div>
              ) : null}
              <div className={last ? "ts-em" : ""} style={ev(tm.em)}>
                <div
                  className="ts-pop"
                  style={{
                    height: row,
                    minWidth: 190,
                    maxWidth: DW,
                    boxSizing: "border-box",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "0 18px 0 8px",
                    borderRadius: 18,
                    background: last ? SOFT.yellow : "#fff",
                    border: `3px solid ${NAVY}`,
                    boxShadow: `0 4px 0 ${NAVY}`,
                    ...dv(tm.at(i, 1)),
                  }}
                >
                  <span style={{ font: l.emoji ? `26px/1 ${EMOJI_FONT}` : `400 22px/1 ${JUA_FONT}`, color: NAVY }}>{l.emoji || i + 1}</span>
                  <span style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ font: `400 18px/1.1 ${JUA_FONT}`, color: NAVY, wordBreak: "keep-all" }}>{l.label}</span>
                    {showSub && l.sub ? <span style={{ font: `700 11.5px/1.25 ${PRE}`, color: "#4B5068", marginTop: 2 }}>{l.sub}</span> : null}
                  </span>
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    ),
  };
}

/* ------------------------------------------------------------------ */
/*  10. 비율 parts · 0 = 전체, 1+i = 조각 i                              */
/* ------------------------------------------------------------------ */

function drawParts(v: Extract<Visual, { type: "parts" }>, tm: DrawTiming): Drawn {
  const parts = v.parts.slice(0, 5);
  const total = parts.reduce((a, p) => a + Math.max(0, Number(p.value) || 0), 0) || 1;
  const cx = 92;
  const cy = 104;
  const r = 70;
  let acc = -Math.PI / 2;
  const hasF = v.focus >= 0 && v.focus < parts.length;
  const arcs = parts.map((p, i) => {
    const a0 = acc;
    const a1 = acc + (Math.max(0, Number(p.value) || 0) / total) * Math.PI * 2;
    acc = a1;
    const mid = (a0 + a1) / 2;
    const off = i === v.focus ? 9 : 0;
    const ox = Math.cos(mid) * off;
    const oy = Math.sin(mid) * off;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const p0 = [cx + ox + r * Math.cos(a0), cy + oy + r * Math.sin(a0)];
    const p1 = [cx + ox + r * Math.cos(a1), cy + oy + r * Math.sin(a1)];
    const full = a1 - a0 >= Math.PI * 2 - 0.001;
    const d = full
      ? `M${cx} ${cy - r} A${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} Z`
      : `M${cx + ox} ${cy + oy} L${p0[0]} ${p0[1]} A${r} ${r} 0 ${large} 1 ${p1[0]} ${p1[1]} Z`;
    return { d, color: SERIES[i % SERIES.length], i };
  });
  return {
    h: 222,
    node: (
      <div style={{ width: DW, height: 222, position: "relative" }}>
        <svg width={200} height={210} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} aria-hidden>
          <circle className="ts-fade" style={dv(tm.at(0))} cx={cx} cy={cy} r={r} fill="rgba(255,255,255,0.14)" stroke="rgba(255,255,255,0.4)" strokeWidth={2} strokeDasharray="5 6" />
          {arcs.map((a) => (
            <g key={a.i} className={dimmer(tm, hasF, a.i === v.focus)} style={ev(tm.em)}>
              <path
                d={a.d}
                fill={a.color}
                stroke={NAVY}
                strokeWidth={3}
                strokeLinejoin="round"
                className="ts-pop"
                style={{ ...dv(tm.at(1 + a.i)), transformBox: "view-box", transformOrigin: `${cx}px ${cy}px` } as CSS}
              />
            </g>
          ))}
          <circle className="ts-pop" style={{ ...dv(tm.at(0)), transformBox: "view-box", transformOrigin: `${cx}px ${cy}px` } as CSS} cx={cx} cy={cy} r={34} fill="#fff" stroke={NAVY} strokeWidth={3} />
        </svg>
        <span className="ts-pop" style={{ position: "absolute", left: cx - 30, width: 60, top: cy - 9, textAlign: "center", font: `400 14px/1.1 ${JUA_FONT}`, color: NAVY, wordBreak: "keep-all", ...dv(tm.at(0, 1)) }}>
          {v.whole}
        </span>
        <div style={{ position: "absolute", left: 192, top: 104 - parts.length * 17, display: "flex", flexDirection: "column", gap: 8 }}>
          {parts.map((p, i) => {
            const f = i === v.focus;
            return (
              <div key={i} className={dimmer(tm, hasF, f)} style={ev(tm.em)}>
                <div className={f ? "ts-em" : ""} style={{ ...ev(tm.em), transformOrigin: "left center" }}>
                  <div className="ts-left" style={{ display: "flex", alignItems: "center", gap: 7, ...dv(tm.at(1 + i, 1), 0.4) }}>
                    <span style={{ width: 14, height: 14, borderRadius: 4, background: SERIES[i % SERIES.length], border: `2.5px solid ${NAVY}` }} />
                    {p.emoji ? <span style={{ font: `14px/1 ${EMOJI_FONT}` }}>{p.emoji}</span> : null}
                    <span style={{ ...lbl, fontSize: 14, color: f ? YELLOW : "#fff" }}>{p.label}</span>
                    <span style={{ font: `400 16px/1 ${JUA_FONT}`, color: f ? YELLOW : "#fff", textShadow: "0 2px 0 rgba(27,27,58,0.45)" }}>{p.value}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <ExampleTag show={v.illustrative} d={tm.at(0)} />
      </div>
    ),
  };
}

/* ------------------------------------------------------------------ */
/*  11. 연표 timeline · 0 = 시간 선, 1+i = 사건 i                         */
/* ------------------------------------------------------------------ */

function drawTimeline(v: Extract<Visual, { type: "timeline" }>, tm: DrawTiming): Drawn {
  const ev0 = v.events.slice(0, 5);
  const n = ev0.length;
  const H = 236;
  const ly = 118;
  const xa = 36;
  const xb = DW - 36;
  const X = (i: number) => (n === 1 ? DW / 2 : xa + (i * (xb - xa)) / (n - 1));
  const hasF = v.focus >= 0 && v.focus < n;
  const line = `M8 ${ly} H${DW - 8} M${DW - 18} ${ly - 8} L${DW - 8} ${ly} L${DW - 18} ${ly + 8}`;
  return {
    h: H,
    node: (
      <div style={{ width: DW, height: H, position: "relative" }}>
        <svg width={DW} height={H} style={{ position: "absolute", inset: 0, overflow: "visible" }} aria-hidden>
          <path d={line} stroke={NAVY} strokeWidth={8} fill="none" strokeLinecap="round" opacity={0.5} pathLength={1} className="ts-draw" style={dv(tm.at(0), 0.6 * tm.slow)} />
          <path d={line} stroke="#fff" strokeWidth={4} fill="none" strokeLinecap="round" pathLength={1} className="ts-draw" style={dv(tm.at(0), 0.6 * tm.slow)} />
          {ev0.map((_, i) => (
            <circle key={i} cx={X(i)} cy={ly} r={i === v.focus ? 10 : 7.5} fill={i === v.focus ? YELLOW : "#fff"} stroke={NAVY} strokeWidth={3} className="ts-pop" style={dv(tm.at(1 + i))} />
          ))}
        </svg>
        {ev0.map((e, i) => {
          const up = i % 2 === 0;
          const f = i === v.focus;
          return (
            <div
              key={i}
              className={dimmer(tm, hasF, f)}
              style={{
                position: "absolute",
                left: X(i) - 50,
                width: 100,
                top: up ? 0 : ly + 16,
                height: ly - 16,
                display: "flex",
                flexDirection: up ? "column" : "column-reverse",
                alignItems: "center",
                justifyContent: "flex-end",
                ...ev(tm.em),
              }}
            >
              <div className="ts-pop" style={{ ...lbl, fontSize: 13, color: f ? YELLOW : "#fff", margin: up ? "0 0 5px" : "5px 0 0", ...dv(tm.at(1 + i, 2)) }}>
                {e.label}
              </div>
              <Sticker size={42} emoji={e.emoji || `${i + 1}`} focus={f} d={tm.at(1 + i, 1)} tm={tm} />
              <div className="ts-pop" style={{ font: `400 15px/1 ${JUA_FONT}`, color: f ? YELLOW : "#fff", textShadow: "0 2px 0 rgba(27,27,58,0.5)", margin: up ? "6px 0 0" : "0 0 6px", ...dv(tm.at(1 + i, 1)) }}>
                {e.when}
              </div>
            </div>
          );
        })}
      </div>
    ),
  };
}

/* ------------------------------------------------------------------ */
/*  12. 비유 analogy · 0 = 개념, 1 = 비유, 2 = 공통점                     */
/* ------------------------------------------------------------------ */

function drawAnalogy(v: Extract<Visual, { type: "analogy" }>, tm: DrawTiming, subs: boolean): Drawn {
  return {
    h: 214,
    node: (
      <div style={{ width: DW, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {[v.thing, v.like].map((s, i) => (
            <React.Fragment key={i}>
              {i === 1 ? (
                <span className="ts-slam" style={{ font: `400 46px/1 ${JUA_FONT}`, color: YELLOW, textShadow: outlineShadow(2.2, 3.4), ...dv(tm.at(1)) }}>
                  ≈
                </span>
              ) : null}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 118 }}>
                <Sticker size={98} emoji={s.emoji || "💡"} fill={i ? SOFT.yellow : "#fff"} d={tm.at(i, 1)} tm={tm} cls={i ? "ts-right" : "ts-pop"} />
                <div className="ts-pop" style={{ font: `400 19px/1.1 ${JUA_FONT}`, color: "#fff", textShadow: outlineShadow(1.8, 3), marginTop: 10, textAlign: "center", wordBreak: "keep-all", ...dv(tm.at(i, 2)) }}>
                  {s.label}
                </div>
                {subs && s.sub ? (
                  <div className="ts-pop" style={{ ...subStyle, marginTop: 3, ...dv(tm.at(i, 2)) }}>
                    {s.sub}
                  </div>
                ) : null}
              </div>
            </React.Fragment>
          ))}
        </div>
        {v.because ? (
          <span className="ts-em" style={{ display: "inline-flex", marginTop: 16, ...ev(tm.em) }}>
            <span className="ts-rise" style={{ ...valBox, maxWidth: DW, fontSize: 14, ...dv(tm.at(2)) }}>
              공통점 · {v.because}
            </span>
          </span>
        ) : null}
      </div>
    ),
  };
}

/* ------------------------------------------------------------------ */

export interface DrawOptions {
  /** 한 줄 설명(sub)을 그림에 넣을지. 모션은 자막으로 빼므로 false */
  subs: boolean;
  /** 차트 메모가 나오는 시각. 없으면 텍스트=모든 단계 뒤, 모션=강조 때 */
  noteAt?: number;
}

export function drawVisual(v: Visual, tm: DrawTiming, opts: DrawOptions): Drawn {
  switch (v.type) {
    case "flow":
      return drawFlow(v, tm, opts.subs);
    case "exchange":
      return drawExchange(v, tm);
    case "versus":
      return drawVersus(v, tm, opts.subs);
    case "chart":
      return drawChart(v, tm, opts.noteAt ?? (tm.motion && tm.em != null ? tm.em : tm.at(1 + v.categories.length)));
    case "cycle":
      return drawCycle(v, tm, opts.subs);
    case "tree":
      return drawTree(v, tm, opts.subs);
    case "matrix":
      return drawMatrix(v, tm);
    case "formula":
      return drawFormula(v, tm);
    case "chain":
      return drawChain(v, tm, opts.subs);
    case "parts":
      return drawParts(v, tm);
    case "timeline":
      return drawTimeline(v, tm);
    case "analogy":
      return drawAnalogy(v, tm, opts.subs);
    default:
      return { h: 120, node: null };
  }
}
