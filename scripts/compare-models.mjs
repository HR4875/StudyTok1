// 세 모델 × 두 형식(텍스트/모션)으로 같은 자료를 생성해 결과를 저장한다.
// 사용법: ANTHROPIC_API_KEY 를 넣고 `npm run dev` 를 띄운 뒤
//   node scripts/compare-models.mjs [기본주소=http://localhost:3000] [자료.txt]
// 결과: scripts/out/compare-<시각>.json, .md  (AI 사용 명세표·검증 장표 근거 자료)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const base = process.argv[2] ?? "http://localhost:3000";
const textFile = process.argv[3];
const text = textFile
  ? readFileSync(textFile, "utf8").slice(0, 12000)
  : `[p.1]
수요의 법칙: 다른 조건이 일정할 때 어떤 재화의 가격이 상승하면 그 재화의 수요량은 감소하고, 가격이 하락하면 수요량은 증가한다. 따라서 수요곡선은 우하향한다.
공급의 법칙: 다른 조건이 일정할 때 가격이 상승하면 공급량은 증가한다. 공급곡선은 우상향한다.
[p.2]
시장균형: 수요량과 공급량이 일치하는 가격을 균형가격, 그때의 거래량을 균형거래량이라 한다. 가격이 균형가격보다 높으면 초과공급이, 낮으면 초과수요가 발생한다.`;

const models = ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"];
const modes = ["text", "motion"];
const rows = [];

for (const mode of modes) {
  for (const model of models) {
    process.stdout.write(`${model} / ${mode} … `);
    const res = await fetch(`${base}/api/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, pageLabel: "p.1-2", mode, model, chunkIndex: 0, chunkCount: 1, docTitle: "모델 비교" }),
    });
    const json = await res.json();
    if (!res.ok) {
      console.log("실패", json.error);
      rows.push({ model, mode, error: json.error });
      continue;
    }
    const cards = json.cards;
    const row = {
      model,
      mode,
      cards: cards.length,
      quizzes: cards.filter((c) => c.kind === "quiz").length,
      visuals: cards.filter((c) => c.visual).length,
      motions: cards.filter((c) => c.motion).length,
      seconds: +(json.usage.ms / 1000).toFixed(1),
      inputTokens: json.usage.inputTokens,
      outputTokens: json.usage.outputTokens,
      costUsd: +json.usage.costUsd.toFixed(5),
      deck: json,
    };
    console.log(`${row.cards}장 ${row.seconds}s $${row.costUsd}`);
    rows.push(row);
  }
}

mkdirSync("scripts/out", { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
writeFileSync(`scripts/out/compare-${stamp}.json`, JSON.stringify(rows, null, 2));
const md = [
  "| 모델 | 형식 | 카드 | 퀴즈 | 도식 | 모션 | 시간(s) | 입력 | 출력 | 비용($) |",
  "|---|---|---|---|---|---|---|---|---|---|",
  ...rows.map((r) =>
    r.error
      ? `| ${r.model} | ${r.mode} | 실패: ${r.error} |||||||| `
      : `| ${r.model} | ${r.mode} | ${r.cards} | ${r.quizzes} | ${r.visuals} | ${r.motions} | ${r.seconds} | ${r.inputTokens} | ${r.outputTokens} | ${r.costUsd} |`,
  ),
].join("\n");
writeFileSync(`scripts/out/compare-${stamp}.md`, md + "\n");
console.log("\n" + md);
