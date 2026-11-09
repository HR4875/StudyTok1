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

/** 글자가 이보다 적은 쪽은 스캔본(그림)으로 보고 이미지로 보낸다 */
export const SCANNED_BELOW = 40;

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

/** 쪽 하나를 JPEG(base64, 머리말 없이)로 그린다. 긴 변 maxSide px */
export async function renderPageJpeg(doc: PdfDoc, n: number, maxSide = 1280, quality = 0.8): Promise<string> {
  const page = await doc.getPage(n);
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(3, maxSide / Math.max(base.width, base.height));
  const vp = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(vp.width);
  canvas.height = Math.round(vp.height);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  page.cleanup();
  const url = canvas.toDataURL("image/jpeg", quality);
  canvas.width = canvas.height = 0;
  return url.slice(url.indexOf(",") + 1);
}

export async function hashBytes(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest).slice(0, 8))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
