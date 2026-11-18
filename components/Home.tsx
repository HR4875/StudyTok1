"use client";

import React, { useRef, useState } from "react";
import { isImage, isPdf } from "@/lib/extract";
import type { RenderMode } from "@/lib/schema";
import { APP_NAME, Logo } from "./ui";

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
}

const MODES = [
  { v: "text", icon: "📝", name: "텍스트 숏츠", tag: "기본", note: "그림·글자가 바로 떠요" },
  { v: "motion", icon: "🎬", name: "모션그래픽", tag: "추가", note: "자막·효과음 영상으로" },
] as const;

export default function Home({ deckCount, cardCount, onCardCount, mode, onMode, onFiles, onLibrary, onSample, apiReady }: Props) {
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

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-[var(--page)]">
      {/* soft brand glow */}
      <div className="pointer-events-none absolute -left-24 -top-28 h-72 w-72 rounded-full bg-[#4B6BFB]/25 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 top-40 h-60 w-60 rounded-full bg-[#FFD43B]/30 blur-3xl" />

      <header className="relative z-10 flex items-center gap-2.5 px-5 pt-[max(18px,env(safe-area-inset-top))]">
        <Logo size={34} />
        <span className="font-jua text-[24px] leading-none text-[var(--navy)]">{APP_NAME}</span>
        <span className="ml-auto rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-bold text-[var(--muted)] shadow-sm">
          {apiReady === false ? "데모 모드" : "Beta"}
        </span>
      </header>

      <div className="relative z-10 px-6 pt-5">
        <h1 className="font-jua text-[33px] leading-[1.18] text-[var(--navy)]">
          자료만 올리면
          <br />
          <span className="relative inline-block">
            <span className="absolute inset-x-[-4px] bottom-[3px] h-[14px] rounded-md bg-[var(--yellow)]" />
            <span className="relative">숏폼 강의</span>
          </span>{" "}
          완성
        </h1>
        <p className="mt-2 text-[14.5px] font-medium leading-relaxed text-[var(--muted)]">개념마다 움직이는 설명 영상과 퀴즈로 바꿔 드려요.</p>
      </div>

      {/* drop zone */}
      <div className="relative z-10 flex flex-1 flex-col justify-center px-5 py-3">
        <button
          type="button"
          onClick={() => input.current?.click()}
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
          className={`group relative flex w-full flex-col items-center rounded-[30px] border-[2.5px] border-dashed px-5 pb-5 pt-5 text-center transition-all ${
            drag ? "scale-[1.02] border-[var(--blue)] bg-[#EEF2FF]" : "border-[#C9D1F6] bg-white"
          } shadow-[0_14px_40px_rgba(75,107,251,0.14)] active:scale-[0.99]`}
          aria-label="학습 자료 파일 올리기"
        >
          {/* illustration: document → motion card */}
          <div className="relative -mb-2 h-[118px] w-[210px] origin-top scale-[0.86]" aria-hidden>
            <div className="absolute left-[8px] top-[14px] h-[96px] w-[74px] -rotate-6 rounded-[14px] border-[3px] border-[var(--navy)] bg-white shadow-[0_5px_0_var(--navy)]">
              <div className="mx-auto mt-3 h-[7px] w-[44px] rounded bg-[#DCE3FF]" />
              <div className="mx-auto mt-2 h-[7px] w-[52px] rounded bg-[#E8ECF8]" />
              <div className="mx-auto mt-2 h-[7px] w-[36px] rounded bg-[#E8ECF8]" />
              <div className="mx-auto mt-2 h-[7px] w-[48px] rounded bg-[#E8ECF8]" />
              <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 rounded-md border-2 border-[var(--navy)] bg-[#FF5A5F] px-1.5 text-[10px] font-extrabold text-white">
                PDF
              </div>
            </div>
            <svg className="absolute left-[92px] top-[48px]" width="34" height="24" viewBox="0 0 34 24">
              <path d="M2 12 H26 M19 4 L28 12 L19 20" stroke="#1B1B3A" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div
              className="animate-floaty absolute right-[6px] top-0 flex h-[118px] w-[70px] flex-col items-center justify-center rounded-[16px] border-[3px] border-[var(--navy)] shadow-[0_5px_0_var(--navy)]"
              style={{ background: "linear-gradient(180deg,#4B6BFB,#6C4CF1)" }}
            >
              <div className="text-[26px] leading-none">☀️</div>
              <div className="mt-1.5 rounded-full border-2 border-white bg-[var(--navy)] px-1.5 font-jua text-[11px] text-[var(--yellow)]">API</div>
              <div className="mt-1.5 font-jua text-[9px] text-white/90">약속된 통로</div>
            </div>
          </div>

          <span className="inline-flex items-center gap-2 rounded-full border-[3px] border-white bg-[var(--navy)] px-6 py-3 font-jua text-[21px] text-[var(--yellow)] shadow-[0_5px_0_rgba(27,27,58,0.35)] transition-transform group-active:translate-y-[2px]">
            <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
              <path d="M10 15 V4 M5 8.5 L10 3.5 L15 8.5" stroke="#FFD43B" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M3.5 15.5 V16.5 H16.5 V15.5" stroke="#FFD43B" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            자료 올리기
          </span>
          <span className="mt-3 text-[13px] font-semibold text-[var(--muted)]">{drag ? "여기에 놓으세요" : "강의 PDF · 교재 사진 · 필기 사진"}</span>
          <span className="mt-2.5 flex flex-wrap justify-center gap-1.5">
            {["PDF", "JPG", "PNG", "여러 장 OK"].map((t) => (
              <span key={t} className="rounded-full bg-[#F1F3FA] px-2.5 py-1 text-[11.5px] font-bold text-[#5B6478]">
                {t}
              </span>
            ))}
          </span>
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
        {err ? <p className="mt-3 text-center text-[13px] font-semibold text-[#E03E3E]">{err}</p> : null}
        {apiReady !== null ? (
          <p className={`mt-2.5 text-center text-[12px] font-bold ${apiReady ? "text-[var(--muted)]" : "text-[#B45309]"}`}>
            {apiReady ? "AI 연결됨 · 올리면 Claude가 바로 만들어요" : "아직 AI 키가 없어요 · PDF 읽기와 쪽 고르기까지 해 볼 수 있어요"}
          </p>
        ) : null}

        <div className="mt-3 flex items-center justify-center gap-2">
          <span className="text-[13px] font-bold text-[var(--muted)]">만들 개념 수</span>
          <div className="flex rounded-full bg-white p-1 shadow-sm ring-1 ring-black/5">
            {[6, 8, 12].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onCardCount(n)}
                className={`rounded-full px-3.5 py-1.5 text-[13px] font-extrabold transition-colors ${
                  cardCount === n ? "bg-[var(--navy)] text-[var(--yellow)]" : "text-[#5B6478]"
                }`}
                aria-pressed={cardCount === n}
              >
                {n}개
              </button>
            ))}
          </div>
        </div>

        {/* 보는 방식: 텍스트 숏츠(기본) / 모션그래픽(추가) */}
        <div className="mt-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label="보는 방식">
          {MODES.map((o) => {
            const on = mode === o.v;
            return (
              <button
                key={o.v}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => onMode(o.v)}
                className={`rounded-[18px] px-3 py-2.5 text-left transition-all ${
                  on ? "bg-[var(--navy)] text-white shadow-[0_4px_0_rgba(27,27,58,0.25)]" : "bg-white text-[var(--ink)] ring-1 ring-black/5"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <span className="text-[17px] leading-none">{o.icon}</span>
                  <span className="text-[14.5px] font-extrabold">{o.name}</span>
                  <span
                    className={`ml-auto rounded-full px-1.5 py-0.5 text-[10.5px] font-extrabold ${on ? "bg-[var(--yellow)] text-[var(--navy)]" : "bg-[#F1F3FA] text-[#5B6478]"}`}
                  >
                    {o.tag}
                  </span>
                </span>
                <span className={`mt-1 block text-[11.5px] font-semibold ${on ? "text-white/80" : "text-[var(--muted)]"}`}>{o.note}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-center text-[11.5px] font-semibold text-[var(--muted)]">
          {mode === "motion"
            ? "같은 카드로 영상을 만들어서 생성 비용은 그대로예요. 보는 중에도 바꿀 수 있어요."
            : "보는 중에 🎬 버튼으로 언제든 모션으로 바꿀 수 있어요."}
        </p>
      </div>

      {/* library */}
      <div className="relative z-10 px-5 pb-[max(18px,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={onLibrary}
          className="flex w-full items-center gap-3 rounded-[22px] bg-white px-4 py-3.5 text-left shadow-[0_8px_24px_rgba(27,27,58,0.08)] ring-1 ring-black/5 active:scale-[0.99]"
        >
          <span
            className="flex h-11 w-11 items-center justify-center rounded-[14px] text-[22px]"
            style={{ background: "linear-gradient(160deg,#FFE27A,#FFD43B)" }}
          >
            🎞️
          </span>
          <span className="flex-1">
            <span className="block text-[15.5px] font-extrabold text-[var(--ink)]">내 보관함</span>
            <span className="block text-[12.5px] font-semibold text-[var(--muted)]">
              {deckCount > 0 ? `지금까지 만든 ${deckCount}개 세트 다시 보기` : "만든 카드가 여기에 모여요"}
            </span>
          </span>
          {deckCount > 0 ? (
            <span className="rounded-full bg-[var(--navy)] px-2.5 py-1 text-[12px] font-extrabold text-[var(--yellow)]">{deckCount}</span>
          ) : null}
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
            <path d="M7 4 L12 9 L7 14" stroke="#9AA3B5" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button type="button" onClick={onSample} className="mx-auto mt-2.5 block text-[13px] font-bold text-[var(--blue)] underline-offset-4 hover:underline">
          자료 없이 예시부터 볼래요 →
        </button>
      </div>
    </div>
  );
}
