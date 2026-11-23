"use client";

import React from "react";
import { burstFrom } from "@/lib/fx";
import type { Quiz } from "@/lib/schema";
import type { Palette } from "@/lib/schema";

interface Props {
  quiz: Quiz;
  term: string;
  palette: Palette;
  retry: boolean;
  selected: number | null;
  streak: number;
  onAnswer: (i: number) => void;
  onNext: () => void;
}

/* 확정 UI(C안) 퀴즈: 종이 바탕, 잉크 QUIZ 라벨 + 빨간 COMBO, 흰 칸 + 잉크 테두리 선택지.
   정답 = 연파랑 칸 + 블루 테두리 + 오션 블루 글씨 ✓, 오답 = 레드 테두리 + 취소선. */
export default function QuizCard({ quiz, term, retry, selected, streak, onAnswer, onNext }: Props) {
  const answered = selected !== null;
  const correct = answered && selected === quiz.answer;
  return (
    <div className="relative flex h-full w-full flex-col bg-[var(--paper)] px-6">
      <div className="h-[100px] shrink-0" />
      <div className="flex items-center gap-2">
        <span className="rounded-[8px] bg-[var(--ink)] px-2.5 py-1 text-[13px] font-bold text-white">{retry ? "다시 도전" : "QUIZ"}</span>
        <span className="min-w-0 truncate text-[13px] font-bold text-[var(--muted)]">{term}</span>
        {streak >= 2 ? (
          <span className="font-display ml-auto shrink-0 -rotate-3 rounded-[10px] bg-[var(--red)] px-3 py-1 text-[18px] text-white">COMBO ×{streak}</span>
        ) : null}
      </div>
      <h2 className="font-display mt-5 text-[27px] leading-[1.25] text-[var(--ink)]" style={{ wordBreak: "keep-all" }}>
        {quiz.question}
      </h2>
      <div className="mt-6 flex flex-col gap-3">
        {quiz.options.map((o, i) => {
          const isAns = i === quiz.answer;
          const isSel = i === selected;
          let box = "border-[var(--ink)] bg-white text-[var(--ink)]";
          let key = "bg-[var(--chip)] text-[var(--ink)]";
          let text = "";
          let state = "";
          if (answered && isAns) {
            state = "is-ok";
            box = "border-[var(--ans-line)] bg-[var(--ans)] text-[var(--ocean)]";
            key = "bg-white text-[var(--ocean)]";
          } else if (answered && isSel) {
            box = "border-[var(--red)] bg-white text-[var(--red)] animate-shake-x";
            state = "is-no";
            key = "bg-[var(--red)] text-white";
            text = "line-through";
          } else if (answered) {
            box = "border-[var(--ink)] bg-white text-[var(--ink)] opacity-50";
            state = "is-dim";
          }
          return (
            <button
              key={i}
              type="button"
              disabled={answered}
              onClick={(e) => {
                if (i === quiz.answer) burstFrom(e.currentTarget, e.clientX ? { x: e.clientX, y: e.clientY } : undefined);
                onAnswer(i);
              }}
              className={`opt-press flex min-h-14 items-center gap-3 rounded-[16px] border-[2.5px] px-3.5 py-3 text-left text-[17px] font-bold ${box} ${state}`}
            >
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] text-[15px] font-extrabold ${key}`}>{i + 1}</span>
              <span className={text} style={{ wordBreak: "keep-all" }}>
                {o}
                {answered && isAns ? <span className="tick-pop ml-1">✓</span> : null}
              </span>
            </button>
          );
        })}
      </div>
      {answered ? (
        <div className="animate-pop-in mt-auto pb-[max(20px,env(safe-area-inset-bottom))] pt-4">
          <div className="rounded-[16px] border-[2.5px] border-[var(--ink)] bg-white px-4 py-3">
            <p className="text-[14.5px] font-medium leading-relaxed text-[var(--ink)]">
              <span className={`font-display mr-1.5 text-[18px] ${correct ? "text-[var(--ans-line)]" : "text-[var(--red)]"}`}>{correct ? "정답!" : "오답"}</span>
              {quiz.explanation || (correct ? "" : "오답노트에 담았어요.")}
            </p>
            {!correct && quiz.explanation ? <p className="mt-1 text-[12.5px] font-semibold text-[var(--muted)]">오답노트에 담았어요.</p> : null}
          </div>
          <button type="button" onClick={onNext} className="press font-display mt-4 h-14 w-full rounded-[18px] bg-[var(--ocean)] text-[19px] text-white">
            다음 카드 →
          </button>
        </div>
      ) : (
        <p className="mt-auto pb-[max(28px,env(safe-area-inset-bottom))] pt-4 text-center text-[12.5px] font-semibold text-[var(--muted)]">정답을 골라 보세요 · 넘기면 건너뛰기</p>
      )}
          </div>
  );
}
