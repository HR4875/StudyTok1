"use client";
// 여러 화면이 같이 쓰는 작은 조각: 로고, 뒤로 가기, 구역 제목, 트랙 번호, 만드는 중 화면의 조각, 진행 시간 시계
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { BRAND, listSeries, type Series } from "@/lib/film/store";
import { Icon } from "./icons";

export function Logo() {
  return (
    <a className="logo" href="#home" aria-label={BRAND + " 홈"}>
      STUDY&nbsp;T<i>@</i>K
    </a>
  );
}

export function Back({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a className="back" href={href}>
      <Icon name="back" />
      {children}
    </a>
  );
}

/** 홈 밖 화면의 머리: 홈으로 가는 링크와 로고 */
export function SubTop() {
  return (
    <header className="top">
      <Back href="#home">홈</Back>
      <Logo />
    </header>
  );
}

export function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="sec">
      <h2>{title}</h2>
      {hint ? <p className="hint">{hint}</p> : null}
      {children}
    </section>
  );
}

/** 트랙 번호: 1번은 업로드, 그다음은 홈에 보이는 순서대로 (내가 만든 시리즈, 바로 볼 수 있는 시리즈) */
export function trackNo(id: string): number {
  const ids = [...listSeries("mine"), ...listSeries("built")].map((s) => s.id);
  const i = ids.indexOf(id);
  return i < 0 ? 0 : i + 2;
}
/** 트랙 라벨에 쓰는 과목 이름: "파생상품 · 전공 강의자료 46쪽에서" → "파생상품", "내 자료 · 감가상각" → "감가상각" */
export const subjectOf = (s: Series): string => s.kicker.replace(/^내 자료 · /, "").split(" · ")[0] || s.kicker;
export const trackLabel = (s: Series): string => {
  const n = trackNo(s.id);
  return (n ? `Track #${n} : ` : "") + subjectOf(s);
};

/** 만드는 동안 흐른 초를 보여 주려고 0.5초마다 다시 그린다. 만들지 않을 때는 시계를 멈춘다. */
export function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [active]);
  return now;
}

/** "메시지 · 12초" */
export const busyLine = (message: string, t0: number, now: number): string => `${message} · ${Math.max(0, Math.round((now - t0) / 1000))}초`;

/** 만드는 중 화면: 기울어진 스티커 카드 세 장 (개념 그림 칸과 같은 모양). 가운데 카드에 방금 정해진 편 이름 (원래 앱의 Loading.tsx) */
export function CardStack({ label }: { label: string }) {
  const card = (i: number) =>
    ({ "--x": `${(i - 1) * 46}px`, "--y": `${i === 1 ? -6 : 6}px`, "--r": `${i === 1 ? -1.5 : (i - 1) * 8}deg`, "--d": `${i * 0.18}s` }) as CSSProperties;
  return (
    <div className="stack" aria-hidden="true">
      <span style={card(0)} />
      <span style={card(2)} />
      <span className="mid1" style={card(1)}>
        <i />
        <b>{label}</b>
      </span>
    </div>
  );
}

/** 만드는 중 화면의 단계 한 줄: 끝남(✓) · 하는 중(돌아가는 원) · 아직 */
export function Check({ state, label, detail }: { state: "done" | "doing" | "todo"; label: string; detail?: string }) {
  return (
    <div className={"ck " + state}>
      <span className="dot" aria-hidden="true">
        {state === "done" ? <Icon name="check" /> : state === "doing" ? <span className="whirl" /> : null}
      </span>
      <span>
        {label}
        <span className="sr">{state === "done" ? " (끝남)" : state === "doing" ? " (하는 중)" : " (아직)"}</span>
      </span>
      {detail ? <em>{detail}</em> : null}
    </div>
  );
}
