"use client";

import React, { useEffect, useMemo, useState } from "react";
import { CONCURRENCY, fitRange, type JobState, type RangeInfo } from "@/lib/generate";
import { TEMPLATE_LABEL, type VisualTemplate } from "@/lib/visual";

interface Props {
  job: JobState;
  /** 만들 개념 수 (예상 시간 계산용) */
  count: number;
  onCancel: () => void;
  onOpenEarly: () => void;
  onChooseRange: (r: { from: number; to: number }) => void;
  onRetry: () => void;
  onSample: () => void;
}

const TIPS = [
  "개념마다 가장 빨리 이해되는 그림 틀을 골라요",
  "그림은 코드가 그려서 빠르고 싸요",
  "모션은 같은 카드로 만들어서 추가 비용이 없어요",
  "카드를 탭하면 멈추고, 위로 넘기면 다음 개념이에요",
  "틀린 퀴즈는 잠시 뒤에 다시 나와요",
];

function Step({ state, label, detail }: { state: "done" | "doing" | "todo"; label: string; detail?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-[2.5px] ${
          state === "done" ? "border-white bg-white" : state === "doing" ? "border-white/90" : "border-white/35"
        }`}
      >
        {state === "done" ? (
          <svg width="14" height="14" viewBox="0 0 14 14">
            <path d="M2.5 7.5 L5.5 10.5 L11.5 3.5" stroke="#4B6BFB" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : state === "doing" ? (
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-[2.5px] border-white border-t-transparent" />
        ) : null}
      </span>
      <span className={`text-[15px] font-bold ${state === "todo" ? "text-white/45" : "text-white"}`}>{label}</span>
      {detail ? <span className="ml-auto text-[13px] font-bold text-white/80">{detail}</span> : null}
    </div>
  );
}

function CardStack({ found }: { found: number }) {
  const emojis = ["📄", "✂️", "🎬", "🧩"];
  return (
    <div className="relative mx-auto h-[130px] w-[200px]" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="absolute left-1/2 top-1/2 flex h-[116px] w-[82px] items-center justify-center rounded-[18px] border-[3px] border-[var(--navy)] bg-white text-[34px] shadow-[0_6px_0_var(--navy)]"
          style={
            {
              marginLeft: -41 + (i - 1) * 42,
              marginTop: -58,
              "--r": `${(i - 1) * 9}deg`,
              animation: `card-stack 1.8s ease-in-out ${i * 0.18}s infinite`,
              zIndex: i === 1 ? 2 : 1,
              background: i === 1 ? "#FFD43B" : "#fff",
            } as React.CSSProperties
          }
        >
          {emojis[(i + found) % emojis.length]}
        </div>
      ))}
    </div>
  );
}

/** 단계가 시작된 뒤 지난 초 (단계가 바뀌면 since가 now보다 뒤라서 0부터 다시 센다) */
function useElapsed(since: number, on: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!on) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [on]);
  return Math.max(0, Math.round((now - since) / 1000));
}

/* ------------------------------------------------------------------ */
/*  쪽 범위 고르기 (PDF는 항상)                                           */
/* ------------------------------------------------------------------ */

function RangePicker({ range, count, onChoose }: { range: RangeInfo; count: number; onChoose: (r: { from: number; to: number }) => void }) {
  // 미리보기가 채워지며 range가 다시 와도, 고른 범위는 그대로 둔다
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const [anchor, setAnchor] = useState<number | null>(null);
  const lo = Math.min(from, to);
  const hi = Math.max(from, to);
  const pages = hi - lo + 1;
  const sel = range.chars.slice(lo - 1, hi).reduce((a, b) => a + b, 0);
  // 글자 PDF에서 글자가 거의 없는 쪽은 그림으로 읽는다 (앞에서 maxImages쪽까지)
  const picturePages = range.scanned ? [] : range.chars.map((ch, i) => (ch < range.imageBelow ? i + 1 : 0)).filter((n) => n >= lo && n <= hi);
  const asPicture = new Set(picturePages.slice(0, range.maxImages));
  const ratio = range.scanned ? pages / range.maxPages : sel / range.maxChars;
  const over = ratio > 1;
  const empty = !range.scanned && sel < 80 && asPicture.size === 0;

  // 다음 묶음: 지금 범위 바로 뒤에서 한 번에 보낼 수 있는 만큼
  const next = useMemo(() => (hi >= range.maxPage ? null : { from: hi + 1, to: fitRange(range.chars, hi + 1, range.scanned) }), [hi, range.maxPage, range.chars, range.scanned]);

  const chips: { label: string; from: number; to: number }[] = [];
  chips.push({ label: range.to >= range.maxPage ? `전체 ${range.maxPage}쪽` : `추천 ${range.from}–${range.to}쪽`, from: range.from, to: range.to });
  if (range.to < range.maxPage) chips.push({ label: `전체 1–${range.maxPage}쪽`, from: 1, to: range.maxPage });
  if (next && !(next.from === range.from && next.to === range.to)) chips.push({ label: `다음 ${next.from}–${next.to}쪽`, from: next.from, to: next.to });

  // 두 번 눌러 고르기: 첫 탭이 시작 쪽, 둘째 탭이 끝 쪽
  const tap = (n: number) => {
    if (anchor === null) {
      setFrom(n);
      setTo(n);
      setAnchor(n);
    } else {
      setFrom(Math.min(anchor, n));
      setTo(Math.max(anchor, n));
      setAnchor(null);
    }
  };
  // 개념 뽑기 약 35초 + 글자 600자당 1초 + 카드는 CONCURRENCY장씩 한 장에 약 28초 (시험 생성 기준)
  const minutes = Math.max(1, Math.round((35 + Math.min(sel, range.maxChars) / 600 + Math.ceil(count / CONCURRENCY) * 28) / 60));
  const clampPage = (v: number) => Math.max(1, Math.min(range.maxPage, Math.round(v) || 1));

  return (
    <div className="relative z-10 flex min-h-0 flex-1 flex-col">
      <div className="px-6 pb-4 pt-1">
        <h2 className="font-jua text-[27px] leading-tight">어디까지 만들까요?</h2>
        <p className="mt-1 text-[13.5px] font-semibold text-white/85">
          전체 {range.maxPage}쪽 · {range.scanned ? "글자 없는 스캔본 (쪽을 그림으로 보내요)" : `약 ${range.totalChars.toLocaleString()}자`}
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col rounded-t-[28px] bg-white text-[var(--ink)]">
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-4 pb-2 pt-4">
          {chips.map((c) => {
            const on = lo === c.from && hi === c.to;
            return (
              <button
                key={c.label}
                type="button"
                onClick={() => {
                  setFrom(c.from);
                  setTo(c.to);
                  setAnchor(null);
                }}
                className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] font-extrabold ${on ? "bg-[var(--navy)] text-[var(--yellow)]" : "bg-[#F1F3FA] text-[#4B5563]"}`}
                aria-pressed={on}
              >
                {c.label}
              </button>
            );
          })}
        </div>
        <p className="px-5 pb-2 text-[12px] font-semibold text-[var(--muted)]">
          {anchor === null ? "쪽을 눌러 시작 쪽부터 다시 고를 수 있어요" : `${anchor}쪽부터 · 이제 끝 쪽을 눌러 주세요`}
        </p>

        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-3">
          <div className="grid grid-cols-3 gap-2.5">
            {range.chars.map((ch, i) => {
              const n = i + 1;
              const inside = n >= lo && n <= hi;
              const thumb = range.thumbs[i];
              const badge = range.scanned || ch >= range.imageBelow ? null : asPicture.has(n) ? "그림으로 읽어요" : "글자 거의 없음";
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => tap(n)}
                  aria-label={`${n}쪽${inside ? " (선택됨)" : ""}`}
                  aria-pressed={inside}
                  className={`relative overflow-hidden rounded-[12px] bg-[#F4F5FA] text-left transition-all ${
                    anchor === n ? "ring-[3px] ring-[var(--yellow)]" : inside ? "ring-[3px] ring-[var(--blue)]" : "opacity-50 ring-1 ring-black/10"
                  }`}
                  style={{ aspectRatio: "3 / 4" }}
                >
                  {thumb ? (
                    <img src={thumb} alt="" className="h-full w-full object-cover object-top" />
                  ) : (
                    <div className="h-full w-full animate-pulse bg-[#E9ECF5]" />
                  )}
                  <span
                    className={`absolute left-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[11px] font-extrabold ${
                      inside ? "bg-[var(--blue)] text-white" : "bg-white/90 text-[#4B5563]"
                    }`}
                  >
                    {n}
                  </span>
                  {badge ? (
                    <span className="absolute inset-x-1.5 bottom-1.5 rounded-md bg-black/55 px-1 py-0.5 text-center text-[10.5px] font-bold text-white">{badge}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-t border-black/5 px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-3">
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={range.maxPage}
              value={from}
              onChange={(e) => {
                setFrom(clampPage(Number(e.target.value)));
                setAnchor(null);
              }}
              className="w-16 rounded-xl border-2 border-[#E5E7EB] px-2 py-1.5 text-center text-[16px] font-extrabold outline-none focus:border-[var(--blue)]"
              aria-label="시작 쪽"
            />
            <span className="text-[14px] font-bold text-[var(--muted)]">~</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={range.maxPage}
              value={to}
              onChange={(e) => {
                setTo(clampPage(Number(e.target.value)));
                setAnchor(null);
              }}
              className="w-16 rounded-xl border-2 border-[#E5E7EB] px-2 py-1.5 text-center text-[16px] font-extrabold outline-none focus:border-[var(--blue)]"
              aria-label="끝 쪽"
            />
            <span className="text-[14px] font-bold text-[var(--muted)]">쪽 ({pages}쪽)</span>
            <span className={`ml-auto text-[12.5px] font-extrabold ${over ? "text-[#E03E3E]" : "text-[var(--muted)]"}`}>
              {range.scanned ? `${pages} / ${range.maxPages}쪽` : `${sel.toLocaleString()} / ${range.maxChars.toLocaleString()}자`}
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#EEF0F6]">
            <div className={`h-full rounded-full transition-[width] ${over ? "bg-[#FF5A6A]" : "bg-[var(--blue)]"}`} style={{ width: `${Math.min(100, Math.round(ratio * 100))}%` }} />
          </div>
          <p className={`mt-1.5 text-[12px] font-semibold ${over || empty ? "text-[#E03E3E]" : "text-[var(--muted)]"}`}>
            {over
              ? range.scanned
                ? `스캔본은 한 번에 ${range.maxPages}쪽까지 보낼 수 있어요. 범위를 줄여 주세요.`
                : "한 번에 만들기엔 길어요. 범위를 줄여 주세요. 나머지는 다음 묶음으로 만들 수 있어요."
              : empty
                ? "고른 쪽에 글자가 거의 없어요. 다른 쪽을 골라 주세요."
                : `개념 ${count}개 · 약 ${minutes}분 · 만드는 동안 준비된 카드부터 볼 수 있어요`}
          </p>
          <button
            type="button"
            disabled={over || empty}
            onClick={() => onChoose({ from: lo, to: hi })}
            className={`mt-2.5 w-full rounded-full py-3 font-jua text-[19px] ${
              over || empty ? "bg-[#E5E7EB] text-[#9CA3AF]" : "bg-[var(--navy)] text-[var(--yellow)] shadow-[0_4px_0_rgba(27,27,58,0.25)] active:translate-y-[2px]"
            }`}
          >
            {lo === hi ? `${lo}쪽으로 만들기` : `${lo}–${hi}쪽으로 만들기`}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export default function Loading({ job, count, onCancel, onOpenEarly, onChooseRange, onRetry, onSample }: Props) {
  const [tip, setTip] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTip((x) => (x + 1) % TIPS.length), 3500);
    return () => clearInterval(t);
  }, []);
  const busy = job.phase === "outline" || job.phase === "scenes" || job.phase === "reading";
  const elapsed = useElapsed(job.phaseAt, busy);

  const phaseIdx = { reading: 0, range: 0, outline: 1, scenes: 2, done: 3, error: -1 }[job.phase];
  const st = (i: number): "done" | "doing" | "todo" => (phaseIdx > i ? "done" : phaseIdx === i ? "doing" : "todo");
  const canOpen = job.phase === "scenes" && job.ready >= Math.min(2, job.total);
  const noKey = job.errorCode === "NO_KEY";
  const heading =
    job.phase === "done"
      ? "완성!"
      : job.phase === "outline"
        ? job.thinking
          ? "Claude가 자료를 읽는 중…"
          : `개념 ${job.found.length}개 찾았어요`
        : job.phase === "scenes"
          ? `카드 만드는 중 ${job.ready}/${job.total}`
          : job.message || "자료 읽는 중…";
  // 첫 개념이 나오기 전에는 얼마나 기다렸는지 보여 준다 (서버가 알려 준 진행 상황이 있으면 그것도)
  const waitNote = job.message && job.message !== "핵심 개념 찾는 중…" ? job.message : "개념을 고르는 데 보통 1분쯤 걸려요";

  return (
    <div className="relative flex h-full flex-col overflow-hidden text-white" style={{ background: "linear-gradient(180deg,#4B6BFB 0%,#5B5CF6 55%,#6C4CF1 100%)" }}>
      <div className="pointer-events-none absolute -left-24 top-20 h-72 w-72 rounded-full bg-white/15 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-20 h-80 w-80 rounded-full bg-[#A78BFA]/40 blur-3xl" />

      <header className="relative z-10 flex items-center px-3 pt-[max(14px,env(safe-area-inset-top))]">
        <button type="button" onClick={onCancel} aria-label="취소" className="flex h-10 w-10 items-center justify-center rounded-full active:bg-white/10">
          <svg width="20" height="20" viewBox="0 0 20 20">
            <path d="M4 4 L16 16 M16 4 L4 16" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
          </svg>
        </button>
        <span className="ml-1 max-w-[70%] truncate text-[13px] font-bold text-white/85">{job.fileName}</span>
      </header>

      {job.phase === "error" ? (
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-7 text-center">
          <div className="animate-shake-x text-[54px]">{noKey ? "🔌" : "😵"}</div>
          <h2 className="mt-3 font-jua text-[27px]">{noKey ? "아직 AI 연결 전이에요" : "앗, 만들지 못했어요"}</h2>
          <p className="mt-2 text-[14.5px] font-semibold leading-relaxed text-white/90">{job.error}</p>
          <div className="mt-6 flex w-full flex-col gap-2.5">
            {!noKey ? (
              <button type="button" onClick={onRetry} className="rounded-full border-[3px] border-white bg-[var(--navy)] py-3 font-jua text-[19px] text-[var(--yellow)]">
                다시 시도
              </button>
            ) : null}
            <button type="button" onClick={onSample} className="rounded-full bg-white py-3 text-[15px] font-extrabold text-[var(--navy)]">
              미리 만든 예시 카드 보기
            </button>
            <button type="button" onClick={onCancel} className="py-2 text-[14px] font-bold text-white/85">
              홈으로
            </button>
          </div>
        </div>
      ) : job.phase === "range" && job.range ? (
        <RangePicker range={job.range} count={count} onChoose={onChooseRange} />
      ) : (
        <div className="relative z-10 flex min-h-0 flex-1 flex-col px-6">
          <div className="flex flex-1 flex-col items-center justify-center">
            <CardStack found={job.found.length} />
            <h2 className="mt-6 text-center font-jua text-[26px] leading-tight">{heading}</h2>
            <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-white/25">
              <div className="relative h-full rounded-full bg-[var(--yellow)] transition-[width] duration-500" style={{ width: `${Math.round(job.progress * 100)}%` }}>
                <div className="animate-shimmer absolute inset-0" />
              </div>
            </div>
            <p className="mt-3 min-h-[20px] text-center text-[13px] font-semibold text-white/80">
              {job.phase === "outline" && job.thinking ? `${elapsed}초째 · ${waitNote}` : TIPS[tip]}
            </p>
          </div>

          <div className="mb-4 space-y-3 rounded-[24px] bg-white/12 p-4 ring-1 ring-white/20 backdrop-blur-sm">
            <Step state={st(0)} label="자료 읽기" />
            <Step
              state={st(1)}
              label="개념 찾고 그림 고르기"
              detail={job.found.length ? `${job.found.length}개` : job.phase === "outline" ? `${elapsed}초` : undefined}
            />
            <Step state={st(2)} label="카드 만들기" detail={job.total ? `${job.ready} / ${job.total}` : undefined} />
            {job.found.length ? (
              <div className="no-scrollbar flex max-h-[132px] flex-wrap gap-1.5 overflow-y-auto pt-1">
                {job.found.map((t, i) => {
                  const status = job.deck?.cards[i]?.status;
                  const tpl = job.templates[i] as VisualTemplate | undefined;
                  return (
                    <span
                      key={`${t}${i}`}
                      className={`animate-pop-in inline-flex items-center gap-1 rounded-full py-1 pl-2.5 pr-1 text-[12.5px] font-bold ${
                        status === "ready" ? "bg-white text-[var(--navy)]" : status === "error" ? "bg-[#FF5A6A] text-white" : "bg-white/20 text-white"
                      }`}
                    >
                      {status === "ready" ? "✓ " : status === "error" ? "! " : ""}
                      {t}
                      {tpl && TEMPLATE_LABEL[tpl] ? (
                        <span className={`rounded-full px-1.5 py-0.5 text-[10.5px] font-extrabold ${status === "ready" ? "bg-[#EEF2FF] text-[var(--blue)]" : "bg-white/20"}`}>
                          {TEMPLATE_LABEL[tpl]}
                        </span>
                      ) : (
                        <span className="w-1" />
                      )}
                    </span>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div className="pb-[max(18px,env(safe-area-inset-bottom))]">
            <button
              type="button"
              disabled={!canOpen}
              onClick={onOpenEarly}
              className={`w-full rounded-full border-[3px] py-3.5 font-jua text-[20px] transition-all ${
                canOpen ? "border-white bg-[var(--yellow)] text-[var(--navy)] shadow-[0_5px_0_rgba(27,27,58,0.35)]" : "border-white/30 bg-white/10 text-white/50"
              }`}
            >
              {canOpen ? `준비된 ${job.ready}개부터 보기 →` : "카드가 준비되면 바로 볼 수 있어요"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
