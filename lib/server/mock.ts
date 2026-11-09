// MOCK_AI=1 일 때: AI를 부르지 않고 화면 흐름만 시험한다 (키 없이 E2E 테스트용).
import { fallbackScene } from "../fallback";
import { SAMPLE_DECK } from "../samples";
import type { Concept, Outline, OutlineRequest, SceneRequest, SceneResult } from "../schema";
import { clip } from "../text";
import { checkScene } from "./checks";
import { zeroUsage } from "./claude";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function mockOutline(req: OutlineRequest & { count: number }, onFound: (terms: string[]) => void): Promise<Outline> {
  const concepts: Concept[] = [];
  // 쪽마다 첫 줄을 개념 이름처럼 쓴다
  for (const p of req.pages) {
    const lines = p.text.split(/\n+/).map((l) => l.trim()).filter((l) => l.length >= 2);
    if (!lines.length) continue;
    const term = clip(lines[0], 12);
    if (concepts.some((c) => c.term === term)) continue;
    concepts.push({
      term,
      definition: clip(lines[1] ?? `${term}의 뜻`, 26),
      explanation: clip(lines.slice(1, 4).join(" ") || `${term}에 대한 설명`, 200),
      keyPoints: lines.slice(1, 4).map((l) => clip(l, 30)),
      example: "",
      visual: "",
      pages: `p.${p.n}`,
    });
    if (concepts.length >= req.count) break;
  }
  for (const c of SAMPLE_DECK.cards) {
    if (concepts.length >= req.count) break;
    concepts.push({ ...c.concept, pages: req.images.length ? "사진 1" : c.concept.pages });
  }
  for (let i = 1; i <= concepts.length; i++) {
    await wait(250);
    onFound(concepts.slice(0, i).map((c) => c.term));
  }
  return { deckTitle: req.name.replace(/\.[^.]+$/, ""), subject: "테스트", language: "ko", concepts };
}

export async function mockScene(req: SceneRequest): Promise<{ result: SceneResult; usage: ReturnType<typeof zeroUsage> }> {
  await wait(500 + Math.random() * 1200);
  const sample = SAMPLE_DECK.cards.find((c) => c.concept.term === req.concept.term)?.scene;
  if (sample) {
    const chk = checkScene(sample, { term: req.concept.term, mode: req.mode ?? "text" });
    return { result: { scene: chk.scene, fallback: false, issues: chk.issues }, usage: zeroUsage() };
  }
  return { result: { scene: fallbackScene(req.concept, req.others ?? [], req.index), fallback: true, issues: ["mock"] }, usage: zeroUsage() };
}
