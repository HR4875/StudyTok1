// MOCK_AI=1 일 때: AI를 부르지 않고 화면 흐름만 시험한다 (키 없이 E2E 테스트용, 로컬 전용).
// 디자인 스레드가 시험용 마케팅 강의 자료로 실제 생성한 결과(lib/samples-marketing.ts)를 돌려준다.
import { checkOutline } from "../assemble";
import { fallbackScene } from "../fallback";
import { SAMPLE_DECK } from "../samples";
import { MKT_FILLS, MKT_FREE, MKT_OUTLINE } from "../samples-marketing";
import type { CardResult, Concept, Outline, OutlineRequest, SceneRequest, SceneResult } from "../schema";
import { clip } from "../text";
import { checkCard, plannedConcept } from "./card";
import { checkScene } from "./checks";
import { zeroUsage } from "./claude";
import { parsePlan } from "./plan";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const MKT = checkOutline(MKT_OUTLINE, 12);
const mktIndex = (term: string) => MKT.concepts.findIndex((c) => c.term === term);

export async function mockOutline(req: OutlineRequest & { count: number }, onFound: (terms: string[]) => void): Promise<Outline> {
  const text = req.pages.map((p) => p.text).join("\n");
  const fromMkt = MKT.concepts.some((c) => text.includes(c.term.split("(")[0].trim()));
  const raw: Concept[] = fromMkt ? MKT.concepts.slice(0, req.count) : [];
  if (!raw.length) {
    // 쪽마다 첫 줄을 개념 이름처럼 쓴다
    for (const p of req.pages) {
      const lines = p.text.split(/\n+/).map((l) => l.trim()).filter((l) => l.length >= 2);
      if (!lines.length) continue;
      const term = clip(lines[0], 12);
      if (raw.some((c) => c.term === term)) continue;
      const keyPoints = lines.slice(1, 4).map((l) => clip(l, 24));
      raw.push({
        term,
        definition: clip(lines[1] ?? `${term}의 뜻`, 26),
        explanation: clip(lines.slice(1, 4).join(" ") || `${term}에 대한 설명`, 200),
        keyPoints,
        example: "",
        visual: "",
        pages: `p.${p.n}`,
        plan: parsePlan({ kind: "process", template: "flow" }, { term, keyPoints }),
      });
      if (raw.length >= req.count) break;
    }
  }
  for (const c of SAMPLE_DECK.cards) {
    if (raw.length >= req.count) break;
    raw.push({ ...c.concept, plan: parsePlan(null, c.concept) });
  }
  const { concepts } = checkOutline({ concepts: raw }, req.count);
  for (let i = 1; i <= concepts.length; i++) {
    await wait(200);
    onFound(concepts.slice(0, i).map((c) => c.term));
  }
  return {
    deckTitle: (fromMkt && MKT.deckTitle) || req.name.replace(/\.[^.]+$/, ""),
    subject: (fromMkt && MKT.subject) || "테스트",
    language: "ko",
    concepts,
  };
}

export async function mockCard(req: SceneRequest): Promise<{ result: CardResult; usage: ReturnType<typeof zeroUsage> }> {
  await wait(400 + Math.random() * 900);
  const concept = plannedConcept(req.concept);
  const i = mktIndex(req.concept.term);
  if (i >= 0 && MKT_FILLS[i]) {
    const chk = checkCard(MKT_FILLS[i], concept);
    if (chk.short) return { result: { template: concept.plan.template, short: chk.short, fallback: false, issues: chk.warnings }, usage: zeroUsage() };
  }
  // 고정 결과가 없으면 시험 포인트로 단계 틀을 채운다
  const flow = { ...concept, plan: { ...concept.plan, template: "flow" as const } };
  const steps = (concept.keyPoints.length >= 3 ? concept.keyPoints : [concept.term, ...concept.keyPoints, "정리"]).slice(0, 4);
  const fake = {
    hook: clip(`${concept.term}, 왜 중요할까?`, 22),
    highlight: concept.definition.split(" ").slice(-2).join(" "),
    palette: (["blue", "teal", "violet", "green", "orange", "pink"] as const)[req.index % 6],
    visual: { type: "flow", steps: steps.map((s, j) => ({ emoji: ["1️⃣", "2️⃣", "3️⃣", "4️⃣"][j], label: clip(s, 8), sub: "" })), focus: 1 },
    quiz: {
      question: `'${concept.term}'의 설명으로 맞는 것은?`,
      options: [clip(concept.definition, 30), "반대로 설명한 것", "다른 개념의 설명", "관계없는 설명"],
      answer: 0,
      explanation: clip(concept.explanation || concept.definition, 60),
    },
  };
  const chk = checkCard(fake, flow);
  if (chk.short) return { result: { template: "flow", short: chk.short, fallback: false, issues: ["mock"] }, usage: zeroUsage() };
  return {
    result: { template: concept.plan.template, short: null, fallback: true, issues: chk.errors, scene: fallbackScene(req.concept, req.others ?? [], req.index) },
    usage: zeroUsage(),
  };
}

export async function mockScene(req: SceneRequest): Promise<{ result: SceneResult; usage: ReturnType<typeof zeroUsage> }> {
  await wait(500 + Math.random() * 1200);
  const i = mktIndex(req.concept.term);
  const sample = (i >= 0 ? MKT_FREE[i] : null) ?? SAMPLE_DECK.cards.find((c) => c.concept.term === req.concept.term)?.scene;
  if (sample) {
    const chk = checkScene(sample, { term: req.concept.term, mode: req.mode ?? "motion" });
    if (!chk.severe.length) return { result: { scene: chk.scene, fallback: false, issues: chk.issues }, usage: zeroUsage() };
  }
  return { result: { scene: fallbackScene(req.concept, req.others ?? [], req.index), fallback: true, issues: ["mock"] }, usage: zeroUsage() };
}
