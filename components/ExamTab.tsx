"use client";

import React, { useMemo, useState } from "react";
import { burstFrom } from "@/lib/fx";
import type { Deck, ExamProblem } from "@/lib/schema";
import type { Settings } from "@/lib/storage";
import { playSfx } from "@/lib/sfx";
import StyleACard from "./StyleACard";

interface Props {
  deck: Deck;
  /** 지금 이 탭이 화면에 보이는지 (안 보이면 해설 영상을 멈춘다) */
  active: boolean;
  /** 이 개념의 문제만 보기 (퀴즈 뒤 "이 개념 문제 풀기"로 들어왔을 때) */
  filter: string | null;
  onFilter: (concept: string | null) => void;
  settings: Settings;
  onBack: () => void;
  onDeckChange: (d: Deck) => void;
}

/** 주관식 답 비교: 숫자가 있으면 숫자끼리(반올림 차이 허용), 없으면 글자끼리 */
function sameAnswer(mine: string, answer: string) {
  const num = (s: string) => {
    const m = s.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
    return m ? Number(m[0]) : null;
  };
  const a = num(mine);
  const b = num(answer);
  if (a !== null && b !== null) return Math.abs(a - b) <= Math.max(0.05, Math.abs(b) * 0.006);
  const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();
  return !!norm(mine) && norm(mine) === norm(answer);
}

/* 시험문제 탭 (2026-11-25): 교재에 실린 문제를 개념별로 모아 학생이 먼저 풀고,
   해설은 모션그래픽(스타일A 풀이 장면)으로 본다. 시간 제한은 없다. */
export default function ExamTab({ deck, active, filter, onFilter, settings, onBack, onDeckChange }: Props) {
  const all = useMemo(() => deck.problems ?? [], [deck.problems]);
  const list = useMemo(() => (filter ? all.filter((p) => p.concept === filter) : all), [all, filter]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [shown, setShown] = useState<Record<string, boolean>>({});
  const [video, setVideo] = useState<ExamProblem | null>(null);
  const done = deck.exam ?? {};
  const problem = openId ? (all.find((p) => p.id === openId) ?? null) : null;
  const at = problem ? list.findIndex((p) => p.id === problem.id) : -1;
  const next = at >= 0 ? list[at + 1] : undefined;

  const mark = (p: ExamProblem, ok: boolean, el?: HTMLElement | null) => {
    playSfx(ok ? "correct" : "wrong");
    if (ok && el) burstFrom(el);
    onDeckChange({ ...deck, exam: { ...done, [p.id]: ok ? "ok" : "no" } });
  };

  const groups = useMemo(() => {
    const m = new Map<string, ExamProblem[]>();
    for (const p of list) m.set(p.concept, [...(m.get(p.concept) ?? []), p]);
    return [...m.entries()];
  }, [list]);
  const solved = list.filter((p) => done[p.id]).length;
  const right = list.filter((p) => done[p.id] === "ok").length;

  const header = (title: string, back: () => void, right?: React.ReactNode) => (
    <div className="shrink-0 bg-[var(--paper)] pb-2 pt-[max(10px,env(safe-area-inset-top))]">
      <div className="flex items-center gap-1 px-2">
        <button type="button" onClick={back} aria-label="뒤로" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full active:bg-black/5">
          <svg width="22" height="22" viewBox="0 0 22 22">
            <path d="M14 4 L7 11 L14 18" stroke="var(--ink)" strokeWidth="2.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="font-display min-w-0 flex-1 truncate text-[20px] text-[var(--ink)]">{title}</span>
        {right}
      </div>
    </div>
  );

  /* ---------- 해설 모션그래픽 ---------- */
  if (video?.solution) {
    return (
      <div className="relative flex h-full w-full flex-col bg-[var(--paper)]">
        {header("해설 영상", () => setVideo(null))}
        <div className="relative min-h-0 flex-1">
          <StyleACard spec={video.solution} mode={active ? "active" : "near"} speed={settings.speed} sound={settings.sound} voice={settings.voice} loop top={0} bottom={12} />
        </div>
        <div className="shrink-0 px-5 pb-[max(18px,env(safe-area-inset-bottom))] pt-2">
          <button type="button" onClick={() => setVideo(null)} className="press font-display h-14 w-full rounded-[18px] bg-[var(--ocean)] text-[19px] text-white">
            문제로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  /* ---------- 문제 한 개 ---------- */
  if (problem) {
    const isChoice = !!problem.options?.length && problem.answerIndex !== undefined;
    const sel = picked[problem.id];
    const answered = isChoice ? sel !== undefined : !!shown[problem.id];
    const result = done[problem.id];
    const mine = typed[problem.id] ?? "";
    const auto = !isChoice && answered && mine.trim() ? sameAnswer(mine, problem.answer) : false;
    return (
      <div className="flex h-full w-full flex-col bg-[var(--paper)] text-[var(--ink)]">
        {header(
          `문제 ${at + 1} / ${list.length}`,
          () => setOpenId(null),
          <span className="mr-3 shrink-0 rounded-[8px] bg-[var(--ocean)] px-2.5 py-1 text-[13px] font-bold text-white">{problem.concept}</span>,
        )}
        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-6 pb-6">
          <div className="mt-2 flex items-center gap-2">
            <span className="rounded-[8px] bg-[var(--ink)] px-2.5 py-1 text-[13px] font-bold text-white">시험문제</span>
            {problem.source ? <span className="text-[13px] font-bold text-[var(--muted)]">{problem.source}</span> : null}
          </div>
          <p className="mt-4 text-[19px] font-bold leading-[1.55]" style={{ wordBreak: "keep-all" }}>
            {problem.text}
          </p>
          {problem.given?.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {problem.given.map((g, i) => (
                <span key={i} className="rounded-[10px] border-[2.5px] border-[var(--ink)] bg-white px-3 py-1.5 text-[15px] font-bold tabular-nums">
                  {g}
                </span>
              ))}
            </div>
          ) : null}
          {!answered ? <p className="mt-4 text-[13px] font-semibold text-[var(--muted)]">종이에 천천히 풀어 보세요. 시간 제한은 없어요.</p> : null}

          {isChoice ? (
            <div className="mt-5 flex flex-col gap-3">
              {problem.options!.map((o, i) => {
                const isAns = i === problem.answerIndex;
                const isSel = i === sel;
                let box = "border-[var(--ink)] bg-white text-[var(--ink)]";
                let key = "bg-[var(--chip)] text-[var(--ink)]";
                if (answered && isAns) {
                  box = "border-[var(--ans-line)] bg-[var(--ans)] text-[var(--ocean)]";
                  key = "bg-white text-[var(--ocean)]";
                } else if (answered && isSel) {
                  box = "border-[var(--red)] bg-white text-[var(--red)]";
                  key = "bg-[var(--red)] text-white";
                } else if (answered) box += " opacity-50";
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={answered}
                    onClick={(e) => {
                      setPicked((p) => ({ ...p, [problem.id]: i }));
                      mark(problem, isAns, e.currentTarget);
                    }}
                    className={`opt-press flex min-h-14 items-center gap-3 rounded-[16px] border-[2.5px] px-3.5 py-3 text-left text-[17px] font-bold ${box}`}
                  >
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] text-[15px] font-extrabold ${key}`}>{i + 1}</span>
                    <span style={{ wordBreak: "keep-all" }}>{o}</span>
                  </button>
                );
              })}
            </div>
          ) : !answered ? (
            <div className="mt-5">
              <label className="text-[13px] font-extrabold text-[var(--muted)]" htmlFor="exam-answer">
                내 답 {problem.ask ? `(${problem.ask})` : ""}
              </label>
              <input
                id="exam-answer"
                value={mine}
                onChange={(e) => setTyped((t) => ({ ...t, [problem.id]: e.target.value }))}
                placeholder="답을 적어 보세요"
                inputMode="text"
                className="mt-1.5 h-14 w-full rounded-[16px] border-[2.5px] border-[var(--ink)] bg-white px-4 text-[18px] font-bold text-[var(--ink)] outline-none"
              />
              <button
                type="button"
                onClick={(e) => {
                  setShown((s) => ({ ...s, [problem.id]: true }));
                  if (mine.trim() && sameAnswer(mine, problem.answer)) mark(problem, true, e.currentTarget);
                  else playSfx("tap");
                }}
                className="press font-display mt-3 h-14 w-full rounded-[18px] bg-[var(--ocean)] text-[19px] text-white"
              >
                {mine.trim() ? "답 확인하기" : "다 풀었어요, 답 보기"}
              </button>
            </div>
          ) : null}

          {answered ? (
            <div className={`mt-5 rounded-[18px] border-[2.5px] border-[var(--ink)] px-4 py-4 ${result === "no" ? "bg-[var(--red-soft)]" : "bg-[var(--blue-soft)]"}`}>
              <p className="text-[13px] font-extrabold text-[var(--muted)]">정답</p>
              <p className="font-display mt-0.5 text-[24px] text-[var(--ocean)]">{problem.answer}</p>
              {!isChoice && mine.trim() ? <p className="mt-1 text-[14px] font-bold">내 답: {mine}</p> : null}
              {!isChoice && !auto && !result ? (
                <div className="mt-3">
                  <p className="text-[14px] font-bold">내 풀이가 맞았나요?</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button type="button" onClick={(e) => mark(problem, true, e.currentTarget)} className="press h-12 rounded-[14px] bg-[var(--ocean)] text-[16px] font-bold text-white">
                      맞았어요
                    </button>
                    <button type="button" onClick={() => mark(problem, false)} className="press press-ink h-12 rounded-[14px] border-[2.5px] border-[var(--ink)] bg-white text-[16px] font-bold text-[var(--ink)]">
                      틀렸어요
                    </button>
                  </div>
                </div>
              ) : result ? (
                <p className={`mt-2 text-[15px] font-extrabold ${result === "ok" ? "text-[var(--ocean)]" : "text-[var(--red)]"}`}>{result === "ok" ? "맞았어요!" : "틀렸어요. 해설을 보고 다시 풀어 보세요."}</p>
              ) : null}
              {problem.explanation ? (
                <p className="mt-3 text-[14.5px] font-medium leading-[1.65]" style={{ wordBreak: "keep-all" }}>
                  {problem.explanation}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        {answered ? (
          <div className="flex shrink-0 flex-col gap-3 px-5 pb-[max(18px,env(safe-area-inset-bottom))] pt-2">
            {problem.solution ? (
              <button
                type="button"
                onClick={() => {
                  playSfx("tap");
                  setVideo(problem);
                }}
                className="press font-display h-14 w-full rounded-[18px] bg-[var(--ocean)] text-[19px] text-white"
              >
                해설 영상 보기 ▶
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                playSfx("tap");
                setOpenId(next ? next.id : null);
              }}
              className="press press-ink font-display h-14 w-full rounded-[18px] border-[2.5px] border-[var(--ink)] bg-white text-[19px] text-[var(--ink)]"
            >
              {next ? "다음 문제 →" : "문제 목록으로"}
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  /* ---------- 문제 목록 ---------- */
  return (
    <div className="flex h-full w-full flex-col bg-[var(--paper)] text-[var(--ink)]">
      {header(
        "시험문제",
        onBack,
        <span className="mr-3 shrink-0 text-[14px] font-semibold tabular-nums">
          {solved} / {list.length} 풀이{solved ? ` · 정답 ${right}` : ""}
        </span>,
      )}
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-5 pb-[max(24px,env(safe-area-inset-bottom))]">
        <p className="mt-1 text-[13.5px] font-semibold leading-relaxed text-[var(--muted)]">교재에 실린 문제를 개념별로 모았어요. 먼저 직접 풀고, 해설은 영상으로 확인하세요.</p>
        {filter ? (
          <div className="mt-3 flex items-center gap-2">
            <span className="rounded-full border-2 border-[var(--ink)] bg-[var(--ink)] px-3 py-[5px] text-[12.5px] font-bold text-white">{filter} 문제만</span>
            <button type="button" onClick={() => onFilter(null)} className="rounded-full border-2 border-[var(--ink)] bg-white px-3 py-[5px] text-[12.5px] font-bold text-[var(--ink)]">
              전체 {all.length}문제 보기
            </button>
          </div>
        ) : null}
        {list.length === 0 ? (
          <p className="py-16 text-center text-[14.5px] font-semibold text-[var(--muted)]">{all.length ? "이 개념에는 교재 문제가 없어요." : "이 자료에는 교재 문제가 없어요."}</p>
        ) : null}
        {groups.map(([name, ps]) => (
          <div key={name} className="mt-5">
            <p className="mb-2 text-[13px] font-extrabold text-[var(--ocean)]">
              {name} · {ps.length}문제
            </p>
            <div className="flex flex-col gap-2.5">
              {ps.map((p) => {
                const r = done[p.id];
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      playSfx("tap");
                      setOpenId(p.id);
                    }}
                    className="opt-press flex items-start gap-3 rounded-[16px] border-[2.5px] border-[var(--ink)] bg-white px-3.5 py-3 text-left"
                  >
                    <span
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] text-[14px] font-extrabold ${
                        r === "ok" ? "bg-[var(--ans-line)] text-white" : r === "no" ? "bg-[var(--red)] text-white" : "bg-[var(--chip)] text-[var(--ink)]"
                      }`}
                    >
                      {r === "ok" ? "✓" : r === "no" ? "✕" : list.indexOf(p) + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 text-[15.5px] font-bold leading-snug" style={{ wordBreak: "keep-all" }}>
                        {p.text}
                      </span>
                      <span className="mt-1 block text-[12.5px] font-semibold text-[var(--muted)]">
                        {[p.source, p.options?.length ? "객관식" : "주관식", p.solution ? "해설 영상" : ""].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
