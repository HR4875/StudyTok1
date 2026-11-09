"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Card, Deck, GenerateUsage } from "@/lib/types";
import { sfx, speak, stopSpeaking, vibrate } from "@/lib/fx";
import { findModel } from "@/lib/models";
import CardView from "./CardView";

interface Props {
  deck: Deck;
  generating: boolean;
  status: string;
  usage: GenerateUsage[];
  error: string | null;
  onExit: () => void;
}

export default function Feed({ deck, generating, status, usage, error, onExit }: Props) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [active, setActive] = useState(0);
  const [sound, setSound] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  // 오답이면 퀴즈 바로 뒤에 해설 카드를 끼워 넣는다
  const cards = useMemo(() => {
    const out: Card[] = [];
    for (const c of deck.cards) {
      out.push(c);
      if (c.kind === "quiz" && c.quiz && answers[c.id] !== undefined && answers[c.id] !== c.quiz.answer) {
        out.push({
          id: `${c.id}-explain`,
          kind: "concept",
          emoji: "💡",
          title: c.title ? `해설 · ${c.title}` : "해설",
          body: c.quiz.explanation,
          points: [`정답: ${c.quiz.choices[c.quiz.answer]}`],
          visual: null,
          quiz: null,
          motion: null,
          pages: c.pages,
          explainFor: c.id,
        });
      }
    }
    return out;
  }, [deck.cards, answers]);

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

  // 모션 모드: 카드가 보이면 내레이션 읽기
  useEffect(() => {
    const c = cards[active];
    if (deck.mode === "motion" && sound && c?.motion?.narration) speak(c.motion.narration);
    else stopSpeaking();
    if (deck.mode === "motion" && sound && c?.motion) sfx.pop();
  }, [active, deck.mode, sound, cards]);

  useEffect(() => () => stopSpeaking(), []);

  const quizzes = deck.cards.filter((c) => c.kind === "quiz");
  const answered = quizzes.filter((q) => answers[q.id] !== undefined);
  const right = answered.filter((q) => answers[q.id] === q.quiz!.answer);

  function answer(card: Card, choice: number) {
    if (answers[card.id] !== undefined || !card.quiz) return;
    setAnswers((a) => ({ ...a, [card.id]: choice }));
    const ok = choice === card.quiz.answer;
    if (sound) (ok ? sfx.correct : sfx.wrong)();
    vibrate(ok ? 30 : [60, 40, 60]);
  }

  const total = usage.reduce(
    (s, u) => ({ cost: s.cost + u.costUsd, inT: s.inT + u.inputTokens, outT: s.outT + u.outputTokens, ms: s.ms + u.ms }),
    { cost: 0, inT: 0, outT: 0, ms: 0 },
  );
  const progress = cards.length ? ((active + 1) / (cards.length + (generating ? 1 : 0) + 1)) * 100 : 0;

  return (
    <div className="feed-shell">
      <header className="feed-top">
        <button className="icon-btn" onClick={onExit} aria-label="처음으로">
          ←
        </button>
        <div className="feed-title">
          <b>{deck.title || "학습 덱"}</b>
          <small>
            {deck.isSample ? "샘플 덱 · 미리 만든 카드" : deck.source} · {deck.mode === "motion" ? "모션" : "텍스트"}
          </small>
        </div>
        <div className="score">
          ✅ {right.length}/{quizzes.length}
        </div>
        <button className="icon-btn" onClick={() => setSound((s) => !s)} aria-label="소리">
          {sound ? "🔊" : "🔇"}
        </button>
        <button className="icon-btn" onClick={() => setShowInfo((s) => !s)} aria-label="AI 사용 정보">
          ⓘ
        </button>
      </header>
      <div className="progress">
        <i style={{ width: `${progress}%` }} />
      </div>

      <div className="feed" ref={scroller}>
        {cards.map((c, i) => (
          <section className="slot" key={c.id} data-idx={i}>
            <CardView
              card={c}
              mode={deck.mode}
              active={i === active}
              chosen={answers[c.id]}
              onAnswer={(ch) => answer(c, ch)}
            />
          </section>
        ))}

        {generating && (
          <section className="slot" data-idx={cards.length}>
            <article className="card card-loading">
              <div className="card-inner">
                <div className="spinner" />
                <h2 className="title">다음 카드 만드는 중…</h2>
                <p className="body">{status}</p>
              </div>
            </article>
          </section>
        )}

        {!generating && (
          <section className="slot" data-idx={cards.length}>
            <article className="card card-end">
              <div className="card-inner">
                <div className="emoji">🏁</div>
                <h2 className="title">{error ? "여기까지 만들었어요" : "한 덱 끝!"}</h2>
                {error && <p className="error">{error}</p>}
                <p className="body">
                  퀴즈 {quizzes.length}개 중 {right.length}개 정답
                  {answered.length < quizzes.length ? ` · ${quizzes.length - answered.length}개는 건너뜀` : ""}
                </p>
                <div className="end-actions">
                  <button
                    className="btn"
                    onClick={() => {
                      setAnswers({});
                      scroller.current?.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  >
                    처음부터 다시
                  </button>
                  <button className="btn btn-ghost" onClick={onExit}>
                    새 자료 올리기
                  </button>
                </div>
              </div>
            </article>
          </section>
        )}
      </div>


      {showInfo && (
        <div className="info-panel" onClick={() => setShowInfo(false)}>
          <b>AI 사용 정보</b>
          {deck.isSample ? (
            <p>미리 만들어 둔 샘플 덱이라 이번에는 AI를 호출하지 않았어요.</p>
          ) : (
            <>
              <p>
                모델 {findModel(deck.model)?.label ?? deck.model} · 호출 {usage.length}회 · 입력 {total.inT.toLocaleString()} / 출력{" "}
                {total.outT.toLocaleString()} 토큰
              </p>
              <p>
                예상 비용 ${total.cost.toFixed(4)} (약 {Math.round(total.cost * 1450)}원) · 생성 시간 {(total.ms / 1000).toFixed(1)}초
              </p>
            </>
          )}
          <small>탭해서 닫기</small>
        </div>
      )}
    </div>
  );
}
