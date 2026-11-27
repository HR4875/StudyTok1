"use client";

import Link from "next/link";
import React, { useRef, useState } from "react";
import { isImage, isPdf } from "@/lib/extract";
import type { RenderMode } from "@/lib/schema";
import { APP_NAME } from "./ui";

interface Props {
  deckCount: number;
  cardCount: number;
  onCardCount: (n: number) => void;
  /** 보는 방식: 텍스트 숏츠(기본) / 모션그래픽. 생성은 같고 피드에서도 바꿀 수 있다 */
  mode: RenderMode;
  onMode: (m: RenderMode) => void;
  onFiles: (files: File[]) => void;
  onLibrary: () => void;
  onSample: () => void;
  /** AI로 실제 생성 가능한지 (null = 확인 중이거나 확인 못 함) */
  apiReady: boolean | null;
  /** 이어보기: 마지막으로 보다 만 덱 */
  resume?: { title: string; n: number; total: number } | null;
  onResume?: () => void;
  /** 간격 복습: 오늘 풀 퀴즈 수 (null = 간격 복습 꺼짐) */
  reviewDue?: number | null;
  /** 아직 졸업하지 않은 복습 퀴즈 수 */
  reviewPending?: number;
  /** 시연용 가상 날짜 (+N일) */
  clockDays?: number;
  onReview?: () => void;
  onShiftDay?: () => void;
}

const MODES = [
  { v: "text", name: "텍스트 숏츠", note: "그림·글자가 바로 떠요" },
  { v: "motion", name: "모션그래픽", note: "자막·효과음 영상으로" },
] as const;

/** 보조 칩: 흰 칸 + 잉크 테두리, 고르면 잉크 칸 + 흰 글씨 */
const pill = (on: boolean) =>
  `rounded-full border-2 border-[var(--ink)] px-3 py-1 text-[13px] font-bold transition-colors ${
    on ? "bg-[var(--ink)] text-white" : "bg-white text-[var(--ink)]"
  }`;

export default function Home({
  deckCount,
  cardCount,
  onCardCount,
  mode,
  onMode,
  onFiles,
  onLibrary,
  onSample,
  apiReady,
  resume,
  onResume,
  reviewDue,
  reviewPending = 0,
  clockDays = 0,
  onReview,
  onShiftDay,
}: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const accept = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const files = Array.from(list);
    const bad = files.find((f) => !isPdf(f) && !isImage(f));
    if (bad) {
      setErr(`${bad.name}: PDF, JPG, PNG만 올릴 수 있어요`);
      return;
    }
    if (files.filter(isPdf).length > 1 || (files.some(isPdf) && files.some(isImage))) {
      setErr("PDF는 한 번에 1개씩, 사진은 여러 장을 함께 올릴 수 있어요");
      return;
    }
    setErr(null);
    onFiles(files);
  };

  const pick = () => input.current?.click();

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-[var(--paper)]">
      {/* 제목 띠: 오션 블루 + 흰 글씨 STUDY T@K */}
      <header className="shrink-0 bg-[var(--ocean)] px-6 pb-6 pt-[max(18px,env(safe-area-inset-top))] text-white">
        <div className="flex items-center gap-2 text-[13px] font-medium text-white/85">
          <span>Our semester&apos;s best study?</span>
          <button
            type="button"
            onClick={onLibrary}
            className="ml-auto rounded-full border-[1.5px] border-white/70 px-2.5 py-0.5 font-bold text-white active:bg-white/10"
            aria-label="내 보관함 열기"
          >
            보관함{deckCount > 0 ? ` ${deckCount}` : ""} →
          </button>
        </div>
        <h1 className="font-display mt-4 text-[64px] leading-[0.92]" aria-label={APP_NAME}>
          STUDY
          <br />
          T@K
        </h1>
        <p className="font-display mt-3 text-[19px] leading-snug">: 자료만 올리면 숏폼 강의 완성</p>
      </header>

      <div className="no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pt-6">
        {/* 이어보기 · 오늘 복습 (11/26 기획: 나갔다 들어와도 보던 곳부터, 1·3·7일 간격 복습) */}
        {resume && onResume ? (
          <button
            type="button"
            onClick={onResume}
            className="press press-ink mb-3 flex w-full shrink-0 items-center gap-3 rounded-[18px] border-[2.5px] border-[var(--ink)] bg-white px-4 py-3 text-left"
            aria-label={`${resume.title} ${resume.n}/${resume.total} 이어보기`}
          >
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] font-extrabold text-[var(--muted)]">보던 곳부터</span>
              <span className="block truncate text-[16px] font-extrabold text-[var(--ink)]">{resume.title}</span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block text-[13px] font-bold tabular-nums text-[var(--muted)]">
                {resume.n}/{resume.total}
              </span>
              <span className="font-display block text-[17px] text-[var(--ocean)]">이어보기 →</span>
            </span>
          </button>
        ) : null}
        {reviewDue != null && (reviewDue > 0 || reviewPending > 0) ? (
          <div className="mb-3 flex w-full shrink-0 items-center gap-3 rounded-[18px] border-[2.5px] border-[var(--ink)] bg-[var(--blue-soft)] px-4 py-3">
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] font-extrabold text-[var(--ocean)]">
                간격 복습 1·3·7일{clockDays ? ` · 가상 날짜 +${clockDays}일` : ""}
              </span>
              <span className="block text-[16px] font-extrabold text-[var(--ink)]">
                {reviewDue > 0 ? `오늘 복습 ${reviewDue}개` : `복습 대기 ${reviewPending}개 · 오늘은 없어요`}
              </span>
              {reviewDue === 0 && onShiftDay ? (
                <button type="button" onClick={onShiftDay} className="mt-0.5 text-[12px] font-bold text-[var(--muted)] underline">
                  시연용: 하루 뒤로 보내기 (가상)
                </button>
              ) : null}
            </span>
            {reviewDue > 0 && onReview ? (
              <button type="button" onClick={onReview} className="press font-display shrink-0 rounded-[14px] bg-[var(--ocean)] px-4 py-2.5 text-[17px] text-white">
                풀기 →
              </button>
            ) : null}
          </div>
        ) : null}

        {/* Track #1 : 업로드 */}
        <button
          type="button"
          onClick={pick}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            accept(e.dataTransfer.files);
          }}
          className={`relative w-full shrink-0 overflow-hidden rounded-[22px] border-[2.5px] border-[var(--ink)] px-5 pb-6 pt-10 text-center transition-colors active:scale-[0.99] ${
            drag ? "bg-[var(--ans)]" : "bg-white"
          }`}
          aria-label="학습 자료 파일 올리기"
        >
          <span className="absolute left-0 top-0 rounded-br-[12px] bg-[var(--ink)] px-3 py-1 text-[13px] font-bold text-white">Track #1 : 업로드</span>
          <span className="font-display block text-[26px] leading-tight text-[var(--ink)]">{drag ? "여기에 놓으세요" : "PDF 올리기"}</span>
          <span className="mt-1.5 block text-[14px] font-medium text-[var(--muted)]">강의 PDF · 교재 사진 · 필기 사진</span>
        </button>
        <input
          ref={input}
          type="file"
          accept="application/pdf,image/*,.pdf,.jpg,.jpeg,.png,.webp,.heic"
          multiple
          className="hidden"
          onChange={(e) => {
            accept(e.target.files);
            e.target.value = "";
          }}
        />
        {err ? <p className="mt-3 text-center text-[13px] font-semibold text-[var(--red)]">{err}</p> : null}

        {/* 보는 방식: 텍스트 숏츠(기본) / 모션그래픽(추가) */}
        <div className="mt-4 flex flex-wrap items-center gap-2" role="radiogroup" aria-label="보는 방식">
          {MODES.map((o) => (
            <button key={o.v} type="button" role="radio" aria-checked={mode === o.v} onClick={() => onMode(o.v)} className={pill(mode === o.v)}>
              {o.name}
            </button>
          ))}
          <span className="rounded-[8px] bg-[var(--red)] px-2 py-1 text-[13px] font-extrabold leading-none text-white">NEW</span>
        </div>
        <p className="mt-2 text-[13px] font-medium text-[var(--muted)]">
          {mode === "motion" ? "개념마다 모션그래픽과 퀴즈를 만들고, 교재 문제는 시험문제 탭에 모아요." : "보는 중에도 언제든 모션으로 바꿀 수 있어요."}
        </p>

        <div className="mt-4 flex items-center gap-2">
          <span className="mr-1 text-[13px] font-bold text-[var(--ink)]">만들 개념 수</span>
          {[6, 8, 12].map((n) => (
            <button key={n} type="button" onClick={() => onCardCount(n)} className={pill(cardCount === n)} aria-pressed={cardCount === n}>
              {n}개
            </button>
          ))}
        </div>

        {apiReady !== null ? (
          <p className="mt-4 text-[13px] font-medium text-[var(--muted)]">
            {apiReady ? "AI 연결됨 · 올리면 Claude가 바로 만들어요" : "아직 AI 키가 없어요 · PDF 읽기와 쪽 고르기까지 해 볼 수 있어요"}
          </p>
        ) : null}

        {/* 새로 만든 모션 쇼츠 화면(/film)으로 가는 길. 이 화면의 기존 흐름은 그대로 둔다. */}
        <Link
          href="/film"
          className="mt-5 flex shrink-0 items-center gap-3 rounded-[18px] border-2 border-[var(--line)] bg-white px-4 py-3 text-[var(--ink)] active:bg-[var(--chip)]"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-bold">모션 쇼츠 새 화면 미리 보기</span>
            <span className="mt-0.5 block text-[13px] font-medium text-[var(--muted)]">어려운 단원을 60초 그림 여러 편으로 나눠 설명해요</span>
          </span>
          <span aria-hidden="true" className="text-[18px] font-bold">
            →
          </span>
        </Link>
        <div className="min-h-4 flex-1" />
      </div>

      {/* 주 버튼 + 보조 버튼 */}
      <div className="shrink-0 space-y-4 px-5 pb-[max(18px,env(safe-area-inset-bottom))] pt-3">
        <button
          type="button"
          onClick={pick}
          className="press font-display h-14 w-full rounded-[18px] bg-[var(--ocean)] text-[19px] text-white"
        >
          자료 올리기 →
        </button>
        <button
          type="button"
          onClick={onSample}
          className="press press-ink font-display h-14 w-full rounded-[18px] border-[2.5px] border-[var(--ink)] bg-white text-[19px] text-[var(--ink)]"
        >
          예시 자료로 둘러보기
        </button>
      </div>
    </div>
  );
}
