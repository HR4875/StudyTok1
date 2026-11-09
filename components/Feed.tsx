"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Card, Deck, GenerateUsage } from "@/lib/types";
import { sfx, speak, stopSpeaking, vibrate } from "@/lib/fx";
import { findModel } from "@/lib/models";
import CardView, { isQuiz } from "./CardView";

interface Props {
  deck: Deck;
  generating: boolean;
  status: string;
  usage: GenerateUsage[];
  error: string | null;
  onExit: () => void;
}

function explainCard(q: Card, pick: number | undefined): Card {
  const quiz = q.quiz!;
  const ox = quiz.choices[0] === "O" && quiz.choices[1] === "X";
  return {
    id: `${q.id}-explain`,
    kind: "concept",
    emoji: "💡",
    title: `정답은 ${quiz.choices[quiz.answer]}`,
    subtitle: null,
    tagline: q.title ? `오늘의 포인트: [[${q.title}]]` : null,
    body: quiz.explanation,
    chip:
      pick !== undefined
        ? { label: "내 답", text: `${ox ? quiz.choices[pick] : quiz.choices[pick]} ✕` }
        : { label: "다음엔", text: "찍어도 괜찮아요. 틀려야 기억에 남아요" },
    points: [],
    visual: null,
    quiz: null,
    motion: null,
    pages: q.pages,
    explainFor: q.id,
    skipped: pick === undefined,
  };
}

export default function Feed({ deck, generating, status, usage, error, onExit }: Props) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [skipped, setSkipped] = useState<Record<string, true>>({});
  const [active, setActive] = useState(0);
  const [sound, setSound] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [combo, setCombo] = useState(0);
  const [best, setBest] = useState(0);
  const [comboPop, setComboPop] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      setSound(localStorage.getItem("st-sound") !== "off");
    } catch {}
  }, []);

  // 오답이거나 풀지 않고 넘긴 퀴즈 바로 뒤에 해설 카드를 끼워 넣는다
  const cards = useMemo(() => {
    const out: Card[] = [];
    for (const c of deck.cards) {
      out.push(c);
      if (!isQuiz(c)) continue;
      const pick = answers[c.id];
      if ((pick !== undefined && pick !== c.quiz!.answer) || (pick === undefined && skipped[c.id])) {
        out.push(explainCard(c, pick));
      }
    }
    return out;
  }, [deck.cards, answers, skipped]);

  // 화면에 보이는 카드 추적
  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.idx));
        }
      },
      { root, threshold: 0.6 },
    );
    root.querySelectorAll("[data-idx]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [cards.length, generating]);

  // 카드가 바뀔 때: 넘긴 퀴즈 처리, 효과음, 모션 모드 내레이션
  const prevActive = useRef(0);
  useEffect(() => {
    const prev = prevActive.current;
    prevActive.current = active;
    if (active > prev) {
      const pc = cards[prev];
      if (pc && isQuiz(pc) && answers[pc.id] === undefined && !skipped[pc.id]) {
        setSkipped((s) => ({ ...s, [pc.id]: true }));
        setCombo(0);
      }
    }
    if (active !== prev && sound) sfx.swipe();
    const c = cards[active];
    if (deck.mode === "motion" && sound && c?.motion?.narration) speak(c.motion.narration);
    else stopSpeaking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useEffect(() => () => stopSpeaking(), []);

  const quizzes = deck.cards.filter(isQuiz);
  const right = quizzes.filter((q) => answers[q.id] === q.quiz!.answer);
  const explainedCount = cards.filter((c) => c.explainFor).length;

  function answer(card: Card, choice: number) {
    if (answers[card.id] !== undefined || !card.quiz) return;
    setAnswers((a) => ({ ...a, [card.id]: choice }));
    const ok = choice === card.quiz.answer;
    if (ok) {
      const n = combo + 1;
      setCombo(n);
      setBest((b) => Math.max(b, n));
      setComboPop((x) => x + 1);
      if (sound) sfx.correct(n);
    } else {
      setCombo(0);
      if (sound) sfx.wrong();
    }
    vibrate(ok ? 30 : [60, 40, 60]);
  }

  function toggleSound() {
    setSound((s) => {
      try {
        localStorage.setItem("st-sound", s ? "off" : "on");
      } catch {}
      if (s) stopSpeaking();
      return !s;
    });
  }

  function restart() {
    setAnswers({});
    setSkipped({});
    setCombo(0);
    scroller.current?.scrollTo({ top: 0, behavior: "smooth" });
  }

  const total = usage.reduce(
    (s, u) => ({ cost: s.cost + u.costUsd, inT: s.inT + u.inputTokens, outT: s.outT + u.outputTokens, ms: s.ms + u.ms }),
    { cost: 0, inT: 0, outT: 0, ms: 0 },
  );
  const slots = cards.length + 1;
  const activeCard = cards[active];
  const light = !activeCard || isQuiz(activeCard);
  const keywords = deck.cards.filter((c) => c.kind === "concept").map((c) => c.title).slice(0, 6);
  const rate = quizzes.length ? Math.round((right.length / quizzes.length) * 100) : 0;
  const sourceLabel = deck.isSample ? "예시 자료(가상)" : deck.source;

  return (
    <div className={`feedwrap ${deck.mode === "motion" ? "motion" : ""}`}>
      <header className={`top ${light ? "light" : ""}`}>
        <div className="top-row">
          <button className="icon-btn" onClick={onExit} aria-label="닫고 새 자료로 만들기">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
          <div className="track" aria-hidden>
            <i style={{ width: `${((active + 1) / slots) * 100}%` }} />
          </div>
          <span className="count">
            {Math.min(active + 1, cards.length)} / {cards.length}
            {generating ? "+" : ""}
          </span>
          <button className="icon-btn" onClick={toggleSound} aria-pressed={sound} aria-label={sound ? "소리 끄기" : "소리 켜기"}>
            {sound ? (
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M4 9v6h4l5 4V5L8 9z" />
                <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M4 9v6h4l5 4V5L8 9z" />
                <path d="M17 9l5 6M22 9l-5 6" />
              </svg>
            )}
          </button>
        </div>
        <div className="sub-row">
          <button className="subject" onClick={() => setShowInfo((s) => !s)} aria-label="자료와 AI 사용 정보">
            {deck.title || "학습 덱"} {deck.mode === "motion" ? "· 모션" : ""} ⓘ
          </button>
          <span key={comboPop} className={`combo ${combo >= 3 ? "hot" : ""} ${comboPop ? "pop-once" : ""}`} aria-live="polite">
            콤보 {combo}
          </span>
        </div>
      </header>

      <main className="feed" ref={scroller} aria-label="학습 피드">
        {cards.map((c, i) => (
          <section className={`slot ${i === active ? "live" : ""}`} key={c.id} data-idx={i}>
            <CardView
              card={c}
              mode={deck.mode}
              chosen={answers[c.id]}
              onAnswer={(ch) => answer(c, ch)}
              sourceLabel={sourceLabel}
            />
          </section>
        ))}

        <section className={`slot ${active === cards.length ? "live" : ""}`} data-idx={cards.length}>
          {generating ? (
            <article className="card plain center">
              <div className="spinner" />
              <p className="done-title small">
                다음 카드
                <br />
                <em>만드는 중</em>
              </p>
              <p className="note">{status}</p>
            </article>
          ) : (
            <article className="card plain">
              <span className="tag">세트 완료</span>
              <div className="spacer" />
              <p className="done-title">
                {error ? "여기까지 만들었어요" : "오늘의 개념"}
                <br />
                <em>{keywords.length}개 획득</em>
              </p>
              {error && <p className="err">{error}</p>}
              {keywords.length > 0 && (
                <div className="kw">
                  {keywords.map((k, i) => (
                    <span key={i}>{k}</span>
                  ))}
                </div>
              )}
              <div className="stats">
                <div className="stat">
                  <b>{rate}%</b>
                  <span>정답률</span>
                </div>
                <div className="stat">
                  <b>{best}</b>
                  <span>최고 콤보</span>
                </div>
                <div className="stat">
                  <b>{explainedCount}</b>
                  <span>해설 카드</span>
                </div>
              </div>
              <div className="actions">
                <button className="btn" onClick={restart}>
                  처음부터 다시
                </button>
                <button className="btn ghost" onClick={onExit}>
                  새 자료 올리기
                </button>
              </div>
              <div className="spacer" />
            </article>
          )}
        </section>
      </main>

      {showInfo && (
        <div className="info-panel" onClick={() => setShowInfo(false)}>
          <b>{deck.isSample ? "샘플 덱 · 예시 콘텐츠(가상)" : deck.source}</b>
          {deck.isSample ? (
            <p>미리 만들어 둔 샘플 덱이라 이번에는 AI를 호출하지 않았어요.</p>
          ) : (
            <>
              <p>
                모델 {findModel(deck.model)?.label ?? deck.model} · 호출 {usage.length}회 · 입력 {total.inT.toLocaleString()} / 출력{" "}
                {total.outT.toLocaleString()} 토큰
              </p>
              <p>
                예상 비용 ${total.cost.toFixed(4)} (환율 1,450원 가정 시 약 {Math.round(total.cost * 1450)}원) · 생성 시간{" "}
                {(total.ms / 1000).toFixed(1)}초
              </p>
            </>
          )}
          <small>탭해서 닫기</small>
        </div>
      )}
    </div>
  );
}
