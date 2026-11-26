// The scene notation ("대본 표기"): a compact text form of a scene script.
// The model writes this instead of JSON, which costs about half the output tokens for the same film.
// parseScript() turns it into the Script the engine plays, toText() writes a Script back, applyPatch() merges a repair.
import type { Script, Beat, Action, Plan, Issue, Props, Quiz } from "./core";
import { COLS, ROWS, hangOf, dotsDims, approxW } from "./core";
import { dict } from "./ease";
import { ICONS } from "./icons";

/** The unit an object's number carries, the number itself, and the words written on the object (a label may name another number with its own unit). */
export interface UnitOf { pre?: string; suf?: string; v?: number; texts?: string[] }
export interface Ctx { grid?: Record<string, [number, number]>; units?: Record<string, UnitOf>; time?: boolean }
export interface Parsed { script: Script; issues: Issue[]; labels: string[]; dels: string[]; has: Record<string, boolean>; grid: Record<string, [number, number]>; units: Record<string, UnitOf> }
/** How much room a thing needs above and below the line of its row. A circle with a caption is the default; tall things (a balance, a dot grid, a table, a plot) hang down from the row, a bar stands up on it. */
export type Reach = Record<string, { up: number; down: number }>;
const UP = 105, DOWN = 145, TOP = 535;
const BAR_TOP = 300;
/** Pixels per unit of value for the bars of one short. */
const barUnit = (values: number[]) => { const top = Math.max(0, ...values.map((v) => Math.abs(v) || 0)); return top > 0 ? BAR_TOP / top : 1; };
/** A place written as "x,y" before the value (the parser reads a bare "880,1430" as a position; toText writes one for a thing it has seated) is not the value. */
/** "1,000" is a thousand written with its comma, not the place x 1, y 0: a place that would sit off the left edge or up in the sentence is read as a number */
const groupedNum = (s: string): boolean => { const m = /^(\d{1,3}),(\d{3})$/.exec(s.trim()); return !!m && (+m[1] < 36 || +m[2] < 300); };
const noPos = (rest: string) => rest.replace(/^\s*(-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?)(?=\s|$)/, (all, xy) => (groupedNum(xy) ? all : ""));
/** The largest value each bar ever takes (the line that adds it and every "set" after). */
export function barValues(text: string): Record<string, number> {
  const out: Record<string, number> = dict();
  for (const raw of String(text || "").split("\n")) {
    const m = /^\s*(bar|set)\s+([A-Za-z_]\w*)\b(.*)$/.exec(raw);
    if (!m || (m[1] === "set" && out[m[2]] == null)) continue;
    const v = /^\s*[^\d\s"=-]*(-?\d[\d,]*(?:\.\d+)?)/.exec(noPos(m[3]));
    out[m[2]] = Math.max(out[m[2]] || 0, v ? Math.abs(parseFloat(v[1].replace(/,/g, ""))) : 0);
  }
  return out;
}
/** Read every line once to learn which ids are tall, before any seat is given out. */
export function reachOf(text: string): Reach {
  const out: Reach = dict(), bars: Record<string, { v: number; scale: number }> = dict();
  for (const raw of String(text || "").split("\n")) {
    const m = /^\s*(scale|dots|plot|table|bar|set)\s+([A-Za-z_]\w*)\b(.*)$/.exec(raw);
    if (!m) continue;
    const type = m[1], id = m[2], rest = m[3], num = (key: string) => { const q = new RegExp("\\b" + key + "\\s*=\\s*(-?\\d+(?:\\.\\d+)?)").exec(rest); return q ? parseFloat(q[1]) : NaN; };
    if (type === "scale") out[id] = { up: UP, down: 325 };
    else if (type === "dots") { const h = dotsDims({ n: num("n") || 100 }).h; out[id] = { up: UP, down: h + 11 }; }
    else if (type === "plot") { const h = num("h") || 560; out[id] = { up: 155, down: h + 15 }; }
    else if (type === "table") { const q = /rows\s*=\s*"([^"]*)"/.exec(rest), n = q ? q[1].split("/").length : 2, head = /cols\s*=/.test(rest) ? 1 : 0, rh = num("rowH") || 112; out[id] = { up: UP, down: rh * (n + head) - 55 }; }
    else if (type === "bar" || (type === "set" && bars[id])) {
      const v = /^\s*[^\d\s"=-]*(-?\d[\d,]*(?:\.\d+)?)/.exec(noPos(rest)), b = bars[id] || (bars[id] = { v: 0, scale: 1 });
      if (v) b.v = Math.max(b.v, Math.abs(parseFloat(v[1].replace(/,/g, ""))));
      out[id] = { up: UP, down: DOWN };
    }
  }
  // bars share one measure: the tallest bar of the short stands BAR_TOP high and the others in proportion
  const unit = barUnit(Object.keys(bars).map((k) => bars[k].v));
  Object.keys(bars).forEach((k) => { out[k] = { up: Math.max(UP, bars[k].v * unit + 95), down: DOWN }; });
  // a tag above or below a thing that fills its row needs room of its own: the row grows by one tag
  const done = new Set<string>();
  for (const raw of String(text || "").split("\n")) {
    const m = /^\s*note\s+[A-Za-z_]\w*\s+@?([A-Za-z_]\w*)\b(.*)$/.exec(raw);
    if (!m || !out[m[1]] || bars[m[1]]) continue;
    const side = /\btop\b/.test(m[2].replace(/"[^"]*"/g, "")) ? "up" : "down";
    if (done.has(m[1] + side)) continue;
    done.add(m[1] + side); out[m[1]][side] += 95;
  }
  return out;
}
/**
 * Room a circle needs above and below its centre (r up, r plus its caption down; a caption set later counts too),
 * so that two of them one row apart in the same column of a time axis do not touch. Used by the row reading under TIME only: films drawn
 * before it keep their seats.
 */
export function circleReach(text: string, reach: Reach): Reach {
  const out: Reach = dict(), rad: Record<string, number> = dict(), cap = new Set<string>();
  Object.keys(reach).forEach((k) => { out[k] = { ...reach[k] }; });
  for (const raw of String(text || "").split("\n")) {
    const m = /^\s*(node|set)\s+([A-Za-z_]\w*)\b(.*)$/.exec(raw);
    if (!m || (m[1] === "set" && rad[m[2]] == null)) continue;
    const r = /(?:^|\s)r=(\d+(?:\.\d+)?)/.exec(m[3].replace(/"[^"]*"/g, ""));
    if (m[1] === "node") rad[m[2]] = r ? +r[1] : 80;
    if (/(?:^|\s)cap=/.test(m[3])) cap.add(m[2]);
  }
  Object.keys(rad).forEach((id) => {
    const o = out[id] || (out[id] = { up: UP, down: DOWN });
    o.up = Math.max(o.up, rad[id] + 6); o.down = Math.max(o.down, rad[id] + (cap.has(id) ? 66 : 0) + 10);
  });
  return out;
}
const PLACED_T = ["node", "box", "icon", "num", "bar", "text", "table", "plot", "scale", "dots"];
/** Read every line once to learn in which scenes each placed thing is on screen (first scene, last scene), before any seat is given out. */
export function lifeOf(text: string): Record<string, { a: number; b: number; ord: number }> {
  const out: Record<string, { a: number; b: number; ord: number }> = dict();
  let n = 0, ord = 0;
  for (const raw of String(text || "").split("\n")) {
    const line = raw.trim();
    if (line[0] === "#") { n++; continue; }
    const m = n ? /^([a-z]+)\s*(.*)$/.exec(line) : null;
    if (!m) continue;
    const op = m[1], rest = m[2];
    if (PLACED_T.includes(op)) { const id = /^([A-Za-z_]\w*)/.exec(rest); if (id) { if (out[id[1]]) out[id[1]].b = Infinity; else out[id[1]] = { a: n, b: Infinity, ord: ord++ }; } }
    else if (op === "del") rest.split(/[\s,]+/).forEach((id) => { if (out[id] && out[id].b === Infinity) out[id].b = n; });
    else if (op === "clear" || op === "keep") {
      const ids = rest.replace(/\bkeep\s*=\s*/, " keep ").split(/[\s,]+/).filter(Boolean), named = ids.filter((x) => x !== "keep" && x !== "except");
      if (op === "clear" && named.length === ids.length && named.length) named.forEach((id) => { if (out[id] && out[id].b === Infinity) out[id].b = n; });
      else Object.keys(out).forEach((id) => { if (!named.includes(id) && out[id].b === Infinity) out[id].b = n; });
    }
  }
  return out;
}
/** "GRID s / u d / fu fd / k": the seats of the picture, row by row from the top. One thing in a row sits in the middle, two sit left and right, three across; "-" leaves a seat empty. A row with a tall thing takes the room it needs and the rows under it move down. */
export function gridSeats(line: string, reach: Reach = dict()): Record<string, [number, number]> {
  const out: Record<string, [number, number]> = dict();
  let y = 0, prevDown = 0, r = 0;
  for (const row of String(line || "").split("/")) {
    const ids = row.trim().split(/[\s,]+/).filter(Boolean), cols = ids.length === 1 ? ["M"] : ids.length === 2 ? ["L", "R"] : ["A", "B", "C"];
    if (r >= 6) break;
    if (r > 0 && prevDown > DOWN && ids.length > 0 && ids.every((id) => id === "-")) continue; // an empty row left under a tall thing: the tall row already took that room
    const up = Math.max(UP, ...ids.map((id) => (reach[id] ? reach[id].up : UP))), down = Math.max(DOWN, ...ids.map((id) => (reach[id] ? reach[id].down : DOWN)));
    y = r === 0 ? TOP + up : y + prevDown + up;
    ids.slice(0, 3).forEach((id, k) => { if (/^[A-Za-z_]\w*$/.test(id)) out[id] = [COLS[cols[k]], y]; });
    prevDown = down; r++;
  }
  return out;
}
/** "TIME 오늘 | 3개월 뒤" with "GRID s / u d": the groups of GRID are stages in time order, seated as columns from left to right over a time axis.
 *  The ids of a group stack from the top; a group with fewer seats than the tallest one is centred beside it, so a tree opens from the middle
 *  (s sits halfway between u and d). "-" leaves a seat empty. Rows take the room their tallest thing needs, as in gridSeats. */
export const TIME_XS: Record<number, number[]> = { 1: [540], 2: [290, 790], 3: [200, 540, 880], 4: [165, 415, 665, 915] };
export function timeSeats(line: string, reach: Reach = dict()): Record<string, [number, number]> {
  const out: Record<string, [number, number]> = dict();
  const groups = String(line || "").split("/").map((g) => g.trim().split(/[\s,]+/).filter(Boolean).slice(0, 4)).slice(0, 4), xs = TIME_XS[groups.length] || TIME_XS[4];
  const R = Math.max(1, ...groups.map((g) => g.length));
  const at: { id: string; c: number; f: number }[] = [];
  groups.forEach((g, c) => g.forEach((id, j) => at.push({ id, c, f: (R - g.length) / 2 + j })));
  const up = (id: string) => (reach[id] ? reach[id].up : UP), down = (id: string) => (reach[id] ? reach[id].down : DOWN);
  // a thing halfway between two rows needs room in both
  const ys: number[] = [];
  let prevDown = 0;
  for (let r = 0; r < R; r++) {
    const here = at.filter((a) => a.id !== "-" && Math.abs(a.f - r) <= 0.5);
    const u = Math.max(UP, ...here.map((a) => up(a.id)));
    ys.push(r === 0 ? TOP + u : ys[r - 1] + prevDown + u);
    prevDown = Math.max(DOWN, ...here.map((a) => down(a.id)));
  }
  const yAt = (f: number) => { const a = Math.floor(f), b = Math.min(R - 1, Math.ceil(f)); return ys[a] + (ys[b] - ys[a]) * (f - a); };
  at.forEach((a) => { if (/^[A-Za-z_]\w*$/.test(a.id)) out[a.id] = [xs[a.c], Math.round(yAt(a.f))]; });
  return out;
}
/** The same picture when GRID has more groups than TIME has stages: then a group cannot be a stage, so each group is a row from the top
 *  and its k-th seat stands in the k-th stage ("-" leaves a seat empty). A model that writes straight through often lays a time picture out this way. */
export function timeRowSeats(line: string, stages: number, reach: Reach = dict()): Record<string, [number, number]> {
  const out: Record<string, [number, number]> = dict(), xs = TIME_XS[stages] || TIME_XS[4];
  let y = 0, prevDown = 0, r = 0;
  for (const row of String(line || "").split("/")) {
    const all = row.trim().split(/[\s,]+/).filter(Boolean), ids = all.slice(0, all.length > xs.length ? 3 : xs.length), real = ids.filter((id) => id !== "-");
    if (!ids.length) continue;
    if (r >= 6) break;
    if (r > 0 && prevDown > DOWN && !real.length) continue; // an empty row left under a tall thing: the tall row already took that room
    const up = Math.max(UP, ...real.map((id) => (reach[id] ? reach[id].up : UP))), down = Math.max(DOWN, ...real.map((id) => (reach[id] ? reach[id].down : DOWN)));
    y = r === 0 ? TOP + up : y + prevDown + up;
    // a row with more seats than stages holds no stage (results side by side above the axis): it spreads across the screen as a plain row does
    const across = ids.length > xs.length ? ["A", "B", "C"].map((c) => COLS[c]) : null;
    ids.forEach((id, k) => { if (/^[A-Za-z_]\w*$/.test(id)) out[id] = [across ? across[k] : xs[k], y]; });
    prevDown = down; r++;
  }
  return out;
}
/** The pairs an arrow or line of the script joins ("arrow a s>u"), read once before any seat is given out. */
export function linksOf(text: string): [string, string][] {
  const out: [string, string][] = [];
  for (const raw of String(text || "").split("\n")) {
    const m = /^\s*(?:arrow|line)\s+[A-Za-z_]\w*\s+@?([A-Za-z_]\w*)-*>@?([A-Za-z_]\w*)(?:\s|$)/.exec(raw);
    if (m) out.push([m[1], m[2]]);
  }
  return out;
}
/**
 * How a GRID line is meant over a time axis. The notation writes rows, each with one seat per stage from left to right; films written before
 * that (bino-1) give one group per stage, stacked from the top; and a tree is often written path by path ("s / u gu / d gd"). The script's
 * own arrows tell: they run from one stage to the next. Of the readings that seat every id, the one with the most arrows going exactly one
 * stage to the right wins, then the one that leaves fewer stages empty; on a tie the rows of the notation win, then the groups.
 * "depth" (a tree read along its arrows) is a candidate only when every id of GRID is joined by an arrow and the depths fill the stages exactly.
 * Returns the reading and the GRID line to seat it with (column form for timeSeats; rows keep their own line for timeRowSeats).
 */
export function timeReading(line: string, stages: number, links: [string, string][], bars: Set<string> = new Set()): { kind: "stage" | "rows" | "depth"; line: string } | null {
  const parts = String(line || "").split("/").map((g) => g.trim().split(/[\s,]+/).filter(Boolean)).filter((g) => g.length);
  const ids = parts.flat().filter((id) => /^[A-Za-z_]\w*$/.test(id)), inGrid = new Set(ids);
  const cand: { kind: "stage" | "rows" | "depth"; col: Record<string, number>; line: string }[] = [];
  const colOf = (groups: string[][]) => { const c: Record<string, number> = dict(); groups.forEach((g, k) => g.forEach((id) => { if (inGrid.has(id) && c[id] == null) c[id] = k; })); return c; };
  // a row longer than the stages is read across the screen (see timeRowSeats), but never a row of pillars: those stand on their stage
  if (parts.every((g) => g.length <= stages || (g.length <= 3 && !g.some((id) => bars.has(id))))) {
    const c: Record<string, number> = dict();
    parts.forEach((g) => { if (g.length <= stages) g.forEach((id, k) => { if (inGrid.has(id) && c[id] == null) c[id] = k; }); });
    cand.push({ kind: "rows", col: c, line });
  }
  if (parts.length === stages) cand.push({ kind: "stage", col: colOf(parts), line });
  const tree = links.filter(([a, b]) => inGrid.has(a) && inGrid.has(b) && a !== b);
  const joined = new Set(tree.flat());
  if (tree.length && ids.every((id) => joined.has(id))) {
    // depth along the arrows: a root has no arrow coming in; a thing is one deeper than the deepest thing pointing at it
    const depth: Record<string, number> = dict();
    let ok = true;
    const walk = (id: string, seen: Set<string>): number => {
      if (depth[id] != null) return depth[id];
      if (seen.has(id)) { ok = false; return 0; }
      seen.add(id);
      const ins = tree.filter(([, b]) => b === id).map(([a]) => walk(a, seen) + 1);
      seen.delete(id);
      return (depth[id] = ins.length ? Math.max(...ins) : 0);
    };
    ids.forEach((id) => walk(id, new Set()));
    const deep = Math.max(...ids.map((id) => depth[id]));
    if (ok && deep + 1 === stages) {
      const groups: string[][] = Array.from({ length: stages }, () => []);
      ids.forEach((id) => { if (!groups[depth[id]].includes(id)) groups[depth[id]].push(id); });
      if (groups.every((g) => g.length && g.length <= 3)) cand.push({ kind: "depth", col: colOf(groups), line: groups.map((g) => g.join(" ")).join(" / ") });
    }
  }
  if (!cand.length) return null;
  const score = (c: { col: Record<string, number> }) => [tree.filter(([a, b]) => c.col[b] - c.col[a] === 1).length, new Set(Object.keys(c.col).map((k) => c.col[k])).size];
  let best = cand[0], bs = score(best);
  for (const c of cand.slice(1)) { const s = score(c); if (s[0] > bs[0] || (s[0] === bs[0] && s[1] > bs[1])) { best = c; bs = s; } }
  return { kind: best.kind, line: best.line };
}
/** How far under its row line a thing reaches with its caption: the line of the time axis goes 40 under the lowest of these.
 *  A bar with no name under it stands on its row line, so the axis goes right there and the bar stands on the axis. */
const footOf = (type: string, reachDown: number, named: boolean) => (type === "bar" ? (named ? 84 : -40) : type === "node" || type === "icon" || type === "box" || type === "num" || type === "text" ? Math.min(reachDown, DOWN) : reachDown);

const ICON_ALIAS: Record<string, string> = dict({ stock: "trendup", share: "trendup", shares: "trendup", graph: "chart", option: "ticket", call: "ticket", put: "ticket", coupon: "ticket", voucher: "ticket", bond: "receipt", loan: "handshake", cash: "money", bill: "money", bills: "money", safe: "vault", deposit: "piggy", savings: "piggy", exporter: "factory", importer: "store", seller: "person", buyer: "person", customer: "person", user: "person", man: "person", woman: "person", worker: "person", investor: "person", team: "people", group: "people", crowd: "people", company: "office", firm: "office", corp: "office", court: "gavel", law: "gavel", judge: "gavel", insurance: "shield", insurer: "umbrella", port: "anchor", vessel: "ship", boat: "ship", cargo: "container", goods: "box", package: "box", parcel: "box", product: "box", letter: "mail", email: "mail", document: "doc", paper: "doc", file: "doc", invoice: "receipt", time: "clock", date: "calendar", home: "house", shop: "store", market: "store", world: "globe", earth: "globe", location: "pin", question: "q", warning: "warn", alert: "warn", ok: "check", no: "x", cross: "x", light: "idea", bulb: "idea", lightbulb: "idea", calculator: "calc", school: "cap", graduation: "cap", pen: "pencil", computer: "laptop", pc: "laptop", mobile: "phone", smartphone: "phone", message: "chat", speech: "chat", thumbsup: "like", thumbsdown: "dislike", happy: "smile", unhappy: "sad", food: "burger", drink: "coffee", clothes: "shirt", fruit: "apple", water: "drop", rain: "cloud", temperature: "thermo", hospital: "medical", doctor: "medical", medicine: "pill", test: "flask", lab: "flask", science: "atom", cpu: "chip", database: "db", server: "db", setting: "gear", settings: "gear", tool: "wrench", tools: "wrench", layers: "stack", energy: "bolt", power: "plug", sport: "ball", photo: "camera", gold: "medal", prize: "trophy", win: "trophy", present: "gift", random: "dice", chance: "dice", probability: "dice", balance: "scale", weight: "scale", security: "lock", protect: "shield", risk: "warn", profit: "trendup", loss: "trenddown", rise: "up", fall: "down", increase: "up", decrease: "down", tax: "percent", rate: "percent", interest: "percent", discount: "tag", price: "tag", sale: "tag", shopping: "cart", delivery: "truck", transport: "truck", flight: "plane", airplane: "plane", rail: "train", bicycle: "bike", launch: "rocket", goal: "target", aim: "target", award: "medal", love: "heart", hot: "fire", fast: "bolt", identity: "id", passport: "id", license: "cert", certificate: "cert", seal: "stamp", approve: "stamp", signature: "sign", agreement: "handshake", deal: "handshake", trade: "handshake", exchange: "handshake", deadline: "hourglass", wait: "hourglass", stopwatch: "timer", apartment: "building", tower: "building", town: "city", country: "flag", nation: "flag", government: "building", customs: "building", account: "wallet", pay: "card", payment: "card", credit: "card", atm: "bank", piggybank: "piggy", treasure: "vault", krw: "won", usd: "dollar", currency: "coins", weather: "cloud", ice: "snow", cold: "snow", gene: "dna", cell: "atom", molecule: "atom", chemistry: "flask", ai: "robot", bot: "robot", mind: "brain", think: "brain", view: "eye", look: "eye", find: "search", magnifier: "search", newspaper: "news", announce: "megaphone", ad: "megaphone", song: "music", sound: "music", charge: "battery", block: "cube", piece: "puzzle", attract: "magnet", study: "book", textbook: "book", read: "book", write: "pencil", exam: "pencil", learner: "student", teacher: "person", professor: "person" });
interface Tok { s: string; q: boolean; k?: string }
const POS = /^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/;
const NUM = /^-?\d+(?:\.\d+)?$/;
/** a grid slot: column letter (A B C for three across, L R for two, M for one) and row 1 to 5 */
const SLOT = /^([ABCLRM])([1-5])$/;
const slotXY = (s: string): [number, number] | null => { const m = SLOT.exec(s); return m ? [COLS[m[1]], ROWS[+m[2] - 1]] : null; };
const slotName = (x: unknown, y: unknown): string | null => { const r = ROWS.indexOf(Number(y)); if (r < 0) return null; const c = ["M", "L", "R", "A", "C"].find((k) => COLS[k] === Number(x)); return c ? c + (r + 1) : null; };
const VAL = /^([^\d\s"=<>@-]*)(-?\d[\d,]*(?:\.\d+)?)([^\d\s"=<>@]*)$/;
const KV = /^([A-Za-z_][A-Za-z0-9_]*)=(.+)$/;
const ASCII = /^[\x00-\x7f]*$/;
const COLORS = new Set(["ink", "blue", "yellow", "pale", "grey", "gray", "green", "red", "white"]);
const SIDES = new Set(["left", "right", "top", "bottom"]);
const TONES = new Set(["solid", "soft"]);
const OPEN = '"“', CLOSE = '"”';
const ALIAS: Record<string, string> = dict({ c: "color", v: "value", col: "color", colour: "color", text: "str", caption: "cap" });
const TEXTKEYS = new Set(["cap", "sub", "badge", "str", "why", "next", "xl", "yl", "suf", "pre", "q", "left", "right"]);

function tokens(line: string): Tok[] {
  const out: Tok[] = [], n = line.length;
  let i = 0;
  const endQ = (from: number) => { let j = from + 1; while (j < n && !CLOSE.includes(line[j])) j++; return j; };
  while (i < n) {
    while (i < n && /\s/.test(line[i])) i++;
    if (i >= n) break;
    if (OPEN.includes(line[i])) { const j = endQ(i); out.push({ s: line.slice(i + 1, j), q: true }); i = j + 1; continue; }
    let j = i;
    while (j < n && !/\s/.test(line[j]) && !OPEN.includes(line[j])) j++;
    const word = line.slice(i, j);
    if (j < n && OPEN.includes(line[j]) && /^[A-Za-z_][A-Za-z0-9_]*=$/.test(word)) { const e = endQ(j); out.push({ s: line.slice(j + 1, e), q: true, k: word.slice(0, -1) }); i = e + 1; continue; }
    const m = KV.exec(word);
    if (m) out.push({ s: m[2], q: false, k: m[1] }); else out.push({ s: word, q: false });
    i = j;
  }
  // an unquoted text value that has spaces: key=지금 주가  ->  key="지금 주가"
  for (let a = 0; a < out.length; a++) {
    const t = out[a];
    if (t.k && !t.q && TEXTKEYS.has(ALIAS[t.k] || t.k)) {
      while (a + 1 < out.length && !out[a + 1].k && !out[a + 1].q && !POS.test(out[a + 1].s) && !ASCII.test(out[a + 1].s)) { t.s += " " + out[a + 1].s; out.splice(a + 1, 1); }
    }
  }
  // key=value pairs land on a plain object of properties, where this one key would replace the object's prototype
  return out.filter((t) => t.k !== "__proto__");
}

const num = (s: string) => parseFloat(s.replace(/,/g, ""));
const list = (s: string) => s.split(/[,\s]+/).map((x) => x.trim()).filter(Boolean);
function kvValue(k: string, t: Tok): unknown {
  const s = t.s;
  if (k === "keep" || k === "between") return list(s);
  if (k === "xr" || k === "yr") return s.split(/\.\.|,|~/).map(num);
  if (k === "xt" || k === "yt") return list(s).map(num);
  if (k === "cols") return s.split("|").map((x) => x.trim());
  if (k === "rows") return s.split(/\s*(?:\/|;)\s*/).filter(Boolean).map((r) => r.split("|").map((x) => x.trim()));
  if (k === "hi") return s.split(/[;\s]+/).filter(Boolean).map((p) => p.split(/[,.]/).map(num));
  if (!t.q && NUM.test(s)) return parseFloat(s);
  if (!t.q && (s === "true" || s === "false")) return s === "true";
  return s;
}
function setValue(p: Props, s: string): boolean {
  const m = VAL.exec(s);
  if (!m) return false;
  p.value = num(m[2]);
  // a value that brings its own minus drops the plus it replaces ("set g -10,000원" on "+10,000원" is not "+-10,000원")
  // and a value with no sign drops an old minus ("set g 0원" on "−1,000원" is not "−0원"); a money sign stays
  if (m[1] || (p.value as number) < 0) p.pre = m[1];
  else if (/^[−-]$/.test(String(p.pre || ""))) p.pre = "";
  if (m[3]) p.suf = m[3];
  const d = (m[2].split(".")[1] || "").length;
  if (d > 4) p.dec = d;
  return true;
}
function link(p: Props, s: string): boolean {
  const k = s.indexOf(">");
  if (k <= 0 || k === s.length - 1) return false;
  const a = s.slice(0, k).replace(/-+$/, ""), b = s.slice(k + 1), pa = POS.exec(a), pb = POS.exec(b);
  if (pa && pb) { p.x = +pa[1]; p.y = +pa[2]; p.x2 = +pb[1]; p.y2 = +pb[2]; } else { p.from = a; p.to = b; }
  return true;
}
const CALC_OP: Record<string, string> = dict({ "*": "×", x: "×", X: "×", "×": "×", "/": "÷", "÷": "÷" });
const sameNum = (a: number, b: number) => Math.abs(a - b) <= 0.005 * Math.max(1, Math.abs(b));
/** Units a label may write right after a number, longest first. Only these are read, so a word that merely follows a number is never taken for a unit. */
const UNIT_WORDS = ["퍼센트", "만원", "억원", "천원", "조원", "달러", "센트", "유로", "위안", "개월", "주일", "시간", "분기", "배럴", "리터", "원", "엔", "%p", "%", "년", "월", "일", "분", "초", "주", "개", "벌", "명", "대", "권", "장", "톤", "배", "번", "회", "건", "칸", "점", "쪽", "편", "살", "세", "kg", "km", "cm", "mm", "ml", "g", "m", "L"];
const MONEY_SIGNS = ["$", "₩", "€", "£", "¥"];
/** The unit written beside the number v in one of an object's texts ("주식 0.25주" gives 주 for 0.25). */
function unitIn(texts: string[] | undefined, v: number): { pre?: string; suf?: string } | undefined {
  for (const raw of texts || []) {
    const s = String(raw).replace(/(\d),(?=\d{3})/g, "$1"), re = /\d+(?:\.\d+)?/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s))) {
      if (!sameNum(parseFloat(m[0]), Math.abs(v))) continue;
      const rest = s.slice(m.index + m[0].length), suf = UNIT_WORDS.find((u) => rest.startsWith(u) && rest[u.length] !== "의");
      const before = m.index > 0 ? s[m.index - 1] : "", pre = MONEY_SIGNS.includes(before) ? before : undefined;
      if (suf || pre) return { pre, suf };
    }
  }
  return undefined;
}
function calcTerms(toks: Tok[]): unknown[] {
  const out: unknown[] = [];
  for (const t of toks) {
    if (t.q) { out.push({ s: t.s }); continue; }
    let s = t.s;
    while (s.startsWith("(")) { out.push("("); s = s.slice(1); }
    let tail = 0;
    while (s.endsWith(")")) { tail++; s = s.slice(0, -1); }
    if (s) {
      const m = /^([^\d@-]*)(-?[\d,]*\.?\d+)([^@]*)(?:@(.+))?$/.exec(s);
      if (m && (s.length > 1 || /\d/.test(s))) {
        const term: Props = { v: num(m[2]) };
        if (m[1]) term.pre = m[1];
        if (m[3]) term.suf = m[3];
        if (m[4]) term.from = m[4];
        const d = (m[2].split(".")[1] || "").length;
        if (d > 4) term.dec = d;
        out.push(term);
      } else if (s.includes("@")) { const [a, b] = s.split("@"); out.push({ s: a, from: b }); }
      else out.push(s);
    }
    while (tail-- > 0) out.push(")");
  }
  return out;
}
/** where the right answer goes among n choices: fixed by the question text, so the order is stable and not always first */
export function answerSlot(q: string, n: number): number {
  let h = 7;
  for (const ch of String(q)) h = (h * 31 + (ch.codePointAt(0) || 0)) % 100003;
  return n > 0 ? h % n : 0;
}
function choiceLine(rest0: string): { q: string; choices: string[]; answer: number; why?: string } {
  const rest = String(rest0).replace(/\|?\s*\b(before|after)\s*=\s*\d+/gi, " ").replace(/([^|\s])\s+(why\s*=)/i, "$1 | $2");
  const parts = rest.split("|").map((x) => x.trim()).filter((x) => x !== "");
  let why: string | undefined, ans = -1;
  const body: string[] = [];
  for (const p of parts) {
    const m = /^(why|ans|answer)\s*[=:]\s*(.*)$/i.exec(p);
    if (m) { if (m[1].toLowerCase() === "why") why = m[2].replace(/^["“]|["”]$/g, ""); else ans = parseInt(m[2], 10) - 1; } else body.push(p.replace(/^["“]|["”]$/g, ""));
  }
  const q = body.shift() || "";
  let choices = body, right = 0;
  const star = choices.findIndex((c) => /\(정답\)|✓$/.test(c));
  if (star >= 0) { right = star; choices = choices.map((c) => c.replace(/\s*(\(정답\)|✓)$/, "")); } else if (ans >= 0 && ans < choices.length) right = ans;
  // the first choice is the right one in the notation; move it to a slot fixed by the question
  const correct = choices[right], others = choices.filter((_, i) => i !== right), slot = answerSlot(q, choices.length);
  const ordered = others.slice();
  ordered.splice(Math.min(slot, ordered.length), 0, correct);
  return { q, choices: correct == null ? [] : ordered, answer: Math.min(slot, others.length), why };
}

const TYPES = new Set(["node", "box", "text", "num", "bar", "icon", "arrow", "line", "brace", "calc", "note", "plot", "dot", "table", "sign", "scale", "dots"]);
const OPS = new Set(["set", "del", "keep", "clear", "pulse", "send", "focus", "ask", "cam", "pline", "pmark"]);

/** The time axis of a TIME picture: a line under the lowest thing of the whole short, from left of the first column to right of the last,
 *  with a stage label under each column; with VALUE a line up the left end to above the highest thing. The parser adds it as the first action of scene 1. */
function axisAction(stages: string[], vname: string | undefined, rows: Map<string, { y: number; type: string; named: boolean }>, reach: Reach): Action {
  const xs = TIME_XS[stages.length] || TIME_XS[4], gap = xs.length > 1 ? xs[1] - xs[0] : 300;
  let low = 0, high = Infinity;
  rows.forEach((r, id) => { low = Math.max(low, r.y + footOf(r.type, reach[id] ? reach[id].down : DOWN, r.named)); high = Math.min(high, r.y - (reach[id] ? reach[id].up : UP)); });
  if (!rows.size) { low = TOP + UP + DOWN; high = TOP; }
  const a: Action = { id: "_axis", type: "axis", auto: true, x: Math.max(52, xs[0] - Math.min(115, gap * 0.45)), y: Math.round(low + 40), x2: Math.min(1000, xs[xs.length - 1] + Math.min(115, gap * 0.45)), labels: stages.slice(), xs: xs.slice() };
  if (vname) { a.vname = vname; a.y2 = Math.round(high - 40); }
  // a label wider than its column is typed smaller; the drawing measures the real text, this only keeps the estimate honest
  a.size = Math.min(40, ...stages.map((l) => Math.floor((40 * (gap - 24)) / Math.max(1, approxW(l, 40)))));
  return a;
}

export function parseScript(text: string, ctx: Ctx = {}): Parsed {
  const issues: Issue[] = [], script: Script = { beats: [] }, plan: Plan = {}, labels: string[] = [], dels: string[] = [], has: Record<string, boolean> = dict();
  const err = (beat: number, msg: string) => issues.push({ level: "error", beat, code: "syntax", msg });
  const steps: Record<number, Props> = {}, quiz: Quiz[] = [];
  const plots: Record<string, { lines: Props[]; marks: Props[] }> = dict();
  const units: Record<string, UnitOf> = dict(ctx.units); // the unit each object's number carries, so a term that flies out of it keeps it
  const grid: Record<string, [number, number]> = dict(ctx.grid);
  const unseated: string[] = [], seenIds = new Set<string>(), live = new Map<string, number>(); // live: the row of each placed thing now on screen
  // the bars written without a name: over TIME they stand on the axis (the stage label names them)
  const axisBar: Record<string, boolean> = dict();
  for (const l of String(text || "").split("\n")) { const m = /^\s*bar\s+([A-Za-z_]\w*)\b(.*)$/.exec(l); if (m) axisBar[m[1]] = !/(^|\s)["“]/.test(m[2]); }
  let reachT: Reach | null = null; // circleReach, made when a thing under TIME needs a seat
  const reach = reachOf(String(text || "")), life = lifeOf(String(text || "")), barV = barValues(String(text || "")), barPx = barUnit(Object.keys(barV).map((k) => barV[k]));
  let beat: Beat | null = null, n = 0;
  const raw = String(text || "").replace(/\r/g, "").split("\n");
  const warnH = (msg: string, code = "syntax") => issues.push({ level: "warn", beat: 0, code, msg });
  const errT = (msg: string) => issues.push({ level: "error", beat: 0, code: "time", msg });
  const cut = (rest: string) => rest.split("|").map((x) => x.trim().replace(/^["“]|["”]$/g, "")).filter(Boolean);
  const chars = (x: string) => Array.from(x.replace(/\s/g, "")).length;
  // TIME changes how GRID is read, and it may come after GRID, so it is read first
  const timeRaw = raw.find((l) => /^\s*TIME\s/.test(l));
  let stages: string[] | null = null, timeOn = false; // stages: valid labels; timeOn: GRID is read as stages and the axis is drawn
  if (timeRaw) {
    const ls = cut(timeRaw.trim().slice(4));
    if (ls.length < 2 || ls.length > 4) errT(`TIME has ${ls.length} stage label${ls.length === 1 ? "" : "s"}; write 2 to 4, separated by "|" ("TIME 오늘 | 3개월 뒤").`);
    else { stages = ls; script.time = ls; const long = ls.filter((x) => chars(x) > 8); if (long.length) errT(`The stage label${long.length > 1 ? "s" : ""} ${long.map((x) => `"${x}"`).join(", ")} of TIME ${long.length > 1 ? "are" : "is"} too long to sit under ${long.length > 1 ? "their columns" : "its column"}; 8 characters at most.`); }
  }
  const placedRow = new Map<string, { y: number; type: string; named: boolean }>(); // the row line of every placed thing, for the axis under them all
  for (let ln = 0; ln < raw.length; ln++) {
    let line = raw[ln].trim();
    if (!line || line === "---" || line.startsWith("```") || line.startsWith("//")) continue;
    // ----- scene header
    if (line[0] === "#") {
      const bar = line.indexOf("|"), head = (bar >= 0 ? line.slice(0, bar) : line).slice(1).trim().split(/\s+/), say = bar >= 0 ? line.slice(bar + 1).trim() : "";
      const label = (head.shift() || "").replace(/[.:)]$/, "");
      if (head.some((w) => /^(DEL|DELETE|삭제)$/i.test(w))) { dels.push(label); beat = null; continue; }
      beat = { do: [] };
      for (const w of head) {
        let m: RegExpExecArray | null;
        if ((m = /^s(?:tep)?=?(\d+)$/i.exec(w))) beat.step = +m[1];
        else if (/^hard!?$/i.test(w)) beat.hard = true;
        else if ((m = /^dur=(\d+(?:\.\d+)?)$/i.exec(w))) beat.dur = +m[1];
      }
      if (say) beat.say = say.replace(/^["“]|["”]$/g, "");
      script.beats.push(beat);
      labels.push(label);
      n = script.beats.length;
      continue;
    }
    let sp = line.search(/\s/), word = sp < 0 ? line : line.slice(0, sp), rest = sp < 0 ? "" : line.slice(sp + 1).trim();
    // the name of a picture used as if it were a type ("ship s1 ..."): it is an icon of that name
    if (beat && sp > 0 && !TYPES.has(word) && !OPS.has(word) && (ICONS[word] || ICON_ALIAS[word]) && /^[A-Za-z_]\w*(\s|$)/.test(rest)) { const k = rest.search(/\s/); rest = (k < 0 ? rest : rest.slice(0, k)) + " " + word + (k < 0 ? "" : rest.slice(k)); word = "icon"; }
    const W = word.toUpperCase().replace(/:$/, "");
    // ----- header and footer lines
    if (!beat || ["END", "QUIZ", "TITLE", "GOAL", "ROUTE", "PICTURE", "GRID", "NEEDS", "GIVEN", "STEP", "TERM", "TRAP", "PART", "VIEWER", "HOOK", "CARD", "TIME", "VALUE"].includes(W) && word === word.toUpperCase()) {
      if (W === "TITLE") { script.title = rest; has.title = true; continue; }
      if (W === "VIEWER") { plan.viewer = rest; continue; }
      if (W === "GOAL") { plan.goal = rest; has.goal = true; continue; }
      if (W === "ROUTE") { plan.route = rest; has.route = true; continue; }
      if (W === "NEEDS") { plan.needs = rest; has.needs = true; continue; }
      if (W === "PICTURE") { plan.picture = rest; has.picture = true; continue; }
      if (W === "GRID") {
        plan.grid = rest; has.grid = true;
        // with TIME the rows of GRID hold one seat per stage; older films give one group per stage. timeReading says which reading the arrows agree with.
        const how = stages ? timeReading(rest, stages.length, linksOf(String(text || "")), new Set(Object.keys(axisBar))) : null;
        if (stages && !how) errT(`TIME names ${stages.length} stages but a row of GRID with pillars (or with more than three seats) has more seats than that. With TIME every row of GRID (the part between "/") holds one seat per stage from left to right, "-" for an empty one: at most ${stages.length} seats in a row of pillars.`);
        if (how && how.kind === "depth") warnH(`GRID was read along its arrows as a tree growing to the right: ${how.line}.`, "time");
        timeOn = !!how;
        Object.assign(grid, how ? (how.kind === "rows" ? timeRowSeats(rest, stages!.length, circleReach(String(text || ""), reach)) : timeSeats(how.line, reach)) : gridSeats(rest, reach));
        continue;
      }
      if (W === "TIME") { has.time = true; continue; } // read before the scenes
      if (W === "VALUE") { has.value = true; const v = rest.replace(/^["“]|["”]$/g, "").trim(); if (!timeRaw) warnH(`VALUE names the vertical axis of a TIME picture; without a TIME line it was left out.`, "time"); else if (chars(v) > 6) errT(`VALUE "${v}" is too long to stand beside the top of the vertical axis; 6 characters at most.`); else if (v) script.vname = v; continue; }
      if (W === "HOOK") { has.hook = true; const k = cut(rest); if (k.length < 3 || k.length > 4) warnH(`HOOK has ${k.length} chunk${k.length === 1 ? "" : "s"}; it needs 3 or 4 separated by "|", so it was left out and the title opens the short.`, "hook"); else { script.hook = k; const long = k.filter((x) => chars(x) > 7); if (long.length) warnH(`HOOK chunk${long.length > 1 ? "s" : ""} ${long.map((x) => `"${x}"`).join(", ")} ${long.length > 1 ? "are" : "is"} longer than 7 characters and will be drawn small.`, "hook"); } continue; }
      if (W === "CARD") { has.card = true; const k = cut(rest).slice(0, 3); if (k.length) { script.card = k; if (chars(k[0]) > 8) warnH(`The big title of CARD ("${k[0]}") is longer than 8 characters and will be drawn small.`, "card"); } continue; }
      if (W === "GIVEN") {
        plan.given = (plan.given || []).concat(rest.split(/\s*[;|]\s*/).filter(Boolean).map((g) => { const k = g.indexOf("="), v = (k < 0 ? g : g.slice(0, k)).trim(); return { v: NUM.test(v) ? parseFloat(v) : v, is: k < 0 ? "" : g.slice(k + 1).trim() }; }));
        has.given = true;
        continue;
      }
      if (W === "STEP") {
        const m = /^(\d+)[.:)]?\s*(.*)$/.exec(rest);
        if (m) { const [q, idea] = m[2].split(/\s*=>\s*/); steps[+m[1]] = { q: (q || "").trim(), idea: (idea || "").trim() }; has.step = true; } else err(0, `Line ${ln + 1}: STEP needs a number: "STEP 3 question => idea".`);
        continue;
      }
      if (W === "TERM") {
        plan.terms = (plan.terms || []).concat(rest.split(/\s*[;|]\s*/).filter(Boolean).map((g) => { const k = g.indexOf("="); return { t: (k < 0 ? g : g.slice(0, k)).trim(), plain: k < 0 ? "" : g.slice(k + 1).trim() }; }));
        has.term = true;
        continue;
      }
      if (W === "TRAP") { plan.trap = rest; has.trap = true; continue; }
      if (W === "PART") {
        const m = /^(\d+)\s*\/\s*(\d+)\s*(.*)$/.exec(rest);
        if (m) plan.part = { n: +m[1], of: +m[2], next: m[3].replace(/^[|\s]*(next\s*[=:])?\s*/i, "").replace(/^["“]|["”]$/g, "") };
        has.part = true;
        continue;
      }
      if (W === "END") { script.takeaway = rest; has.end = true; beat = null; continue; }
      if (W === "QUIZ") { const c = choiceLine(rest); if (c.choices.length >= 2) quiz.push(c); else err(0, `Line ${ln + 1}: QUIZ needs a question and at least two choices separated by "|".`); has.quiz = true; beat = null; continue; }
      if (!beat) { if (script.beats.length || /^[a-z]/.test(word)) err(0, `Line ${ln + 1}: "${word}" is outside a scene. Start a scene with "#n | sentence".`); continue; }
    }
    // ----- lines inside a scene
    if (!ASCII.test(word)) { issues.push({ level: "warn", beat: n, code: "syntax", msg: `Line ${ln + 1}: skipped a line that is not notation ("${line.slice(0, 30)}").` }); continue; }
    const acts = beat.do as Action[], op = word.toLowerCase(), toks = tokens(rest);
    const bare = (t: Tok) => !t.q && !t.k;
    if (op === "focus") { beat.focus = (beat.focus || []).concat(toks.filter(bare).flatMap((t) => list(t.s))); continue; }
    if (op === "ask") { const c = choiceLine(rest); beat.ask = c; if (c.choices.length < 2) err(n, `Line ${ln + 1}: ask needs a question and 2 or 3 choices separated by "|".`); continue; }
    if (op === "cam") { const c: Props = {}; for (const t of toks) { const m = POS.exec(t.s); if (t.k) c[t.k] = kvValue(t.k, t); else if (m) { c.x = +m[1]; c.y = +m[2]; } } beat.cam = c; continue; }
    if (op === "del" || op === "pulse") { const at = toks.find((t) => t.k === "at"); toks.filter(bare).flatMap((t) => list(t.s)).forEach((id) => { acts.push(Object.assign({ op, id }, at ? { at: parseFloat(at.s) } : {})); if (op === "del") live.delete(id); }); continue; }
    if (op === "keep" || op === "clear") { // the time axis is the floor of the picture: wiping the things on it leaves it
      const kv = toks.find((t) => t.k === "keep"), ids = toks.filter(bare).flatMap((t) => list(t.s)).filter((x) => x !== "keep" && x !== "except");
      if (op === "clear" && !kv && ids.length && !/\b(keep|except)\b/.test(rest)) ids.forEach((id) => { acts.push({ op: "del", id }); live.delete(id); });
      else { const keepIds = (kv ? list(kv.s) : ids).concat(timeOn || ctx.time ? ["_axis"] : []); acts.push({ op: "clear", keep: keepIds }); Array.from(live.keys()).forEach((k) => { if (!keepIds.includes(k)) live.delete(k); }); }
      continue;
    }
    if (op === "send") {
      const a: Action = { op: "send" };
      for (const t of toks) { if (t.k) a[ALIAS[t.k] || t.k] = kvValue(ALIAS[t.k] || t.k, t); else if (t.q) a.str = t.s; else if (!link(a, t.s)) { if (COLORS.has(t.s)) a.color = t.s; else if (ASCII.test(t.s) && a.icon == null) a.icon = t.s; else a.str = a.str ? a.str + " " + t.s : t.s; } }
      if (a.from == null || a.to == null) err(n, `Line ${ln + 1}: send needs "from>to".`);
      acts.push(a);
      continue;
    }
    if (op === "pline" || op === "pmark") {
      const plot = toks[0] && bare(toks[0]) ? toks[0].s : "", st = plots[plot];
      if (!st) { err(n, `Line ${ln + 1}: ${op} names plot "${plot}" which was not added.`); continue; }
      const at = toks.find((t) => t.k === "at");
      if (op === "pline") {
        const L: Props = { id: toks[1] && bare(toks[1]) ? toks[1].s : "l" + st.lines.length, pts: [] };
        for (const t of toks.slice(2)) { const m = POS.exec(t.s); if (t.k) L[ALIAS[t.k] || t.k] = kvValue(ALIAS[t.k] || t.k, t); else if (t.q) L.str = t.s; else if (m) L.pts.push([+m[1], +m[2]]); else if (COLORS.has(t.s)) L.color = t.s; else if (t.s === "dash") L.dash = true; }
        const k = st.lines.findIndex((x) => x.id === L.id);
        if (k >= 0) st.lines[k] = L; else st.lines.push(L);
        acts.push(Object.assign({ op: "set", id: plot, lines: st.lines.map((x) => Object.assign({}, x)) }, at ? { at: parseFloat(at.s) } : {}));
      } else {
        const M: Props = {};
        for (const t of toks.slice(1)) { if (t.k) M[t.k] = kvValue(t.k, t); else if (t.q) M.str = t.s; else if (NUM.test(t.s) && M.x == null) M.x = parseFloat(t.s); else M.str = M.str ? M.str + " " + t.s : t.s; }
        st.marks.push(M);
        acts.push(Object.assign({ op: "set", id: plot, marks: st.marks.map((x) => Object.assign({}, x)) }, at ? { at: parseFloat(at.s) } : {}));
      }
      continue;
    }
    const isSet = op === "set", isAdd = TYPES.has(op);
    if (!isSet && !isAdd) { err(n, `Line ${ln + 1}: unknown word "${word}". A scene line starts with an object type (node, box, icon, calc ...) or set, del, keep, clear, pulse, send, focus, ask.`); continue; }
    const id = toks.length && bare(toks[0]) ? toks.shift()!.s : "";
    if (!id || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(id)) { err(n, `Line ${ln + 1}: "${word}" needs an id (letters and digits) right after it.`); continue; }
    const a: Action = isSet ? { op: "set", id } : { id, type: op };
    const type = isSet ? "" : op, strs: string[] = [], loose: string[] = [];
    if (type === "calc") {
      const k = toks.findIndex((t, i) => i > 0 && !!t.k), body = k < 0 ? toks : toks.slice(0, k), tail = k < 0 ? [] : toks.slice(k);
      const p0 = body.length && !body[0].q ? POS.exec(body[0].s) : null;
      if (p0) { a.x = +p0[1]; a.y = +p0[2]; body.shift(); }
      else if (body.length && !body[0].q && slotXY(body[0].s)) body.shift(); // a calculation finds its own place
      a.terms = calcTerms(body);
      for (const t of tail) if (t.k) a[ALIAS[t.k] || t.k] = kvValue(ALIAS[t.k] || t.k, t);
      // units: a number that flies out of an object keeps that object's unit when it is that object's number. A different number
      // (0.25 out of a bar that shows 1원 and is named "주식 0.25주") takes the unit written beside it on the object, or none: a unit is never guessed.
      // "suf=" names the unit of the result.
      const ts = a.terms as unknown[], eq = ts.findIndex((x) => x === "=" || x === "≈");
      ts.forEach((x, k) => {
        if (!x || typeof x !== "object") return;
        const tm = x as Props;
        if (typeof tm.v !== "number" || tm.pre != null || tm.suf != null) return;
        const u = tm.from != null ? units[String(tm.from)] : undefined;
        const own = !u ? undefined : (u.pre || u.suf) && (u.v == null || sameNum(u.v, tm.v)) ? u : unitIn(u.texts, tm.v);
        if (own && (own.pre || own.suf)) { if (own.pre) tm.pre = own.pre; if (own.suf) tm.suf = own.suf; }
        else if (!u && ((eq >= 0 && k > eq) || tm.from == null)) { if (a.pre != null) tm.pre = a.pre; if (a.suf != null) tm.suf = a.suf; }
      });
      delete a.pre; delete a.suf;
      // a sum or a difference is of like things: when the units that are written all agree, the bare numbers carry the same unit
      const numsT = ts.filter((x) => !!x && typeof x === "object" && typeof (x as Props).v === "number") as Props[];
      if (numsT.length > 1 && !ts.some((x) => typeof x === "string" && ["×", "÷"].includes(CALC_OP[x] || ""))) {
        // the sign of one number is not a unit: "1000 − 10000 = −9000원" gives the bare numbers 원, not "−"
        const unsign = (x: unknown) => String(x || "").replace(/[−–+-]/g, ""), written = numsT.filter((t) => t.pre != null || t.suf != null), key = (t: Props) => `${unsign(t.pre)}|${t.suf || ""}`;
        if (written.length && written.every((t) => key(t) === key(written[0]))) numsT.forEach((t) => { if (t.pre == null && t.suf == null) { if (unsign(written[0].pre)) t.pre = unsign(written[0].pre); if (written[0].suf) t.suf = written[0].suf; } });
      }
      const res = eq >= 0 ? (ts.slice(eq + 1).find((x) => x && typeof x === "object") as Props | undefined) : undefined;
      if (res) units[id] = { pre: res.pre, suf: res.suf, v: typeof res.v === "number" ? res.v : undefined };
      acts.push(a);
      continue;
    }
    let gotPos = false;
    for (const t of toks) {
      if (t.k) { const k = ALIAS[t.k] || t.k; a[k] = kvValue(k, t); continue; }
      if (t.q) { strs.push(t.s); continue; }
      const s = t.s, m = groupedNum(s) ? null : POS.exec(s);
      if (m && !gotPos) { a.x = +m[1]; a.y = +m[2]; gotPos = true; continue; }
      const sl = gotPos ? null : slotXY(s);
      if (sl) { a.x = sl[0]; a.y = sl[1]; gotPos = true; continue; }
      if ((["arrow", "line", "brace"].includes(type) || type === "") && s.includes(">") && link(a, s)) continue;
      if (type === "sign" && /[>~|]/.test(s) && !POS.test(s)) { a.between = s.split(/[>~|]/).filter(Boolean); continue; }
      if (type === "dot" && /^[A-Za-z_]\w*\.[A-Za-z_]\w*$/.test(s)) { [a.plot, a.line] = s.split("."); continue; }
      if (type === "note" && a.to == null && !SIDES.has(s) && /^@?[A-Za-z_]\w*$/.test(s)) { a.to = s.replace(/^@/, ""); continue; }
      if (COLORS.has(s)) { a.color = s === "gray" ? "grey" : s; continue; }
      if (SIDES.has(s) && (type === "note" || type === "brace" || isSet)) { a.side = s; continue; }
      if (TONES.has(s)) { a.tone = s; continue; }
      if (s === "dash" || s === "both" || s === "hard") { a[s] = true; continue; }
      if (type === "icon" && a.name == null && ASCII.test(s)) { const nm = s.toLowerCase(); a.name = ICON_ALIAS[nm] || nm; continue; }
      if ((isSet || ["node", "box", "num", "bar", "text"].includes(type)) && a.value == null && setValue(a, s)) continue;
      loose.push(s);
    }
    if (!strs.length && loose.length && loose.some((x) => !ASCII.test(x) || !/[A-Za-z]/.test(x))) { strs.push(loose.join(" ")); loose.length = 0; }
    if (loose.length) err(n, `Line ${ln + 1}: could not read "${loose.join(" ")}" in "${line.slice(0, 60)}". Put text in double quotes and write other settings as key=value.`);
    if (strs.length) {
      if (type === "scale") { a.left = a.left ?? strs[0]; if (strs[1] != null) a.right = a.right ?? strs[1]; }
      else if (type === "dots") a.cap = a.cap ?? strs[0];
      else if (type === "icon" || type === "num") a.cap = a.cap ?? strs[0];
      else { a.str = strs[0]; if (strs[1] != null) a[type === "box" ? "sub" : "cap"] = strs[1]; }
    }
    if (type === "plot") plots[id] = { lines: [], marks: [] };
    if ((timeOn || ctx.time) && (type === "arrow" || type === "line") && a.from != null) a.across = true; // see lineEnds
    // four stages leave 250 px between columns: a big circle (r=96, copied from the examples) leaves no room for the label of the arrow between two
    if ((timeOn || ctx.time) && (stages || []).length >= 4 && Number(a.r) > 80 && (type === "node" || (isSet && units[id] && !barV[id]))) a.r = 80;
    if (type === "bar") a.scale = barPx; else if (isSet && barV[id] != null) delete a.scale; // the engine sets the measure of the bars
    {
      const words = [a.str, a.cap, a.sub, a.badge, a.left, a.right].filter((x): x is string => typeof x === "string" && x !== ""), was = units[id];
      if (a.value != null) units[id] = { pre: a.pre, suf: a.suf, v: typeof a.value === "number" ? a.value : undefined, texts: words.concat((was && was.texts) || []) };
      else if (words.length) units[id] = Object.assign({}, was, { texts: words.concat((was && was.texts) || []) });
    }
    // Under a time axis a thing without a seat joins the column of what its scene last worked with (else of the newest thing on screen): every seat
    // there is a column of a stage, and the rows of two groups can be half a row apart, so the "free row" of the plain picture below would land on a neighbour.
    // It takes the nearest place under that thing that stays free for as long as it is on screen, else the nearest above, else the foot of the column.
    if (!isSet && !gotPos && !grid[id] && PLACED_T.includes(type) && timeOn) {
      const me = life[id] || { a: n, b: Infinity, ord: 0 };
      const rT = reachT || (reachT = circleReach(String(text || ""), reach)), upOf = (k: string) => Math.max(UP, rT[k] ? rT[k].up : UP), downOf = (k: string) => Math.max(DOWN, rT[k] ? rT[k].down : DOWN);
      const worked = acts.flatMap((x) => [x.id, x.from, x.to]).filter((k): k is string => typeof k === "string" && !!grid[k]);
      const near = worked.length ? worked[worked.length - 1] : Array.from(live.keys()).filter((k) => grid[k]).pop();
      const xs = TIME_XS[(stages || []).length] || TIME_XS[4], x0 = near ? grid[near][0] : xs[0], yNear = near ? grid[near][1] : 0;
      // pillars with no name in the bottom row stand on the axis: nothing may sit under them, or the axis drops away and they float.
      // Then a thing that finds no place above them in its column takes the nearest column that has one.
      const ys0 = Object.keys(grid).map((k) => grid[k][1]), feet = Object.keys(grid).filter((k) => axisBar[k] && grid[k][1] === Math.max(...ys0));
      const floor = type !== "bar" && feet.length ? grid[feet[0]][1] : Infinity;
      const placeIn = (x: number): number | null => {
        const inCol = Object.keys(grid).filter((k) => grid[k][0] === x && life[k] && life[k].a <= me.b && me.a <= life[k].b);
        const free = (y: number) => inCol.every((k) => y + downOf(id) <= grid[k][1] - upOf(k) || y - upOf(id) >= grid[k][1] + downOf(k));
        const cand = Array.from(new Set(ys0.concat(inCol.map((k) => grid[k][1] + downOf(k) + upOf(id))))).filter((y) => y >= TOP + upOf(id) && y < floor && free(y));
        const under = cand.filter((y) => y > yNear).sort((p, q) => p - q), over = cand.filter((y) => y < yNear).sort((p, q) => q - p);
        return under.length ? under[0] : over.length ? over[0] : floor < Infinity ? null : Math.max(TOP, ...inCol.map((k) => grid[k][1] + downOf(k))) + upOf(id);
      };
      let seat: [number, number] | null = null;
      for (const x of [x0].concat(xs.filter((v) => v !== x0).sort((p, q) => Math.abs(p - x0) - Math.abs(q - x0)))) { const y = placeIn(x); if (y != null) { seat = [x, y]; break; } }
      grid[id] = seat || [x0, Math.max(TOP, ...Object.keys(grid).filter((k) => grid[k][0] === x0).map((k) => grid[k][1] + downOf(k))) + upOf(id)];
      unseated.push(id);
    }
    // not in the GRID line and no place given: the engine seats it. The whole short is known, so nothing lands on a seat that is taken later,
    // and the picture keeps reading from the top down in the order things appear.
    if (!isSet && !gotPos && !grid[id] && PLACED_T.includes(type)) {
      const isTall = (k: string) => !!reach[k] && (reach[k].down > DOWN || reach[k].up > UP);
      const me = life[id] || { a: n, b: Infinity, ord: 0 };
      // the things without a seat that this scene adds sit together in one row
      const mates = isTall(id) ? [id] : [id].concat(Object.keys(life).filter((k) => k !== id && !grid[k] && life[k].a === me.a && !isTall(k)).sort((p, q) => life[p].ord - life[q].ord)).slice(0, 3);
      const span = { a: me.a, b: Math.max(...mates.map((k) => (life[k] ? life[k].b : Infinity))) };
      const rows = new Map<number, string[]>();
      Object.keys(grid).forEach((k) => { rows.set(grid[k][1], (rows.get(grid[k][1]) || []).concat(k)); });
      const ys = Array.from(rows.keys()).sort((p, q) => p - q), nowYs = Array.from(live.values()), lowNow = nowYs.length ? Math.max(...nowYs) : 0;
      const busy = (y: number) => (rows.get(y) || []).filter((k) => life[k] && life[k].a <= span.b && span.a <= life[k].b);
      const plain = (y: number) => (rows.get(y) || []).every((k) => !isTall(k));
      const cols = mates.length === 1 ? ["M"] : mates.length === 2 ? ["L", "R"] : ["A", "B", "C"];
      let done = false;
      if (!isTall(id)) {
        // 1. a row nobody uses while these things are on screen. The row just under what is on screen now comes first.
        const free = ys.filter((y) => !busy(y).length && plain(y)), under = free.filter((y) => y > lowNow), over = free.filter((y) => y < lowNow);
        const y = under.length ? under[0] : over.length ? over[over.length - 1] : null;
        if (y != null) { mates.forEach((k, j) => { grid[k] = [COLS[cols[j]], y]; }); done = true; }
        // 2. one thing alone: a free side of a row that is in use now, the lowest such row first (the newest part of a picture is at its bottom)
        if (!done && mates.length === 1) for (const y2 of ys.filter((v) => nowYs.includes(v)).reverse()) {
          if (!plain(y2)) continue; // a tall thing fills its row
          const xs = busy(y2).map((k) => grid[k][0]), x = [COLS.C, COLS.A].find((c) => xs.every((v) => Math.abs(v - c) >= 340));
          if (x != null) { grid[id] = [x, y2]; done = true; break; }
        }
      }
      if (!done) { // 3. a new row right under the rows that have been used so far; the rows still waiting for their things move down to make room
        const seenYs = ys.filter((y) => (rows.get(y) || []).some((k) => seenIds.has(k))), base = seenYs.length ? seenYs[seenYs.length - 1] : null;
        const up = Math.max(UP, ...mates.map((k) => (reach[k] ? reach[k].up : UP))), down = Math.max(DOWN, ...mates.map((k) => (reach[k] ? reach[k].down : DOWN)));
        const baseDown = base == null ? 0 : Math.max(DOWN, ...(rows.get(base) || []).map((k) => (reach[k] ? reach[k].down : DOWN)));
        const y = base == null ? TOP + up : base + baseDown + up;
        ys.filter((v) => base == null || v > base).forEach((v) => (rows.get(v) || []).forEach((k) => { grid[k] = [grid[k][0], grid[k][1] + up + down]; }));
        mates.forEach((k, j) => { grid[k] = [COLS[cols[j]], y]; });
      }
      mates.forEach((k) => unseated.push(k));
    }
    // a seat from the GRID line, when the line itself gives no place
    if (!isSet && !gotPos && grid[id] && !["arrow", "line", "brace", "note", "sign", "dot"].includes(type)) { a.x = grid[id][0]; a.y = grid[id][1]; gotPos = true; a._seat = true; }
    // tall things hang down from their row instead of straddling it
    if (!isSet && gotPos && typeof a.y === "number" && ["node", "box", "icon", "num", "bar", "text", "table", "plot", "scale", "dots"].includes(type)) { seenIds.add(id); live.set(id, a.y as number); }
    const hung = !isSet && gotPos && (a._seat || ROWS.includes(a.y as number)) ? hangOf(type, a) : null;
    if (hung != null) a.y = (a.y as number) - 80 + hung;
    // the row line it stands on; a tall thing given as a position (a script written back by toText) was hung from its row, so the line is found again
    if (!isSet && typeof a.y === "number" && PLACED_T.includes(type)) { const h = hangOf(type, a); placedRow.set(id, { y: hung != null || h == null ? (a.y as number) - (hung != null ? hung - 80 : 0) : (a.y as number) + 80 - h, type, named: a.str != null && a.str !== "" }); }
    delete a._seat;
    acts.push(a);
  }
  if (unseated.length) issues.push({ level: "warn", beat: 0, code: "seat", msg: `No seat in GRID for: ${unseated.join(", ")}. They were given free seats of the picture.` });
  if (timeOn && stages && script.beats.length) script.beats[0].do = [axisAction(stages, script.vname, placedRow, reach) as Action].concat((script.beats[0].do || []) as Action[]);
  const ks = Object.keys(steps).map(Number).sort((x, y) => x - y);
  if (ks.length) plan.steps = ks.map((k) => steps[k]);
  if (Object.keys(plan).length) script.plan = plan;
  if (quiz.length) script.quiz = quiz;
  if (script.beats.length && !script.takeaway && !has.end) { const last = script.beats[script.beats.length - 1]; if (last.say) script.takeaway = last.say.replace(/\*/g, ""); }
  return { script, issues, labels, dels, has, grid, units };
}

// ---------- writing a Script back as notation ----------
const qt = (s: unknown) => '"' + String(s ?? "").replace(/"/g, "'") + '"';
const KEYORDER = ["w", "h", "r", "size", "scale", "frac", "dec", "tone", "side", "name", "badge", "cap", "sub", "curve", "show", "px", "label", "rowH", "xl", "yl", "at", "opacity", "align"];
function valTok(p: Props): string | null { return p.value == null ? null : (p.pre || "") + String(p.value) + (p.suf || ""); }
function actLine(a: Action): string[] {
  const op = a.op || (a.type ? "add" : "set");
  if (op === "del" || op === "pulse") return [`${op} ${a.id}${a.at != null ? " at=" + a.at : ""}`];
  if (op === "clear") { const k = Array.isArray(a.keep) ? a.keep.filter((x: unknown) => x !== "_axis") : []; return [k.length ? `keep ${k.join(" ")}` : "clear"]; } // the TIME line brings the axis back
  if (op === "send") return [`send ${a.from}>${a.to}${a.icon ? " " + a.icon : ""}${a.str != null ? " " + qt(a.str) : ""}${a.color ? " c=" + a.color : ""}${a.at != null ? " at=" + a.at : ""}`];
  const p: Props = Object.assign({}, a), type = op === "add" ? String(a.type) : "";
  const out: string[] = [op === "add" ? `${type} ${a.id}` : `set ${a.id}`];
  const used = new Set(["op", "id", "type"]);
  const use = (...k: string[]) => k.forEach((x) => used.add(x));
  if (type === "calc") {
    use("x", "y", "terms", "_autoY");
    for (const t of Array.isArray(p.terms) ? p.terms : []) {
      if (typeof t === "number") out.push(String(t));
      else if (typeof t === "string") out.push(t);
      else if (t && typeof t === "object") { const tt = t as Props; out.push(tt.v != null && typeof tt.v === "number" ? `${tt.pre || ""}${tt.v}${tt.suf || ""}${tt.from ? "@" + tt.from : ""}` : tt.from ? `${tt.s ?? tt.str ?? tt.v}@${tt.from}` : qt(tt.s ?? tt.str ?? tt.v)); }
    }
  } else {
    if (["arrow", "line", "brace"].includes(type) && p.from != null && p.to != null) { out.push(`${p.from}>${p.to}`); use("from", "to"); }
    else if (["arrow", "line", "brace"].includes(type) && p.x2 != null) { out.push(`${p.x},${p.y}>${p.x2},${p.y2}`); use("x", "y", "x2", "y2"); }
    if (type === "sign" && Array.isArray(p.between)) { out.push(p.between.join("~")); use("between"); }
    if (type === "dot" && p.plot != null) { out.push(`${p.plot}.${p.line ?? ""}`); use("plot", "line"); }
    if (type === "note" && p.to != null) { out.push(String(p.to)); use("to"); }
    if (p.x != null && p.y != null && !used.has("x")) { out.push(slotName(p.x, p.y) || `${p.x},${p.y}`); use("x", "y"); }
    if (type === "icon" && p.name != null) { out.push(String(p.name)); use("name"); }
    const v = valTok(p);
    if (v != null && (op === "set" || ["node", "box", "num", "bar", "text"].includes(type))) { out.push(v); use("value", "pre", "suf"); }
    if (p.side != null && (type === "note" || type === "brace")) { out.push(String(p.side)); use("side"); }
    if (type === "scale") { out.push(qt(p.left ?? ""), qt(p.right ?? "")); use("left", "right"); }
    if (p.str != null && type !== "icon" && type !== "num") { out.push(qt(p.str)); use("str"); }
    if (p.color != null) { out.push("c=" + p.color); use("color"); }
    if (p.dash === true) { out.push("dash"); use("dash"); }
    if (p.both === true) { out.push("both"); use("both"); }
  }
  const rest = Object.keys(p).filter((k) => !used.has(k) && p[k] != null).sort((x, y) => (KEYORDER.indexOf(x) + 99) % 99 - (KEYORDER.indexOf(y) + 99) % 99);
  const lines: string[] = [];
  for (const k of rest) {
    const v = p[k];
    if (k === "lines" && Array.isArray(v)) { v.forEach((L: Props) => lines.push(`pline ${a.id} ${L.id} ${(L.pts || []).map((q: number[]) => q.join(",")).join(" ")}${L.color ? " c=" + L.color : ""}${L.dash ? " dash" : ""}${L.str != null ? " " + qt(L.str) : ""}`)); continue; }
    if (k === "marks" && Array.isArray(v)) { v.forEach((M: Props) => lines.push(`pmark ${a.id} ${M.x}${M.str != null ? " " + qt(M.str) : ""}`)); continue; }
    if (k === "xr" || k === "yr") out.push(`${k}=${v[0]}..${v[1]}`);
    else if (k === "xt" || k === "yt" || k === "keep") out.push(`${k}=${v.join(",")}`);
    else if (k === "cols") out.push(`cols=${qt(v.join("|"))}`);
    else if (k === "rows") out.push(`rows=${qt(v.map((r: unknown[]) => r.join("|")).join(" / "))}`);
    else if (k === "hi") out.push(`hi=${qt(v.map((r: number[]) => r.join(",")).join(" "))}`);
    else if (typeof v === "number" || typeof v === "boolean") out.push(`${k}=${v}`);
    else if (typeof v === "string") out.push(/^[\x21-\x7e]+$/.test(v) && !/[="]/.test(v) ? `${k}=${v}` : `${k}=${qt(v)}`);
  }
  return [out.join(" "), ...lines];
}
const choiceText = (c: { q?: string; choices: string[]; answer: number; why?: string }) => [c.q || "", c.choices[c.answer], ...c.choices.filter((_, i) => i !== c.answer)].join(" | ") + (c.why ? " | why=" + c.why : "");

export function toText(script: Script, opt: { plan?: boolean } = {}): string {
  const L: string[] = [], p = script.plan || {};
  if (script.title) L.push("TITLE " + script.title);
  if (script.hook && script.hook.length) L.push("HOOK " + script.hook.join(" | "));
  if (script.card && script.card.length) L.push("CARD " + script.card.join(" | "));
  if (opt.plan === false && script.time && p.grid) L.push("GRID " + p.grid); // a TIME picture is read from its GRID
  if (script.time && script.time.length) L.push("TIME " + script.time.join(" | "));
  if (script.time && script.vname) L.push("VALUE " + script.vname);
  if (opt.plan !== false) {
    if (p.goal) L.push("GOAL " + p.goal);
    if (p.route) L.push("ROUTE " + p.route);
    if (p.picture) L.push("PICTURE " + p.picture);
    if (p.grid) L.push("GRID " + p.grid);
    if (p.needs) L.push("NEEDS " + p.needs);
    if (p.given && p.given.length) L.push("GIVEN " + p.given.map((g) => `${g.v}=${g.is || ""}`).join("; "));
    (p.steps || []).forEach((s, i) => L.push(`STEP ${i + 1} ${s.q || ""} => ${s.idea || ""}`));
    if (p.terms && p.terms.length) L.push("TERM " + p.terms.map((t) => `${t.t}=${t.plain || ""}`).join("; "));
    if (p.trap) L.push("TRAP " + p.trap);
    if (p.part && (p.part.of || 1) > 1) L.push(`PART ${p.part.n}/${p.part.of}${p.part.next ? " next=" + p.part.next : ""}`);
  }
  (script.beats || []).forEach((b, i) => {
    L.push(`#${i + 1}${b.step != null ? " s" + b.step : ""}${b.hard ? " hard" : ""}${b.say ? " | " + b.say : ""}`);
    (b.do || []).forEach((a) => { if (!(a && a.type === "axis" && a.auto)) L.push(...actLine(a)); }); // the parser adds the axis again from TIME
    if (b.cam) L.push(`cam ${b.cam.x ?? 540},${b.cam.y ?? 960}${b.cam.zoom != null ? " zoom=" + b.cam.zoom : ""}`);
    if (b.focus && b.focus.length) L.push("focus " + b.focus.join(" "));
    if (b.ask) L.push("ask " + choiceText(b.ask));
  });
  if (script.takeaway) L.push("END " + script.takeaway);
  (script.quiz || []).forEach((q) => L.push("QUIZ " + choiceText(q)));
  return L.join("\n");
}

/** Merge a repair: scenes with the same number replace the old ones, "#5a" goes in after scene 5, "#7 DEL" removes scene 7. */
export function applyPatch(base: Script, patchText: string): { script: Script; issues: Issue[]; changed: string[] } {
  const b0 = parseScript(toText(base)); // the seats and units the unchanged scenes already use
  const p = parseScript(patchText, { grid: b0.grid, units: b0.units, time: !!base.time }), out: Script = Object.assign({}, base, { plan: Object.assign({}, base.plan || {}) }), changed: string[] = [];
  const byLabel = new Map<string, Beat>();
  p.labels.forEach((l, i) => byLabel.set(l.toLowerCase(), p.script.beats[i]));
  const dels = new Set(p.dels.map((x) => x.toLowerCase())), beats: Beat[] = [];
  const extras = (k: number) => [...byLabel.keys()].filter((l) => new RegExp(`^${k}[a-z]$`).test(l) || new RegExp(`^${k}\\.\\d+$`).test(l)).sort().forEach((l) => { beats.push(byLabel.get(l)!); changed.push("+" + l); });
  extras(0);
  (base.beats || []).forEach((b, i) => {
    const k = String(i + 1);
    if (dels.has(k)) changed.push("-" + k);
    else if (byLabel.has(k)) { beats.push(byLabel.get(k)!); changed.push("~" + k); }
    else beats.push(b);
    extras(i + 1);
  });
  out.beats = beats;
  const pp = p.script.plan || {}, plan = out.plan as Plan;
  if (p.has.hook) { if (p.script.hook) out.hook = p.script.hook; else delete out.hook; }
  if (p.has.card && p.script.card) out.card = p.script.card;
  if (p.has.time) { if (p.script.time) out.time = p.script.time; else delete out.time; }
  if (p.has.value) { if (p.script.vname) out.vname = p.script.vname; else delete out.vname; }
  if (p.has.title && p.script.title) out.title = p.script.title;
  if (p.has.goal) plan.goal = pp.goal;
  if (p.has.route) plan.route = pp.route;
  if (p.has.needs) plan.needs = pp.needs;
  if (p.has.picture) plan.picture = pp.picture;
  if (p.has.grid) plan.grid = pp.grid;
  if (p.has.given) { const seen = new Set((pp.given || []).map((g) => String(g.v))); plan.given = (pp.given || []).concat((plan.given || []).filter((g) => !seen.has(String(g.v)))); }
  if (p.has.step) plan.steps = pp.steps;
  if (p.has.term) plan.terms = pp.terms;
  if (p.has.trap) plan.trap = pp.trap;
  if (p.has.end && p.script.takeaway) out.takeaway = p.script.takeaway;
  if (p.has.quiz && p.script.quiz) out.quiz = p.script.quiz;
  // the time axis lies under the whole picture and opens scene 1: measure it again on the merged scenes and put it back in its place
  const isAxis = (a: Action) => !!a && a.type === "axis" && !!a.auto;
  out.beats = out.beats.map((b) => ((b.do || []).some(isAxis) ? Object.assign({}, b, { do: (b.do || []).filter((a) => !isAxis(a)) }) : b));
  if (out.time && out.beats.length) {
    const again = parseScript(toText(out)).script.beats[0], ax = again && (again.do || []).find(isAxis);
    if (ax) out.beats[0] = Object.assign({}, out.beats[0], { do: [ax].concat(out.beats[0].do || []) });
  }
  return { script: out, issues: p.issues, changed };
}
