// 시리즈 계획과 한 편의 브리프. 서버(대본 생성)와 브라우저(내장 시리즈 재생)가 같이 쓴다.
//
// 제작 순서: 기획 모델이 한 단원을 여러 편으로 나누고, 편마다 가장 쉬운 길과 시청자가 걸어갈 단계를 정한다 (계획).
// 대본 모델은 그 단계를 그림으로 옮기기만 한다 (대본). 그다음 엔진이 대본을 자동 점검하고(lint), 걸린 것이 있으면 한 번만 고친다.
import { lint, prep } from "./core";
import type { Issue, PlanStep, Script } from "./core";
import { parseScript, toText } from "./script";

export interface PlanShort {
  n: number;
  /** 편 제목 (시청자가 품을 질문) */
  title: string;
  /** 교재 용어 그대로의 개념 이름 (목록과 재생 화면에 제목 대신 보인다). 예: "원가계층" */
  concept: string;
  /** 이 편이 가르칠 생각 하나 */
  idea: string;
  /** 그림과 길: 어떤 그림 하나를 키워 가며 설명할지 */
  route: string;
  needs: string;
  /** 이 편이 끝나면 확정되는 것 (뒤 편이 설명 없이 쓸 수 있다) */
  gives: string;
  /** 자료의 쪽 범위. 예: "3-5" */
  src: string;
  steps: { q: string; idea: string }[];
  /** 영상 속 질문 한 줄 */
  ask: string;
}

export interface SeriesPlan {
  series: string;
  /** 시리즈를 다 보면 할 수 있게 되는 것 */
  after: string;
  /** 시리즈 내내 쓰는 예시 하나 */
  example: string;
  /** 시리즈의 숫자. "100=지금 주가; 120=오른 주가" */
  given: string;
  shorts: PlanShort[];
}

const PLAN_KEYS = new Set(["concept", "idea", "route", "needs", "gives", "src"]);

/** 기획 모델의 답(줄 표기)을 읽는다. 모르는 줄은 건너뛴다. */
export function parsePlan(text: string): SeriesPlan {
  const plan: SeriesPlan = { series: "", after: "", example: "", given: "", shorts: [] };
  for (const raw of String(text || "").replace(/\r/g, "").split("\n")) {
    const line = raw.trim();
    const sp = line.indexOf(" ");
    const word = (sp < 0 ? line : line.slice(0, sp)).toUpperCase();
    const rest = sp < 0 ? "" : line.slice(sp + 1).trim();
    const last = plan.shorts[plan.shorts.length - 1];
    if (word === "SERIES") plan.series = rest;
    else if (word === "AFTER") plan.after = rest;
    else if (word === "EXAMPLE") plan.example = rest;
    else if (word === "GIVEN") plan.given = rest;
    else if (word === "SHORT") {
      const parts = rest.split("|").map((x) => x.trim());
      const s: PlanShort = { n: parseInt(parts[0], 10) || plan.shorts.length + 1, title: parts[1] || "", concept: "", idea: "", route: "", needs: "", gives: "", src: "", steps: [], ask: "" };
      for (const p of parts.slice(2)) {
        const m = /^(concept|idea|route|needs|gives|src)\s*=\s*(.*)$/i.exec(p);
        const key = m ? m[1].toLowerCase() : "";
        if (m && PLAN_KEYS.has(key)) s[key as "concept" | "idea" | "route" | "needs" | "gives" | "src"] = m[2].trim();
      }
      plan.shorts.push(s);
    } else if (word === "STEP" && last) {
      const parts = rest.replace(/^\d+\s+/, "").split(/\s*=>\s*/);
      last.steps.push({ q: (parts[0] || "").trim(), idea: (parts[1] || "").trim() });
    } else if (word === "ASK" && last) last.ask = rest;
  }
  return plan;
}

/** 대본을 쓸 수 있을 만큼 채워진 편인가 */
export const isCompleteShort = (s: PlanShort): boolean => !!s.title && s.steps.length >= 3;

/** 덜 채워진 편을 빼고 번호를 다시 매긴 계획 (모델이 중간에 끊긴 경우 대비) */
export function usablePlan(plan: SeriesPlan): SeriesPlan {
  const shorts = plan.shorts.filter(isCompleteShort).map((s, i) => ({ ...s, n: i + 1 }));
  return { ...plan, shorts };
}

/** 계획을 다시 줄 표기로 쓴다 (parsePlan과 짝). 서버가 계획을 정리해서 돌려줄 때 쓴다. */
export function planToText(plan: SeriesPlan): string {
  const out = [`SERIES ${plan.series}`, `AFTER ${plan.after}`, `EXAMPLE ${plan.example}`];
  if (plan.given) out.push(`GIVEN ${plan.given}`);
  for (const s of plan.shorts) {
    const head = [`SHORT ${s.n}`, s.title];
    if (s.concept) head.push(`concept=${s.concept}`);
    head.push(`idea=${s.idea}`, `route=${s.route}`);
    if (s.needs) head.push(`needs=${s.needs}`);
    head.push(`gives=${s.gives}`);
    if (s.src) head.push(`src=${s.src}`);
    out.push("", head.join(" | "));
    s.steps.forEach((x, i) => out.push(`STEP ${i + 1} ${x.q} => ${x.idea}`));
    if (s.ask) out.push(`ASK ${s.ask}`);
  }
  return out.join("\n") + "\n";
}

export interface Brief {
  /** 대본 모델에게 주는 글 */
  user: string;
  steps: PlanStep[];
}

/** 계획의 k편(1부터)을 쓰는 대본 모델에게 줄 브리프. source는 그 편에 해당하는 자료 발췌(없어도 된다). */
export function briefOf(plan: SeriesPlan, k: number, source = ""): Brief {
  const s = plan.shorts[k - 1];
  const n = plan.shorts.length;
  const before = plan.shorts.slice(0, k - 1);
  const next = plan.shorts[k];
  const known = before.map((b) => `- ${b.n}편 "${b.title}": ${b.gives || b.idea}`).join("\n");
  let u = `시리즈: ${plan.series} (전체 ${n}편 가운데 ${k}편)\n시리즈 내내 쓰는 예시: ${plan.example}\n${plan.given ? `시리즈의 숫자: ${plan.given}\n` : ""}`;
  u += before.length ? `시청자가 앞 편에서 이미 배운 것:\n${known}\n` : "이 편이 시리즈의 첫 편입니다. 아무것도 모르는 상태에서 시작하세요.\n";
  u += `\n이번 편: "${s.title}"\n가르칠 생각: ${s.idea}\n그림과 길: ${s.route}\n이 편이 끝나면 확정될 것: ${s.gives}\n`;
  if (s.steps.length) u += `걸어갈 단계:\n${s.steps.map((x, i) => `STEP ${i + 1} ${x.q} => ${x.idea}`).join("\n")}\n`;
  if (s.ask) u += `ASK ${s.ask}\n`;
  u += next ? `다음 편: "${next.title}"\n` : "이 편이 마지막 편입니다.\n";
  if (source) u += `\n아래는 학생이 올린 자료에서 이 편에 해당하는 부분입니다. 사실, 용어, 공식을 확인할 때만 쓰고, 설명 순서는 위 단계를 따르세요.\n<자료>\n${source}\n</자료>\n`;
  return { user: u, steps: s.steps };
}

export interface GivenNumber {
  v: number;
  is: string;
}

/** 한 편이 계산 없이 보여도 되는 숫자: 시리즈의 숫자와 앞 편에서 확정된 값. 브리프 글에서 읽는다. */
export function seriesGiven(briefText: string): GivenNumber[] {
  const out: GivenNumber[] = [];
  const had = new Set<number>();
  const txt = String(briefText || "");
  const push = (v: number, is: string) => {
    if (had.has(v)) return;
    had.add(v);
    out.push({ v, is });
  };
  const m = /^시리즈의 숫자:\s*(.*)$/m.exec(txt);
  if (m) {
    for (const g of m[1].split(/\s*;\s*/)) {
      const eq = g.indexOf("=");
      const v = (eq < 0 ? g : g.slice(0, eq)).trim();
      if (/^-?\d+(\.\d+)?%?$/.test(v)) push(parseFloat(v), eq < 0 ? "" : g.slice(eq + 1).trim());
      if (/^\d+(\.\d+)?%$/.test(v)) push(parseFloat(v) / 100, "백분율 " + v); // 10% is also the 0.1 a calc multiplies by
    }
  }
  const a = txt.indexOf("시청자가 앞 편에서 이미 배운 것:");
  const b = txt.indexOf("\n이번 편:");
  if (a >= 0 && b > a) {
    for (const line of txt.slice(a, b).split("\n")) {
      const q = /^- \d+편 "[^"]*":\s*(.*)$/.exec(line.trim());
      // "40,000이면 10,000" and "−1,000": the comma groups digits and the minus belongs to the number
      if (q) for (const v of q[1].replace(/(\d),(?=\d{3})/g, "$1").match(/[−-]?\d+(?:\.\d+)?/g) || []) { const x = parseFloat(v.replace("−", "-")); push(x, "앞 편에서 나온 값"); push(Math.abs(x), "앞 편에서 나온 값"); }
    }
  }
  return out;
}

/** 읽은 대본에 제작 과정이 아는 것을 더한다: 계획한 단계(대본이 다시 적지 않았을 때)와 시리즈의 숫자. */
export function withBrief(sc: Script, steps: PlanStep[], given: GivenNumber[]): Script {
  if (steps.length && !(sc.plan && sc.plan.steps && sc.plan.steps.length)) sc.plan = { ...sc.plan, steps };
  if (given.length) {
    const mine = (sc.plan && sc.plan.given) || [];
    const have = new Set(mine.map((g) => String(g.v)));
    const more = given.filter((g) => !have.has(String(g.v)));
    if (more.length) sc.plan = { ...sc.plan, given: [...mine, ...more] };
  }
  return sc;
}

const dropFences = (text: string) =>
  String(text || "")
    .replace(/\r/g, "")
    .split("\n")
    .filter((l) => !/^\s*```/.test(l))
    .join("\n");

/** 모델의 답 → 대본 표기만 (코드 울타리와 TITLE 앞의 말은 버린다) */
export function cleanRaw(text: string): string {
  let t = dropFences(text);
  const i = t.search(/^TITLE\s/m);
  if (i > 0) t = t.slice(i);
  return t.trim() + "\n";
}

/** 고친 장면만 담긴 답 → 표기만 (첫 "#숫자" 줄 앞의 말은 버린다) */
export function cleanPatch(text: string): string {
  let t = dropFences(text);
  const i = t.search(/^#\d/m);
  if (i > 0) t = t.slice(i);
  return t.trim() + "\n";
}

/** 기획 모델의 답 → 계획 표기만 */
export function cleanPlan(text: string): string {
  let t = dropFences(text);
  const i = t.search(/^SERIES\s/m);
  if (i > 0) t = t.slice(i);
  return t.trim() + "\n";
}

export interface Checked {
  raw: string;
  script: Script;
  issues: Issue[];
  errs: Issue[];
  scenes: number;
  /** 재생 길이(초) */
  dur: number;
}

const finish = (raw: string, script: Script, syntax: Issue[]): Checked => {
  let issues = syntax.slice();
  let dur = 0;
  try {
    if (script.beats.length) {
      issues = issues.concat(lint(script));
      dur = prep(script).dur;
    }
  } catch (e) {
    issues.push({ level: "error", beat: 0, code: "parse", msg: "The script could not be checked: " + (e instanceof Error ? e.message : String(e)) });
  }
  return { raw, script, issues, errs: issues.filter((i) => i.level === "error"), scenes: script.beats.length, dur };
};

/** 대본 표기를 읽고 엔진의 자동 점검을 돌린다. 읽지 못해도 던지지 않고 오류 목록으로 돌려준다. */
export function checkScript(raw: string, brief: Brief | null): Checked {
  try {
    const p = parseScript(raw);
    const script = withBrief(p.script, brief ? brief.steps : [], brief ? seriesGiven(brief.user) : []);
    return finish(raw, script, p.issues);
  } catch (e) {
    const issue: Issue = { level: "error", beat: 0, code: "parse", msg: "The script could not be read: " + (e instanceof Error ? e.message : String(e)) };
    return { raw, script: { beats: [] }, issues: [issue], errs: [issue], scenes: 0, dur: 0 };
  }
}

// ---------- 한 번의 수리 ----------

/** 한 장면 안에서 끝나는 오류 (꼬리표 둘 자리가 없다, 글이 물체에 비해 길다): 그 장면만 다시 쓴다. 나머지는 전체를 다시 쓴다. */
export const LOCAL_ERRS = new Set(["cover", "fit"]);
export const isLocal = (errs: Issue[]): boolean => errs.length > 0 && errs.every((i) => LOCAL_ERRS.has(i.code));

export const errList = (errs: Issue[]): string => errs.map((i) => `- ${i.beat ? "장면 " + i.beat + ": " : ""}${i.msg}`).join("\n") || "- 없음";

/** 걸린 장면만 다시 쓰게 하는 요청 */
/** 고칠 때 보여 주는 대본. 모델이 쓴 글의 장면 번호가 1부터 차례대로면 그 글 그대로 보여 준다: 자기가 쓴 표기로 고치게 되고,
 *  엔진이 정한 자리(숫자,숫자)나 계획의 STEP 줄이 대본에 섞여 들어가지 않는다. 번호가 어긋나면 엔진이 다시 적은 글을 쓴다. */
const ownText = (script: Script, raw: string): string => {
  const own = String(raw || "").trim();
  if (!own) return toText(script);
  const labels = parseScript(own).labels, n = (script.beats || []).length;
  return labels.length === n && labels.every((l, i) => l === String(i + 1)) ? own : toText(script);
};
export const patchUser = (user: string, script: Script, errs: Issue[], raw = ""): string =>
  `${user}\n아래는 이 브리프로 쓴 대본입니다 (장면 번호는 1부터 순서대로).\n<대본>\n${ownText(script, raw)}\n</대본>\n\n자동 점검 오류 (모두 고쳐야 함):\n${errList(errs)}\n\n오류가 난 장면만 같은 표기로 다시 쓰세요. 전체를 다시 쓰지 않고, 설명이나 머리말 없이 표기 줄만 씁니다.\n- "#5 ..." 처럼 같은 번호로 쓰면 그 장면 전체가 새 내용으로 바뀝니다. 그 장면의 줄을 빠짐없이 다시 쓰고, 오류와 상관없는 줄은 그대로 둡니다.\n- 다른 장면이 쓰는 id는 그대로 남겨 두세요. 꼬리표나 화살표 이름을 없앴다면, 뒤 장면에서 그 id를 쓰는지 확인하고 쓰는 장면도 함께 다시 쓰세요.\n- 머리말 줄(TITLE, HOOK, CARD, GOAL, PICTURE, CAST, GRID, TIME, GIVEN, TERM, PART)과 END, QUIZ는 다시 쓰지 않습니다. 장면 줄에 자리(숫자,숫자)를 적지 않습니다.\n- 화면 맨 위 문장과 가르치는 내용은 바꾸지 않습니다. 자리가 없거나 글이 길어서 생긴 오류이니, 같은 말을 자리가 있는 방법으로 옮기기만 하세요.`;

/** 대본 전체를 다시 쓰게 하는 요청. lost는 처음 보는 학생이 막힌 곳(검수 단계를 켰을 때만 채워진다). */
export const rewriteUser = (user: string, raw1: string, errs: Issue[], lost = "- 없음"): string =>
  `${user}\n아래는 이 브리프로 처음 쓴 대본입니다.\n<대본>\n${raw1.trim()}\n</대본>\n\n자동 점검 오류 (모두 고쳐야 함):\n${errs.length ? errList(errs) : "- 대본이 끝까지 쓰이지 않았습니다. 장면을 6개 이상 10개 이하로 끝까지 쓰세요."}\n\n이 영상을 처음 본 학생이 막힌 곳 (화면에 보인 것만으로는 이해하지 못한 곳):\n${lost}\n\n같은 표기로 대본 전체를 처음부터 끝까지 다시 쓰세요. 설명이나 머리말 없이 표기만 씁니다. 잘된 장면은 그대로 두고, 막힌 곳은 문장만 바꾸지 말고 그 이유가 그림으로 보이게 고치세요: 숫자가 어디서 왔는지 보이게 하고(그 숫자를 가진 물체에서 날아오게), 한 장면에 생각이 둘이면 둘로 나누고, 물체 하나가 뜻을 바꾸지 않게 하세요. 장면은 10개 이하, 한 장면에 계산은 하나입니다.`;

// ---------- 학생이 올린 자료 ----------

export interface SourcePage {
  n: number;
  text: string;
}

/** 쪽 구분이 없는 글을 700자 안팎의 덩어리로 나눈다 (문단 끝에서 자른다). */
export function blocksOf(text: string): SourcePage[] {
  const out: string[] = [];
  let buf = "";
  for (const para of String(text || "").replace(/\r/g, "").split(/\n\s*\n/)) {
    if (buf && buf.length + para.length > 700) {
      out.push(buf.trim());
      buf = "";
    }
    buf += para + "\n\n";
  }
  if (buf.trim()) out.push(buf.trim());
  return out.map((t, i) => ({ n: i + 1, text: t }));
}

/** 쪽마다 [p.N] 표시를 붙인 글. 기획 모델이 편마다 src=쪽 범위를 적을 수 있게 한다. */
export const withMarks = (pages: SourcePage[]): string => pages.map((p) => `[p.${p.n}]\n${p.text}`).join("\n\n");

/** "3-5, 8" 같은 쪽 범위 → 쪽 번호 집합 */
export function pagesIn(src: string): Set<number> {
  const want = new Set<number>();
  for (const part of String(src || "").split(/[,\s]+/)) {
    const m = /^(\d+)(?:\s*[-~]\s*(\d+))?$/.exec(part.trim());
    if (!m) continue;
    // 거꾸로 적은 범위("45-12")도 같은 쪽으로 읽는다
    const a = Math.min(+m[1], +(m[2] || m[1]));
    const b = Math.min(Math.max(+m[1], +(m[2] || m[1])), a + 2000);
    for (let k = a; k <= b; k++) want.add(k);
  }
  return want;
}

/**
 * 기획 모델에 보낼 쪽 고르기: range("12-45, 50")가 있으면 그 쪽만, 그다음 앞에서부터 cap 글자에 들어가는 만큼.
 * text는 [p.N] 표시를 붙인 글, all은 범위 안에서 글자가 있는 쪽 수 (used가 이보다 적으면 다 담지 못한 것).
 */
export function pickPages(pages: SourcePage[], range: string, cap: number): { used: SourcePage[]; text: string; all: number } {
  const want = pagesIn(range);
  const sel = (want.size ? pages.filter((p) => want.has(p.n)) : pages).filter((p) => p.text);
  const used: SourcePage[] = [];
  let size = 0;
  for (const p of sel) {
    if (used.length && size + p.text.length > cap) break;
    used.push(p);
    size += p.text.length + 8;
  }
  return { used, text: withMarks(used).slice(0, cap), all: sel.length };
}

/** 한 편의 src가 가리키는 쪽만 골라 [p.N] 표시와 함께 돌려준다 (cap 글자까지). */
export function pickSource(pages: SourcePage[], src: string, cap = 7000): string {
  const want = pagesIn(src);
  return withMarks(pages.filter((p) => want.has(p.n))).slice(0, cap);
}

/** [p.N] 표시가 붙은 글을 다시 쪽으로 나눈다 (withMarks와 짝). */
export function pagesOfMarked(marked: string): SourcePage[] {
  const out: SourcePage[] = [];
  const re = /^\[p\.(\d+)\]\s*$/gm;
  let m: RegExpExecArray | null;
  let last: { n: number; at: number } | null = null;
  const text = String(marked || "");
  while ((m = re.exec(text))) {
    if (last) out.push({ n: last.n, text: text.slice(last.at, m.index).trim() });
    last = { n: +m[1], at: m.index + m[0].length };
  }
  if (last) out.push({ n: last.n, text: text.slice(last.at).trim() });
  return out.filter((p) => p.text);
}
