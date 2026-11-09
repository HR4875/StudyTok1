"use client";
import type { Card, RenderMode } from "@/lib/types";
import Visual from "./Visual";

interface Props {
  card: Card;
  mode: RenderMode;
  active: boolean;
  chosen: number | undefined;
  onAnswer: (choice: number) => void;
}

const KIND_LABEL: Record<string, string> = {
  hook: "궁금증",
  concept: "개념",
  quiz: "퀴즈",
  summary: "요약",
};

export default function CardView({ card, mode, active, chosen, onAnswer }: Props) {
  const motion = mode === "motion" && card.motion;
  const isExplain = Boolean(card.explainFor);

  return (
    <article
      className={`card card-${card.kind} ${isExplain ? "card-explain" : ""} ${motion ? "is-motion" : ""} ${
        active ? "is-active" : ""
      }`}
    >
      {motion && <div className="bg-blobs" aria-hidden><i /><i /><i /></div>}
      <div className="card-inner">
        <div className="card-tag">
          <span>{isExplain ? "오답 해설" : KIND_LABEL[card.kind]}</span>
          {card.pages && <span className="pages">{card.pages}</span>}
        </div>

        {card.kind === "quiz" && card.quiz ? (
          <QuizBody card={card} chosen={chosen} onAnswer={onAnswer} />
        ) : (
          <>
            <div className="emoji">{card.emoji}</div>
            <h2 className="title">{card.title}</h2>

            {motion && card.motion ? (
              <div className="beats" key={active ? "on" : "off"}>
                {card.motion.beats.map((b, i) => (
                  <span key={i} className={`beat fx-${b.effect}`} style={{ ["--d" as string]: `${0.3 + i * 0.7}s` }}>
                    {b.text}
                  </span>
                ))}
              </div>
            ) : null}

            {card.body && (
              <p className="body" style={motion ? { ["--d" as string]: `${0.4 + (card.motion?.beats.length ?? 0) * 0.7}s` } : undefined}>
                {card.body}
              </p>
            )}

            {card.points.length > 0 && (
              <ul className="points">
                {card.points.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            )}

            {card.visual && <Visual v={card.visual} animate={Boolean(motion) && active} key={active ? "a" : "b"} />}
          </>
        )}
      </div>
    </article>
  );
}

function QuizBody({ card, chosen, onAnswer }: { card: Card; chosen: number | undefined; onAnswer: (c: number) => void }) {
  const q = card.quiz!;
  const answered = chosen !== undefined;
  const correct = answered && chosen === q.answer;
  return (
    <div className={`quiz ${answered ? (correct ? "is-correct" : "is-wrong") : ""}`}>
      <div className="emoji">🧠</div>
      <h2 className="title">{q.question}</h2>
      <div className="choices">
        {q.choices.map((c, i) => {
          let state = "";
          if (answered) {
            if (i === q.answer) state = "right";
            else if (i === chosen) state = "picked-wrong";
            else state = "dim";
          }
          return (
            <button key={i} className={`choice ${state}`} disabled={answered} onClick={() => onAnswer(i)}>
              <span className="choice-no">{String.fromCharCode(65 + i)}</span>
              {c}
            </button>
          );
        })}
      </div>
      {answered && (
        <p className="quiz-result">
          {correct ? "정답! 🎉 " + q.explanation : "아쉬워요. 아래로 넘기면 해설 카드가 있어요 👇"}
        </p>
      )}
      {!answered && <p className="quiz-hint">모르겠으면 그냥 넘겨도 돼요</p>}
    </div>
  );
}
