"use client";
// 브라우저에서 PDF를 읽는다. 파일은 서버에 올리지 않고, 고른 페이지의 텍스트만 AI 서버 함수로 보낸다.
import { LIMITS } from "./models";

type PdfJs = typeof import("pdfjs-dist");
let pdfjsPromise: Promise<PdfJs> | null = null;

async function getPdfJs(): Promise<PdfJs> {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((m) => {
      m.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
      return m;
    });
  }
  return pdfjsPromise;
}

export async function countPages(data: ArrayBuffer): Promise<number> {
  const pdfjs = await getPdfJs();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(data.slice(0)) }).promise;
  const n = doc.numPages;
  await doc.destroy();
  return n;
}

export interface PageChunk {
  from: number;
  to: number;
  label: string;
  text: string;
  pdfBase64?: string; // 글자가 거의 없는(스캔) 페이지일 때만
}

const MIN_CHARS_PER_PAGE = 80;

// from~to (1부터) 페이지를 pagesPerChunk 장씩 묶어 텍스트를 뽑는다.
export async function extractChunks(data: ArrayBuffer, from: number, to: number): Promise<PageChunk[]> {
  const pdfjs = await getPdfJs();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(data.slice(0)) }).promise;
  const chunks: PageChunk[] = [];
  try {
    for (let start = from; start <= to; start += LIMITS.pagesPerChunk) {
      const end = Math.min(to, start + LIMITS.pagesPerChunk - 1);
      const parts: string[] = [];
      for (let p = start; p <= end; p++) {
        const page = await doc.getPage(p);
        const tc = await page.getTextContent();
        const line = tc.items
          .map((it) => ("str" in it ? it.str + (it.hasEOL ? "\n" : " ") : ""))
          .join("")
          .replace(/[ \t]+/g, " ")
          .replace(/\n{3,}/g, "\n\n")
          .trim();
        parts.push(`[p.${p}]\n${line}`);
      }
      const text = parts.join("\n\n").slice(0, LIMITS.maxCharsPerChunk);
      const label = start === end ? `p.${start}` : `p.${start}-${end}`;
      const pages = end - start + 1;
      const bodyChars = text.replace(/\[p\.\d+\]/g, "").replace(/\s/g, "").length;
      if (bodyChars < MIN_CHARS_PER_PAGE * pages) {
        // 스캔본 등 글자가 없는 페이지: 해당 페이지만 잘라 PDF로 보낸다
        chunks.push({ from: start, to: end, label, text: "", pdfBase64: await slicePdf(data, start, end) });
      } else {
        chunks.push({ from: start, to: end, label, text });
      }
    }
  } finally {
    await doc.destroy();
  }
  return chunks;
}

async function slicePdf(data: ArrayBuffer, from: number, to: number): Promise<string> {
  const { PDFDocument } = await import("pdf-lib");
  const src = await PDFDocument.load(data.slice(0), { ignoreEncryption: true });
  const out = await PDFDocument.create();
  const idx = Array.from({ length: to - from + 1 }, (_, i) => from - 1 + i);
  const pages = await out.copyPages(src, idx);
  pages.forEach((p) => out.addPage(p));
  const bytes = await out.save();
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

export async function hashFile(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest).slice(0, 8))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
