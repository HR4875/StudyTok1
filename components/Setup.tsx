"use client";
import { useState } from "react";
import { DEFAULT_MODEL, LIMITS, MODELS } from "@/lib/models";
import { countPages } from "@/lib/pdf";
import type { RenderMode } from "@/lib/types";

export interface SetupChoice {
  file: File;
  data: ArrayBuffer;
  from: number;
  to: number;
  mode: RenderMode;
  model: string;
}

interface Props {
  busy: boolean;
  error: string | null;
  onStart: (c: SetupChoice) => void;
  onSample: (mode: RenderMode) => void;
}

export default function Setup({ busy, error, onStart, onSample }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<ArrayBuffer | null>(null);
  const [pages, setPages] = useState(0);
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(1);
  const [mode, setMode] = useState<RenderMode>("text");
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [reading, setReading] = useState(false);
  const [localErr, setLocalErr] = useState<string | null>(null);

  async function pick(f: File | undefined) {
    setLocalErr(null);
    if (!f) return;
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      setLocalErr("PDF 파일만 올릴 수 있어요.");
      return;
    }
    setReading(true);
    try {
      const buf = await f.arrayBuffer();
      const n = await countPages(buf);
      setFile(f);
      setData(buf);
      setPages(n);
      setFrom(1);
      setTo(Math.min(n, 5));
    } catch {
      setLocalErr("PDF를 읽지 못했어요. 암호가 걸려 있거나 손상된 파일일 수 있어요.");
    } finally {
      setReading(false);
    }
  }

  const count = to - from + 1;
  const rangeErr =
    pages > 0 && (from < 1 || to > pages || from > to)
      ? "페이지 범위를 다시 확인해 주세요."
      : count > LIMITS.maxPages
        ? `한 번에 최대 ${LIMITS.maxPages}페이지까지 만들 수 있어요.`
        : null;
  const calls = Math.ceil(count / LIMITS.pagesPerChunk);

  return (
    <main className="setup">
      <div className="brand">
        <span className="logo">▶</span>
        <h1>StudyTok</h1>
        <p>강의자료 PDF를 올리면, AI가 넘겨 보는 숏폼 카드와 퀴즈로 바꿔 줘요.</p>
      </div>

      <section className="panel">
        <label className={`drop ${file ? "has-file" : ""}`}>
          <input type="file" accept="application/pdf,.pdf" onChange={(e) => pick(e.target.files?.[0])} hidden />
          {reading ? "PDF 읽는 중…" : file ? `📄 ${file.name} · ${pages}쪽` : "📄 PDF 선택하기"}
          <small>파일은 서버에 저장하지 않아요. 고른 페이지의 글만 AI에게 보냅니다.</small>
        </label>

        {pages > 0 && (
          <div className="row">
            <span className="row-label">페이지</span>
            <input
              type="number"
              min={1}
              max={pages}
              value={from}
              onChange={(e) => setFrom(Number(e.target.value))}
              aria-label="시작 페이지"
            />
            <span>~</span>
            <input
              type="number"
              min={1}
              max={pages}
              value={to}
              onChange={(e) => setTo(Number(e.target.value))}
              aria-label="끝 페이지"
            />
            <span className="muted">{rangeErr ?? `${count}쪽 · AI 호출 ${calls}회`}</span>
          </div>
        )}

        <div className="row">
          <span className="row-label">형식</span>
          <div className="seg">
            <button className={mode === "text" ? "on" : ""} onClick={() => setMode("text")}>
              텍스트 숏츠 <small>기본 · 도표·그래프 포함</small>
            </button>
            <button className={mode === "motion" ? "on" : ""} onClick={() => setMode("motion")}>
              모션그래픽 <small>애니메이션·내레이션 · 비용↑</small>
            </button>
          </div>
        </div>

        <div className="row">
          <span className="row-label">AI 모델</span>
          <select value={model} onChange={(e) => setModel(e.target.value)}>
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label} ({m.note})
              </option>
            ))}
          </select>
        </div>

        {(localErr || error) && <p className="error">{localErr || error}</p>}

        <button
          className="btn btn-primary"
          disabled={!file || !data || Boolean(rangeErr) || busy}
          onClick={() => file && data && onStart({ file, data, from, to, mode, model })}
        >
          {busy ? "만드는 중…" : "숏폼 만들기"}
        </button>
      </section>

      <section className="sample">
        <p>파일이 없다면 미리 만든 샘플 덱으로 체험해 보세요.</p>
        <div className="sample-btns">
          <button className="btn btn-ghost" onClick={() => onSample("text")}>
            샘플 · 텍스트 숏츠
          </button>
          <button className="btn btn-ghost" onClick={() => onSample("motion")}>
            샘플 · 모션그래픽
          </button>
        </div>
      </section>

      <footer className="foot">
        서울시립대 AI실무활용과스마트비즈니스 기말 프로젝트 · <a href="/lab">모델 비교 실험실</a>
      </footer>
    </main>
  );
}
