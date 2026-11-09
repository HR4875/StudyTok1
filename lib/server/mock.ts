// MOCK_AI=1 일 때: AI를 부르지 않고 화면 흐름만 시험한다 (키 없이 E2E 테스트용, 로컬 전용).
// 디자인 스레드의 실제 생성 결과(scripts/fixtures)가 있으면 그걸 돌려준다.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fallbackScene } from "../fallback";
import { SAMPLE_DECK } from "../samples";
import type { CardResult, Concept, Outline, OutlineRequest, SceneRequest, SceneResult } from "../schema";
import { clip } from "../text";
import { checkFill } from "./card";
import { checkConcepts, checkScene } from "./checks";
import { zeroUsage } from "./claude";
import { applyPlanRules, parsePlan } from "./plan";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
function fixture<T>(name: string): T | null {
  try {
    return JSON.parse(readFileSync(join(process.cwd(), "scripts/fixtures", name), "utf8")) as T;
  } catch {
    return null;
  }
}

export async function mockOutline(req: OutlineRequest & { count: number }, onFound: (terms: string[]) => void): Promise<Outline> {
  const text = req.pages.map((p) => p.text).join("\n");
  const director = fixture<unknown>("director.json");
  let concepts: Concept[] = [];
  if (director) {
    const { outline } = checkConcepts(director);
    if (outline.concepts.some((c) => text.includes(c.term.split("(")[0].trim()))) concepts = outline.concepts.slice(0, req.count);
  }
  if (!concepts.length) {
    // 쪽마다 첫 줄을 개념 이름처럼 쓴다
    for (const p of req.pages) {
      const lines = p.text.split(/\n+/).map((l) => l.trim()).filter((l) => l.length >= 2);
      if (!lines.length) continue;
      const term = clip(lines[0], 12);
      if (concepts.some((c) => c.term === term)) continue;
      const keyPoints = lines.slice(1, 4).map((l) => clip(l, 24));
      concepts.push({
        term,
        definition: clip(lines[1] ?? `${term}의 뜻`, 26),
        explanation: clip(lines.slice(1, 4).join(" ") || `${term}에 대한 설명`, 200),
        keyPoints,
        example: "",
        visual: "",
        pages: `p.${p.n}`,
        plan: parsePlan({ kind: "process", template: "flow" }, { term, keyPoints }),
      });
      if (concepts.length >= req.count) break;
    }
  }
  for (const c of SAMPLE_DECK.cards) {
    if (concepts.length >= req.count) break;
    concepts.push({ ...c.concept, plan: parsePlan(null, c.concept) });
  }
  concepts = applyPlanRules(concepts).concepts;
  for (let i = 1; i <= concepts.length; i++) {
    await wait(200);
    onFound(concepts.slice(0, i).map((c) => c.term));
  }
  return { deckTitle: (director as { deckTitle?: string } | null)?.deckTitle ?? req.name.replace(/\.[^.]+$/, ""), subject: "테스트", language: "ko", concepts };
}

export async function mockCard(req: SceneRequest): Promise<{ result: CardResult; usage: ReturnType<typeof zeroUsage> }> {
  await wait(400 + Math.random() * 900);
  const director = fixture<{ concepts: { term: string }[] }>("director.json");
  const i = director?.concepts.findIndex((c) => c.term === req.concept.term) ?? -1;
  const raw = i >= 0 ? fixture<Record<string, unknown>>(`text-${i + 1}.json`) : null;
  const template = req.concept.plan?.template ?? "flow";
  if (raw) {
    const visual = raw.visual as { type: typeof template };
    const chk = checkFill({ ...raw }, visual.type, req.concept);
    if (chk.fill) return { result: { template: visual.type, fill: chk.fill, fallback: false, issues: chk.warnings }, usage: zeroUsage() };
  }
  // 고정 결과가 없으면 시험 포인트로 단계 틀을 채운다
  const steps = (req.concept.keyPoints.length >= 3 ? req.concept.keyPoints : [req.concept.term, ...req.concept.keyPoints, "정리"]).slice(0, 4);
  const fake = {
    hook: clip(`${req.concept.term}, 왜 중요할까?`, 22),
    highlight: req.concept.definition.split(" ").slice(-2).join(" "),
    palette: (["blue", "teal", "violet", "green", "orange", "pink"] as const)[req.index % 6],
    visual: { type: "flow", steps: steps.map((s, j) => ({ emoji: ["1️⃣", "2️⃣", "3️⃣", "4️⃣"][j], label: clip(s, 8), sub: "" })), focus: 1 },
    quiz: {
      question: `'${req.concept.term}'의 설명으로 맞는 것은?`,
      options: [clip(req.concept.definition, 30), "반대로 설명한 것", "다른 개념의 설명", "관계없는 설명"],
      answer: 0,
      explanation: clip(req.concept.explanation || req.concept.definition, 60),
    },
  };
  const chk = checkFill(fake, "flow", req.concept);
  if (chk.fill) return { result: { template: "flow", fill: chk.fill, fallback: false, issues: ["mock"] }, usage: zeroUsage() };
  return { result: { template, fill: null, fallback: true, issues: chk.errors, scene: fallbackScene(req.concept, req.others ?? [], req.index) }, usage: zeroUsage() };
}

export async function mockScene(req: SceneRequest): Promise<{ result: SceneResult; usage: ReturnType<typeof zeroUsage> }> {
  await wait(500 + Math.random() * 1200);
  const director = fixture<{ concepts: { term: string }[] }>("director.json");
  const i = director?.concepts.findIndex((c) => c.term === req.concept.term) ?? -1;
  const fromFixture = i >= 0 ? fixture<unknown>(`motion-${i + 1}.json`) : null;
  const sample = fromFixture ?? SAMPLE_DECK.cards.find((c) => c.concept.term === req.concept.term)?.scene;
  if (sample) {
    const chk = checkScene(sample, { term: req.concept.term, mode: req.mode ?? "motion" });
    if (!chk.severe.length) return { result: { scene: chk.scene, fallback: false, issues: chk.issues }, usage: zeroUsage() };
  }
  return { result: { scene: fallbackScene(req.concept, req.others ?? [], req.index), fallback: true, issues: ["mock"] }, usage: zeroUsage() };
}
