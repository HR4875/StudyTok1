"use client";
import type { ReactNode } from "react";
import type { Card, RenderMode } from "@/lib/types";
import Visual from "./Visual";

interface Props {
  card: Card;
  mode: RenderMode;
  chosen: number | undefined;
  onAnswer: (choice: number) => void;
  sourceLabel?: string;
}

// "고객 머릿속 [[한 자리]] 차지하기" → 형광펜 강조
export function Marked({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  const re = /\[\[(.+?)\]\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(
      <span className="mk" key={m.index}>
        {m[1]}
      </span>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

const TAG: Record<string, string> = { hook: "오늘의 질문", concept: "개념", summary: "정리" };

export function isQuiz(c: Card) {
  return c.kind === "quiz" && Boolean(c.quiz);
}

export default function CardView({ card, mode, chosen, onAnswer, sourceLabel }: Props) {
  const source = [sourceLabel, card.pages].filter(Boolean).join(" · ");
  if (isQuiz(card)) return <QuizCard card={card} chosen={chosen} onAnswer={onAnswer} source={source} />;

  const explain = Boolean(card.explainFor);
  const long = card.title.length > 7 || card.kind === "hook" || explain;
  const tag = explain ? `해설 · ${card.skipped ? "건너뛴 문제" : "방금 틀린 문제"}` : TAG[card.kind] ?? "개념";

  return (
    <article className={`card grad ${explain ? "explain" : ""} k-${card.kind}`}>
      <span className="tag">{tag}</span>
      <Visual v={card.visual} emoji={card.emoji} beats={mode === "motion" ? card.motion?.beats : undefined} />
      <h2 className={`name ${long ? "mid" : ""} ${card.title.length > 12 ? "long" : ""}`}>
        {card.title}
        {card.subtitle && <small>{card.subtitle}</small>}
      </h2>
      {card.tagline && (
        <p className="tagline">
          <Marked text={card.tagline} />
        </p>
      )}
      {card.body && <p className="desc">{card.body}</p>}
      {card.kind === "summary" && card.points.length > 0 && (
        <div className="kw-row">
          {card.points.map((p, i) => (
            <span key={i}>{p}</span>
          ))}
        </div>
      )}
      {card.chip && (
        <div className="chip">
          <b>{card.chip.label}</b>
          <span>{card.chip.text}</span>
        </div>
      )}
      <div className="hint">↑ 올려서 다음</div>
      {source && <div className="source">{source}</div>}
    </article>
  );
}

function QuizCard({
  card,
  chosen,
  onAnswer,
  source,
}: {
  card: Card;
  chosen: number | undefined;
  onAnswer: (c: number) => void;
  source: string;
}) {
  const q = card.quiz!;
  const ox = q.choices.length === 2 && q.choices[0] === "O" && q.choices[1] === "X";
  const answered = chosen !== undefined;
  const correct = answered && chosen === q.answer;
  return (
    <article className="card plain">
      <span className="ask">{ox ? "맞으면 O, 틀리면 X" : "알맞은 답을 고르세요"}</span>
      <p className="q">{q.question}</p>
      <div className={`opts ${ox ? "ox" : ""}`}>
        {q.choices.map((c, i) => {
          let state = "";
          if (answered) {
            if (i === q.answer) state = "right";
            else if (i === chosen) state = "wrong";
          }
          return (
            <button key={i} className={`opt ${state}`} disabled={answered} onClick={() => onAnswer(i)}>
              {ox ? (
                <>
                  {c}
                  <span className="mark">{state === "right" ? "정답" : state === "wrong" ? "오답" : ""}</span>
                </>
              ) : (
                <>
                  <span className="k">{i + 1}</span>
                  <span className="t">{c}</span>
                </>
              )}
            </button>
          );
        })}
      </div>
      <div className="spacer" />
      {answered ? (
        <div className="toast">
          <b className={correct ? "ok" : "no"}>{correct ? "정답!" : `정답은 ${ox ? q.choices[q.answer] : `${q.answer + 1}번`}!`}</b>
          <p>{correct ? q.explanation : "올려서 해설 카드를 확인해요."}</p>
        </div>
      ) : (
        <div className="hint">모르겠으면 넘겨도 돼요. 해설이 따라와요 ↑</div>
      )}
      {source && <div className="source">{source}</div>}
    </article>
  );
}
