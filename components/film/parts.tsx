"use client";
// 여러 화면이 같이 쓰는 작은 조각: 로고, 뒤로 가기, 구역 제목, 진행 시간 시계
import { useEffect, useState, type ReactNode } from "react";
import { BRAND } from "@/lib/film/store";
import { Icon } from "./icons";

export function Logo() {
  return (
    <a className="logo" href="#home" aria-label={BRAND + " 홈"}>
      Study<i>Tok</i>
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
