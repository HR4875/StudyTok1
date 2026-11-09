"use client";
import { useEffect, useRef, useState } from "react";
import { DEFAULT_MODEL, LIMITS, MODELS } from "@/lib/models";
import { countPages, rangeText, renderThumb } from "@/lib/pdf";
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
  status: string;
  error: string | null;
  onStart: (c: SetupChoice) => void;
  onSample: (mode: RenderMode) => void;
}

const MAX = LIMITS.maxPages;

export default function Setup({ busy, status, error, onStart, onSample }: Props) {
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<ArrayBuffer | null>(null);
  const [sample, setSample] = useState(false);
  const [pages, setPages] = useState(0);
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(1);
  const [motion, setMotion] = useState(false);
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [upErr, setUpErr] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [reading, setReading] = useState(false);

  async function openFile(f: File | undefined) {
    setUpErr(null);
    if (!f) return;
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      setUpErr("PDF 파일만 올릴 수 있어요. 파일 확장자가 .pdf인지 확인해 주세요.");
      return;
    }
    setReading(true);
    try {
      const buf = await f.arrayBuffer();
      const n = await countPages(buf);
      setFile(f);
      setData(buf);
      setSample(false);
      setPages(n);
      setFrom(1);
      setTo(Math.min(n, 10));
      setStep(1);
    } catch {
      setUpErr("이 PDF를 열지 못했어요. 암호가 걸려 있거나 손상된 파일일 수 있어요.");
    } finally {
      setReading(false);
    }
  }

  const count = to - from + 1;
  const valid = from >= 1 && to <= pages && from <= to && count <= MAX;

  function next() {
    if (step < 2) return setStep(step + 1);
    const mode: RenderMode = motion ? "motion" : "text";
    if (sample) return onSample(mode);
    if (file && data) onStart({ file, data, from, to, mode, model });
  }

  if (busy) return <Making status={status} />;

  return (
    <div className="app">
      <section className="setup">
        <div className="steps gutter">
          {["자료 올리기", "범위 고르기", "스타일"].map((s, i) => (
            <span key={s} className={i <= step ? "on" : ""}>
              {s}
            </span>
          ))}
        </div>

        {step === 0 && (
          <div className="pane gutter">
            <h1>
              PDF를 넣으면
              <br />
              <em>숏폼</em>이 됩니다
            </h1>
            <p className="lead">전공서, 강의자료, 자격증 교재 모두 괜찮아요. 고른 쪽만 넘기면서 푸는 카드로 바꿔요.</p>
            <label
              className={`drop ${over ? "over" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(true);
              }}
              onDragLeave={() => setOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setOver(false);
                void openFile(e.dataTransfer.files[0]);
              }}
            >
              <UploadIcon />
              <b>{reading ? "PDF 읽는 중…" : "PDF 고르기"}</b>
              <small>여기로 끌어다 놓아도 돼요. 파일은 서버에 저장하지 않아요.</small>
              <input className="sr" type="file" accept="application/pdf,.pdf" onChange={(e) => openFile(e.target.files?.[0])} />
            </label>
            {(upErr || error) && <p className="err">{upErr || error}</p>}
            <div className="or">또는</div>
            <button
              className="btn ghost"
              onClick={() => {
                setSample(true);
                setStep(2);
              }}
            >
              예시 자료로 둘러보기
            </button>
            <a className="lab-link" href="/lab">
              모델 비교 실험실 →
            </a>
          </div>
        )}

        {step === 1 && data && file && (
          <RangePane
            data={data}
            name={file.name}
            pages={pages}
            from={from}
            to={to}
            setFrom={setFrom}
            setTo={setTo}
            valid={valid}
            onChangeFile={() => setStep(0)}
          />
        )}

        {step === 2 && (
          <div className="pane gutter">
            <h1>
              어떤 숏폼으로
              <br />
              만들까요?
            </h1>
            <div className={`style-opt ${!motion ? "base" : ""}`}>
              <header>
                <h2>텍스트 숏츠</h2>
                <span className="pill y">기본 포함</span>
              </header>
              <p>큰 개념 이름과 한 줄 설명, 그리고 코드로 그린 도식·도표·그래프. 빠르고 가볍게 만들어져요.</p>
              <Meters time={1} cost={1} />
            </div>
            <div className={`style-opt ${motion ? "base" : ""}`}>
              <header>
                <h2>모션그래픽</h2>
                <span className="pill">추가 선택</span>
              </header>
              <p>그림이 튀어나오고, 연결선이 흐르고, 그래프가 자라요. 말풍선과 음성 내레이션도 붙어요. 시간과 비용이 더 들어요.</p>
              <Meters time={3} cost={3} />
              <label className="switch">
                <input type="checkbox" role="switch" checked={motion} onChange={(e) => setMotion(e.target.checked)} />
                모션그래픽 추가하기
              </label>
            </div>
            {!sample && (
              <label className="model-row">
                <span>AI 모델</span>
                <select value={model} onChange={(e) => setModel(e.target.value)}>
                  {MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label} · {m.note}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {sample && <p className="note">예시 자료(경제학원론 '수요와 공급')는 미리 만들어 둔 카드라 AI를 부르지 않아요.</p>}
            {error && <p className="err">{error}</p>}
          </div>
        )}

        <div className="foot gutter">
          {step > 0 && (
            <button className="btn ghost" onClick={() => setStep(step === 2 && sample ? 0 : step - 1)}>
              이전
            </button>
          )}
          {step > 0 && (
            <button className="btn" disabled={step === 1 && !valid} onClick={next}>
              {step === 2 ? "카드 만들기" : "다음"}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

function RangePane(props: {
  data: ArrayBuffer;
  name: string;
  pages: number;
  from: number;
  to: number;
  setFrom: (n: number) => void;
  setTo: (n: number) => void;
  valid: boolean;
  onChangeFile: () => void;
}) {
  const { data, name, pages, from, to, setFrom, setTo, valid } = props;
  const thA = useRef<HTMLCanvasElement>(null);
  const thB = useRef<HTMLCanvasElement>(null);
  const [chars, setChars] = useState<number | null>(null);
  const [excerpt, setExcerpt] = useState("");
  const pick = useRef(0);
  const count = to - from + 1;

  useEffect(() => {
    if (!valid) return;
    let alive = true;
    setChars(null);
    const t = setTimeout(async () => {
      try {
        if (thA.current) await renderThumb(data, from, thA.current);
        if (thB.current) await renderThumb(data, to, thB.current);
        const text = await rangeText(data, from, to);
        if (!alive) return;
        setChars(text.replace(/\s+/g, "").length);
        setExcerpt(text.replace(/\s+/g, " ").trim().slice(0, 160));
      } catch {
        // 미리보기 실패는 생성에 영향을 주지 않는다
      }
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [data, from, to, valid]);

  const n = Math.min(pages, 60);
  const bar = Array.from({ length: n }, (_, i) => Math.round((i * (pages - 1)) / Math.max(1, n - 1)) + 1);

  function clickPage(p: number) {
    if (pick.current === 0) {
      setFrom(p);
      setTo(Math.max(p, Math.min(to, p + MAX - 1)));
    } else if (p < from) {
      setTo(from);
      setFrom(p);
    } else setTo(p);
    pick.current = 1 - pick.current;
  }

  let readout: React.ReactNode;
  if (!valid) {
    readout =
      from > to
        ? "시작 쪽이 끝 쪽보다 뒤에 있어요."
        : count > MAX
          ? `한 번에 최대 ${MAX}쪽까지 만들 수 있어요. 지금 ${count}쪽이에요.`
          : `1쪽부터 ${pages}쪽 사이로 골라 주세요.`;
  } else if (chars === null) {
    readout = (
      <>
        <b>{count}쪽</b>을 카드로 만들어요. 글자를 읽는 중…
      </>
    );
  } else {
    readout = chars ? (
      <>
        <b>{count}쪽</b>에서 글자 <b>{chars.toLocaleString("ko-KR")}자</b>를 읽었어요. AI 호출은 {Math.ceil(count / LIMITS.pagesPerChunk)}번이에요.
      </>
    ) : (
      <>
        <b>{count}쪽</b>에서 읽을 수 있는 글자가 없어요. 스캔 이미지면 쪽 그림을 그대로 AI에게 보내요.
      </>
    );
  }

  return (
    <div className="pane gutter">
      <div className="filebar">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden>
          <path d="M6 3h9l4 4v14H6z" />
          <path d="M14 3v5h5" />
        </svg>
        <div>
          <b>{name}</b>
          <small>전체 {pages}쪽</small>
        </div>
        <button className="icon-btn" onClick={props.onChangeFile} aria-label="다른 파일 고르기">
          ↺
        </button>
      </div>
      <h1>
        몇 쪽부터
        <br />
        몇 쪽까지 만들까요?
      </h1>
      <div className="range-nums">
        <label>
          시작 쪽
          <input type="number" min={1} max={pages} value={from} inputMode="numeric" onChange={(e) => setFrom(Number(e.target.value) || 0)} />
        </label>
        <span>~</span>
        <label>
          끝 쪽
          <input type="number" min={1} max={pages} value={to} inputMode="numeric" onChange={(e) => setTo(Number(e.target.value) || 0)} />
        </label>
      </div>
      <div className="pagebar" aria-label="쪽을 눌러 범위 지정">
        {bar.map((p, i) => (
          <button key={i} className={p >= from && p <= to ? "in" : ""} aria-label={`${p}쪽`} title={`${p}쪽`} onClick={() => clickPage(p)} />
        ))}
      </div>
      <div className="pagebar-cap">
        <span>1쪽</span>
        <span>{pages}쪽</span>
      </div>
      <div className="thumbs">
        <figure>
          <canvas ref={thA} />
          <figcaption>{from}쪽</figcaption>
        </figure>
        <figure>
          <canvas ref={thB} />
          <figcaption>{to}쪽</figcaption>
        </figure>
      </div>
      <p className="readout">{readout}</p>
      {valid && excerpt && <p className="excerpt">{excerpt}</p>}
    </div>
  );
}

function Making({ status }: { status: string }) {
  const steps = ["고른 쪽 글자 읽기", "핵심 개념 뽑기", "도식·그래프 그리기", "퀴즈와 해설 만들기"];
  const [k, setK] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setK((x) => Math.min(x + 1, steps.length - 1)), 2500);
    return () => clearInterval(t);
  }, [steps.length]);
  return (
    <div className="app">
      <section className="making gutter">
        <h1>
          숏폼 카드를
          <br />
          <em>만들고 있어요</em>
        </h1>
        {steps.map((s, i) => (
          <div key={s} className={`task ${i < k ? "done" : i === k ? "doing" : ""}`}>
            <i />
            {s}
          </div>
        ))}
        <p className="note">{status || "첫 카드가 나오면 바로 넘겨 볼 수 있어요."}</p>
      </section>
    </div>
  );
}

function Meters({ time, cost }: { time: number; cost: number }) {
  const m = (n: number) => (
    <div className="meter">
      {[0, 1, 2].map((i) => (
        <i key={i} className={i < n ? "f" : ""} />
      ))}
    </div>
  );
  return (
    <div className="meters">
      <span>만드는 시간</span>
      {m(time)}
      <span>비용</span>
      {m(cost)}
    </div>
  );
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden>
      <rect x="12" y="6" width="36" height="48" rx="7" fill="#fff" stroke="#1B1D3A" strokeWidth="3.5" />
      <path d="M20 20h20M20 28h20M20 36h12" stroke="#B9C3F5" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="46" cy="46" r="13" fill="#FFD43B" stroke="#1B1D3A" strokeWidth="3.5" />
      <path d="M46 52V40M41 45l5-5 5 5" fill="none" stroke="#1B1D3A" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
