"use client";
// 예시로 둘러보기 (#ex): 영상 디자인 A–F의 모션 예시와, 바로 볼 수 있는 내장 시리즈.
import { useEffect, useRef, useState } from "react";
import { HOST } from "@/lib/film/host";
import { listSeries, madeKs, totalOf, useFilmStore } from "@/lib/film/store";
import { Icon } from "./icons";
import { Section, SubTop, Tabs, trackLabel } from "./parts";
import Still from "./Still";

const DESIGNS: { id: string; name: string; what: string }[] = [
  { id: "a", name: "디자인 A", what: "어두운 무대에 빛나는 입체 물체" },
  { id: "b", name: "디자인 B", what: "잉크와 종이, 색 하나" },
  { id: "c", name: "디자인 C", what: "3D 조작형 콘솔과 유리 통" },
  { id: "d", name: "디자인 D", what: "점과 칸, 칸 하나가 단위 하나" },
  { id: "e", name: "디자인 E", what: "아이소메트릭 설명도" },
  { id: "f", name: "디자인 F", what: "포지셔닝 맵, 중간에 입체로" },
];

/** 소리 없이 계속 도는 예시 영상. 화면에 보일 때만 돌고, 재생기가 열려 있으면 멈춘다 */
function Loop({ id, paused }: { id: string; paused: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const v = ref.current;
    if (!v || typeof IntersectionObserver === "undefined") return setSeen(true);
    const io = new IntersectionObserver(([e]) => setSeen(e.isIntersecting), { threshold: 0.2 });
    io.observe(v);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (paused || !seen) v.pause();
    else void v.play().catch(() => {});
  }, [paused, seen]);
  return <video ref={ref} className="st" src={HOST.designVideos + id + ".mp4"} muted loop playsInline preload="metadata" aria-hidden="true" />;
}

export default function BrowseView({ paused }: { paused: boolean }) {
  useFilmStore();
  const [big, setBig] = useState<string | null>(null);
  const built = listSeries("built");
  const d = DESIGNS.find((x) => x.id === big);
  return (
    <div className="browse">
      <SubTop />
      <header className="shead">
        <h1>예시로 둘러보기</h1>
        <p className="sub">쇼츠가 입는 영상 디자인 여섯 가지와, 바로 볼 수 있는 시리즈예요.</p>
      </header>
      <Section title="영상 디자인 A–F" hint="누르면 크게 봐요">
        <div className="dgrid">
          {DESIGNS.map((x) => (
            <button key={x.id} type="button" className="dcard" onClick={() => setBig(x.id)}>
              <span className="phone">
                <span className="in">
                  <Loop id={x.id} paused={paused || !!big} />
                </span>
              </span>
              <b>{x.name}</b>
              <span>{x.what}</span>
            </button>
          ))}
        </div>
      </Section>
      <Section title="바로 볼 수 있는 시리즈">
        <div className="cards">
          {built.map((s) => {
            const have = madeKs(s);
            return (
              <a key={s.id} className="scard" href={"#s-" + s.id}>
                <span className="tab">{trackLabel(s)}</span>
                <div>
                  <h3>{s.title}</h3>
                  <div className="meta">{`쇼츠 ${totalOf(s)}편 · 볼 수 있음 ${have.length}편`}</div>
                </div>
                <div className="poster">{have.length ? <Still sid={s.id} k={have[0]} /> : null}</div>
              </a>
            );
          })}
        </div>
      </Section>
      <Tabs on="ex" />
      {d ? (
        <div className="dview" role="dialog" aria-modal="true" aria-label={d.name}>
          <div className="scrim" onClick={() => setBig(null)} />
          <div className="dbox">
            <div className="phone">
              <span className="in">
                <Loop id={d.id} paused={paused} />
              </span>
            </div>
            <p>
              <b>{d.name}</b> · {d.what}
            </p>
            <button type="button" className="ib dclose" aria-label="닫기" onClick={() => setBig(null)}>
              <Icon name="close" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
