"use client";
import { useState } from "react";
import CardView from "@/components/CardView";
import { callGenerate } from "@/lib/generate";
import { MODELS } from "@/lib/models";
import type { GenerateResponse, RenderMode } from "@/lib/types";

// 같은 자료를 세 모델로 동시에 만들어 품질·속도·비용을 나란히 비교하는 페이지 (발표 '검증' 장표용)
const SAMPLE_TEXT = `[p.1]
수요의 법칙: 다른 조건이 일정할 때 어떤 재화의 가격이 상승하면 그 재화의 수요량은 감소하고, 가격이 하락하면 수요량은 증가한다. 따라서 수요곡선은 우하향한다.
공급의 법칙: 다른 조건이 일정할 때 가격이 상승하면 공급량은 증가한다. 공급곡선은 우상향한다.
[p.2]
시장균형: 수요량과 공급량이 일치하는 가격을 균형가격, 그때의 거래량을 균형거래량이라 한다. 가격이 균형가격보다 높으면 초과공급이, 낮으면 초과수요가 발생하며 가격은 균형으로 조정된다.
수요의 변화와 수요량의 변화: 가격 변화에 따른 움직임은 수요곡선 위의 이동(수요량의 변화)이고, 소득·선호·관련 재화의 가격·미래 예상 등 가격 외 요인의 변화는 수요곡선 자체의 이동(수요의 변화)이다.`;

interface Result {
  state: "idle" | "loading" | "done" | "error";
  res?: GenerateResponse;
  error?: string;
}

export default function Lab() {
  const [text, setText] = useState(SAMPLE_TEXT);
  const [mode, setMode] = useState<RenderMode>("text");
  const [results, setResults] = useState<Record<string, Result>>({});

  async function run() {
    setResults(Object.fromEntries(MODELS.map((m) => [m.id, { state: "loading" }])));
    await Promise.all(
      MODELS.map(async (m) => {
        try {
          const res = await callGenerate({
            text,
            pageLabel: "p.1-2",
            mode,
            model: m.id,
            chunkIndex: 0,
            chunkCount: 1,
            docTitle: "모델 비교",
          });
          setResults((r) => ({ ...r, [m.id]: { state: "done", res } }));
        } catch (e) {
          setResults((r) => ({ ...r, [m.id]: { state: "error", error: e instanceof Error ? e.message : "오류" } }));
        }
      }),
    );
  }

  const busy = Object.values(results).some((r) => r.state === "loading");

  return (
    <main className="lab">
      <a href="/">← StudyTok</a>
      <h1>모델 비교 실험실</h1>
      <p className="muted">
        같은 자료를 Opus 5.5 · Sonnet 5.5 · Haiku 5.5 로 동시에 만들어 카드 품질, 걸린 시간, 비용을 비교해요. 모두 effort
        medium. 한 번 실행에 AI 호출 3회가 쓰여요.
      </p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} />
      <div className="row">
        <div className="seg">
          <button className={mode === "text" ? "on" : ""} onClick={() => setMode("text")}>
            텍스트 숏츠
          </button>
          <button className={mode === "motion" ? "on" : ""} onClick={() => setMode("motion")}>
            모션그래픽
          </button>
        </div>
        <button className="btn btn-primary" style={{ width: "auto" }} disabled={busy || !text.trim()} onClick={run}>
          {busy ? "생성 중…" : "세 모델로 만들기"}
        </button>
      </div>

      <div className="lab-grid">
        {MODELS.map((m) => {
          const r = results[m.id];
          return (
            <section className="lab-col" key={m.id}>
              <h3>{m.label}</h3>
              {!r && <p className="muted">아직 실행 전</p>}
              {r?.state === "loading" && <div className="spinner" />}
              {r?.state === "error" && <p className="error">{r.error}</p>}
              {r?.state === "done" && r.res && (
                <>
                  <p className="lab-stats">
                    카드 {r.res.cards.length}장 · 퀴즈 {r.res.cards.filter((c) => c.kind === "quiz").length}개 · 도식{" "}
                    {r.res.cards.filter((c) => c.visual).length}개
                    <br />
                    {(r.res.usage.ms / 1000).toFixed(1)}초 · 입력 {r.res.usage.inputTokens} / 출력 {r.res.usage.outputTokens} 토큰 · $
                    {r.res.usage.costUsd.toFixed(4)}
                  </p>
                  <div className="lab-cards">
                    {r.res.cards.map((c) => (
                      <div className="lab-card" key={c.id}>
                        <CardView card={c} mode={mode} active chosen={undefined} onAnswer={() => {}} />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}
