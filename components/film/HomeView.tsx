"use client";
// 홈 (기존 시작 화면처럼 한 화면): 제목 띠, 업로드 트랙, 디자인 F 예시 영상, 주 버튼 둘. 내가 만든 시리즈가 있으면 그 사이에
import { useEffect, useRef } from "react";
import { HOST } from "@/lib/film/host";
import { listSeries, madeKs, seenOf, totalOf, useFilmStore, type Series } from "@/lib/film/store";
import { Section, trackLabel } from "./parts";
import Still from "./Still";

/** 처음 화면의 예시 영상: 디자인 F 포지셔닝 맵 (9:16, 중간에 입체로 바뀐다). 소리 없이 계속 돌고, 재생기가 열려 있으면 멈춘다 */
function HeroVideo({ paused }: { paused: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (paused) v.pause();
    else void v.play().catch(() => {});
  }, [paused]);
  return <video ref={ref} className="st" src={HOST.heroVideo} muted loop playsInline autoPlay preload="auto" aria-hidden="true" />;
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
        <a className="phone big" href="#w-bino-1" aria-label="예시 쇼츠 둘러보기">
          <span className="in">
            <HeroVideo paused={paused} />
          </span>
          <span className="tag">
            <b />
            <span>디자인 F 예시</span>
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
