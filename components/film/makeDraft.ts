"use client";
// 만들기 화면에 적은 것과 읽은 파일. 화면을 떠났다 돌아와도 남도록 화면 밖에 둔다 (페이지를 닫으면 사라진다).
import { useSyncExternalStore } from "react";
import { pickPages, blocksOf, type SourcePage } from "@/lib/film/plan";
import { FILM_LIMITS } from "@/lib/film/types";
import { isScannedDoc, openPdf, readPdfPages } from "@/lib/pdf";

export interface MakeDraft {
  topic: string;
  paste: string;
  /** 읽을 쪽 범위 ("12-45") */
  range: string;
  /** 고른 파일 이름 (없으면 "") */
  file: string;
  /** 파일에서 읽은 쪽. 읽지 못했으면 null */
  pages: SourcePage[] | null;
  /** 파일 칸 아래에 보이는 말 (읽은 결과나 읽는 중) */
  note: string;
  reading: boolean;
  /** 이 화면에서 바로 알려 주는 말 (서버 오류가 아닌 것) */
  err: string;
}

let draft: MakeDraft = { topic: "", paste: "", range: "", file: "", pages: null, note: "", reading: false, err: "" };
const listeners = new Set<() => void>();
// 앞 파일을 읽는 동안 다른 파일을 고르면 앞 파일의 결과는 버린다
let readSeq = 0;

export function setDraft(patch: Partial<MakeDraft>): void {
  draft = { ...draft, ...patch };
  listeners.forEach((fn) => fn());
}
export const getDraft = (): MakeDraft => draft;

export function useDraft(): MakeDraft {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    () => draft,
    () => draft,
  );
}

const charsOf = (text: string) => text.replace(/\s/g, "").length;
const isPdf = (f: File) => /\.pdf$/i.test(f.name) || f.type === "application/pdf";

/** 파일을 이 기기에서 읽어 쪽으로 나눈다. 파일 자체는 어디에도 보내지 않는다. */
export async function takeFile(f: File): Promise<void> {
  const seq = ++readSeq;
  setDraft({ file: f.name, pages: null, range: "", reading: true, note: "읽는 중", err: "" });
  let pages: SourcePage[] | null = null;
  let note = "";
  try {
    if (isPdf(f)) {
      const doc = await openPdf(await f.arrayBuffer());
      try {
        const read = await readPdfPages(doc, (a, b) => {
          if (seq === readSeq) setDraft({ note: `읽는 중 ${a}/${b}쪽` });
        });
        if (isScannedDoc(read.map((p) => p.chars))) note = "글자가 들어 있지 않은 PDF(스캔본)예요. 지금은 글자가 있는 PDF만 읽을 수 있어요.";
        else {
          pages = read.map((p) => ({ n: p.n, text: p.text }));
          const chars = read.reduce((a, p) => a + p.chars, 0);
          const p = pickPages(pages, "", FILM_LIMITS.sourceChars);
          note = `${read.length}쪽, 글자 ${chars.toLocaleString("ko-KR")}자를 읽었어요.` + (p.used.length < p.all ? ` 한 번에 ${p.used.length}쪽까지 쓸 수 있어서, 아래에 읽을 쪽을 적어 주세요.` : "");
        }
      } finally {
        void doc.destroy();
      }
    } else {
      const text = await f.text();
      if (text.trim()) {
        pages = blocksOf(text);
        note = `글자 ${charsOf(text).toLocaleString("ko-KR")}자를 읽었어요.`;
      } else note = "빈 파일이에요.";
    }
  } catch {
    pages = null;
    note = "이 파일은 열지 못했어요. 다른 파일로 해 보세요.";
  }
  if (seq === readSeq) setDraft({ pages, note, reading: false });
}

/** 계획 모델에 보낼 자료: 파일의 고른 쪽과 붙여 넣은 글 */
export function sourceOf(d: MakeDraft): string {
  const cap = FILM_LIMITS.sourceChars;
  const parts: string[] = [];
  if (d.pages) parts.push(pickPages(d.pages, d.range, cap).text);
  if (d.paste.trim()) parts.push(pickPages(blocksOf(d.paste), "", cap).text);
  return parts.filter(Boolean).join("\n\n").slice(0, cap);
}
