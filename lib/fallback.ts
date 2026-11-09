// AI 장면이 끝내 검사를 통과하지 못하거나 시간이 모자랄 때 쓰는 기본 텍스트 카드.
// AI를 다시 부르지 않고 개념 정보만으로 만든다 (서버·브라우저 같이 씀).
import type { Actor, Beat, Concept, Palette, Quiz, Scene } from "./schema";
import { clip, cleanStr } from "./text";

/** 정답이 늘 같은 자리에 있지 않게 보기 순서를 섞는다 */
export function shuffleQuiz(q: Quiz, rand = Math.random): Quiz {
  if (q.options.length !== 4) return q;
  const order = [0, 1, 2, 3];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return { ...q, options: order.map((i) => q.options[i]), answer: order.indexOf(q.answer) };
}

/* ------------------------------------------------------------------ */
/*  AI 없이 만드는 기본 텍스트 카드 (마지막 안전망)                       */
/* ------------------------------------------------------------------ */

const FALLBACK_PALETTES: Palette[] = ["blue", "teal", "violet", "green", "orange", "pink", "navy"];

export function fallbackScene(concept: Concept, others: { term: string; definition: string }[], index = 0): Scene {
  const points = concept.keyPoints.map((k) => cleanStr(k, 60)).filter(Boolean).slice(0, 3);
  const actors: Actor[] = [];
  const beats: Beat[] = [];
  const ys = points.length === 1 ? [50] : points.length === 2 ? [32, 68] : [18, 50, 82];
  points.forEach((p, i) => {
    actors.push({
      id: `p${i + 1}`,
      type: "pill",
      emoji: ["1️⃣", "2️⃣", "3️⃣"][i],
      label: clip(p, 15),
      x: 50,
      y: ys[i],
      w: 0,
      h: 0,
      size: "m",
      color: i === 0 ? "yellow" : "white",
      value: 0,
      hidden: true,
    });
    beats.push({ t: 0.3 + i * 1.1, do: "enter", a: `p${i + 1}`, b: "", x: 0, y: 0, text: "", emoji: "", value: 0, style: "left", d: 0, id: "" });
  });
  if (!actors.length) {
    actors.push({ id: "t", type: "pill", emoji: "💡", label: clip(concept.term, 14), x: 50, y: 50, w: 0, h: 0, size: "l", color: "yellow", value: 0, hidden: false });
    beats.push({ t: 0.4, do: "pulse", a: "t", b: "", x: 0, y: 0, text: "", emoji: "", value: 0, style: "", d: 0, id: "" });
  } else {
    beats.push({ t: 0.3 + points.length * 1.1, do: "glow", a: "p1", b: "", x: 0, y: 0, text: "", emoji: "", value: 0, style: "", d: 1.2, id: "" });
  }

  // 퀴즈: 이 개념의 정의를 다른 개념 정의들 사이에서 고르기
  const distract = others
    .filter((o) => o.term !== concept.term && o.definition && o.definition !== concept.definition)
    .map((o) => clip(cleanStr(o.definition, 80), 34));
  const fillers = ["여러 개념을 한데 묶은 이름", "특정 사례에만 쓰는 용어", "앞의 설명과 반대되는 개념"];
  const opts = Array.from(new Set([clip(concept.definition, 34), ...distract, ...fillers])).slice(0, 4);
  const quiz = shuffleQuiz({
    question: `'${concept.term}'을(를) 가장 잘 설명한 것은?`,
    options: opts,
    answer: 0,
    explanation: cleanStr(concept.explanation, 200) || concept.definition,
  });

  return {
    hook: clip(`${concept.term}, 한 줄로 말하면?`, 22),
    term: concept.term,
    definition: clip(concept.definition, 30),
    highlight: "",
    palette: FALLBACK_PALETTES[index % FALLBACK_PALETTES.length],
    actors,
    beats,
    captions: points.length ? [{ t: 0.2, text: "시험에 나오는 포인트" }] : [],
    quiz,
  };
}
