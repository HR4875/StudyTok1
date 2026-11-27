"use client";
// 홈 (기존 시작 화면처럼 한 화면): 제목 띠, 업로드 트랙, 디자인 F 미리보기, 주 버튼 둘. 내가 만든 시리즈가 있으면 그 사이에
import { useEffect, useRef, useState } from "react";
import { createDirector, type Director, type FilmInfo } from "@/lib/film";
import { BRAND, listSeries, loadShort, madeKs, seenOf, totalOf, useFilmStore, type Series } from "@/lib/film/store";
import { Section, trackLabel } from "./parts";
import Still, { STILL_OPTS, posterTime } from "./Still";

const reducedMotion = () => {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
};

/** 미리보기 한 편을 계속 돌린다. paused 동안(재생기가 열려 있을 때)은 마지막 그림에서 멈춘다. */
function HeroStage({ sid, k, paused }: { sid: string; k: number; paused: boolean }) {
  const ref = useRef<SVGSVGElement>(null);
  // 멈췄다 다시 돌 때 이어서 돌도록 마지막 시각을 기억한다 (null: 아직 시작 전)
  const at = useRef<number | null>(null);
  const [stage, setStage] = useState<{ dir: Director; info: FilmInfo } | null>(null);
  const sh = loadShort(sid, k);
  const script = sh && sh.scenes ? sh.script : null;
  // 대본은 한 번만 싣는다. 재생기를 열고 닫을 때 다시 실으면 그동안 미리보기가 비어 보인다.
  useEffect(() => {
    const svg = ref.current;
    if (!svg || !script) return;
    let live = true;
    const dir = createDirector(svg, { fancy: true });
    dir
      .load(script, { ...STILL_OPTS, fancy: true, brand: BRAND })
      .then((info) => {
        if (!live) return;
        if (reducedMotion()) dir.seek(posterTime(info));
        else setStage({ dir, info });
      })
      .catch(() => {});
    return () => {
      live = false;
      setStage(null);
    };
  }, [script]);
  useEffect(() => {
    if (!stage) return;
    const { dir, info } = stage;
    // 첫 바퀴는 둘째 장면에서 시작한다: 거기서부터 이미 볼 그림이 있다
    const from = at.current ?? 0;
    dir.seek(Math.min(from, info.dur - 0.01));
    if (paused) return;
    let raf = 0;
    let t0 = performance.now() - from * 1000;
    let odd = false;
    const loop = () => {
      odd = !odd;
      // 한 프레임 걸러 그린다: 작은 미리보기라 이것으로 충분하고 휴대폰 배터리를 덜 쓴다
      if (odd && !document.hidden) {
        let t = (performance.now() - t0) / 1000;
        if (t > info.dur + 1.4) {
          t0 = performance.now();
          t = 0;
        }
        at.current = t;
        dir.seek(Math.min(t, info.dur - 0.01));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [stage, paused]);
  return <svg ref={ref} className="st" aria-hidden="true" />;
}

function SeriesCard({ s }: { s: Series }) {
  const n = totalOf(s);
  const have = madeKs(s);
  const done = have.filter((k) => seenOf(s.id, k)?.done).length;
  return (
    <a className="scard" href={"#s-" + s.id}>
      <span className="tab">{trackLabel(s)}</span>
      <div>
        <h3>{s.title || "이름 없는 시리즈"}</h3>
        <div className="meta">{`쇼츠 ${n}편 · 볼 수 있음 ${have.length}편` + (done ? ` · ${done}편 봄` : "")}</div>
        <div className="bar" role="img" aria-label={`${n}편 중 ${done}편 봄`}>
          <i style={{ width: (n ? Math.round((done / n) * 100) : 0) + "%" }} />
        </div>
      </div>
      <div className="poster">{have.length ? <Still sid={s.id} k={have[0]} /> : null}</div>
    </a>
  );
}

export default function HomeView({ paused }: { paused: boolean }) {
  useFilmStore();
  const mine = listSeries("mine");
  const built = listSeries("built");
  // 사람이 다듬은 편이면 "그대로"라고 말하지 않는다
  const touched = (e: unknown) => !!e && (e as { from?: string; edited?: boolean }).from === "built" && !!(e as { edited?: boolean }).edited;
  const heroEdited = touched(built.find((s) => s.id === "bino")?.shorts[1]);
  return (
    <div className="home">
      {/* 제목 띠: 오션 블루 + 흰 글씨 STUDY T@K (확정안 시작 화면) */}
      <header className="band">
        <h1>
          <span className="kick">어려운 전공도 60초 그림으로</span>
          <span className="big">
            STUDY
            <br />
            T@K
          </span>
          <span className="tagline">: 자료만 올리면 숏폼 강의 완성</span>
        </h1>
        <a className="toplink" href="#price">
          <span>요금제</span>
        </a>
      </header>
      <a className="upcard" href="#make">
        <span className="tab">Track #1 : 업로드</span>
        <b>PDF 올리기</b>
        <span>전공책 PDF · 강의자료 · 주제 한 줄도 돼요</span>
      </a>
      <section className="sec hero">
        <h2>이렇게 보여요</h2>
        <a className="phone big" href="#w-bino-1" aria-label="예시 쇼츠 보기: 이항모형 1편">
          <span className="in">
            <HeroStage sid="bino" k={1} paused={paused} />
          </span>
          <span className="tag">
            <b />
            <span>{heroEdited ? "AI가 쓰고 사람이 다듬음" : "AI가 쓴 그대로"}</span>
          </span>
        </a>
      </section>
      {mine.length ? (
        <Section title="내가 만든 시리즈">
          <div className="cards">
            {mine.map((s) => (
              <SeriesCard key={s.id} s={s} />
            ))}
          </div>
        </Section>
      ) : null}
      <div className="home-cta">
        <a className="btn primary" href="#make">
          자료 올리기 →
        </a>
        <a className="btn ghost" href="#w-bino-1">
          예시로 둘러보기
        </a>
      </div>
    </div>
  );
}
