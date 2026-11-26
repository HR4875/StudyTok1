"use client";
// 홈: 제목 띠, 업로드 트랙, 움직이는 미리보기, 시리즈 트랙, 맛보기, 지금 되는 것
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createDirector, type Director, type FilmInfo } from "@/lib/film";
import { HOST } from "@/lib/film/host";
import { listSeries, loadShort, madeKs, sampleList, seenOf, totalOf, useFilmStore, type Series } from "@/lib/film/store";
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
    const dir = createDirector(svg, { fancy: false });
    dir
      .load(script, STILL_OPTS)
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
    const from = at.current ?? (info.beats[1] ? info.beats[1].t0 - 0.2 : 0);
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

const Fact = ({ b, children }: { b: string; children: ReactNode }) => (
  <li>
    <b>{b}</b>
    {children}
  </li>
);

export default function HomeView({ paused }: { paused: boolean }) {
  useFilmStore();
  const mine = listSeries("mine");
  const built = listSeries("built");
  // 사람이 다듬은 편이 있으면 "그대로"라고 말하지 않는다
  const touched = (e: unknown) => !!e && (e as { from?: string; edited?: boolean }).from === "built" && !!(e as { edited?: boolean }).edited;
  const heroEdited = touched(built.find((s) => s.id === "bino")?.shorts[1]);
  const anyEdited = built.some((s) => Object.values(s.shorts).some(touched));
  return (
    <>
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
      <div className="tags">
        <span className="tagchip">60초 모션 쇼츠</span>
        <span className="tagchip">보다가 직접 답해요</span>
        <span className="label red">NEW</span>
      </div>
      <div className="home-cta">
        <a className="btn primary" href="#make">
          자료 올리기 →
        </a>
        <a className="btn ghost" href="#w-bino-1">
          예시로 둘러보기
        </a>
      </div>
      <Section title="이렇게 보여요" hint="전공책이나 자격증 교재를 올리면 한 편에 한 가지씩, 그림이 움직이며 설명해요.">
        <div className="heroplay">
          <a className="phone" href="#w-bino-1" aria-label="이항모형 1편 보기">
            <span className="in">
              <HeroStage sid="bino" k={1} paused={paused} />
            </span>
            <span className="tag">
              <b />
              <span>
                {heroEdited ? "AI가 쓰고 사람이 다듬음" : "AI가 쓴 그대로"}
                <span className="long"> 재생 중</span>
              </span>
            </span>
          </a>
          <ul className="facts">
            <Fact b="60초">한 편에 딱 한 가지</Fact>
            <Fact b="3문제">보는 중 한 번, 끝나고 두 번</Fact>
            <Fact b="내 자료">전공 PDF도 자격증 교재도</Fact>
          </ul>
        </div>
      </Section>
      {mine.length ? (
        <Section title="내가 만든 시리즈" hint="이 기기에만 저장돼요.">
          <div className="cards">
            {mine.map((s) => (
              <SeriesCard key={s.id} s={s} />
            ))}
          </div>
        </Section>
      ) : null}
      <Section title="바로 볼 수 있는 시리즈" hint={anyEdited ? "AI가 계획하고 쓴 대본이에요. 사람이 다듬은 편은 끝 화면에 적어 두었어요." : "AI가 계획하고 쓴 대본을 손대지 않고 그대로 실었어요."}>
        <div className="cards">
          {built.map((s) => (
            <SeriesCard key={s.id} s={s} />
          ))}
        </div>
      </Section>
      <Section title="한 편짜리 맛보기" hint="그릴 수 있는 그림의 종류를 보여 주려고 사람이 직접 쓴 본보기예요.">
        <div className="strip">
          {sampleList().map((x) => (
            <a key={x.k} className="tcard" href={"#w-ex-" + x.k}>
              <div className="poster">
                <Still sid="ex" k={x.k} />
              </div>
              <b>{x.label}</b>
              <span>{x.kind}</span>
            </a>
          ))}
        </div>
      </Section>
      <Section title="지금 되는 것">
        <ul className="about">
          <li>
            <b>실제로 동작해요</b>
            재생, 영상 속 질문에 답하기, 끝나고 푸는 문제, 속도와 디자인 바꾸기, 소리, 내 자료로 새 시리즈와 새 편 만들기.
          </li>
          <li>
            <b>만들 때 쓰는 것</b>
            {HOST.howMade}
          </li>
          <li>
            <b>아직 없는 것</b>
            로그인, 결제, 서버 저장. 본 기록과 만든 시리즈는 이 기기에만 남아요.
          </li>
        </ul>
      </Section>
      <footer className="foot">
        <a href="#price">요금제 계획 보기</a>
        <p className="fine">전공 PDF에서 만든 시리즈의 원본 자료는 싣지 않았고, 계획과 대본만 실었습니다.</p>
      </footer>
    </>
  );
}
