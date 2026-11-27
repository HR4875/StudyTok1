"use client";
// 홈 (디자인팀장 확정안처럼 한 화면, 미니멀): 제목 띠, 업로드 트랙, 이어보기·오늘 복습 카드(있을 때만), 주 버튼 둘, 아래 탭.
// 예시 영상은 둘러보기(#ex), 내가 만든 시리즈는 내 시리즈 탭(#mine)으로 옮겼다 (11/27).
import { getSeries, entryOf, titleOf, totalOf, useFilmStore } from "@/lib/film/store";
import { clockDays, dueReviews, lastProgress, setClockDays, spacedOn, useStudy, waitingReviews } from "@/lib/film/study";
import { Tabs } from "./parts";
import Still from "./Still";

/** 이어보기: 가장 최근에 보다 만 시리즈의 그 편부터 */
function Resume() {
  const p = lastProgress((sid, k) => !!entryOf(sid, k));
  if (!p) return null;
  const s = getSeries(p.sid);
  if (!s) return null;
  const total = totalOf(s);
  return (
    <a className="scard resume" href={`#w-${p.sid}-${p.k}`}>
      <span className="tab">보던 곳부터</span>
      <div>
        <h3>{titleOf(p.sid, p.k)}</h3>
        <div className="meta">
          {`${p.k}/${total}편 · `}
          <b className="goin">이어보기 →</b>
        </div>
      </div>
      <div className="poster">
        <Still sid={p.sid} k={p.k} />
      </div>
    </a>
  );
}

/** 오늘 복습: 1·3·7일 간격으로 돌아온 퀴즈. 기다리는 것만 있으면 시연용으로 하루 뒤로 보낼 수 있다 */
function Review() {
  if (!spacedOn()) return null;
  const due = dueReviews().length;
  const wait = waitingReviews();
  if (!due && !wait) return null;
  return (
    <div className="rcard">
      <div>
        <b>{due ? `오늘 복습 ${due}개` : `복습 대기 ${wait}개`}</b>
        <span>{(due ? "간격 복습 1·3·7일" : "오늘은 없어요") + (clockDays() ? ` · 가상 날짜 +${clockDays()}일` : "")}</span>
      </div>
      {due ? (
        <a className="btn small primary" href="#r-today">
          풀기 →
        </a>
      ) : (
        <button type="button" className="btn small" onClick={() => setClockDays(clockDays() + 1)}>
          하루 뒤로 (시연)
        </button>
      )}
    </div>
  );
}

export default function HomeView(_: { paused: boolean }) {
  useFilmStore();
  useStudy();
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
      <Resume />
      <Review />
      <a className="upcard" href="#make">
        <span className="tab">Track #1 : 업로드</span>
        <b>PDF 올리기</b>
        <span>전공책 PDF · 강의자료 · 주제 한 줄도 돼요</span>
      </a>
      <div className="home-cta">
        <a className="btn primary" href="#make">
          자료 올리기 →
        </a>
        <a className="btn ghost" href="#ex">
          예시로 둘러보기
        </a>
      </div>
      <Tabs on="home" />
    </div>
  );
}
