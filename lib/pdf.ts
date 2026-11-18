"use client";
// 브라우저에서 PDF를 읽는다. 파일 자체는 서버에 올리지 않고, 고른 쪽의 글자(스캔 쪽은 작은 그림)만 보낸다.

type PdfJs = typeof import("pdfjs-dist");
type PdfDoc = import("pdfjs-dist").PDFDocumentProxy;
let pdfjsPromise: Promise<PdfJs> | null = null;

export async function getPdfJs(): Promise<PdfJs> {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((m) => {
      m.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
      return m;
    });
  }
  return pdfjsPromise;
}

export async function openPdf(data: ArrayBuffer): Promise<PdfDoc> {
  const pdfjs = await getPdfJs();
  return pdfjs.getDocument({ data: new Uint8Array(data.slice(0)) }).promise;
}

export interface PdfPage {
  n: number;
  text: string;
  chars: number; // 공백을 뺀 글자 수
}

/** 글자 PDF에서 글자가 이보다 적은 쪽(그림 위주 슬라이드 등)은 그림으로 보낸다 */
export const SCANNED_BELOW = 40;

/** 글자가 없는 PDF(스캔본)인지: 전체 글자 < max(40, 쪽수×8). 스캔본이면 모든 쪽을 그림으로 보낸다 */
export const isScannedDoc = (chars: number[]) => chars.reduce((a, b) => a + b, 0) < Math.max(40, chars.length * 8);

type TextItem = { str: string; transform: number[]; width: number; height: number; hasEOL: boolean };

/** 글자 조각을 위치대로 잇는다. 조각 사이가 실제로 떨어져 있을 때만 띄어 쓴다 (한글 단어가 쪼개지지 않게) */
function joinItems(items: unknown[]): string {
  let out = "";
  let prev: { x: number; y: number; w: number; size: number; eol: boolean } | null = null;
  for (const raw of items) {
    if (!raw || typeof raw !== "object" || !("str" in raw)) continue;
    const it = raw as TextItem;
    const x = it.transform[4];
    const y = it.transform[5];
    const size = Math.hypot(it.transform[2], it.transform[3]) || it.height || 10;
    if (it.str) {
      if (prev) {
        if (prev.eol || Math.abs(y - prev.y) > Math.max(size, prev.size) * 0.5) out += "\n";
        else {
          const gap = x - (prev.x + prev.w);
          if (gap > Math.min(size, prev.size) * 0.15 && !out.endsWith(" ") && !it.str.startsWith(" ")) out += " ";
        }
      }
      out += it.str;
      prev = { x, y, w: it.width, size, eol: it.hasEOL };
    } else if (it.hasEOL && prev) prev.eol = true;
  }
  return out;
}

export async function readPdfPages(doc: PdfDoc, onProgress?: (done: number, total: number) => void): Promise<PdfPage[]> {
  const out: PdfPage[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const tc = await page.getTextContent();
    const text = joinItems(tc.items)
      .replace(/[ \t ]+/g, " ")
      .replace(/ *\n */g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    out.push({ n, text, chars: text.replace(/\s/g, "").length });
    page.cleanup();
    if (n % 10 === 0) onProgress?.(n, doc.numPages);
  }
  return out;
}

/** 쪽 하나를 그려 JPEG data URL로. scaleOf는 1배 크기(가로, 세로)를 받아 배율을 돌려준다 */
async function renderPage(doc: PdfDoc, n: number, scaleOf: (w: number, h: number) => number, quality: number): Promise<string> {
  const page = await doc.getPage(n);
  const base = page.getViewport({ scale: 1 });
  const vp = page.getViewport({ scale: scaleOf(base.width, base.height) });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(vp.width));
  canvas.height = Math.max(1, Math.round(vp.height));
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  try {
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    return canvas.toDataURL("image/jpeg", quality);
  } finally {
    page.cleanup();
    canvas.width = canvas.height = 0;
  }
}

/** 쪽 하나를 JPEG(base64, 머리말 없이)로 그린다. 긴 변 maxSide px (AI에게 보내는 그림) */
export async function renderPageJpeg(doc: PdfDoc, n: number, maxSide = 1280, quality = 0.8): Promise<string> {
  const url = await renderPage(doc, n, (w, h) => Math.min(3, maxSide / Math.max(w, h)), quality);
  return url.slice(url.indexOf(",") + 1);
}

/** 쪽 범위 화면의 작은 미리보기 (JPEG data URL, 가로 width px) */
export async function pageThumb(doc: PdfDoc, n: number, width = 200): Promise<string> {
  return renderPage(doc, n, (w) => width / w, 0.72);
}

export async function hashBytes(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest).slice(0, 8))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
