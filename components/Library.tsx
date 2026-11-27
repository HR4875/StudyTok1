"use client";

import React, { useState } from "react";
import { thumbOf } from "@/lib/cards";
import type { Deck } from "@/lib/schema";
import { PALETTE_BG } from "@/motion/palettes";

interface Props {
  decks: Deck[];
  samples: Deck[];
  generatingId: string | null;
  onOpen: (deck: Deck) => void;
  onDelete: (id: string) => void;
  onBack: () => void;
}

function DeckRow({ deck, generating, onOpen, onDelete }: { deck: Deck; generating: boolean; onOpen: () => void; onDelete?: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const ready = deck.cards.filter((c) => c.status === "ready").length;
  const failed = deck.cards.filter((c) => c.status === "error").length;
  const thumb = thumbOf(deck.cards);
  const pal = PALETTE_BG[thumb.palette] ?? PALETTE_BG.blue;
  const emoji = thumb.emoji;
  const date = new Date(deck.createdAt);
  return (
    <div className="flex items-center gap-3 rounded-[18px] border-[2.5px] border-[var(--ink)] bg-white p-3">
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={`${deck.title} 열기`}>
        <span
          className="flex h-[58px] w-[46px] shrink-0 items-center justify-center rounded-[16px] border-[2.5px] border-[var(--ink)] text-[22px]"
          style={{ background: `linear-gradient(180deg, ${pal.top}, ${pal.bottom})` }}
        >
          {emoji}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-extrabold text-[var(--ink)]">{deck.title}</span>
          <span className="mt-0.5 block truncate text-[13px] font-semibold text-[var(--muted)]">
            {deck.subject ? `${deck.subject} · ` : ""}
            개념 {deck.cards.length}개{deck.sample ? "" : ` · ${date.getMonth() + 1}/${date.getDate()}`}
          </span>
          {generating ? (
            <span className="mt-1 inline-block rounded-full bg-[var(--ans)] px-2 py-0.5 text-[12px] font-bold text-[var(--ocean)]">
              만드는 중 {ready}/{deck.cards.length}
            </span>
          ) : failed > 0 ? (
            <span className="mt-1 inline-block rounded-full border-2 border-[var(--red)] px-2 py-0.5 text-[12px] font-bold text-[var(--red)]">{failed}개 실패 · 열어서 다시 만들기</span>
          ) : null}
        </span>
      </button>
      {onDelete ? (
        <button
          type="button"
          onClick={() => (confirm ? onDelete() : setConfirm(true))}
          onBlur={() => setConfirm(false)}
          className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] font-bold transition-colors ${
            confirm ? "bg-[var(--red)] text-white" : "border-2 border-[var(--ink)] bg-white text-[var(--ink)]"
          }`}
        >
          {confirm ? "정말 삭제" : "삭제"}
        </button>
      ) : null}
    </div>
  );
}

export default function Library({ decks, samples, generatingId, onOpen, onDelete, onBack }: Props) {
  return (
    <div className="flex h-full flex-col bg-[var(--page)]">
      <header className="flex items-center gap-2 px-3 pb-2 pt-[max(14px,env(safe-area-inset-top))]">
        <button type="button" onClick={onBack} aria-label="뒤로" className="flex h-10 w-10 items-center justify-center rounded-full active:bg-black/5">
          <svg width="22" height="22" viewBox="0 0 22 22">
            <path d="M14 4 L7 11 L14 18" stroke="#232325" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className="font-display text-[24px] text-[var(--ink)]">내 모션 보관함</h1>
      </header>
      <div className="no-scrollbar flex-1 space-y-2.5 overflow-y-auto px-4 pb-8">
        {decks.length === 0 ? (
          <div className="rounded-[22px] border-2 border-dashed border-[var(--line)] px-5 py-8 text-center">
            <p className="text-[15px] font-bold text-[var(--ink)]">아직 만든 모션이 없어요</p>
            <p className="mt-1 text-[13px] font-medium text-[var(--muted)]">홈에서 자료를 올리면 여기에 저장돼요. (이 기기 브라우저에 저장)</p>
          </div>
        ) : (
          decks.map((d) => (
            <DeckRow key={d.id} deck={d} generating={generatingId === d.id} onOpen={() => onOpen(d)} onDelete={() => onDelete(d.id)} />
          ))
        )}
        <p className="px-1 pt-4 text-[13px] font-extrabold tracking-wide text-[var(--muted)]">예시 자료</p>
        {samples.map((s) => (
          <DeckRow key={s.id} deck={s} generating={false} onOpen={() => onOpen(s)} />
        ))}
      </div>
    </div>
  );
}
