import type { Card, CardKind, Motion, Quiz, RenderMode, Visual } from "./types";

// AI 응답은 스키마를 따르지만, 화면이 깨지지 않도록 한 번 더 다듬는다.
const KINDS: CardKind[] = ["hook", "concept", "quiz", "summary"];

const str = (v: unknown, max = 400) => (typeof v === "string" ? v.slice(0, max) : "");
const strArr = (v: unknown, n: number, max = 120) =>
  Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, n).map((x) => x.slice(0, max)) : [];

function visual(v: unknown): Visual | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const type = str(o.type, 20) as Visual["type"];
  if (!type || type === "none") return null;
  const items = Array.isArray(o.items)
    ? o.items.slice(0, 6).map((it) => {
        const i = (it ?? {}) as Record<string, unknown>;
        return {
          label: str(i.label, 40),
          value: typeof i.value === "number" && Number.isFinite(i.value) ? i.value : null,
          note: typeof i.note === "string" ? i.note.slice(0, 80) : null,
        };
      })
    : [];
  if (items.length === 0) return null;
  if ((type === "bar" || type === "pie") && items.some((i) => i.value === null)) return null;
  return { type, title: typeof o.title === "string" ? o.title.slice(0, 40) : null, items };
}

function quiz(v: unknown): Quiz | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const choices = strArr(o.choices, 4, 80);
  const answer = Number(o.answer);
  if (choices.length < 2 || !Number.isInteger(answer) || answer < 0 || answer >= choices.length) return null;
  return { question: str(o.question, 200), choices, answer, explanation: str(o.explanation, 300) };
}

function motion(v: unknown): Motion | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const beats = Array.isArray(o.beats)
    ? o.beats.slice(0, 4).map((b) => {
        const x = (b ?? {}) as Record<string, unknown>;
        const effect = ["pop", "slide", "type", "zoom", "highlight"].includes(String(x.effect))
          ? (x.effect as Motion["beats"][number]["effect"])
          : "pop";
        return { text: str(x.text, 40), effect };
      })
    : [];
  if (beats.length === 0) return null;
  return { beats, narration: str(o.narration, 160) };
}

export function sanitizeCards(raw: unknown[], mode: RenderMode, chunkIndex: number): Card[] {
  if (!Array.isArray(raw)) return [];
  const out: Card[] = [];
  raw.slice(0, 10).forEach((r, i) => {
    const o = (r ?? {}) as Record<string, unknown>;
    let kind = (KINDS.includes(o.kind as CardKind) ? o.kind : "concept") as CardKind;
    const q = quiz(o.quiz);
    if (kind === "quiz" && !q) kind = "concept";
    out.push({
      id: `c${chunkIndex}-${i}-${Math.random().toString(36).slice(2, 7)}`,
      kind,
      emoji: str(o.emoji, 8) || "📘",
      title: str(o.title, 60),
      body: str(o.body, 300),
      points: strArr(o.points, 3),
      visual: kind === "quiz" ? null : visual(o.visual),
      quiz: kind === "quiz" ? q : null,
      motion: mode === "motion" && kind !== "quiz" ? motion(o.motion) : null,
      pages: typeof o.pages === "string" ? o.pages.slice(0, 20) : null,
    });
  });
  return out;
}
