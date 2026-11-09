// AI가 쓴 JSON을 렌더러에 넣기 전에 검사하고, 고칠 수 있는 건 고친다.
// 고칠 수 없는 문제(severe)가 남으면 한 번 다시 요청하고, 그래도 안 되면 fallbackScene으로 대신한다.
import {
  ACTIONS,
  ACTOR_TYPES,
  COLORS,
  PALETTES,
  SIZES,
  STYLES,
  type Actor,
  type Beat,
  type Caption,
  type Concept,
  type Outline,
  type Quiz,
  type RenderMode,
  type Scene,
} from "../schema";
import { shuffleQuiz } from "../fallback";
import { cleanStr, clip, visualLength } from "../text";

export { visualLength };

const str = cleanStr;
const num = (v: unknown, lo: number, hi: number, dflt = 0) => {
  const n = typeof v === "number" && Number.isFinite(v) ? v : Number(v);
  if (!Number.isFinite(n)) return dflt;
  return Math.min(hi, Math.max(lo, n));
};
const pick = <T extends string>(v: unknown, list: readonly T[], dflt: T): T => (list.includes(v as T) ? (v as T) : dflt);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

let segmenter: Intl.Segmenter | null = null;
/** 이모지 칸에는 이모지 하나만 (글자 덩어리 첫 개) */
export function firstEmoji(v: unknown): string {
  const s = str(v, 40);
  if (!s) return "";
  try {
    segmenter ??= new Intl.Segmenter("ko", { granularity: "grapheme" });
    const first = segmenter.segment(s)[Symbol.iterator]().next().value?.segment ?? "";
    return /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(first) ? first : "";
  } catch {
    return Array.from(s)[0] ?? "";
  }
}

export const SCENE_RULES = {
  maxActors: 9,
  maxBeats: 18,
  maxCaptions: 5,
  hook: 22,
  definition: 30,
  label: 11,
  caption: 26,
  lastBeatAt: 11,
};

export interface CheckResult {
  scene: Scene;
  /** 고쳐서 넘어간 것 */
  issues: string[];
  /** 고칠 수 없어 다시 만들어야 하는 것 */
  severe: string[];
}

export function checkScene(raw: unknown, ctx: { term: string; mode: RenderMode }): CheckResult {
  const issues: string[] = [];
  const severe: string[] = [];
  const r = obj(raw);

  // ---------- text fields
  let term = str(r.term, 40);
  if (!term || term.replace(/\s/g, "") !== ctx.term.replace(/\s/g, "")) {
    if (term && term !== ctx.term) issues.push(`term을 "${ctx.term}"로 맞춤`);
    term = ctx.term;
  }
  let hook = str(r.hook, 80);
  if (visualLength(hook) > SCENE_RULES.hook + 6) {
    issues.push("hook이 너무 길어 줄임");
    hook = clip(hook, SCENE_RULES.hook + 4);
  }
  let definition = str(r.definition, 120);
  if (!definition) severe.push("definition이 비었음");
  if (visualLength(definition) > SCENE_RULES.definition + 8) {
    issues.push("definition이 너무 길어 줄임");
    definition = clip(definition, SCENE_RULES.definition + 6);
  }
  let highlight = str(r.highlight, 60);
  if (highlight && !definition.includes(highlight)) {
    // 띄어쓰기만 다르면 definition 쪽 표기로 맞추고, 아예 없으면 뺀다
    const chars = Array.from(highlight.replace(/\s/g, "")).map((ch) => ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const m = chars.length ? definition.match(new RegExp(chars.join("\\s*"))) : null;
    highlight = m ? m[0] : "";
    if (!m) issues.push("highlight가 definition 안에 없어 뺌");
  }
  const palette = pick(r.palette, PALETTES, "blue");

  // ---------- actors
  const ids = new Set<string>();
  const actors: Actor[] = [];
  for (const v of arr(r.actors)) {
    const a = obj(v);
    let id = str(a.id, 24).replace(/\s/g, "_") || `a${actors.length + 1}`;
    while (ids.has(id)) id = `${id}_${actors.length}`;
    const type = pick(a.type, ACTOR_TYPES, "card");
    let label = str(a.label, 40);
    if (visualLength(label) > SCENE_RULES.label + (type === "text" || type === "pill" ? 5 : 0)) {
      label = clip(label, SCENE_RULES.label + (type === "text" || type === "pill" ? 4 : 0));
      issues.push(`${id}: 라벨 줄임`);
    }
    const actor: Actor = {
      id,
      type,
      emoji: type === "card" || type === "circle" || type === "emoji" || type === "pill" ? firstEmoji(a.emoji) : "",
      label,
      x: num(a.x, 0, 100, 50),
      y: num(a.y, 0, 100, 50),
      w: type === "zone" ? num(a.w, 10, 100, 60) || 60 : 0,
      h: type === "zone" || type === "bar" ? num(a.h, 5, 100, type === "bar" ? 45 : 50) : 0,
      size: pick(a.size, SIZES, "m"),
      color: pick(a.color, COLORS, type === "pill" ? "navy" : "white"),
      value: type === "number" ? num(a.value, -1e9, 1e9, 0) : type === "bar" ? num(a.value, 0, 100, 0) : 0,
      hidden: a.hidden === true,
    };
    if (type === "emoji" && !actor.emoji) {
      if (!actor.label) continue;
      issues.push(`${id}: 이모지가 없어 글자 상자로 바꿈`);
      actor.type = "pill";
    }
    if ((type === "pill" || type === "text") && !actor.label) continue; // 빈 글자 상자는 버린다
    ids.add(id);
    actors.push(actor);
    if (actors.length >= SCENE_RULES.maxActors) break;
  }
  if (arr(r.actors).length > SCENE_RULES.maxActors) issues.push(`액터 ${SCENE_RULES.maxActors}개까지만 씀`);
  if (actors.length === 0) severe.push("actors가 없음");

  // ---------- beats
  const linkIds = new Set<string>();
  const beats: Beat[] = [];
  let dropped = 0;
  const rawBeats = arr(r.beats)
    .map(obj)
    .sort((p, q) => num(p.t, 0, 60) - num(q.t, 0, 60));
  for (const b of rawBeats) {
    const action = pick(b.do, ACTIONS, "pulse");
    if (!ACTIONS.includes(b.do as never)) {
      dropped++;
      continue;
    }
    const a = str(b.a, 24).replace(/\s/g, "_");
    const bb = str(b.b, 24).replace(/\s/g, "_");
    const beat: Beat = {
      t: Math.round(num(b.t, 0, SCENE_RULES.lastBeatAt) * 10) / 10,
      do: action,
      a,
      b: bb && ids.has(bb) ? bb : "",
      x: action === "move" ? num(b.x, 0, 100, 50) : 0,
      y: action === "move" ? num(b.y, 0, 100, 50) : 0,
      text: str(b.text, 40),
      emoji: firstEmoji(b.emoji),
      value: action === "grow" ? num(b.value, 0, 100, 100) : action === "count" ? num(b.value, -1e9, 1e9, 0) : 0,
      style: pick(b.style, STYLES, ""),
      d: Math.round(num(b.d, 0, 4) * 10) / 10,
      id: str(b.id, 24).replace(/\s/g, "_"),
    };
    // 없는 배우를 가리키는 비트는 버린다 (exit은 화살표 id도 가능)
    const target = ids.has(a) || (action === "exit" && linkIds.has(a));
    if (!target) {
      dropped++;
      continue;
    }
    if ((action === "send" || action === "link") && !beat.b) {
      dropped++;
      continue;
    }
    if (action === "link") {
      if (!beat.id) beat.id = `l${beats.length + 1}`;
      linkIds.add(beat.id);
    }
    if (action === "send" && !beat.text && !beat.emoji) beat.emoji = "✉️";
    beats.push(beat);
    if (beats.length >= SCENE_RULES.maxBeats) break;
  }
  if (dropped) issues.push(`잘못된 비트 ${dropped}개 뺌`);
  // 숨긴 배우는 enter 비트가 있어야 보인다
  for (const a of actors) {
    if (a.hidden && !beats.some((b) => b.do === "enter" && b.a === a.id)) {
      a.hidden = false;
      issues.push(`${a.id}: 등장 비트가 없어 처음부터 보이게 함`);
    }
  }
  const moving = beats.filter((b) => b.do !== "dim" && b.do !== "glow" && b.do !== "pulse").length;
  if (ctx.mode === "motion" && beats.length < 3) severe.push("모션인데 움직임(beats)이 3개보다 적음");
  else if (ctx.mode === "motion" && moving === 0) severe.push("모션인데 강조만 있고 움직임이 없음");

  // ---------- captions
  const captions: Caption[] = arr(r.captions)
    .map(obj)
    .map((c) => ({ t: Math.round(num(c.t, 0, SCENE_RULES.lastBeatAt + 1) * 10) / 10, text: str(c.text, 60) }))
    .filter((c) => c.text)
    .sort((p, q) => p.t - q.t)
    .slice(0, SCENE_RULES.maxCaptions)
    .map((c) => (visualLength(c.text) > SCENE_RULES.caption + 4 ? { ...c, text: clip(c.text, SCENE_RULES.caption + 3) } : c));

  // ---------- quiz
  const q = obj(r.quiz);
  const options = arr(q.options).map((o) => str(o, 80)).filter(Boolean);
  const unique = Array.from(new Set(options));
  const answer = Math.round(num(q.answer, 0, 3, 0));
  const quiz: Quiz = {
    question: str(q.question, 160),
    options: unique.slice(0, 4),
    answer,
    explanation: str(q.explanation, 240),
  };
  if (!quiz.question) severe.push("퀴즈 질문이 없음");
  if (unique.length < 4) severe.push("퀴즈 보기가 4개가 아니거나 겹침");
  else if (unique.length !== options.length || options.length > 4) {
    // 정답이 잘리거나 자리가 바뀌지 않았는지 확인
    const correct = options[answer];
    const at = quiz.options.indexOf(correct);
    if (at < 0) severe.push("퀴즈 정답 보기가 잘림");
    else quiz.answer = at;
  }

  const scene: Scene = { hook, term, definition, highlight, palette, actors, beats, captions, quiz };
  if (!severe.length) scene.quiz = shuffleQuiz(scene.quiz);
  return { scene, issues, severe };
}

/* ------------------------------------------------------------------ */
/*  개념 뽑기 결과 검사                                                 */
/* ------------------------------------------------------------------ */

export function normTerm(s: string): string {
  return s
    .toLowerCase()
    .replace(/\([^)]*\)|（[^）]*）/g, "")
    .replace(/[\s·・\-_'"`.,:;!?/\\[\]{}]/g, "");
}

export function checkConcepts(raw: unknown): { outline: Outline; issues: string[] } {
  const issues: string[] = [];
  const r = obj(raw);
  const concepts: Concept[] = [];
  for (const v of arr(r.concepts)) {
    const c = obj(v);
    const term = str(c.term, 40);
    const definition = str(c.definition, 160);
    if (!term || !definition) {
      issues.push("이름이나 정의가 빈 개념을 뺌");
      continue;
    }
    concepts.push({
      term,
      definition,
      explanation: str(c.explanation, 900),
      keyPoints: arr(c.keyPoints)
        .map((k) => str(k, 120))
        .filter(Boolean)
        .slice(0, 5),
      example: str(c.example, 400),
      visual: str(c.visual, 400),
      pages: str(c.pages, 30),
    });
  }
  return {
    outline: {
      deckTitle: str(r.deckTitle, 60),
      subject: str(r.subject, 40),
      language: str(r.language, 10) || "ko",
      concepts,
    },
    issues,
  };
}

/** 조각별 결과를 순서대로 합치고, 이름이 겹치는 개념은 하나만 남긴다 */
export function mergeConcepts(groups: { concepts: Concept[]; quota: number }[], count: number): Concept[] {
  const seen = new Set<string>();
  const main: Concept[] = [];
  const extra: Concept[] = [];
  for (const g of groups) {
    g.concepts.forEach((c, i) => {
      const k = normTerm(c.term);
      if (!k || seen.has(k)) return;
      seen.add(k);
      (i < g.quota ? main : extra).push(c);
    });
  }
  const out = main.slice(0, count);
  for (const c of extra) {
    if (out.length >= count) break;
    out.push(c);
  }
  return out;
}
