// 스타일A 설계도 검사 (서버·브라우저 공용). 엔진이 그릴 수 있는 모양인지만 가볍게 본다.
import type { StyleASpec } from "./schema";

export const STYLEA_TYPES = [
  "hook", "define", "end", "flow", "compare", "bars", "number", "grid", "formula", "chat", "list", "cycle", "quadrant", "scale", "stack",
  "picture", "dots", "narrow", "transfer", "slots", "exchange", "curve", "balance", "problem", "table", "solve",
] as const;

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown) => typeof v === "string" && v.trim().length > 0;
const list = (v: unknown, min = 1) => Array.isArray(v) && v.length >= min;

/** 장면 type별로 없으면 못 그리는 칸 */
const NEED: Record<string, (s: Record<string, unknown>) => string | null> = {
  hook: (s) => (list(s.lines) || str(s.text) ? null : "lines"),
  define: (s) => (str(s.term) && str(s.desc) ? null : "term, desc"),
  end: (s) => (str(s.takeaway) ? null : "takeaway"),
  problem: (s) => (str(s.text) ? null : "text"),
  solve: (s) => (list(s.steps) && str(s.answer) ? null : "steps, answer"),
  table: (s) => (list(s.cols) ? null : "cols"),
  dots: (s) => (list(s.groups) ? null : "groups"),
  bars: (s) => (list(s.items, 2) ? null : "items"),
  number: (s) => (s.value !== undefined && s.value !== "" ? null : "value"),
  curve: (s) => (str(s.shape) ? null : "shape"),
};

/** JSON 문자열 또는 객체 → 설계도. 못 읽으면 null */
export function parseSpec(raw: unknown): StyleASpec | null {
  let v = raw;
  if (typeof v === "string") {
    try {
      v = JSON.parse(v.trim().replace(/^```(?:json)?\s*|\s*```$/g, ""));
    } catch {
      return null;
    }
  }
  if (!isObj(v) || !Array.isArray(v.scenes)) return null;
  return v as unknown as StyleASpec;
}

/** 고쳐 달라고 돌려보낼 문제 목록. 비어 있으면 통과 */
export function checkSpec(spec: StyleASpec, kind: "concept" | "solution"): string[] {
  const errors: string[] = [];
  const sc = spec.scenes;
  if (!Array.isArray(sc) || sc.length < 3 || sc.length > 10) return [`scenes는 3~10개여야 함 (지금 ${Array.isArray(sc) ? sc.length : 0}개)`];
  sc.forEach((s, i) => {
    if (!isObj(s) || !str(s.type)) return errors.push(`scenes[${i}]: type이 없음`);
    const type = s.type as string;
    if (!(STYLEA_TYPES as readonly string[]).includes(type)) return errors.push(`scenes[${i}]: 없는 type "${type}"`);
    const miss = NEED[type]?.(s);
    if (miss) errors.push(`scenes[${i}] ${type}: ${miss} 칸이 필요함`);
  });
  if (errors.length) return errors;
  const first = sc[0].type;
  const last = sc[sc.length - 1].type;
  if (kind === "concept" && first !== "hook") errors.push("개념 영상의 첫 장면은 hook");
  if (kind === "solution" && first !== "problem") errors.push("풀이 영상의 첫 장면은 problem");
  if (last !== "end") errors.push("마지막 장면은 end");
  if (kind === "solution" && !sc.some((s) => s.type === "solve")) errors.push("풀이 영상에는 solve 장면이 필요함");
  return errors;
}
