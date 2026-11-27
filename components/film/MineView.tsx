"use client";
// 내 시리즈 (#mine): 내가 만든 시리즈를 모아 보는 탭. 홈에서 옮겨 왔다 (11/27).
import { listSeries, madeKs, seenOf, totalOf, useFilmStore } from "@/lib/film/store";
import { progressOf, useStudy } from "@/lib/film/study";
import { SubTop, Tabs, trackLabel } from "./parts";
import Still from "./Still";

export default function MineView() {
  useFilmStore();
  useStudy();
  const mine = listSeries("mine");
  return (
    <div className="mine">
      <SubTop />
      <header className="shead">
        <h1>내 시리즈</h1>
        <p className="sub">{mine.length ? `만든 시리즈 ${mine.length}개 · 이 기기에 저장돼요` : "아직 만든 시리즈가 없어요"}</p>
      </header>
      {mine.length ? (
        <div className="cards">
          {mine.map((s) => {
            const n = totalOf(s);
            const have = madeKs(s);
            const done = have.filter((k) => seenOf(s.id, k)?.done).length;
            const p = progressOf(s.id);
            return (
              <a key={s.id} className="scard" href={p && !p.done && s.shorts[p.k] ? `#w-${s.id}-${p.k}` : "#s-" + s.id}>
                <span className="tab">{trackLabel(s)}</span>
                <div>
                  <h3>{s.title || "이름 없는 시리즈"}</h3>
                  <div className="meta">{`쇼츠 ${n}편 · 볼 수 있음 ${have.length}편` + (done ? ` · ${done}편 봄` : "") + (p && !p.done ? ` · ${p.k}편째 보는 중` : "")}</div>
                  <div className="bar" role="img" aria-label={`${n}편 중 ${done}편 봄`}>
                    <i style={{ width: (n ? Math.round((done / n) * 100) : 0) + "%" }} />
                  </div>
                </div>
                <div className="poster">{have.length ? <Still sid={s.id} k={have[0]} /> : null}</div>
              </a>
            );
          })}
        </div>
      ) : (
        <div className="home-cta">
          <a className="btn primary" href="#make">
            자료 올리기 →
          </a>
        </div>
      )}
      <Tabs on="mine" />
    </div>
  );
}
