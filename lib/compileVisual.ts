import type { Cue, SfxKind } from "@/motion/timeline";
import { FPS } from "@/motion/timeline";
import type { TextShort, Visual, VisualPlan } from "./visual";

/* ------------------------------------------------------------------ */
/*  compileVisual: 카드 칸(CardFill) → 템플릿 모션 시간표                 */
/*                                                                    */
/*  AI를 다시 부르지 않는다. 텍스트 숏츠와 같은 칸으로                     */
/*    훅(2초) → 그림이 단계별로 등장 + 자막 → 핵심 강조 → 개념 이름 쾅      */
/*  순서의 10~15초 영상을 만든다. 그리기는 motion/VisualDraw.tsx가,        */
/*  재생은 motion/TemplateScene.tsx(Remotion)가 한다.                    */
/*  단계 번호는 VisualDraw의 그리기 함수와 1:1로 맞춘다.                  */
/* ------------------------------------------------------------------ */

export type StepKind = "pop" | "draw" | "slide" | "drop" | "slam" | "grow" | "fade" | "rise";

export interface StepDef {
  /** 이 단계가 시작될 때 띄울 자막. ""이면 앞 자막을 이어서 둔다 */
  caption: string;
  kind: StepKind;
  /** 자막이 없을 때 머무는 시간(초) */
  base: number;
  /** true면 이 단계에서 앞 자막을 내린다(그림 속 글자가 설명을 대신할 때) */
  clear?: boolean;
}

export interface VisualTimeline {
  /** 그림이 시작되는 시각(초). 그 전은 훅 */
  d0: number;
  steps: { t: number; d: number; caption: string; kind: StepKind; clear: boolean }[];
  /** 핵심 강조 시작(초). null이면 강조 없음 */
  em: number | null;
  emCaption: string;
  /** 개념 이름이 쾅 나오는 시각(초) */
  termAt: number;
  /** 전체 길이(프레임) */
  total: number;
  /** 프레임 단위 자막 */
  captions: { f0: number; f1: number; text: string }[];
  /** 프레임 단위 효과음 */
  cues: Cue[];
}

const len = (s: string) => Array.from(s ?? "").length;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** 받침 여부: 한글은 종성, 숫자·영문은 읽는 소리로. 끝 괄호(영문 병기)는 떼고 본다 */
function hasBatchim(word: string): boolean | null {
  const w = word.replace(/\s*\([^)]*\)\s*$/, "").trim();
  const ch = Array.from(w).pop() ?? "";
  const c = ch.codePointAt(0) ?? 0;
  if (c >= 0xac00 && c <= 0xd7a3) return (c - 0xac00) % 28 !== 0;
  if (/[0-9]/.test(ch)) return "013678".includes(ch);
  if (/[a-zA-Z]/.test(ch)) return "lmnrLMNR".includes(ch);
  return null;
}
/** josa("4P", "는", "은") → "4P는" (받침 있으면 withB, 없으면 withoutB) */
export function josa(word: string, withB: string, withoutB: string) {
  const b = hasBatchim(word);
  return word + (b === null ? withoutB : b ? withB : withoutB);
}

/** 그림 틀마다 등장 단계와 단계별 자막 */
export function visualSteps(v: Visual): StepDef[] {
  const say = (it: { label: string; sub?: string }) => (it.sub ? it.sub : it.label);
  switch (v.type) {
    case "flow":
      return v.steps.slice(0, 5).map((s) => ({ caption: say(s), kind: "pop", base: 0.8 }));
    case "exchange":
      return [
        { caption: `${v.left.label} ↔ ${v.right.label}`, kind: "slide", base: 0.9 },
        ...v.messages.slice(0, 4).map(() => ({ caption: "", kind: "draw" as const, base: 1.05, clear: true })),
      ];
    case "versus":
      return [
        { caption: say(v.a), kind: "slide", base: 0.8 },
        { caption: say(v.b), kind: "slide", base: 0.8 },
        { caption: "", kind: "slam", base: 0.55, clear: true },
        ...v.rows.slice(0, 3).map(() => ({ caption: "", kind: "rise" as const, base: 0.95 })),
      ];
    case "chart": {
      const names = v.series
        .slice(0, 2)
        .map((s) => s.name)
        .filter(Boolean)
        .join("·");
      return [
        { caption: names && v.xLabel ? `${v.xLabel}에 따른 ${names}` : names || v.yLabel, kind: "fade", base: 0.8 },
        ...v.categories.slice(0, 6).map(() => ({ caption: "", kind: (v.kind === "bar" ? "grow" : "draw") as StepKind, base: 0.62 })),
      ];
    }
    case "cycle":
      return [
        ...v.nodes.slice(0, 5).map((n) => ({ caption: say(n), kind: "pop" as const, base: 0.75 })),
        { caption: v.center || "다시 처음으로", kind: "draw", base: 1.0 },
      ];
    case "tree": {
      const k = v.children.slice(0, 4).length;
      return [
        { caption: v.root.sub || `${josa(v.root.label, "은", "는")} ${k}가지`, kind: "pop", base: 0.8 },
        { caption: "", kind: "draw", base: 0.4 },
        ...v.children.slice(0, 4).map((c) => ({ caption: say(c), kind: "drop" as const, base: 0.8 })),
      ];
    }
    case "matrix": {
      const s: StepDef[] = [
        { caption: `가로 ${v.x.name} · 세로 ${v.y.name}`, kind: "draw", base: 1.0 },
        ...v.items.slice(0, 5).map(() => ({ caption: "", kind: "drop" as const, base: 0.55 })),
      ];
      if (v.gap?.label) s.push({ caption: `빈 자리: ${v.gap.label}`, kind: "pop", base: 1.0 });
      return s;
    }
    case "formula": {
      const s: StepDef[] = [
        { caption: `${josa(v.result, "은", "는")}?`, kind: "pop", base: 0.8 },
        ...v.terms.slice(0, 3).map((t) => ({ caption: t.note ? `${t.text}: ${t.note}` : t.text, kind: "pop" as const, base: 0.8 })),
      ];
      if (v.example) s.push({ caption: "", kind: "rise", base: 1.5 });
      return s;
    }
    case "chain": {
      const links = v.links.slice(0, 4);
      return links.map((l, i) => ({
        caption: l.sub ? l.sub : i === 0 ? l.label : i === links.length - 1 ? `결국 ${l.label}` : `그래서 ${l.label}`,
        kind: "pop" as const,
        base: 0.8,
      }));
    }
    case "parts":
      return [
        { caption: `${josa(v.whole, "을", "를")} 나누면`, kind: "pop", base: 0.8 },
        ...v.parts.slice(0, 5).map(() => ({ caption: "", kind: "pop" as const, base: 0.6 })),
      ];
    case "timeline":
      return [
        { caption: "", kind: "draw", base: 0.6 },
        ...v.events.slice(0, 5).map((e) => ({ caption: `${e.when} ${e.label}`, kind: "pop" as const, base: 0.75 })),
      ];
    case "analogy": {
      const s: StepDef[] = [
        { caption: `${josa(v.thing.label, "은", "는")}?`, kind: "pop", base: 0.8 },
        { caption: `마치 ${v.like.label}처럼`, kind: "slide", base: 0.9 },
      ];
      if (v.because) s.push({ caption: "", kind: "rise", base: 1.3 });
      return s;
    }
  }
}

/** 강조할 그림 요소가 있는지 (핵심 하나가 커지고 나머지가 흐려짐) */
function hasEmphasisTarget(v: Visual): boolean {
  switch (v.type) {
    case "flow":
      return v.focus >= 0 && v.focus < v.steps.length;
    case "timeline":
      return v.focus >= 0 && v.focus < v.events.length;
    case "parts":
      return v.focus >= 0 && v.focus < v.parts.length;
    case "matrix":
      return (v.focus >= 0 && v.focus < v.items.length) || !!v.gap?.label;
    case "chart":
      return (v.focus >= 0 && v.focus < v.categories.length) || !!v.note;
    case "chain":
    case "formula":
      return true;
    case "analogy":
      return !!v.because;
    case "cycle":
      return !!v.center;
    default:
      return false;
  }
}

function fallbackEmCaption(v: Visual): string {
  if (v.type === "chart") return v.note;
  if (v.type === "parts" && v.focus >= 0 && v.parts[v.focus]) return `${josa(v.parts[v.focus].label, "이", "가")} ${v.parts[v.focus].value}%`;
  if (v.type === "analogy") return v.because;
  return "";
}

const SFX: Record<StepKind, SfxKind | null> = {
  pop: "pop",
  draw: "draw",
  slide: "whoosh",
  drop: "boop",
  slam: "boop",
  grow: "rise",
  fade: null,
  rise: "tick",
};

const HOOK_SECONDS = 2.0;
const TERM_HOLD = 3.7;

export function compileVisual(short: TextShort, plan?: Partial<VisualPlan> | null): VisualTimeline {
  const v = short.visual;
  const defs = visualSteps(v);
  const hasHook = !!short.hook?.trim();
  const d0 = hasHook ? HOOK_SECONDS : 0.4;
  let t = d0 + 0.2;
  const steps = defs.map((s) => {
    const d = s.caption ? clamp(0.7 + 0.065 * len(s.caption), 0.95, 1.9) : s.base;
    const out = { t, d, caption: s.caption, kind: s.kind, clear: !!s.clear };
    t += d;
    return out;
  });
  const emCaption = (plan?.focus ?? "").trim() || fallbackEmCaption(v);
  const target = hasEmphasisTarget(v);
  let em: number | null = null;
  if (target || emCaption) {
    em = t;
    t += emCaption ? clamp(0.9 + 0.065 * len(emCaption), 1.3, 2.3) : 1.0;
  }
  const termAt = t + 0.15;
  const total = Math.round((termAt + TERM_HOLD) * FPS);
  const fr = (s: number) => Math.round(s * FPS);

  // 자막: 자막 있는 단계부터 다음 자막(또는 강조·개념 이름) 전까지
  const marks: { t: number; text: string }[] = steps.filter((s) => s.caption || s.clear).map((s) => ({ t: s.t, text: s.caption }));
  if (em != null) marks.push({ t: em, text: emCaption });
  const captions = marks
    .map((m, i) => ({
      f0: fr(m.t),
      f1: i + 1 < marks.length ? fr(marks[i + 1].t) : fr(termAt) - 2,
      text: m.text,
    }))
    .filter((c) => c.text);

  const cues: Cue[] = [];
  if (hasHook) cues.push({ f: 3, kind: "hook" });
  steps.forEach((s) => {
    const k = SFX[s.kind];
    if (k) cues.push({ f: fr(s.t), kind: k });
  });
  if (em != null) cues.push({ f: fr(em), kind: v.type === "matrix" && v.gap?.label ? "sparkle" : "ding" });
  cues.push({ f: fr(termAt), kind: "impact" });
  if (short.highlight) cues.push({ f: fr(termAt) + 20, kind: "swish" });
  cues.sort((a, b) => a.f - b.f);
  const deduped: Cue[] = [];
  for (const c of cues) {
    if (c.f >= total) continue;
    const last = [...deduped].reverse().find((d) => d.kind === c.kind);
    if (last && c.f - last.f < 4) continue;
    deduped.push(c);
  }

  return { d0, steps, em, emCaption, termAt, total, captions, cues: deduped };
}

const cache = new WeakMap<object, Map<string, VisualTimeline>>();
/** 같은 카드면 다시 계산하지 않는다 */
export function getTimeline(short: TextShort, plan?: Partial<VisualPlan> | null): VisualTimeline {
  const key = plan?.focus ?? "";
  let m = cache.get(short);
  if (!m) {
    m = new Map();
    cache.set(short, m);
  }
  let tl = m.get(key);
  if (!tl) {
    tl = compileVisual(short, plan);
    m.set(key, tl);
  }
  return tl;
}
