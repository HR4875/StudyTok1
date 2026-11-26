// Director 2 core: turns a scene script into a timeline, answers "what is on screen at time t",
// checks a script before anyone sees it, and describes each scene in plain words for a reviewer.
// No DOM here, so the server and the browser share it.
import { clamp, lerp, E, dict } from "./ease";
import { ICONS, ICON_KO } from "./icons";

export const W = 1080, H = 1920;
export const LEAD = 0.3, TAIL = 0.9, TWEEN = 0.55;
/** Design F opens every film with its title as kinetic type (HOOK film seconds, one chunk per half second) and closes it with a card (CARD). */
export const HOOK = 2.0, CARD = 2.6;
/** Where pictures may sit: the sentence owns the top of the stage, the app's controls the bottom. */
export const ZONE = { x0: 36, x1: 1044, y0: 500, y1: 1800 };
/** While a question is on screen its answer buttons own everything below this line. */
export const ASK_Y = 1290;
/** The part of the screen the camera keeps the picture in (the sentence sits above it). */
export const FRAME = { y0: 560, y1: 1790 };
/** The grid: a row holds one thing (M), two (L R) or three (A B C). */
export const COLS: Record<string, number> = dict({ A: 200, B: 540, C: 880, L: 290, R: 790, M: 540 });
export const ROWS = [640, 890, 1140, 1390, 1640];

export type Props = Record<string, any>;
export interface Action extends Props { op?: string; id?: string; type?: string; at?: number }
export interface Ask { q?: string; choices: string[]; answer: number; why?: string }
export interface Beat { dur?: number; say?: string; step?: number; hard?: boolean; cam?: { x?: number; y?: number; zoom?: number }; focus?: string[]; do?: Action[]; ask?: Ask }
export interface PlanStep { q?: string; idea?: string; why?: string; show?: string; new?: { v: number | string; from?: string }[]; hard?: boolean }
export interface Plan {
  viewer?: string; goal?: string; known?: string[]; route?: string; needs?: string; picture?: string; grid?: string;
  given?: { v: number | string; is?: string }[]; steps?: PlanStep[]; terms?: { t: string; plain?: string }[]; trap?: string;
  part?: { n: number; of: number; next?: string };
}
export interface Quiz { q: string; choices: string[]; answer: number; why?: string }
/** hook: the 3 or 4 chunks of type that open the film; card: the end card (big title, highlighted part, rest); time: the stage labels of a picture
 *  that runs left to right over a time axis; vname: the name of its vertical axis. All four are optional. */
export interface Script { title?: string; skin?: string; speed?: number; plan?: Plan; beats: Beat[]; quiz?: Quiz[]; takeaway?: string; hook?: string[]; card?: string[]; time?: string[]; vname?: string }

export interface MObj { id: string; type: string; tAdd: number; tDel: number; keys: { t: number; p: Props }[]; pulses: number[]; order: number; beat: number; auto?: boolean }
export interface Send { from: string; to: string; icon?: string; str?: string; color?: string; t0: number; dur: number; i: number }
export interface AskM { i: number; n: number; t0: number; hold: number; t1: number; ask: Ask }
export interface Cue extends Props { k: string }
export interface BeatM { t0: number; dur: number; b: Beat; i: number }
export interface Model {
  script: Script; speed: number; beats: BeatM[]; objs: Map<string, MObj>; list: MObj[];
  cams: { t: number; c: { x: number; y: number; zoom: number } }[];
  says: { t0: number; t1: number; text: string; i: number }[];
  cues: Cue[]; sends: Send[]; focus: { t0: number; t1: number; ids: Set<string>; i: number }[]; asks: AskM[];
  /** length on the script's own clock, and length as played (divided by the speed) */
  DUR: number; dur: number; warn: string[];
  /** ids that had no seat and were placed by the engine */
  seated: string[];
  /** the title as kinetic type before scene 1 (len 0: none), and the end card after the last scene, on the script's clock */
  hook: { t0: number; len: number; chunks: string[] };
  end: { t0: number; len: number };
}
export interface Issue { level: "error" | "warn"; beat: number; code: string; msg: string }

export const TYPES = ["node", "box", "text", "num", "bar", "icon", "arrow", "line", "brace", "calc", "note", "plot", "dot", "table", "sign", "scale", "dots", "axis"];
// The time axis ("axis", added by the parser for a TIME line) is the floor of the picture, not a thing in it: it is in none of the sets below,
// so it never counts as a thing on screen, never overlaps anything and is never seated. Only the camera's whole-picture box, the calculation
// line and the tags look at it, through axisBox().
const SOLID = new Set(["node", "box", "text", "num", "icon", "bar", "calc", "plot", "table", "scale", "dots"]);
const PLACED = new Set(["node", "box", "text", "num", "bar", "icon", "plot", "table", "scale", "dots"]);
const NUMK = ["x", "y", "w", "h", "r", "size", "value", "x2", "y2", "opacity", "frac", "px", "py", "show", "scale", "tilt", "hi", "hi2"];
/** the size of a grid of dots */
export function dotsDims(p: Props) {
  const n = Math.max(1, Math.min(400, Math.round(Number(p.n) || 100))), cols = Number(p.cols) || (n <= 10 ? n : n <= 100 ? 10 : 20), d = Number(p.size) || (cols <= 10 ? 44 : 30), pitch = d * 1.3, rows = Math.ceil(n / cols);
  return { n, cols, d, pitch, rows, w: cols * pitch - d * 0.3, h: rows * pitch - d * 0.3 };
}
/** how far a tall thing hangs below the top of its row: its centre is this far under the row's top edge */
export function hangOf(type: string, p: Props): number | null {
  if (type === "plot") return (Number(p.h) || 560) / 2;
  if (type === "table") return tableDims(p).h / 2;
  if (type === "scale") return 110;
  if (type === "dots") return dotsDims(p).h / 2;
  return null;
}

// ---------- numbers and text ----------
export function fmtV(v: number, dec?: number): string {
  if (!isFinite(v)) return String(v);
  let s: string;
  if (dec != null) s = v.toFixed(dec);
  else if (Math.abs(v - Math.round(v)) < 1e-9) s = String(Math.round(v));
  else s = String(+v.toFixed(4));
  const [a, b] = s.split(".");
  return a.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (b ? "." + b : "");
}
export const sayChars = (s?: string) => String(s || "").replace(/[*\s]/g, "").length;
/** Numbers that only name or order something (3년째, 제14조, 3월 31일, 2024년, 2단계) are not quantities: nobody has to see where they come from. */
const LABEL_RE = /제\s*\d+\s*(?:조|항|호|장|절|편|과|차|회|기|강)?|\d+\s*(?:번째|년째|일째|회째|째|단계|위|편|호|차|학년|교시|쪽|페이지|주차|년차|세기|등(?!분))|(?:1\d{3}|20\d{2})\s*년(?!\s*(?:뒤|후|간|동안|치|마다|째))(?:\s*\d{1,2}\s*월)?(?:\s*\d{1,2}\s*일)?|\d{1,2}\s*월\s*\d{1,2}\s*일|\d{1,2}\s*월(?!\s*(?:간|동안|치))|[①-⑳]|\b(?:step|no\.?|ch\.?|part|p\.)\s*\d+/gi;
export const quantitiesIn = (s: unknown): number[] => (typeof s === "string" ? numsIn(s.replace(LABEL_RE, " ")) : numsIn(s));
const NUM_RE = /\d[\d,]*(?:\.\d+)?/g;
export function numsIn(s: unknown): number[] {
  if (s == null) return [];
  if (typeof s === "number") return isFinite(s) ? [Math.abs(s)] : [];
  return (String(s).match(NUM_RE) || []).map((x) => parseFloat(x.replace(/,/g, ""))).filter((x) => isFinite(x));
}
const HANGUL = (c: number) => (c >= 0x1100 && c <= 0x11ff) || (c >= 0x2e80 && c <= 0x9fff) || (c >= 0xac00 && c <= 0xd7a3) || (c >= 0xf900 && c <= 0xfaff) || (c >= 0xff00 && c <= 0xffef);
/** rough width of bold Korean text, good enough to catch overflow before drawing */
export function approxW(str: unknown, size: number): number {
  let w = 0;
  for (const ch of String(str ?? "")) {
    const c = ch.codePointAt(0) || 0;
    w += HANGUL(c) ? 0.93 : ch === " " ? 0.27 : /[0-9]/.test(ch) ? 0.6 : /[A-Z]/.test(ch) ? 0.68 : /[a-z]/.test(ch) ? 0.56 : /[.,:;!'"|]/.test(ch) ? 0.3 : 0.62;
  }
  return w * size;
}

// ---------- calc terms ----------
export interface Term { kind: "num" | "op" | "txt"; v?: number; text: string; from?: string; color?: string }
const OPS: Record<string, string> = dict({ "+": "+", "-": "−", "−": "−", "–": "−", "*": "×", x: "×", X: "×", "×": "×", "/": "÷", "÷": "÷", "=": "=", "(": "(", ")": ")", "≈": "≈" });
export function normTerms(p: Props): Term[] {
  const out: Term[] = [];
  for (const raw of Array.isArray(p.terms) ? p.terms : []) {
    if (raw == null) continue;
    if (typeof raw === "number") { out.push({ kind: "num", v: raw, text: (p.pre || "") + fmtV(raw, p.dec) + (p.suf || "") }); continue; }
    if (typeof raw === "string") {
      const s = raw.trim();
      if (OPS[s]) out.push({ kind: "op", text: OPS[s] });
      else if (/^-?[\d,]+(\.\d+)?$/.test(s)) { const v = parseFloat(s.replace(/,/g, "")); out.push({ kind: "num", v, text: (p.pre || "") + fmtV(v, p.dec) + (p.suf || "") }); }
      else out.push({ kind: "txt", text: s });
      continue;
    }
    if (typeof raw === "object") {
      const v = typeof raw.v === "number" ? raw.v : typeof raw.v === "string" && /^-?[\d,]+(\.\d+)?$/.test(raw.v.trim()) ? parseFloat(raw.v.replace(/,/g, "")) : NaN;
      if (isFinite(v)) out.push({ kind: "num", v, text: (raw.pre ?? p.pre ?? "") + fmtV(v, raw.dec ?? p.dec) + (raw.suf ?? p.suf ?? ""), from: raw.from == null ? undefined : String(raw.from), color: raw.color });
      else if (raw.s != null || raw.str != null || typeof raw.v === "string") out.push({ kind: "txt", text: String(raw.s ?? raw.str ?? raw.v), from: raw.from == null ? undefined : String(raw.from), color: raw.color });
    }
  }
  return out;
}
/** A long calc is drawn smaller so that it fits the width of the screen. */
export function calcSize(p: Props): number {
  const s0 = p.size || 64, ts = normTerms(p), raw = ts.reduce((a, q) => a + approxW(q.text, s0), 0) + Math.max(0, ts.length - 1) * s0 * 0.34;
  return raw > 980 ? Math.floor((s0 * 980) / raw) : s0;
}
/** Does the left side of a calc equal its right side? null when it cannot be judged (words as operands, no "="). */
export function checkCalc(terms: Term[]): { ok: boolean; lhs: number; rhs: number } | null {
  const eq = terms.findIndex((t) => t.kind === "op" && (t.text === "=" || t.text === "≈"));
  if (eq < 1 || eq === terms.length - 1) return null;
  const left = terms.slice(0, eq), right = terms.slice(eq + 1);
  if (left.some((t) => t.kind === "txt") || right.length !== 1 || right[0].kind !== "num") return null;
  let i = 0;
  const peek = () => left[i], next = () => left[i++];
  const atom = (): number => {
    const t = next();
    if (!t) return NaN;
    if (t.kind === "num") return t.v as number;
    if (t.text === "(") { const v = sum(); next(); return v; }
    if (t.text === "−") return -atom();
    return NaN;
  };
  const prod = (): number => { let v = atom(); while (peek() && (peek().text === "×" || peek().text === "÷")) { const o = next().text, r = atom(); v = o === "×" ? v * r : v / r; } return v; };
  const sum = (): number => { let v = prod(); while (peek() && (peek().text === "+" || peek().text === "−")) { const o = next().text, r = prod(); v = o === "+" ? v + r : v - r; } return v; };
  const lhs = sum(), rhs = right[0].v as number;
  if (!isFinite(lhs)) return null;
  const shown = (right[0].text.split(".")[1] || "").replace(/\D/g, "").length;
  const tol = Math.max(Math.abs(rhs) * 0.004, 0.6 * Math.pow(10, -shown));
  return { ok: Math.abs(lhs - rhs) <= tol, lhs, rhs };
}

// ---------- timing ----------
export function animLen(a: Action): number {
  const op = a.op || (a.type ? "add" : "set");
  if (op === "send") return Number(a.dur) || 0.9;
  if (op === "add") {
    if (a.type === "calc") return 0.5 + 0.32 * (Array.isArray(a.terms) ? a.terms.length : 3);
    if (a.type === "plot") return 0.9 + 0.3 * (Array.isArray(a.lines) ? a.lines.length : 0);
    if (a.type === "table") return 0.5 + 0.16 * (Array.isArray(a.rows) ? a.rows.length : 0);
    return 0.5;
  }
  return op === "set" ? TWEEN : 0.3;
}
/** A scene lasts at least long enough to read its sentence and to watch its moves finish. */
export function beatTiming(b: Beat, i: number) {
  const acts = (b.do || []).filter((a) => a && typeof a === "object");
  const ats = acts.map((a, k) => (a.at == null ? (i === 0 ? 0.25 : 0.5) + 0.4 * k : Math.max(0, Number(a.at) || 0)));
  let end = 0;
  acts.forEach((a, k) => { end = Math.max(end, ats[k] + animLen(a)); });
  const hasCalc = acts.some((a) => (a.op || "add") === "add" && a.type === "calc");
  // time to read the sentence, then to look at each thing that changed, then a beat of rest
  const changes = acts.filter((a) => (a.op || (a.type ? "add" : "set")) !== "clear").length;
  const read = 0.6 + sayChars(b.say || b.ask?.q) / 7;
  let min = Math.max(read + 0.5 * Math.min(changes, 4) + 0.9, end + (hasCalc ? 1.4 : 0.9));
  if (b.hard) min += 0.8;
  if (b.ask) min = Math.max(min, 7.2);
  const dur = Math.min(11, Math.max(Number(b.dur) || 0, min));
  return { dur, ats, min };
}

/** The ids a scene works with: what it changes, pulses, points at, joins or computes with. */
function refsOf(b: Beat): Set<string> {
  const s = new Set<string>((b.focus || []).map(String));
  (b.do || []).forEach((a) => {
    if (!a || typeof a !== "object") return;
    const op = a.op || (a.type ? "add" : "set");
    if ((op === "set" || op === "pulse") && a.id != null) s.add(String(a.id));
    for (const k of ["from", "to", "plot"]) if (a[k] != null) s.add(String(a[k]));
    if (Array.isArray(a.between)) a.between.forEach((x: unknown) => s.add(String(x)));
    if (Array.isArray(a.terms)) a.terms.forEach((x: Props) => { if (x && typeof x === "object" && x.from != null) s.add(String(x.from)); });
  });
  return s;
}

/** The ids whose numbers a scene's calculation takes: together with what the scene adds, the part of the picture the viewer must watch. */
function srcOf(b: Beat): Set<string> {
  const s = new Set<string>();
  (b.do || []).forEach((a) => { if (a && typeof a === "object" && Array.isArray(a.terms)) a.terms.forEach((x: Props) => { if (x && typeof x === "object" && x.from != null) s.add(String(x.from)); }); });
  return s;
}

/** The ids a scene changes. A change nobody sees is lost, so these come before the things a calculation merely takes its numbers from. */
function setOf(b: Beat): Set<string> {
  const s = new Set<string>();
  (b.do || []).forEach((a) => { if (a && typeof a === "object" && (a.op || (a.type ? "add" : "set")) === "set" && a.id != null) s.add(String(a.id)); });
  return s;
}

// ---------- the hook ----------
// Korean words that lean on the next word (a counter, a number word, an adverb, a modifier ending in ㄹ): a chunk must not end on one.
const LEAN = new Set(["몇", "한", "두", "세", "네", "새", "첫", "이", "그", "저", "각", "온", "왜", "더", "또", "안", "못", "꼭", "늘", "곧", "좀", "잘", "다", "총", "약", "및", "제", "딱", "꽤", "참"]);
// words that lean on the word before (a bound noun or a counter): a chunk must not start with one
const HANG = new Set(["수", "것", "뿐", "때", "줄", "데", "등", "만", "쯤", "번", "개", "원", "주", "명", "년", "달", "점", "배", "속", "위", "뒤", "앞", "밖", "옆", "중", "끝", "아니라", "아니고", "아닌"]);
const leansOn = (w: string) => { const a = [...w]; if (a.length !== 1 || /[,，]$/.test(w)) return false; const c = (a[0].codePointAt(0) || 0) - 0xac00; return LEAN.has(w) || (c >= 0 && c < 11172 && c % 28 === 8); };
/** The title cut at spaces into 3 or 4 chunks, one per half second of the hook. A chunk keeps to 8 characters (spaces and the closing ? or !
 *  not counted) when the words allow it, and to 9 at most; a longer title uses its last clause, and failing that drops words from the front
 *  (the type also shrinks, down to about 96 px). The ? or ! stays at the end of the last chunk. */
export function hookChunks(title: string): string[] {
  const clean = String(title || "").replace(/[*_`#]/g, "").replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const chars = (s: string) => [...s.replace(/[\s,，]/g, "").replace(/[?!？！.]+$/, "")].length; // commas are thin: they do not count
  const cut = (words: string[]) => { // the best way to cut these words into 3 or 4 chunks
    const n = words.length;
    if (n <= 3) return { chunks: words.slice(), max: Math.max(0, ...words.map(chars)) };
    let best: { chunks: string[]; max: number; cost: number } | null = null;
    for (const k of [3, 4]) {
      const go = (from: number, left: number, acc: string[]) => {
        if (left === 1) {
          const ch = acc.concat(words.slice(from).join(" ")), ls = ch.map(chars), max = Math.max(...ls);
          let cost = max * 10 + ls.reduce((a, l) => a + l * l, 0) / ch.length / 4 + (k === 3 ? 2 : 0);
          ch.forEach((c, j) => {
            const ws = c.split(" ");
            if (j < ch.length - 1 && leansOn(ws[ws.length - 1])) cost += 15;
            if (j < ch.length - 1 && /[,，]$/.test(c)) cost -= 8; // a clause ends here: the best place to cut
            else if (j < ch.length - 1 && /(면|고|서)$/.test(c)) cost -= 3; // "if ...", "and ...": a clause without its comma
            if (/[,，]./.test(c)) cost += 15; // and a chunk that runs over the end of a clause reads as two thoughts
            if (j > 0 && HANG.has(ws[0])) cost += 12;
            if (ws.length === 1 && chars(c) <= 1) cost += 20;
          });
          if (!best || cost < best.cost) best = { chunks: ch, max, cost };
          return;
        }
        for (let e = from + 1; e <= n - left + 1; e++) go(e, left - 1, acc.concat(words.slice(from, e).join(" ")));
      };
      go(0, k, []);
    }
    return best as unknown as { chunks: string[]; max: number };
  };
  const words = clean.split(" ");
  const all = cut(words);
  if (all.max <= 9) return all.chunks;
  const comma = clean.search(/[,，][^,，]*$/), tail = comma > 0 ? clean.slice(comma + 1).trim() : "";
  if (tail && tail.split(" ").length >= 3) { const c = cut(tail.split(" ")); if (c.max <= 9) return c.chunks; }
  // still too long: the type shrinks to the widest line, but below about 96 px it would not read, so words go from the front
  let ws = words;
  while (ws.length > 3 && Math.max(...cut(ws).chunks.map((c, j, a) => approxW(c, 1) + (j === a.length - 1 ? 0.54 : 0))) * 96 > 900) ws = ws.slice(1);
  return cut(ws).chunks;
}

// ---------- timeline ----------
export function prep(script: Script, opt: { speed?: number; hook?: boolean } = {}): Model {
  const speed = clamp(Number(opt.speed ?? script.speed ?? 1.1) || 1.1, 0.5, 2);
  const m: Model = { script, speed, beats: [], objs: new Map(), list: [], cams: [{ t: 0, c: { x: 540, y: 960, zoom: 1 } }], says: [], cues: [], sends: [], focus: [], asks: [], DUR: 0, dur: 0, warn: [], seated: [], hook: { t0: 0, len: 0, chunks: [] }, end: { t0: 0, len: CARD } };
  // the hook comes first and everything else simply starts later, so no scene needs to know about it
  const given = (script as Props).hook, chunks = opt.hook === false ? [] : Array.isArray(given) && given.length >= 3 && given.length <= 4 && given.every((x: unknown) => typeof x === "string" && x.trim()) ? given.map((x: string) => x.trim()) : hookChunks(String(script.title || ""));
  if (chunks.length) { m.hook = { t0: 0, len: HOOK, chunks }; chunks.forEach((_, k) => m.cues.push({ k: "pop", t: 0.5 * k, step: [0, 2, 4, 7][k % 4], v: 0.08 })); }
  let t = (m.hook.len ? 0.05 : LEAD) + m.hook.len; // after a hook scene 1 starts at once: the dot that survives the title is already on its way
  (Array.isArray(script.beats) ? script.beats : []).forEach((b, i) => {
    if (!b || typeof b !== "object") return;
    const { dur, ats } = beatTiming(b, i), t0 = t;
    m.beats.push({ t0, dur, b, i });
    const sayText = b.say || b.ask?.q;
    if (sayText) m.says.push({ t0: t0 + 0.05, t1: t0 + dur - 0.1, text: String(sayText), i });
    if (Array.isArray(b.focus) && b.focus.length) m.focus.push({ t0: t0 + 0.15, t1: t0 + dur - 0.05, ids: new Set(b.focus.map(String)), i });
    if (b.ask && Array.isArray(b.ask.choices) && b.ask.choices.length >= 2) {
      const a: AskM = { i, n: m.asks.length, t0: t0 + 0.8, hold: t0 + dur * 0.6, t1: t0 + dur, ask: b.ask };
      m.asks.push(a);
      m.cues.push({ k: "pop", t: a.t0, step: 4, v: 0.08 }, { k: "chord", t: a.hold + 0.05, deg: 1, v: 0.1, strum: 0.03 });
    }
    (b.do || []).filter((a) => a && typeof a === "object").forEach((a, k) => {
      const at = t0 + Math.min(ats[k], Math.max(0, dur - 0.3));
      const op = a.op || (a.type ? "add" : "set");
      if (op === "send") {
        const d = Number(a.dur) || 0.9;
        m.sends.push({ from: String(a.from), to: String(a.to), icon: a.icon, str: a.str, color: a.color, t0: at, dur: d, i });
        m.cues.push({ k: "whoosh", t0: at, t1: at + d, v: 0.07 }, { k: "tick", t: at + d, step: 7, oct: 1, v: 0.09 });
        return;
      }
      if (op === "clear") {
        const keep = new Set((Array.isArray(a.keep) ? a.keep : []).map(String));
        m.list.forEach((o) => { if (!keep.has(o.id) && o.tDel > at && o.tAdd <= at) o.tDel = at; });
        return;
      }
      const id = a.id == null ? "" : String(a.id);
      if (!id) { m.warn.push(`scene ${i + 1}: an action has no id`); return; }
      if (op === "add") {
        const old = m.objs.get(id);
        if (old && old.tDel > at) old.tDel = at; // the same id again: the old one leaves
        const p0: Props = Object.assign({}, a);
        if (a.type === "calc") {
          if (typeof p0.x !== "number") p0.x = 540;
          if (typeof p0.y !== "number") { p0.y = 1700; p0._autoY = true; }
          m.list.forEach((c) => { if (c.type === "calc" && c.tDel > at && c.tAdd <= at) c.tDel = at; }); // one calculation on screen at a time
        }
        if (PLACED.has(String(a.type)) && (typeof p0.x !== "number" || typeof p0.y !== "number")) {
          // no seat was given: take the middle of the first free row under what is on screen
          let low = 0;
          m.list.forEach((q) => { if (!(q.tAdd <= at && q.tDel > at) || !PLACED.has(q.type)) return; const bx = boxOf(m, q, q.keys[q.keys.length - 1].p, at); if (bx) low = Math.max(low, bx.y1); });
          const r = ROWS.findIndex((y) => y - 105 >= low - 20);
          p0.x = 540; p0.y = ROWS[r < 0 ? ROWS.length - 1 : r]; p0._auto = true;
          const hang = hangOf(String(a.type), p0);
          if (hang != null) p0.y = p0.y - 80 + hang;
          m.seated.push(id);
        }
        if (a.type === "sign") { // a new sign between the same two things replaces the old one
          const key = Array.isArray(p0.between) ? p0.between.map(String).sort().join("~") : `${p0.x},${p0.y}`;
          m.list.forEach((q) => { if (q.type !== "sign" || !(q.tAdd <= at && q.tDel > at)) return; const qp = q.keys[0].p, qk = Array.isArray(qp.between) ? qp.between.map(String).sort().join("~") : `${qp.x},${qp.y}`; if (qk === key) q.tDel = at; });
        }
        const o: MObj = { id, type: String(a.type || "text"), tAdd: at, tDel: Infinity, keys: [{ t: at, p: p0 }], pulses: [], order: m.list.length, beat: i };
        m.objs.set(id, o);
        m.list.push(o);
        if (o.type === "calc") {
          const n = normTerms(a).length;
          for (let j = 0; j < n - 1; j++) m.cues.push({ k: "tick", t: at + 0.32 * j + 0.3, step: 2 + j, oct: 1, v: 0.07 });
          m.cues.push({ k: "note", inst: "bell", t: at + 0.32 * Math.max(0, n - 1) + 0.2, step: 7, v: 0.12, dec: 1.1 });
        } else if (!["arrow", "line", "brace", "note"].includes(o.type)) m.cues.push({ k: "pop", t: at, step: [0, 2, 4, 7][m.list.length % 4], v: 0.07 });
        else m.cues.push({ k: "tick", t: at + 0.1, step: 4, oct: 1, v: 0.05 });
      } else {
        const o = m.objs.get(id);
        if (!o) { m.warn.push(`scene ${i + 1}: "${op}" names an id that was never added: ${id}`); return; }
        if (op === "set") { o.keys.push({ t: at, p: Object.assign({}, o.keys[o.keys.length - 1].p, a) }); m.cues.push({ k: "tick", t: at, step: 9, oct: 1, v: 0.06 }); }
        else if (op === "del") o.tDel = Math.min(o.tDel, at);
        else if (op === "pulse") { o.pulses.push(at); m.cues.push({ k: "note", inst: "bell", t: at, step: 4, v: 0.1, dec: 1 }); }
        else m.warn.push(`scene ${i + 1}: unknown op "${op}"`);
      }
    });
    t += dur;
  });
  m.end = { t0: t, len: CARD }; // the end card takes the place of the old rest at the end
  m.DUR = t + CARD;
  m.dur = m.DUR / speed;
  // a calculation belongs to its scene: it leaves when the next scene starts, unless that scene uses it
  const refs = m.beats.map(({ b }) => refsOf(b));
  // a line, bracket, sign or tag that names something not on screen yet waits until it is
  m.list.forEach((o) => {
    if (!["arrow", "line", "brace", "sign", "note"].includes(o.type)) return;
    const p = o.keys[0].p, ids: string[] = [];
    for (const k of ["from", "to"]) if (p[k] != null) ids.push(String(p[k]));
    if (Array.isArray(p.between)) p.between.forEach((x: unknown) => ids.push(String(x)));
    let t = o.tAdd;
    for (const id of ids) { const q = m.objs.get(id); if (q && q !== o && q.tAdd > t) t = q.tAdd + 0.25; }
    if (t > o.tAdd) { const d = t - o.tAdd; o.tAdd = t; o.keys.forEach((k) => { if (k.t < t) k.t = t; }); o.pulses = o.pulses.map((x) => Math.max(x, t)); if (o.tDel <= t) o.tDel = t; void d; }
  });
  m.list.forEach((o) => {
    if (o.type !== "calc") return;
    for (const bm of m.beats) {
      if (bm.i <= o.beat || refs[bm.i].has(o.id)) continue;
      if (o.tDel > bm.t0 + 0.1) { o.tDel = bm.t0 + 0.1; o.auto = true; }
      break;
    }
  });
  // a calculation with no place of its own sits just under the picture of its scene
  m.list.forEach((o) => {
    if (o.type !== "calc" || !o.keys[0].p._autoY) return;
    const bm = m.beats.find((x) => x.i === o.beat);
    if (!bm) return;
    const t1 = bm.t0 + bm.dur - 0.02;
    let low = 0;
    m.list.forEach((q) => { if (q === o || q.type === "calc" || !(SOLID.has(q.type) || q.type === "axis") || !(q.tAdd <= t1 && q.tDel > t1)) return; const bx = q.type === "axis" ? axisBox(stateOfEnd(q, t1)) : boxOf(m, q, stateOfEnd(q, t1), t1); if (bx) low = Math.max(low, bx.y1); }); // under the stage labels too
    const y = Math.max(700, low ? low + 150 : 1100); // the camera frames whatever the picture needs
    o.keys.forEach((k) => { k.p.y = y; });
  });
  // the label of a line or arrow sits beside the middle of the line, on the side where it covers nothing: above a level line first, because captions hang under things
  const labelled: Box[] = [];
  m.list.forEach((o) => {
    if (o.type !== "arrow" && o.type !== "line") return;
    const p0 = o.keys[0].p;
    if (!p0.str || p0.from == null || p0.to == null) return;
    const t1 = o.tAdd + 0.7, A = anchorOf(m, String(p0.from), t1), B = anchorOf(m, String(p0.to), t1);
    if (!A || !B) return;
    const others: Box[] = labelled.slice();
    m.list.forEach((q) => {
      if (q === o || q.type === "calc" || !(q.tAdd < o.tDel && q.tDel > o.tAdd) || !(SOLID.has(q.type) || q.type === "sign")) return;
      const tq = Math.max(t1, q.tAdd + 0.6), qb = boxOf(m, q, stateOfEnd(q, tq), tq);
      if (qb) others.push(qb);
    });
    const [a, b] = lineEnds(A, B, p0), ux = (b[0] - a[0]) / (Math.hypot(b[0] - a[0], b[1] - a[1]) || 1), bend = Number(p0.curve) || 0;
    // how far the middle of the label sits from the line: half of the label across the line plus a gap, so a label beside an upright line does not sit on it
    const uy = (b[1] - a[1]) / (Math.hypot(b[0] - a[0], b[1] - a[1]) || 1), far = Math.max(50, Math.abs(uy) * (approxW(String(p0.str), 40) + 36) / 2 + Math.abs(ux) * 31 + 12);
    const d = bend ? (bend < 0 ? -50 : 50) : Math.abs(ux) > 0.6 ? (ux > 0 ? -far : far) : far;
    const cost = (off: number, pos: number) => {
      const lb = lineLabel(m, p0, t1, off, pos);
      if (!lb) return 0;
      let c = lb.x0 < 16 || lb.x1 > W - 16 ? 1e6 : 0;
      others.forEach((bx) => { const ix = Math.min(lb.x1, bx.x1) - Math.max(lb.x0, bx.x0) + 8, iy = Math.min(lb.y1, bx.y1) - Math.max(lb.y0, bx.y0) + 4; if (ix > 0 && iy > 0) c += ix * iy; });
      return c;
    };
    let best = { off: d, pos: 0.5, c: Infinity };
    for (const [off, pos] of bend ? [[d, 0.5]] : [[d, 0.5], [-d, 0.5], [d, 0.34], [d, 0.66], [-d, 0.34], [-d, 0.66], [d + (d < 0 ? -55 : 55), 0.5], [-d - (d < 0 ? -55 : 55), 0.5]]) { const c = cost(off, pos); if (c < best.c) best = { off, pos, c }; if (c < 1) break; }
    o.keys.forEach((k) => { k.p.loff = best.off; k.p.lpos = best.pos; });
    const lb = lineLabel(m, p0, t1, best.off, best.pos);
    if (lb) labelled.push(lb);
  });
  // a note takes the side it was given unless something is in the way there, now or later while the note is up; then it takes the first free side.
  // Lines and arrows count as in the way too: a tag never sits on a line.
  m.list.forEach((o) => {
    if (o.type !== "note") return;
    const bm = m.beats.find((x) => x.i === o.beat);
    if (!bm) return;
    const t1 = Math.max(bm.t0 + bm.dur - 0.02, o.tAdd + 0.1), p = stateOfEnd(o, t1), want = String(p.side || "right");
    const others: Box[] = [], segs: { s: number[]; now: boolean }[] = [], mine: Record<string, number> = dict(); // mine: how far out the tags this thing already has reach, per side
    m.list.forEach((q) => {
      if (q === o || !(q.tAdd < o.tDel && q.tDel > o.tAdd) || q.id === String(p.to)) return;
      const tq = Math.max(t1, q.tAdd + 0.6);
      if (q.type === "arrow" || q.type === "line") {
        const qp = q.keys[0].p;
        if (qp.from == null || qp.to == null) return;
        const A = anchorOf(m, String(qp.from), tq), B = anchorOf(m, String(qp.to), tq);
        if (A && B) segs.push({ s: [A.x, A.y, B.x, B.y], now: q.tAdd <= t1 });
        const lb = lineLabel(m, qp, tq);
        if (lb) others.push(lb);
        return;
      }
      if (q.type === "note" && q.order < o.order) { const qp = stateOfEnd(q, tq); if (String(qp.to) === String(p.to)) mine[String(qp.side)] = Math.max(mine[String(qp.side)] || 0, (Number(qp.push) || 0) + 78); }
      if (q.type === "axis") { const ap = stateOfEnd(q, tq); others.push({ x0: Number(ap.x) - 30, y0: Number(ap.y) - 20, x1: Number(ap.x2) + 40, y1: Number(ap.y) + 92 }); return; } // a tag never sits on the line or the stage labels
      const qb = q.type === "note" ? (q.order < o.order ? noteBox(m, stateOfEnd(q, tq), tq) : null) : SOLID.has(q.type) || q.type === "sign" ? boxOf(m, q, stateOfEnd(q, tq), tq) : null;
      if (qb) others.push(qb);
    });
    // how much a tag on side sd would cover; a second tag on the same side of the same thing stacks on the first. Nothing covered is a free place.
    const pushOf = (sd: string) => (sd === "top" || sd === "bottom" ? mine[sd] || 0 : 0);
    const cost = (sd: string, slide = 0) => {
      const nb = noteBox(m, Object.assign({}, p, { push: slide ? 0 : pushOf(sd), slide }), t1, sd);
      if (!nb) return 0;
      const an = anchorOf(m, String(p.to), t1);
      let c = an && an.box && (sd === "left" ? nb.x1 > an.box.x0 : sd === "right" ? nb.x0 < an.box.x1 : false) ? 1e6 : 0; // squeezed against the edge of the stage, it would cover its own thing
      segs.forEach(({ s: [x0, y0, x1, y1], now }) => { for (let k = 1; k < 24; k++) { const x = x0 + ((x1 - x0) * k) / 24, y = y0 + ((y1 - y0) * k) / 24; if (x > nb.x0 - 10 && x < nb.x1 + 10 && y > nb.y0 - 10 && y < nb.y1 + 10) { c += now ? 3000 : 150; break; } } }); // a line drawn later passes behind the tag, which is the lesser evil
      others.forEach((bx) => { const ix = Math.min(nb.x1, bx.x1) - Math.max(nb.x0, bx.x0) + 10, iy = Math.min(nb.y1, bx.y1) - Math.max(nb.y0, bx.y0) + 6; if (ix > 0 && iy > 0) c += ix * iy; });
      return c;
    };
    let best = { s: want, slide: 0, c: Infinity };
    const sides = [want, "right", "left", "bottom", "top"].filter((v, i, a) => a.indexOf(v) === i);
    search: for (const slide of [0, 78, -78, 156, -156]) for (const sd of sides) {
      if (slide && (sd === "top" || sd === "bottom") && Math.abs(slide) > 78) continue;
      const c = cost(sd, slide) + Math.abs(slide) * 0.005;
      if (c < best.c) best = { s: sd, slide, c };
      if (c < 1) break search;
    }
    o.keys.forEach((k) => { k.p.side = best.s; if (best.slide) k.p.slide = best.slide; else if (pushOf(best.s)) k.p.push = pushOf(best.s); });
  });
  // framing. Three wishes, in this order: words stay large enough to read on a phone (outside a question the zoom never goes under ZMIN),
  // what a scene is about is never off screen, and the camera moves as rarely as it can.
  // So the camera takes the longest stretch of coming scenes whose whole picture fits one frame, and holds that frame for the stretch.
  // A picture that has outgrown one frame is followed: the frame holds what the coming scenes are about and as much of the rest as fits.
  {
    type Cam = { x: number; y: number; zoom: number };
    const B = m.beats, top = FRAME.y0, bot = FRAME.y1;
    const wipe = B.map(({ b }, k) => k > 0 && (b.do || []).some((x) => x && x.op === "clear"));
    const all = B.map((bm) => sceneBox(m, bm.i)), core = B.map((bm, k) => aboutBox(m, bm.i, refs[k], bm.b));
    const sees = (c: Cam, r: Rect | null, hi = bot) => !r || (960 + (r.y0 - c.y) * c.zoom >= top - 4 && 960 + (r.y1 - c.y) * c.zoom <= hi + 4 && (r.x0 - c.x) * c.zoom >= -524 && (r.x1 - c.x) * c.zoom <= 524);
    const camOf = (f: Fit): Cam => ({ x: f.x, y: f.y, zoom: f.zoom });
    const same = (p: Cam, q: Cam) => Math.abs(p.x - q.x) < 1 && Math.abs(p.y - q.y) < 1 && Math.abs(p.zoom - q.zoom) < 0.005;
    /** a box grown with the nearest other things on screen in scene k, for as long as it still fits one frame */
    const grow = (c0: Rect, k: number, ask: boolean, zmin: number): Rect => {
      const t1 = B[k].t0 + B[k].dur - 0.02, rest: Rect[] = [];
      m.list.forEach((o) => {
        if (!(o.tAdd <= t1 && o.tDel > t1) || !(SOLID.has(o.type) || o.type === "note")) return;
        const bx = o.type === "note" ? noteBox(m, stateOfEnd(o, t1), t1) : boxOf(m, o, stateOfEnd(o, t1), t1);
        if (bx) rest.push({ x0: bx.x0, y0: bx.y0, x1: bx.x1, y1: bx.y1, wide: false });
      });
      const gap = (r: Rect) => Math.max(0, r.y0 - c0.y1, c0.y0 - r.y1) + 0.2 * Math.max(0, r.x0 - c0.x1, c0.x0 - r.x1);
      rest.sort((p, q) => gap(p) - gap(q));
      let c = c0;
      for (const r of rest) { const v = join(c, r) as Rect; if (!roomy(v, ask, zmin)) break; c = v; }
      return c;
    };
    /** the frame to take at scene k when the frame in force no longer serves */
    const plan = (k: number): Cam | null => {
      const here = all[k];
      if (!here || roomy(here, false, ZMIN)) { // the whole picture, of as many coming scenes as one frame holds
        let u: Rect | null = null;
        for (let j = k; j < B.length && !(j > k && wipe[j]); j++) { const v = join(u, all[j]); if (v && !roomy(v, false, ZMIN)) break; u = v; }
        return u ? camOf(fitBox(u, false, 1.25, ZMIN)) : null;
      }
      let c: Rect | null = null; // too big for one frame: follow what the coming scenes are about
      for (let j = k; j < B.length && !(j > k && wipe[j]); j++) { const v = join(c, core[j]); if (v && c && !roomy(v, false, ZMIN)) break; c = v; }
      if (!c) { for (let j = k - 1; j >= 0 && !c; j--) { c = core[j]; if (wipe[j]) break; } }
      if (!c) c = here;
      const z = clamp(needOf(c, false) - 1e-6, ZLOW, ZMIN); // a scene that only points at far ends of the picture is seen whole, even if that costs some size
      return camOf(fitBox(grow(Object.assign({}, c, { wide: false }), k, false, z), false, 1, z));
    };
    let cur: Cam = { x: 540, y: 960, zoom: 1 }, held: Cam | null = null, first = true; // held: the frame in force outside questions
    B.forEach(({ b, t0 }, k) => {
      let next = cur;
      if (wipe[k]) held = null;
      if (b.cam) { next = Object.assign({}, cur, b.cam); held = next; }
      else if (b.ask) { // a question first tries to leave the picture where it is; the buttons take the lower part of the screen
        const base = held || plan(k), here = all[k], hi = ASK_Y - 70;
        if (base && (!here || sees(base, here, hi))) next = base;
        else if (here && roomy(here, true, 0.8)) next = camOf(fitBox(here, true));
        else if (here) { // a big picture: show what the scenes just before were about, at a size that can still be read
          let c: Rect | null = core[k];
          for (let j = k - 1; j >= 0 && j >= k - 2; j--) { const v = join(c, core[j]); if (v && c && !roomy(v, true, 0.8)) break; c = v; if (wipe[j]) break; }
          next = c && roomy(c, true, 0.7) ? camOf(fitBox(grow(Object.assign({}, c, { wide: false }), k, true, 0.8), true, 1, 0.7)) : camOf(fitBox(here, true));
        }
      } else {
        const here = all[k], whole = !here || roomy(here, false, ZMIN);
        if (!(held && sees(held, whole ? here : core[k]))) held = plan(k) || held;
        if (held) next = held;
      }
      if (!same(next, cur) || first) { if (first) m.cams = [{ t: 0, c: next }]; else m.cams.push({ t: t0, c: next }); cur = next; }
      first = false;
    });
  }
  return m;
}
/** The camera that shows everything on screen at the end of scene i, centred in the free part of the stage. */
type Fit = { x: number; y: number; zoom: number; x0: number; y0: number; x1: number; y1: number; fits: boolean };
/** The box around everything that is on screen at the end of scene i, and whether a bracket is among it. */
function sceneBox(m: Model, i: number): { x0: number; y0: number; x1: number; y1: number; wide: boolean; ask: boolean } | null {
  const bm = m.beats.find((x) => x.i === i);
  if (!bm) return null;
  const t1 = bm.t0 + bm.dur - 0.02;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  m.list.forEach((o) => {
    if (!(o.tAdd <= t1 && o.tDel > t1) || !(SOLID.has(o.type) || o.type === "note" || o.type === "arrow" || o.type === "line" || o.type === "axis")) return; // the time axis belongs to the whole picture, never to what one scene is about (coreBox)
    const bx = o.type === "axis" ? axisBox(stateOfEnd(o, t1)) : o.type === "note" ? noteBox(m, stateOfEnd(o, t1), t1) : o.type === "arrow" || o.type === "line" ? lineLabel(m, stateOfEnd(o, t1), t1) : boxOf(m, o, stateOfEnd(o, t1), t1);
    if (!bx) return;
    x0 = Math.min(x0, bx.x0); y0 = Math.min(y0, bx.y0); x1 = Math.max(x1, bx.x1); y1 = Math.max(y1, bx.y1);
  });
  if (!isFinite(x0)) return null;
  return { x0, y0, x1, y1, wide: m.list.some((o) => o.type === "brace" && o.tAdd <= t1 && o.tDel > t1), ask: !!bm.b.ask }; // a bracket's label sits outside the things it joins
}
/** Below this zoom the words of a picture are too small to read on a phone. */
export const ZMIN = 0.86;
/** The zoom is allowed to go this low when the things one scene works with are spread over a tall picture. */
export const ZLOW = 0.74;
type Rect = { x0: number; y0: number; x1: number; y1: number; wide: boolean };
const join = (a: Rect | null, b: Rect | null): Rect | null => (!a ? b : !b ? a : { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1), wide: a.wide || b.wide });
/** how far a box must be scaled to fill the free part of the stage (above the buttons during a question) */
const needOf = (r: { x0: number; y0: number; x1: number; y1: number }, ask: boolean) => Math.min(((ask ? ASK_Y - 70 : FRAME.y1) - FRAME.y0) / (r.y1 - r.y0 + 30), 1010 / (r.x1 - r.x0 + 30));
const roomy = (r: Rect, ask: boolean, zmin: number) => needOf(r, ask) >= zmin - 1e-6;
/** The camera that puts a box in the middle of the free part of the stage. A question may shrink the picture further: the buttons need the room. */
function fitBox(bx: { x0: number; y0: number; x1: number; y1: number; wide: boolean }, ask: boolean, zmax = 1.16, lo = ask ? 0.5 : ZMIN): Fit {
  const top = FRAME.y0, bot = ask ? ASK_Y - 70 : FRAME.y1, need = needOf(bx, ask);
  const zoom = clamp(need, lo, bx.wide ? 1 : zmax), cx = bx.wide ? 540 : (bx.x0 + bx.x1) / 2;
  return { x: 540 + (cx - 540) * clamp((zoom - 1) / 0.1), y: (bx.y0 + bx.y1) / 2 - ((top + bot) / 2 - 960) / zoom, zoom, x0: bx.x0, y0: bx.y0, x1: bx.x1, y1: bx.y1, fits: need >= lo - 1e-6 };
}
/** The box around what scene i is about: the things it adds, changes, points at or computes with. */
function coreBox(m: Model, i: number, ids: Set<string>): Rect | null {
  const bm = m.beats.find((x) => x.i === i);
  if (!bm) return null;
  const t1 = bm.t0 + bm.dur - 0.02;
  let r: Rect | null = null;
  m.list.forEach((o) => {
    if (!(o.tAdd <= t1 && o.tDel > t1) || !(o.beat === i || ids.has(o.id)) || !(SOLID.has(o.type) || o.type === "note" || o.type === "arrow" || o.type === "line")) return;
    const bx = o.type === "note" ? noteBox(m, stateOfEnd(o, t1), t1) : o.type === "arrow" || o.type === "line" ? lineLabel(m, stateOfEnd(o, t1), t1) : boxOf(m, o, stateOfEnd(o, t1), t1);
    if (bx) r = join(r, { x0: bx.x0, y0: bx.y0, x1: bx.x1, y1: bx.y1, wide: false });
  });
  return r;
}
/** What the camera must show in scene i. Everything the scene works with, when one frame holds that at a readable size;
 *  else what is new, what it changes and the things its calculation takes numbers from; else what is new and what it changes;
 *  else what is new and the sources; else only what is new (a number may then fly in from off screen). */
function aboutBox(m: Model, i: number, ids: Set<string>, b: Beat): Rect | null {
  const full = coreBox(m, i, ids);
  if (!full || roomy(full, false, ZMIN)) return full;
  const src = srcOf(b), set = setOf(b);
  if (set.size) {
    const both = coreBox(m, i, new Set<string>([...src, ...set]));
    if (both && roomy(both, false, ZMIN)) return both;
    const changed = coreBox(m, i, set);
    if (changed && roomy(changed, false, ZMIN)) return changed;
  }
  const made = coreBox(m, i, src);
  if (made && roomy(made, false, ZMIN)) return made;
  const fresh = coreBox(m, i, new Set<string>());
  return fresh && roomy(fresh, false, ZMIN) ? fresh : full;
}
/** Framing of one scene by itself. */
export function frameOf(m: Model, i: number): Fit | null {
  const bx = sceneBox(m, i);
  return bx ? fitBox(bx, bx.ask) : null;
}

/** The properties of an object at time t. New values glide in over TWEEN seconds. */
export function stateOf(o: MObj, t: number): Props {
  let p: Props = o.keys[0].p;
  for (let i = 1; i < o.keys.length; i++) {
    const k = o.keys[i];
    if (t < k.t) break;
    const u = E.rest(clamp((t - k.t) / TWEEN)), from = p;
    if (u >= 1) { p = k.p; continue; }
    const q: Props = Object.assign({}, k.p);
    for (const n of NUMK) if (typeof from[n] === "number" && typeof k.p[n] === "number") q[n] = lerp(from[n], k.p[n], u);
    q._prev = from; q._u = u;
    p = q;
  }
  return p;
}
export const alive = (o: MObj, t: number) => t >= o.tAdd && t < o.tDel;
export function camAt(m: Model, t: number) {
  let a = m.cams[0], b = m.cams[0];
  for (const c of m.cams) if (t >= c.t) { a = b; b = c; }
  const u = E.cam(clamp((t - b.t) / 1.0));
  return { x: lerp(a.c.x, b.c.x, u), y: lerp(a.c.y, b.c.y, u), zoom: Math.exp(lerp(Math.log(a.c.zoom || 1), Math.log(b.c.zoom || 1), u)) };
}
export function beatAt(m: Model, t: number): BeatM | null {
  let cur: BeatM | null = null;
  for (const b of m.beats) if (t >= b.t0) cur = b;
  return cur;
}

// ---------- geometry (estimates; the drawing code measures real text) ----------
export interface Box { x0: number; y0: number; x1: number; y1: number }
export const plotMap = (p: Props) => {
  const w = p.w || 800, h = p.h || 560, x0 = (p.x || 540) - w / 2, y1 = (p.y || 1100) + h / 2;
  const xr = Array.isArray(p.xr) && p.xr.length === 2 ? p.xr : [0, 1], yr = Array.isArray(p.yr) && p.yr.length === 2 ? p.yr : [0, 1];
  return { x0, y1, w, h, xr, yr, sx: (v: number) => x0 + ((v - xr[0]) / (xr[1] - xr[0] || 1)) * w, sy: (v: number) => y1 - ((v - yr[0]) / (yr[1] - yr[0] || 1)) * h };
};
/** y of a plot line at data x (straight segments between its points) */
export function lineY(pts: number[][], x: number): number {
  if (!Array.isArray(pts) || !pts.length) return 0;
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; return x1 === x0 ? y1 : y0 + ((y1 - y0) * (x - x0)) / (x1 - x0); }
  return pts[pts.length - 1][1];
}
export function tableDims(p: Props) {
  const cols = Array.isArray(p.cols) ? p.cols.length : Array.isArray(p.rows) && p.rows[0] ? p.rows[0].length : 1;
  const nrows = Array.isArray(p.rows) ? p.rows.length : 0, head = Array.isArray(p.cols) ? 1 : 0;
  const w = p.w || 920, rowH = p.rowH || 112, h = rowH * (nrows + head);
  return { cols, nrows, head, w, rowH, h, x0: (p.x || 540) - w / 2, y0: (p.y || 1100) - h / 2 };
}
/** Screen position of a dot that rides on a plot. */
export function dotPos(m: Model, p: Props, t: number): [number, number] | null {
  const po = m.objs.get(String(p.plot));
  if (!po) return null;
  const pp = stateOf(po, t), map = plotMap(pp), px = Number(p.px) || 0;
  let py = Number(p.py) || 0;
  if (p.line != null) { const ln = (Array.isArray(pp.lines) ? pp.lines : []).find((l: Props) => String(l.id) === String(p.line)); if (ln) py = lineY(ln.pts, px); }
  return [map.sx(px), map.sy(py)];
}
/** How tall a bar's column is, in px (below zero: it hangs down). A bar that has no number yet but gets one later keeps that room:
 *  it is drawn as an empty slot of that size, so the viewer sees what is about to be filled. */
export function barSlot(o: MObj | null | undefined, p: Props): number {
  if (p.scale == null) return p.h || 0;
  if (p.value != null) return Number(p.value) * p.scale;
  const later = o ? o.keys.find((k) => k.p.value != null) : undefined;
  return later ? Number(later.p.value) * (later.p.scale ?? p.scale) : p.h || 0;
}
/** Does the straight way from (ax,ay) to (bx,by), without its two ends, cross the box? */
function crosses(ax: number, ay: number, bx: number, by: number, r: Box): boolean {
  let u0 = 0.15, u1 = 0.85; // the ends belong to the two things themselves
  const dx = bx - ax, dy = by - ay;
  for (const [pp, qq] of [[-dx, ax - r.x0], [dx, r.x1 - ax], [-dy, ay - r.y0], [dy, r.y1 - ay]]) {
    if (Math.abs(pp) < 1e-9) { if (qq < 0) return false; continue; }
    const u = qq / pp;
    if (pp < 0) u0 = Math.max(u0, u); else u1 = Math.min(u1, u);
    if (u0 > u1) return false;
  }
  return true;
}
/** A sign reads only between neighbours. This is the thing that sits on the way between its two ends, if there is one. */
export function signBlocker(m: Model, p: Props, t: number): MObj | null {
  if (!Array.isArray(p.between) || p.between.length < 2) return null;
  const ends = new Set(p.between.map(String)), A = anchorOf(m, String(p.between[0]), t), B = anchorOf(m, String(p.between[1]), t);
  if (!A || !B) return null;
  for (const o of m.list) {
    if (!SOLID.has(o.type) || o.type === "calc" || ends.has(String(o.id)) || !alive(o, t)) continue;
    const b = boxOf(m, o, stateOf(o, t), t);
    if (b && crosses(A.x, A.y, B.x, B.y, { x0: b.x0 - 24, y0: b.y0 - 24, x1: b.x1 + 24, y1: b.y1 + 24 })) return o;
  }
  return null;
}
/** Where a sign between two things is drawn: halfway, or beside them when they are stacked one above the other (a caption sits between those).
 *  With another thing on the way between the two there is no place where the sign would read as theirs, so it is not drawn (null). */
export function signAt(m: Model, p: Props, t: number): [number, number] | null {
  const A = anchorOf(m, String(p.between[0]), t), B = anchorOf(m, String(p.between[1]), t);
  if (!A || !B) return null;
  if (signBlocker(m, p, t)) return null;
  const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
  if (Math.abs(A.x - B.x) < 120 && Math.abs(A.y - B.y) > 120) { const right = Math.max(A.box ? A.box.x1 : A.x + A.r, B.box ? B.box.x1 : B.x + B.r); return [right + 90 > 1000 ? Math.min(A.box ? A.box.x0 : A.x - A.r, B.box ? B.box.x0 : B.x - B.r) - 90 : right + 90, my]; }
  return [mx, my];
}
/** Half the width of a node. A value too long for the circle at a readable size widens the circle into a pill; the text is not shrunk to fit. */
export function nodeHalf(p: Props): number {
  const r = p.r || 80, str = p.value != null ? (p.pre || "") + fmtV(Number(p.value), p.dec) + (p.suf || "") : p.str;
  if (str == null || str === "" || (p.frac != null && p.frac < 0.999)) return r;
  const size = Math.min(p.size || r * 0.62, 46);
  if (approxW(str, size) <= r * 1.72) return r;
  return Math.min(Math.max(r, approxW(str, size) / 2 + r * 0.36), r * 2);
}
type Anchor = { x: number; y: number; r: number; hw?: number; box: Box | null; body?: Box };
/** Where a line from a's centre towards a point leaves a's body. */
export function edgePt(a: Anchor, towards: number[], pad = 10): number[] {
  const dx = towards[0] - a.x, dy = towards[1] - a.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
  if (a.r > 0) {
    let out = a.r;
    if (a.hw && a.hw > a.r + 1) { const A = a.hw - a.r, ax = Math.abs(ux), ay = Math.abs(uy); out = ay > 1e-6 && (a.r / ay) * ax <= A ? a.r / ay : A * ax + Math.sqrt(Math.max(0, a.r * a.r - A * A * ay * ay)); } // a pill: a bar with round ends
    return [a.x + ux * (out + pad - 8), a.y + uy * (out + pad - 8)];
  }
  const bb = a.body || a.box;
  if (bb) { const hw = (bb.x1 - bb.x0) / 2 + pad, hh = (bb.y1 - bb.y0) / 2 + pad, cx = (bb.x0 + bb.x1) / 2, cy = (bb.y0 + bb.y1) / 2, k = Math.min(Math.abs(ux) > 1e-6 ? hw / Math.abs(ux) : 1e9, Math.abs(uy) > 1e-6 ? hh / Math.abs(uy) : 1e9); return [cx + ux * Math.min(k, L * 0.9), cy + uy * Math.min(k, L * 0.9)]; }
  return [a.x, a.y];
}
/** The two ends of a line or arrow between A and B. A caption sits under its circle or icon: a line that leaves or arrives from below starts under the caption instead of crossing it. */
export function lineEnds(A: Anchor, B: Anchor, p: Props): number[][] {
  let a = p.from != null ? edgePt(A, [B.x, B.y]) : [A.x, A.y], b = p.to != null ? edgePt(B, [A.x, A.y], 14) : [B.x, B.y];
  const capUnder = (q: Anchor) => !!(q.box && (q.body ? q.box.y1 - q.body.y1 > 30 : q.r && q.box.y1 - (q.y + q.r) > 30));
  // across: a line of a TIME picture that runs from one column to another meets its circles from the side; the caption rule is for trees that grow down
  if (p.from != null && p.to != null && !p.curve && !(p.across && Math.abs(B.x - A.x) > 120)) {
    if (capUnder(A) && B.y - A.y > 60) { a = [A.x, A.box!.y1 + 6]; b = edgePt(B, a, 14); }
    else if (capUnder(B) && A.y - B.y > 60) { b = [B.x, B.box!.y1 + 16]; a = edgePt(A, b); }
  }
  return [a, b];
}
/** Where the label of a line or arrow sits: beside the middle of the line; off says how far and on which side. */
export function lineLabel(m: Model, p: Props, t: number, off?: number, pos?: number): (Box & { cx: number; cy: number }) | null {
  if (!p.str || p.from == null || p.to == null) return null;
  const A = anchorOf(m, String(p.from), t), B = anchorOf(m, String(p.to), t);
  if (!A || !B) return null;
  const [a, b] = lineEnds(A, B, p), dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, bend = Number(p.curve) || 0;
  const o = off != null ? off : p.loff != null ? Number(p.loff) : bend < 0 ? -50 : 50;
  const at = bend ? 0.5 : pos != null ? pos : p.lpos != null ? Number(p.lpos) : 0.5;
  const cx = a[0] + (b[0] - a[0]) * at - uy * (bend * 0.5 + o), cy = a[1] + (b[1] - a[1]) * at + ux * (bend * 0.5 + o), w = approxW(p.str, 40) + 36, h = 62;
  return { x0: cx - w / 2, y0: cy - h / 2, x1: cx + w / 2, y1: cy + h / 2, cx, cy };
}
export function boxOf(m: Model, o: MObj, p: Props, t: number): Box | null {
  const x = Number(p.x) || 0, y = Number(p.y) || 0;
  switch (o.type) {
    case "node": { const r = p.r || 80, capW = p.cap ? Math.min(340, approxW(p.cap, 42)) / 2 : 0, hw = Math.max(nodeHalf(p), capW); return { x0: x - hw, y0: y - r, x1: x + hw, y1: y + r + (p.cap ? 66 : 0) }; }
    case "box": { const w = p.w || 240, h = p.h || 120, hw = Math.max(w / 2, p.cap ? Math.min(340, approxW(p.cap, 42)) / 2 : 0); return { x0: x - hw, y0: y - h / 2, x1: x + hw, y1: y + h / 2 + (p.cap ? 66 : 0) }; }
    case "text": { const s = p.size || 56, w = Math.min(p.maxW || 1000, approxW(p.str, s)); return p.align === "left" ? { x0: x, y0: y - s * 0.62, x1: x + w, y1: y + s * 0.62 } : { x0: x - w / 2, y0: y - s * 0.62, x1: x + w / 2, y1: y + s * 0.62 }; }
    case "num": { const s = p.size || 120, w = approxW((p.pre || "") + fmtV(Number(p.value) || 0, p.dec) + (p.suf || ""), s); return { x0: x - w / 2, y0: y - s * 0.62 - (p.cap ? 62 : 0), x1: x + w / 2, y1: y + s * 0.62 }; }
    case "icon": { const s = p.size || 160, capW = p.cap ? Math.min(340, approxW(p.cap, 42)) / 2 : 0, hw = Math.max(s / 2, capW); return { x0: x - hw, y0: y - s / 2, x1: x + hw, y1: y + s / 2 + (p.cap ? 62 : 0) }; }
    case "bar": { const w = p.w || 120, h = Math.abs(barSlot(o, p)); return { x0: x - w / 2, y0: y - h - (p.value != null ? 95 : 0), x1: x + w / 2, y1: y + (p.str ? 82 : 44) }; } // a pillar: its number's pill rides 95 px over the top, its floor and name reach 82 px under the seat
    case "calc": { const s = calcSize(p), ts = normTerms(p), w = ts.reduce((a, q) => a + approxW(q.text, s), 0) + Math.max(0, ts.length - 1) * s * 0.34; return { x0: x - w / 2, y0: y - s * 0.7, x1: x + w / 2, y1: y + s * 0.7 }; }
    case "plot": { const map = plotMap(p); return { x0: map.x0 - 70, y0: map.y1 - map.h - 50, x1: map.x0 + map.w + 20, y1: map.y1 + 70 }; }
    case "table": { const d = tableDims(p); return { x0: d.x0, y0: d.y0, x1: d.x0 + d.w, y1: d.y0 + d.h }; }
    case "dot": { const c = dotPos(m, p, t); return c ? { x0: c[0] - 20, y0: c[1] - 20, x1: c[0] + 20, y1: c[1] + 20 } : null; }
    case "scale": { const hw = (p.w || 700) / 2; return { x0: x - hw - 150, y0: y - 110, x1: x + hw + 150, y1: y + 270 }; }
    case "dots": { const d = dotsDims(p); return { x0: x - d.w / 2, y0: y - d.h / 2, x1: x + d.w / 2, y1: y + d.h / 2 + (p.cap ? 66 : 0) }; }
    case "sign": {
      let sx = x, sy = y;
      if (Array.isArray(p.between)) { const c = signAt(m, p, t); if (!c) return null; sx = c[0]; sy = c[1]; }
      const s = p.size || 96, w = Math.max(s * 0.6, approxW(p.str || "=", s));
      return { x0: sx - w / 2, y0: sy - s * 0.5, x1: sx + w / 2, y1: sy + s * 0.5 };
    }
    case "axis": return null; // the floor of the picture: nothing collides with it, and it is never cut at the edges of the frame (see axisBox)
    default: return null;
  }
}
/** The room the time axis takes: its line, its stage labels under the line and, with a vertical axis, the line up the left with its name. */
export function axisBox(p: Props): Box {
  const x = Number(p.x) || 0, y = Number(p.y) || 0, x2 = Number(p.x2) || x, xs: number[] = Array.isArray(p.xs) ? p.xs.map(Number) : [];
  const half = xs.length > 1 ? (xs[1] - xs[0]) / 2 : 120, top = p.vname != null && typeof p.y2 === "number" ? p.y2 - 70 : y - 30;
  return { x0: Math.min(x - 30, xs.length ? xs[0] - half : x), y0: top, x1: Math.max(x2 + 40, xs.length ? xs[xs.length - 1] + half : x2), y1: y + 92 };
}
/** Where a note sits: beside the object it tags, on the given side. */
export function noteBox(m: Model, p: Props, t: number, side?: string): (Box & { cx: number; cy: number; w: number; h: number; tip: [number, number] }) | null {
  const A = anchorOf(m, String(p.to), t);
  if (!A) return null;
  const bx = A.box || { x0: A.x - A.r, x1: A.x + A.r, y0: A.y - A.r, y1: A.y + A.r }, size = p.size || 40, w = Math.min(520, approxW(p.str || "", size) + size * 0.9), h = size * 1.6, off = 30 + (Number(p.push) || 0), s = side || p.side || "right";
  let x = A.x, y = A.y, tip: [number, number];
  const sl = Number(p.slide) || 0; // a tag that found no free place beside its thing slides along that side: a second and third tag form a list
  if (s === "right") { x = bx.x1 + off + w / 2; y += sl; tip = [bx.x1 + 6, A.y]; } else if (s === "left") { x = bx.x0 - off - w / 2; y += sl; tip = [bx.x0 - 6, A.y]; } else if (s === "top") { y = bx.y0 - off - h / 2; x += sl; tip = [A.x, bx.y0 - 6]; } else { y = bx.y1 + off + h / 2; x += sl; tip = [A.x, bx.y1 + 6]; }
  x = clamp(x, w / 2 + 24, W - w / 2 - 24);
  return { x0: x - w / 2, y0: y - h / 2, x1: x + w / 2, y1: y + h / 2, cx: x, cy: y, w, h, tip };
}
/** The point other things aim at (arrows, flying numbers, tokens), with the radius to stop short of it. */
export function anchorOf(m: Model, id: string, t: number): Anchor | null {
  const o = m.objs.get(String(id));
  if (!o) return null;
  const p = stateOf(o, t), b = boxOf(m, o, p, t);
  if (o.type === "node") return { x: p.x, y: p.y, r: (p.r || 80) + 8, hw: nodeHalf(p) + 8, box: b };
  if (o.type === "icon") return { x: p.x, y: p.y, r: (p.size || 160) / 2 + 6, box: b };
  if (o.type === "box" && b && p.cap) { const w = p.w || 240, h = p.h || 120; return { x: p.x, y: p.y, r: 0, box: b, body: { x0: p.x - w / 2, y0: p.y - h / 2, x1: p.x + w / 2, y1: p.y + h / 2 } }; }
  if (o.type === "bar" && b) return { x: p.x, y: (b.y0 + (p.value != null ? 70 : 0) + p.y) / 2, r: 0, box: b };
  if (b) return { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, r: 0, box: b };
  if (typeof p.x === "number" && typeof p.y === "number") return { x: p.x, y: p.y, r: 0, box: null };
  return null;
}

// ---------- a plain description of what the viewer sees (for the reviewer model) ----------
const q = (s: unknown) => `"${String(s ?? "").replace(/\*/g, "")}"`;
function nameOf(m: Model, o: MObj, p: Props): string {
  const val = p.value != null ? (p.pre || "") + fmtV(Number(p.value), p.dec) + (p.suf || "") : p.str;
  const ref = (id: unknown) => { const r = objAt(m, id, o.tAdd); return r ? shortName(m, r, o.tAdd) : String(id); };
  switch (o.type) {
    case "node": return `원 ${q(val)}${p.cap ? `(아래 설명: ${p.cap})` : ""}${p.frac != null && p.frac < 1 ? ` (원의 ${fmtV(p.frac * 100)}%만 채워짐)` : ""}`;
    case "box": return `상자 ${q(val)}${p.sub ? ` / 둘째 줄 ${q(p.sub)}` : ""}`;
    case "text": return `글 ${q(p.str)}`;
    case "num": return `큰 숫자 ${q(val)}${p.cap ? `(위 설명: ${p.cap})` : ""}`;
    case "bar": return `막대${p.str ? ` ${q(p.str)}` : ""}${p.value != null ? ` 값 ${val}` : ""}`;
    case "icon": return `그림(${ICON_KO[p.name] || p.name})${p.cap ? ` ${q(p.cap)}` : ""}${p.badge ? ` 배지 ${q(p.badge)}` : ""}`;
    case "arrow": case "line": return `${o.type === "arrow" ? "화살표" : "선"} ${p.from != null ? ref(p.from) : "한 점"} → ${p.to != null ? ref(p.to) : "한 점"}${p.str ? ` 꼬리표 ${q(p.str)}` : ""}`;
    case "brace": return `구간 표시(${p.from != null ? ref(p.from) : "한 점"} ~ ${p.to != null ? ref(p.to) : "한 점"}) ${q(p.str)}`;
    case "calc": return `계산식 ${q(normTerms(p).map((x) => x.text).join(" "))}`;
    case "note": return `${ref(p.to)}에 붙은 쪽지 ${q(p.str)}`;
    case "plot": return `그래프(가로축 ${q(p.xl || "")}, 세로축 ${q(p.yl || "")}, 선: ${(Array.isArray(p.lines) ? p.lines : []).map((l: Props) => (l.str || l.id) + " " + JSON.stringify(l.pts)).join("; ") || "없음"}${Array.isArray(p.marks) && p.marks.length ? `, 표시선: ${p.marks.map((k: Props) => (k.str || "") + (k.x != null ? ` x=${k.x}` : ` y=${k.y}`)).join("; ")}` : ""})`;
    case "dot": return `그래프 위의 점(가로 ${fmtV(Number(p.px) || 0)})${p.str ? ` ${q(p.str)}` : ""}`;
    case "table": return `표(머리: ${(p.cols || []).join(" | ")}; 행: ${(p.rows || []).slice(0, p.show == null ? undefined : Math.round(p.show)).map((r: unknown[]) => r.join(" | ")).join(" / ")})`;
    case "sign": return `큰 기호 ${q(p.str)}${Array.isArray(p.between) ? ` (${ref(p.between[0])} 과 ${ref(p.between[1])} 사이)` : ""}`;
    case "scale": return `저울(왼쪽 접시 ${q(p.left || "")}, 오른쪽 접시 ${q(p.right || "")}, ${(p.tilt || 0) < -0.2 ? "왼쪽으로 기울어짐" : (p.tilt || 0) > 0.2 ? "오른쪽으로 기울어짐" : "수평"})`;
    case "axis": return `맨 아래 가로 시간축(왼쪽부터 ${(Array.isArray(p.labels) ? p.labels : []).map((x: unknown) => q(x)).join(", ")})${p.vname ? `, 왼쪽 세로축 ${q(p.vname)}` : ""}`;
    case "dots": return `점 ${dotsDims(p).n}개 격자(색칠된 점 ${Math.round(p.hi || 0)}개${p.hi2 ? `, 다른 색 점 ${Math.round(p.hi2)}개` : ""})${p.cap ? ` 설명 ${q(p.cap)}` : ""}`;
    default: return `${o.type} ${q(val)}`;
  }
}
function shortName(m: Model, o: MObj, t?: number): string {
  const p = t == null ? o.keys[o.keys.length - 1].p : stateOfEnd(o, t);
  const val = p.value != null ? (p.pre || "") + fmtV(Number(p.value), p.dec) + (p.suf || "") : p.str ?? p.cap ?? p.name ?? o.id;
  const kind: Record<string, string> = dict({ node: "원", box: "상자", text: "글", num: "숫자", bar: "막대", icon: "그림", calc: "계산식", plot: "그래프", table: "표", dot: "점", arrow: "화살표", line: "선", brace: "구간 표시", note: "쪽지", sign: "기호", scale: "저울", dots: "점 격자" });
  if (o.type === "scale") return "저울";
  if (o.type === "dots") return `점 격자${p.cap ? " " + q(p.cap) : ""}`;
  if (o.type === "icon") return `그림 ${q(p.cap || ICON_KO[p.name] || p.name)}`;
  if (o.type === "node" && p.cap) return `원 ${q(p.cap)}`;
  if (o.type === "bar" && p.str) return `막대 ${q(p.str)}`;
  if (o.type === "calc") return `계산식 ${q(normTerms(p).map((x) => x.text).join(" "))}`;
  if (o.type === "plot") return `그래프 ${q([p.yl, p.xl].filter(Boolean).join(" / ") || o.id)}`;
  if (o.type === "table") return `표 ${q((p.rows || []).map((r: unknown[]) => r[0]).join(", ") || o.id)}`;
  if (o.type === "dot") return "그래프 위의 점";
  return `${kind[o.type] || o.type} ${q(val)}`;
}
/** the last properties set at or before t, without the glide */
function stateOfEnd(o: MObj, t: number): Props { let p = o.keys[0].p; for (const k of o.keys) if (k.t <= t) p = k.p; return p; }
/** the object an id means at time t (an id can be reused after its first owner has left) */
function objAt(m: Model, id: unknown, t: number): MObj | undefined {
  const all = m.list.filter((o) => o.id === String(id));
  return all.filter((o) => o.tAdd <= t + 1e-6).pop() || all[0];
}
export const DESCRIBE_KEY = "표기: + 새로 나타남, − 사라짐, ~ 바뀜, → 무언가 이동, ! 잠깐 커지며 강조. 계산식의 (22원←원 \"…\")는 그 숫자가 그 물체에서 날아와 식이 된다는 뜻.";
/** What a first-time viewer sees, scene by scene, in words. The reviewer reads this instead of watching. */
export function describe(script: Script, opt: { speed?: number } = {}): string {
  const m = prep(script, opt), out: string[] = [];
  m.beats.forEach((bm) => {
    const { b, t0, dur, i } = bm, t1 = t0 + dur - 0.02, L: string[] = [];
    L.push(`[${i + 1}] ${b.ask ? "질문 장면" : q(b.say || "(문장 없음)")}`);
    const plus: string[] = [];
    m.list.filter((o) => o.beat === i).forEach((o) => {
      const p = o.keys[0].p;
      let s = nameOf(m, o, p);
      if (o.type === "calc") {
        const terms = normTerms(p), eq = terms.findIndex((y) => y.text === "=" || y.text === "≈");
        const src = terms.filter((x) => x.from).map((x) => { const r = objAt(m, x.from, o.tAdd); return `${x.text}←${r ? shortName(m, r, o.tAdd) : x.from}`; });
        const bare = terms.filter((x, k) => x.kind === "num" && !x.from && (eq < 0 || k < eq)).map((x) => x.text);
        if (src.length) s += ` (${src.join(", ")})`;
        if (bare.length) s += ` (어디서 왔는지 표시 없이 식에 나타나는 숫자: ${bare.join(", ")})`;
      }
      plus.push(s);
    });
    if (plus.length) L.push(" + " + plus.join(" · "));
    const minus: string[] = [], bang: string[] = [];
    m.list.forEach((o) => {
      for (let k = 1; k < o.keys.length; k++) {
        const key = o.keys[k];
        if (key.t < t0 || key.t >= t0 + dur) continue;
        const a = nameOf(m, o, o.keys[k - 1].p), z = nameOf(m, o, key.p), pa = o.keys[k - 1].p, pz = key.p, notes: string[] = [];
        if (a !== z) notes.push(`${a} → ${z}`);
        if (pa.color !== pz.color && pz.color) notes.push(`색이 ${pz.color}(으)로`);
        if ((pa.x !== pz.x || pa.y !== pz.y) && typeof pz.x === "number") notes.push("자리를 옮김");
        if (notes.length) L.push(` ~ ${a === z ? shortName(m, o, key.t) + ": " : ""}${notes.join(", ")}`);
      }
      if (o.tDel >= t0 && o.tDel < t0 + dur && !(o.type === "calc" && (o.auto || m.list.some((c) => c.type === "calc" && c !== o && Math.abs(c.tAdd - o.tDel) < 1e-6)))) minus.push(shortName(m, o, o.tDel - 0.01));
      if (o.pulses.some((x) => x >= t0 && x < t0 + dur)) bang.push(shortName(m, o, t1));
    });
    m.sends.filter((s) => s.i === i).forEach((s) => {
      const a = objAt(m, s.from, s.t0), z = objAt(m, s.to, s.t0);
      L.push(` → ${s.icon ? `그림(${ICON_KO[s.icon] || s.icon})` : "조각"}${s.str ? ` ${q(s.str)}` : ""}: ${a ? shortName(m, a, s.t0) : s.from}에서 ${z ? shortName(m, z, s.t0) : s.to}(으)로`);
    });
    if (bang.length) L.push(" ! " + bang.join(" · "));
    const cleared = (b.do || []).some((a) => a && a.op === "clear");
    if (cleared) { const on = m.list.filter((o) => alive(o, t1) && SOLID.has(o.type)).map((o) => shortName(m, o, t1)); L.push(` 화면을 정리함. 남은 것: ${on.join(" · ") || "없음"}`); }
    else if (minus.length) L.push(" − " + minus.join(" · "));
    if (b.ask) L.push(` 묻는 말: ${q(b.ask.q || "")} 보기 ${b.ask.choices.map((c, k) => `${k + 1}) ${c}`).join("  ")} → 잠시 뒤 정답 ${b.ask.answer + 1}번이 밝혀짐${b.ask.why ? `, 한마디 ${q(b.ask.why)}` : ""}`);
    out.push(L.join("\n"));
  });
  return out.join("\n");
}

// ---------- checks ----------
const TRIVIAL = new Set([0, 1, 2]);
const near = (set: Set<number>, v: number) => { if (set.has(v)) return true; for (const s of set) if (Math.abs(s - v) <= Math.max(1e-9, Math.abs(v) * 1e-6)) return true; return false; };
function textsOf(type: string, p: Props, prev?: Props): unknown[] {
  const keys = ["str", "sub", "cap", "badge", "xl", "yl", "left", "right"], out: unknown[] = [];
  for (const k of keys) if (p[k] != null && (!prev || prev[k] !== p[k])) out.push(p[k]);
  if (p.value != null && (!prev || prev.value !== p.value) && type !== "dot") out.push(Number(p.value));
  if (type === "table") { const a = JSON.stringify([p.cols, p.rows]); if (!prev || JSON.stringify([prev.cols, prev.rows]) !== a) { (p.cols || []).forEach((c: unknown) => out.push(c)); (p.rows || []).forEach((r: unknown[]) => (r || []).forEach((c) => out.push(c))); } }
  if (type === "plot") { (p.marks || []).forEach((k: Props) => { if (k && k.str != null) out.push(k.str); }); (p.lines || []).forEach((l: Props) => { if (l && l.str != null) out.push(l.str); }); }
  return out;
}
/** Problems a script must not ship with. Errors go back to the writer; warnings are advice. */
export function lint(script: Script, opt: { speed?: number } = {}): Issue[] {
  const out: Issue[] = [], err = (beat: number, code: string, msg: string) => out.push({ level: "error", beat, code, msg }), warn = (beat: number, code: string, msg: string) => out.push({ level: "warn", beat, code, msg });
  if (!script || !Array.isArray(script.beats) || !script.beats.length) { err(0, "empty", "The script has no scenes."); return out; }
  const COVER = err; // the engine has already taken the least bad place, so only the script can make room: the one repair says it another way
  const m = prep(script, opt);
  m.warn.forEach((w) => err(0, "ref", w));
  if (m.seated.length) warn(0, "seat", `No seat in GRID for: ${m.seated.join(", ")}. They were placed in the first free row.`);
  if (m.beats.length < 5) warn(0, "short", `Only ${m.beats.length} scenes: a short needs a hook, the build-up and a pay-off.`);
  if (m.beats.length > 14) err(0, "long", `${m.beats.length} scenes are too many for one short (13 at most). Merge or delete the least important scenes.`);
  if (m.asks.length !== 1) err(0, "ask", m.asks.length ? `${m.asks.length} scenes ask a question; exactly one, right before the key reveal.` : "No scene asks the viewer to predict. Put exactly one ask scene right before the key reveal.");
  const clears = m.beats.filter(({ b, t0, dur, i }) => (b.do || []).some((a) => a && a.op === "clear") && m.list.filter((o) => SOLID.has(o.type) && o.type !== "calc" && o.beat < i && o.tDel >= t0 && o.tDel < t0 + dur).length >= 3).length;
  if (clears > 2) err(0, "slides", `The screen is wiped in ${clears} scenes. Build one picture and keep it: wipe at most twice, and never draw again what was already on screen.`);
  const body = (m.DUR - m.hook.len - m.end.len + TAIL) / m.speed; // the hook and the end card are the engine's, not the writer's: they do not count
  if (body > 66) err(0, "long", `The short runs ${body.toFixed(0)} s; keep it under 60 s by cutting scenes or splitting into parts.`);
  else if (body > 60) warn(0, "long", `The short runs ${body.toFixed(0)} s; 60 s or less holds attention better.`);
  // numbers: nothing may appear without a visible origin
  const plan = script.plan || {}, given = new Set<number>(), seen = new Set<number>();
  (plan.given || []).forEach((g) => numsIn(g && g.v).forEach((v) => given.add(v)));
  m.list.forEach((o) => { if (o.type === "axis") [o.keys[0].p.vname].concat(o.keys[0].p.labels || []).forEach((s) => numsIn(s).forEach((v) => given.add(v))); }); // the stage labels are on screen from the start ("3년 뒤")
  const ok = (v: number) => TRIVIAL.has(v) || near(given, v) || near(seen, v);
  const seenIds = new Set<string>(), computed = new Set<number>();
  const everIds = new Set<string>(); m.beats.forEach(({ b }) => (b.do || []).forEach((a) => { if (a.id != null && (a.type || (a.op || "add") === "add")) everIds.add(String(a.id)); }));
  let calcSeen = false;
  m.beats.forEach(({ b, i, t0, dur }) => {
    const n = i + 1, acts = (b.do || []).filter((a) => a && typeof a === "object");
    if (!b.say && !b.ask) warn(n, "say", "This scene has no sentence.");
    const chars = sayChars(b.say || b.ask?.q);
    if (chars > 30) err(n, "say", `The sentence has ${chars} characters without spaces; 24 at most so it can be read at a glance.`);
    else if (chars > 24) warn(n, "say", `The sentence has ${chars} characters without spaces; aim for 20.`);
    const pic = acts.length > 0 || !!b.ask || !!b.cam || (Array.isArray(b.focus) && b.focus.length > 0);
    if (!pic) err(n, "still", "Nothing changes in the picture in this scene. Every scene must show its idea, not only say it.");
    const adds = acts.filter((a) => (a.op || (a.type ? "add" : "set")) === "add");
    const heavy = adds.filter((a) => !["arrow", "line", "note", "brace", "sign", "dot", "calc", "axis"].includes(String(a.type)));
    if (heavy.length > 4) err(n, "crowd", `${heavy.length} new objects appear in one scene; 3 at most. Keep what is already on screen instead of drawing it again, or spread the new things over two scenes.`);
    if (adds.filter((a) => a.type === "calc").length > 1) err(n, "crowd", "Two calculations in one scene. One calculation per scene.");
    // ids and types
    for (const a of acts) {
      const op = a.op || (a.type ? "add" : "set");
      if (!["add", "set", "del", "pulse", "send", "clear"].includes(op)) { err(n, "op", `Unknown op "${op}".`); continue; }
      if (op === "add") {
        if (!TYPES.includes(String(a.type))) err(n, "type", `Unknown type "${a.type}" (id ${a.id}).`);
        if (a.id != null && seenIds.has(String(a.id))) warn(n, "dup", `id "${a.id}" is added twice; the first one is removed when the second appears.`);
        if (a.id != null) seenIds.add(String(a.id));
        if (a.type === "icon" && !ICONS[String(a.name)]) warn(n, "icon", `Unknown icon name "${a.name}" (id ${a.id}); a plain circle is drawn. Use a name from the list.`);
        for (const k of ["from", "to", "plot"]) if (a[k] != null && a.type !== "calc" && !(k === "plot" ? seenIds : everIds).has(String(a[k]))) err(n, "ref", `"${a.id}" points at "${a[k]}" which does not exist.`);
        if (a.type === "sign" && Array.isArray(a.between)) a.between.forEach((r: unknown) => { if (!everIds.has(String(r))) err(n, "ref", `sign "${a.id}" sits between "${r}" which does not exist.`); });
        if (["arrow", "line", "brace"].includes(String(a.type)) && (a.from == null || a.to == null) && [a.x, a.y, a.x2, a.y2].some((v) => typeof v !== "number")) err(n, "ref", `"${a.id}" needs from and to, or x, y, x2, y2.`);
        if (a.type === "note" && a.to == null) err(n, "ref", `note "${a.id}" needs "to".`);
      } else if (op === "send") {
        for (const k of ["from", "to"]) if (!seenIds.has(String(a[k]))) err(n, "ref", `send: "${a[k]}" does not exist yet.`);
        if (a.icon != null && !ICONS[String(a.icon)]) err(n, "icon", `send: unknown icon name "${a.icon}".`);
      }
    }
    (b.focus || []).forEach((id) => { if (!seenIds.has(String(id))) err(n, "ref", `focus names "${id}" which does not exist.`); });
    if (b.ask) {
      const right = numsIn((b.ask.choices || [])[b.ask.answer]);
      if (right.length && right.every((v) => near(computed, v))) err(n, "ask", "The question comes after its answer was already worked out on screen. Move the ask scene to just before the scene that reveals the answer.");
      if (!Array.isArray(b.ask.choices) || b.ask.choices.length < 2 || b.ask.choices.length > 3) err(n, "ask", "A question needs 2 or 3 choices.");
      else if (!(b.ask.answer >= 0 && b.ask.answer < b.ask.choices.length)) err(n, "ask", "The answer index is out of range.");
      (b.ask.choices || []).forEach((c) => { if (approxW(c, 52) > 820) err(n, "ask", `Choice "${c}" is too long for a button (14 characters at most).`); });
    }
    // calculations
    for (const a of adds.filter((x) => x.type === "calc")) {
      const terms = normTerms(a), eq = terms.findIndex((x) => x.text === "=" || x.text === "≈");
      if (terms.length < 3) { err(n, "calc", `calc "${a.id}" needs at least two operands and a result.`); continue; }
      terms.forEach((x, k) => {
        if (x.from && !seenIds.has(x.from)) err(n, "ref", `calc "${a.id}": term ${x.text} flies from "${x.from}" which does not exist yet.`);
        if (x.kind === "num" && (eq < 0 || k < eq)) {
          if (!ok(x.v as number)) err(n, "orphan", `calc "${a.id}" uses ${x.text}, but that number has not been shown before and is not in GIVEN. Show where it comes from first.`);
          else if (!x.from && !TRIVIAL.has(x.v as number) && near(seen, x.v as number)) warn(n, "from", `calc "${a.id}": give term ${x.text} a "from" so the viewer sees which object it comes from.`);
        }
      });
      const c = checkCalc(terms);
      if (c && !c.ok) err(n, "math", `calc "${a.id}" is wrong: the left side is ${fmtV(c.lhs)}, but the result shown is ${fmtV(c.rhs)}.`);
      if (eq >= 0) terms.slice(eq + 1).forEach((x) => { if (x.kind === "num") { seen.add(x.v as number); computed.add(x.v as number); } });
      const operands = terms.filter((x, k) => x.kind === "num" && (eq < 0 || k < eq)).length;
      if (operands > 3 || calcSize(a) < 44) err(n, "fit", `calc "${a.id}" is too long to read on a phone (${operands} numbers before "="; 3 at most). Split it into two calculations in two scenes.`);
      terms.forEach((x) => { if (x.from) { const src = m.objs.get(x.from); if (src && !(src.tAdd <= t0 + dur && src.tDel > t0 + 0.2)) warn(n, "from", `calc "${a.id}": term ${x.text} comes from "${x.from}", which is no longer on screen. Keep that result in a node or box.`); } });
    }
    // every other number that appears in this scene
    const texts: unknown[] = [b.say, b.ask?.q]; // the reason shown with the answer may name what the next scene works out
    if (adds.some((a) => a.type === "calc")) calcSeen = true;
    m.list.forEach((o) => {
      if (o.beat === i && o.type !== "calc") texts.push(...textsOf(o.type, o.keys[0].p));
      for (let k = 1; k < o.keys.length; k++) if (o.keys[k].t >= t0 - 1e-6 && o.keys[k].t < t0 + dur) texts.push(...textsOf(o.type, o.keys[k].p, o.keys[k - 1].p));
    });
    m.sends.filter((x) => x.i === i).forEach((x) => texts.push(x.str));
    const bad = new Map<number, string>();
    if (!calcSeen) texts.forEach((s) => numsIn(s).forEach((v) => given.add(v))); // the set-up scenes introduce what is given
    // a run of whole numbers counted out in one scene (1, 2, 3, 4 on four things) numbers the things; it is not a quantity either
    const here = new Set<number>();
    texts.forEach((s) => quantitiesIn(s).forEach((v) => here.add(v)));
    const counted = (v: number) => Number.isInteger(v) && v >= 3 && v <= 30 && here.has(v - 1) && here.has(v - 2);
    texts.forEach((s) => quantitiesIn(s).forEach((v) => { if (!ok(v) && !counted(v) && !bad.has(v)) bad.set(v, String(s).replace(/\*/g, "").slice(0, 24)); }));
    if (bad.size) err(n, "orphan", `Number${bad.size > 1 ? "s" : ""} ${[...bad.keys()].map((v) => `${fmtV(v)} (in "${bad.get(v)}")`).join(", ")} appear${bad.size > 1 ? "" : "s"} in this scene with no visible origin. A number must be given at the start (list it in GIVEN) or be the result of a calc the viewer has watched.`);
    texts.forEach((s) => numsIn(s).forEach((v) => { if (near(given, v)) seen.add(v); }));
    // layout at the end of the scene
    const t1 = t0 + dur - 0.02, boxes: { o: MObj; b: Box }[] = [];
    m.list.forEach((o) => {
      if (!alive(o, t1) || !(SOLID.has(o.type) || o.type === "sign")) return;
      const p = stateOf(o, t1), bx = boxOf(m, o, p, t1);
      if (o.type === "sign" && o.beat === i) { const w = signBlocker(m, p, t1); if (w) warn(n, "apart", `sign "${o.id}" is not drawn: "${w.id}" sits between "${p.between[0]}" and "${p.between[1]}". A sign reads only between two neighbours; for things that are apart, pulse both and say it in the sentence.`); }
      if (!bx) return;
      if (o.beat === i || o.keys.some((k) => k.t >= t0 && k.t < t0 + dur)) {
        if (bx.x0 < ZONE.x0 - 6 || bx.x1 > ZONE.x1 + 6) err(n, "layout", `"${o.id}" runs off the side of the screen (x ${Math.round(bx.x0)}..${Math.round(bx.x1)}; keep within ${ZONE.x0}..${ZONE.x1}).`);
        // text that would shrink too far
        if (o.type === "box" && p.str != null) { const s = Math.floor(((p.w || 240) - 28) / Math.max(1e-6, approxW(p.str, 1))); if (s < 34) err(n, "fit", `The text of box "${o.id}" does not fit its width; shorten it or widen the box.`); }
        if (o.type === "node" && (p.str != null || p.value != null)) { const str = p.value != null ? (p.pre || "") + fmtV(Number(p.value), p.dec) + (p.suf || "") : p.str, r = p.r || 80, hw = nodeHalf(p), s = Math.floor((hw > r ? 2 * hw - r * 0.5 : r * 1.72) / Math.max(1e-6, approxW(str, 1))); if (s < 30) err(n, "fit", `The text of node "${o.id}" is too long even for a widened circle; shorten it (about 9 characters at most) or use a box.`); }
        if (o.type === "text" && approxW(p.str, 34) > 1000) err(n, "fit", `text "${o.id}" is too long for one line.`);
        if (o.type === "scale") [["left", p.left], ["right", p.right]].forEach(([side, str]) => { if (str != null && str !== "" && Math.floor(272 / Math.max(1e-6, approxW(str, 1))) < 38) err(n, "fit", `The name on the ${side} pan of scale "${o.id}" ("${str}") is too long to read on a phone; 8 characters at most, so say the rest in the sentence or in a node beside the scale.`); });
      }
      boxes.push({ o, b: bx });
    });
    const fr = frameOf(m, i), ids = refsOf(b), full = coreBox(m, i, ids), cb = aboutBox(m, i, ids, b);
    if (fr && !fr.fits && b.ask) warn(n, "crowd", "Much is on screen above the answer buttons; the picture is shown small during the question.");
    else if (cb && !b.ask && !roomy(cb, false, ZLOW)) err(n, "crowd", "What this scene adds is spread too far apart to show in one frame at a readable size. Put the things one scene adds in the same row or in neighbouring rows, and keep the picture within four rows.");
    else if (full && !b.ask && !roomy(full, false, ZMIN)) warn(n, "tall", "This scene works with things that are far apart in a tall picture, so part of what it points at is off screen. Keep the things one scene works with in neighbouring rows.");
    for (let a = 0; a < boxes.length; a++) for (let c = a + 1; c < boxes.length; c++) {
      const A = boxes[a], B = boxes[c];
      if (A.o.beat !== i && B.o.beat !== i && !A.o.keys.some((k) => k.t >= t0 && k.t < t0 + dur) && !B.o.keys.some((k) => k.t >= t0 && k.t < t0 + dur)) continue; // already reported in an earlier scene
      const ix = Math.min(A.b.x1, B.b.x1) - Math.max(A.b.x0, B.b.x0), iy = Math.min(A.b.y1, B.b.y1) - Math.max(A.b.y0, B.b.y0);
      if (ix <= -16 || iy <= -8) continue; // text that almost touches reads as one lump
      const small = Math.min((A.b.x1 - A.b.x0) * (A.b.y1 - A.b.y0), (B.b.x1 - B.b.x0) * (B.b.y1 - B.b.y0));
      if (((ix + 16) * (iy + 8)) / Math.max(1, small) > 0.06) err(n, "overlap", `"${A.o.id}" and "${B.o.id}" overlap or touch on screen. Put them in different slots (a row holds M, or L R, or A B C), shorten a caption, or delete what is no longer needed.`);
    }
    // a tag or a line label that still covers something after the engine took the best place there was
    m.list.forEach((o) => {
      const isTag = o.type === "note", isLab = (o.type === "arrow" || o.type === "line") && !!o.keys[0].p.str;
      if (!(isTag || isLab) || !alive(o, t1)) return;
      const p = stateOf(o, t1), tb = isTag ? noteBox(m, p, t1) : lineLabel(m, p, t1);
      if (!tb) return;
      for (const { o: q, b: qb } of boxes) {
        if ((isTag && q.id === String(p.to)) || q.type === "calc" || (o.beat !== i && q.beat !== i)) continue; // reported in the scene where the later of the two arrives
        const ix = Math.min(tb.x1, qb.x1) - Math.max(tb.x0, qb.x0), iy = Math.min(tb.y1, qb.y1) - Math.max(tb.y0, qb.y0);
        if (ix > 14 && iy > 12 && ix * iy > 700) { COVER(n, "cover", `The ${isTag ? "tag" : "label of the line"} "${o.id}" (${p.str}) has no free place and covers "${q.id}". There is too much in that spot: say it in the caption of the thing instead (set <id> cap="..."), tag a thing that has room beside it, or drop it.`); break; }
      }
    });
    const onScreen = boxes.length;
    if (onScreen > 9) warn(n, "crowd", `${onScreen} objects are on screen at once; delete what is no longer needed (use "clear").`);
  });
  // plan coverage
  const steps = (plan.steps || []).length;
  if (steps) {
    const used = new Set(m.beats.map((x) => x.b.step).filter((x) => x != null));
    for (let s = 1; s <= steps; s++) if (!used.has(s)) warn(0, "plan", `Plan step ${s} has no scene (set "step" on the scene that shows it).`);
  }
  return out;
}
