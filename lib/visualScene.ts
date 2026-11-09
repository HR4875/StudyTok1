// 임시 변환기: 그림 틀 칸(CardFill) → 모션 장면(Scene).
// 디자인 스레드의 compileVisual()이 오면 그걸로 바꾼다. 그 전까지 텍스트 숏츠 카드를 화면에 띄우는 용도라
// 틀마다 모양을 단순하게(세로 목록·막대·2축 지도) 잡는다. AI 호출 없음.
import type { Actor, Beat, Caption, Concept, Scene } from "./schema";
import { clip } from "./text";
import type { CardFill, Visual } from "./visual";

const actor = (id: string, type: Actor["type"], x: number, y: number, o: Partial<Actor> = {}): Actor => ({
  id,
  type,
  emoji: "",
  label: "",
  x,
  y,
  w: 0,
  h: 0,
  size: "m",
  color: "white",
  value: 0,
  hidden: false,
  ...o,
});
const beat = (t: number, action: Beat["do"], a: string, o: Partial<Beat> = {}): Beat => ({
  t: Math.round(t * 10) / 10,
  do: action,
  a,
  b: "",
  x: 0,
  y: 0,
  text: "",
  emoji: "",
  value: 0,
  style: "",
  d: 0,
  id: "",
  ...o,
});

type Item = { emoji: string; label: string; sub?: string };

function items(v: Visual): { list: Item[]; linked: boolean; focus: number } {
  switch (v.type) {
    case "flow":
      return { list: v.steps, linked: true, focus: v.focus };
    case "chain":
      return { list: v.links, linked: true, focus: v.links.length - 1 };
    case "cycle":
      return { list: v.nodes, linked: true, focus: -1 };
    case "timeline":
      return { list: v.events.map((e) => ({ emoji: e.emoji, label: `${e.when} ${e.label}` })), linked: true, focus: v.focus };
    case "tree":
      return { list: [v.root, ...v.children], linked: false, focus: -1 };
    case "versus":
      return { list: [v.a, v.b], linked: false, focus: -1 };
    case "exchange":
      return { list: [v.left, v.right], linked: false, focus: -1 };
    case "analogy":
      return { list: [v.thing, v.like], linked: false, focus: 1 };
    case "formula":
      return { list: [{ emoji: "🟰", label: v.result }, ...v.terms.map((t) => ({ emoji: "", label: t.text, sub: t.note }))], linked: false, focus: 0 };
    default:
      return { list: [], linked: false, focus: -1 };
  }
}

export function sceneFromFill(concept: Pick<Concept, "term" | "definition" | "plan">, fill: CardFill): Scene {
  const v = fill.visual;
  const actors: Actor[] = [];
  const beats: Beat[] = [];
  const captions: Caption[] = [];
  let t = 0.3;

  if (v.type === "chart" || v.type === "parts") {
    // 막대 그래프 (첫 계열 / 비율)
    const bars =
      v.type === "chart"
        ? v.categories.map((c, i) => ({ label: c, value: v.series[0]?.values[i] ?? 0 }))
        : v.parts.map((p) => ({ label: `${p.emoji}${p.label}`, value: p.value }));
    const max = Math.max(1, ...bars.map((b) => Math.abs(b.value)));
    const n = bars.length;
    bars.forEach((b, i) => {
      const id = `b${i}`;
      actors.push(actor(id, "bar", n === 1 ? 50 : 12 + (76 * i) / (n - 1), 92, { label: clip(b.label, 7), h: 62, value: 0, color: i === v.focus ? "yellow" : "blue", size: n > 4 ? "s" : "m" }));
      beats.push(beat(t + i * 0.45, "grow", id, { value: Math.max(4, Math.round((Math.abs(b.value) / max) * 100)), d: 0.8 }));
    });
    t += n * 0.45 + 0.8;
    if (v.focus >= 0 && v.focus < n) beats.push(beat(t, "glow", `b${v.focus}`, { d: 1.4 }));
    const note = v.type === "chart" ? v.note : "";
    captions.push({ t: 0.2, text: clip(v.type === "chart" ? `${v.series[0]?.name ?? ""} ${v.xLabel ? `· ${v.xLabel}` : ""}`.trim() || "그래프로 보면" : `${v.whole} 비중`, 22) });
    if (note) captions.push({ t, text: clip(note, 22) });
  } else if (v.type === "matrix") {
    actors.push(actor("map", "zone", 50, 50, { w: 92, h: 92, label: `${v.y.name} ↑ · ${v.x.name} →` }));
    v.items.forEach((it, i) => {
      const id = `s${i}`;
      actors.push(actor(id, "emoji", 8 + it.x * 0.84, 92 - it.y * 0.84, { emoji: it.emoji || "📍", label: clip(it.label, 6), size: "s", hidden: true }));
      beats.push(beat(t + i * 0.5, "enter", id, { style: "pop" }));
    });
    t += v.items.length * 0.5 + 0.4;
    if (v.focus >= 0 && v.focus < v.items.length) beats.push(beat(t, "pulse", `s${v.focus}`));
    if (v.gap.label) {
      actors.push(actor("gap", "pill", 8 + v.gap.x * 0.84, 92 - v.gap.y * 0.84, { emoji: v.gap.emoji || "✨", label: clip(v.gap.label, 8), color: "yellow", hidden: true }));
      beats.push(beat(t + 0.6, "enter", "gap", { style: "drop" }), beat(t + 1.1, "glow", "gap", { d: 1.4 }));
    }
    captions.push({ t: 0.2, text: clip(`${v.x.low}↔${v.x.high} · ${v.y.low}↔${v.y.high}`, 22) });
  } else {
    // 세로 목록: 단계·연쇄·순환·분류·비교·주고받기·비유·공식
    const { list, linked, focus } = items(v);
    const shown = list.slice(0, 5);
    const n = shown.length;
    const ys = n <= 1 ? [50] : shown.map((_, i) => 8 + (84 * i) / (n - 1));
    const side = v.type === "versus" || v.type === "exchange" || v.type === "analogy";
    shown.forEach((it, i) => {
      const id = `i${i}`;
      const x = side ? (i === 0 ? 24 : 76) : 50;
      const y = side ? 40 : ys[i];
      actors.push(
        side
          ? actor(id, "card", x, y, { emoji: it.emoji || "💡", label: clip(it.label, 8), size: "m", hidden: true, color: i === focus ? "yellow" : "white" })
          : actor(id, "pill", x, y, { emoji: it.emoji, label: clip(it.label, 10), hidden: true, color: i === focus ? "yellow" : i === 0 && v.type === "tree" ? "navy" : "white" }),
      );
      beats.push(beat(t, "enter", id, { style: side ? (i === 0 ? "left" : "right") : "up" }));
      if (linked && i > 0) beats.push(beat(t + 0.2, "link", `i${i - 1}`, { b: id, style: "arrow", id: `l${i}`, d: 0.4 }));
      if (v.type === "tree" && i > 0) beats.push(beat(t + 0.2, "link", "i0", { b: id, style: "line", id: `l${i}`, d: 0.4 }));
      if (it.sub) captions.push({ t, text: clip(`${it.label} · ${it.sub}`, 24) });
      t += 0.8;
    });
    if (v.type === "cycle" && n > 2) beats.push(beat(t, "link", `i${n - 1}`, { b: "i0", style: "arrow", id: "lc", d: 0.5 }));
    if (v.type === "versus") {
      v.rows.forEach((r, i) => captions.push({ t: t + i * 1.1, text: clip(`${r.name}: ${r.a} vs ${r.b}`, 26) }));
      t += v.rows.length * 1.1;
    }
    if (v.type === "exchange") {
      v.messages.forEach((m, i) => {
        const [a, b] = m.from === "left" ? ["i0", "i1"] : ["i1", "i0"];
        beats.push(beat(t + i * 1.1, "send", a, { b, style: m.from === "left" ? "bubble" : "answer", text: clip(m.text, 14), d: 0.9 }));
      });
      t += v.messages.length * 1.1;
    }
    if (v.type === "analogy") {
      beats.push(beat(t, "link", "i0", { b: "i1", style: "both", id: "eq", text: "≈", d: 0.5 }));
      captions.push({ t, text: clip(v.because, 22) });
      t += 0.8;
    }
    if (v.type === "formula" && v.example) {
      captions.push({ t, text: clip(v.example, 26) });
      t += 0.8;
    }
    if (focus >= 0 && focus < n) beats.push(beat(t, "glow", `i${focus}`, { d: 1.4 }));
  }

  const focusNote = concept.plan?.focus;
  if (focusNote && captions.length < 4) captions.push({ t: Math.max(t, (captions[captions.length - 1]?.t ?? 0) + 1.2), text: clip(focusNote, 24) });
  captions.sort((a, b) => a.t - b.t);

  return {
    hook: fill.hook,
    term: concept.term,
    definition: concept.definition,
    highlight: concept.definition.includes(fill.highlight) ? fill.highlight : "",
    palette: fill.palette,
    actors,
    beats: beats.sort((a, b) => a.t - b.t),
    captions: captions.slice(0, 5),
    quiz: fill.quiz,
  };
}
