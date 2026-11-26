"use client";
// 한 편이 끝난 뒤 올라오는 끝 화면 (확정안): 개념 카드(그림 칸, 이름, 한 줄 정리, 용어), 퀴즈 두 개와 해설 시트, 완주 칸.
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Script } from "@/lib/film";
import { makeShort, initGen, useGen } from "@/lib/film/gen";
import { entryOf, getSeries, markSeen, seenOf, titleOf, totalOf, useFilmStore, type Series, type ShortEntry } from "@/lib/film/store";
import { burstFrom } from "./fx";
import Still from "./Still";
import { usd } from "./format";
import { blip } from "./PlayerAudio";

const reduced = () => {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
};

/** 이 편을 누가 어떻게 썼고 AI 비용이 얼마였는지 */
export function costLine(e: ShortEntry, s: Series | null): string {
  const share = s ? s.planShare : 0;
  if (e.from === "ex") return "사람이 직접 쓴 본보기 대본이에요. AI 비용은 들지 않았습니다.";
  if (e.from === "built") {
    const c = e.cost;
    const fix = c.fix === "rewrite" ? " (자동 점검 뒤 한 번 다시 쓴 것)" : c.fix === "patch" ? " (자동 점검에 걸린 장면 하나만 고친 것)" : "";
    if (e.edited) return `Sonnet 5.5가 쓴 대본을 사람이 연출만 다듬은 편이에요. AI 비용은 대본 ${usd(c.write)}에 시리즈 계획 몫 ${usd(share)}를 더해 ${usd(c.write + share)}였습니다.`;
    return `Sonnet 5.5가 ${c.secs}초 만에 쓴 대본 그대로예요${fix}. AI 비용은 대본 ${usd(c.write)}에 시리즈 계획 몫 ${usd(share)}를 더해 ${usd(c.write + share)}였습니다.`;
  }
  const m = e.made;
  if (m.model === "mock") return "예시 모드에서 만든 편이에요. AI를 부르지 않고 준비된 대본을 가져왔습니다.";
  const fix = m.fix === "rewrite" ? ", 자동 점검 뒤 한 번 다시 씀" : m.fix === "patch" ? ", 자동 점검 뒤 걸린 장면만 고침" : "";
  // 정해 둔 모델이 아닌 다른 모델이 답했으면 그 이름을 그대로 알린다
  const other = m.model && !/sonnet-5-5/.test(m.model) ? m.model.replace(/^claude-/, "") : "";
  return (
    (other ? `${m.secs}초 만에 쓴 편이에요 (${other}, 호출 ${m.calls}번${fix}). ` : `Sonnet 5.5가 ${m.secs}초 만에 쓴 편이에요 (호출 ${m.calls}번${fix}). `) +
    (m.errs > 0 ? `자동 점검에서 ${m.errs}곳이 남아 있어요.` : "자동 점검을 통과했어요.") +
    (m.usd > 0 ? ` AI 비용은 대본 ${usd(m.usd)}에 시리즈 계획 몫 ${usd(share)}를 더해 ${usd(m.usd + share)}였습니다.` : "")
  );
}

export interface EndSheetProps {
  sid: string;
  k: number;
  script: Script;
  entry: ShortEntry;
  onReplay: () => void;
}

/** 한 줄 정리에서 형광펜을 칠 핵심어: 용어 가운데 문장에 들어 있는 첫 것, 없으면 편 제목 */
function keyWordOf(text: string, words: string[]): [string, string, string] | null {
  for (const w of words) {
    const t = (w || "").trim();
    if (t.length < 2) continue;
    const i = text.indexOf(t);
    if (i >= 0) return [text.slice(0, i), t, text.slice(i + t.length)];
  }
  return null;
}

/** 개념 그림 칸: 영상의 한 장면을 블루 테두리 스티커 칸에 담는다 (칸만 기울이고 그림은 똑바로) */
function ConceptPicture({ sid, k }: { sid: string; k: number }) {
  const ref = useRef<HTMLDivElement>(null);
  // 9:16 장면을 정사각 칸에 꽉 채운다 (가운데를 잘라 보인다)
  useEffect(() => {
    ref.current?.querySelector("svg")?.setAttribute("preserveAspectRatio", "xMidYMid slice");
  }, []);
  return (
    <div className="cpic" aria-hidden="true">
      <div className="in" ref={ref}>
        <Still sid={sid} k={k} />
      </div>
    </div>
  );
}

const Mark = ({ ok }: { ok: boolean }) => (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    {ok ? (
      <path d="M3 8.5 L6.5 12 L13 4.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    ) : (
      <path d="M4 4 L12 12 M12 4 L4 12" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    )}
  </svg>
);

export default function EndSheet({ sid, k, script, entry, onReplay }: EndSheetProps) {
  useFilmStore();
  const gen = useGen();
  useEffect(() => {
    initGen();
  }, []);
  const quiz = (script.quiz ?? []).slice(0, 2);
  const terms = (script.plan?.terms ?? []).slice(0, 3);
  // 고른 보기. 두 번 눌러도 한 번만 센다
  const [picks, setPicks] = useState<number[]>([]);
  const picksRef = useRef<number[]>([]);
  // 해설 시트가 떠 있는 문제 (없으면 -1). 시트를 내리면 풀이는 선택지 아래 칸에 남는다
  const [open, setOpen] = useState(-1);
  const sheetRef = useRef<HTMLDivElement>(null);
  const finRef = useRef<HTMLHeadingElement>(null);
  // 끝 화면이 올라오면 초점을 여기로 옮긴다: 아래에 가려진 재생 단추에 남아 있으면 키보드와 화면 낭독기가 길을 잃는다
  useEffect(() => {
    sheetRef.current?.focus({ preventScroll: true });
  }, []);
  const shown = Math.min(quiz.length, picks.length + 1);

  // 완주 칸에 도착하면 제목에서 파티클이 한 번 터진다 (정답·완료 순간 = 팡 파티클)
  useEffect(() => {
    const el = finRef.current;
    const root = sheetRef.current;
    if (!el || !root || typeof IntersectionObserver === "undefined") return;
    let fired = false;
    const io = new IntersectionObserver(
      (es) => {
        if (fired || !es.some((x) => x.isIntersecting)) return;
        fired = true;
        burstFrom(el, undefined, 24);
        io.disconnect();
      },
      { root, threshold: 0.9 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const answer = (i: number, j: number, at?: { x: number; y: number }, el?: Element) => {
    const cur = picksRef.current;
    if (cur.length !== i) return;
    const next = [...cur, j];
    picksRef.current = next;
    setPicks(next);
    const score = next.map((p, m) => p === quiz[m].answer);
    blip(score[i]);
    markSeen(sid, k, { quiz: score });
    if (score[i] && el) burstFrom(el, at);
    setOpen(i);
  };

  /** 시트의 단추: 시트를 내리고 다음 문제(마지막이면 완주 칸)로 간다 */
  const goOn = (i: number) => {
    setOpen(-1);
    const root = sheetRef.current;
    const target = i + 1 < quiz.length ? root?.querySelectorAll<HTMLElement>(".qb")[i + 1] : finRef.current?.parentElement;
    if (!target) return;
    const smooth = !reduced();
    window.requestAnimationFrame(() => {
      try {
        target.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
      } catch {
        /* 스크롤은 없어도 된다 */
      }
      (target.querySelector<HTMLElement>(".opt") ?? finRef.current ?? target).focus({ preventScroll: true });
    });
  };

  const s = getSeries(sid);
  const n = s ? totalOf(s) : 0;
  let next: ReactNode;
  if (!s || s.kind === "ex")
    next = (
      <a className="btn primary" href="#home">
        홈으로
      </a>
    );
  else if (k < n && entryOf(sid, k + 1))
    next = (
      <a className="btn primary" href={`#w-${sid}-${k + 1}`}>
        {`다음 편 보기 →`}
      </a>
    );
  else if (k < n && gen.avail === "ok" && !gen.busy)
    next = (
      <button
        type="button"
        className="btn primary"
        onClick={() => {
          location.hash = "#s-" + sid;
          void makeShort(sid, k + 1);
        }}
      >
        {`다음 ${k + 1}편 만들기 →`}
      </button>
    );
  else
    next = (
      <a className="btn primary" href={"#s-" + sid}>
        시리즈 목록으로
      </a>
    );

  // 콤보: 영상 속 질문부터 이어서 맞힌 수 (두 번째 연속 정답부터 COMBO ×2)
  const askOk = seenOf(sid, k)?.ask;
  const results = picks.map((p, m) => p === quiz[m].answer);
  const streakAt: number[] = [];
  let run = askOk === true ? 1 : 0;
  for (const r of results) {
    run = r ? run + 1 : 0;
    streakAt.push(run);
  }
  const best = Math.max(askOk === true ? 1 : 0, ...streakAt);
  const right = results.filter(Boolean).length;
  const wrong = quiz.map((q, m) => ({ q, m })).filter(({ m }) => picks[m] != null && !results[m]);

  const name = script.title || titleOf(sid, k);
  const take = script.takeaway || script.plan?.goal || "";
  const hl = keyWordOf(take, [...terms.map((t) => t.t), name]);
  const cost = costLine(entry, s);
  return (
    <div className={"sheet" + (open >= 0 ? " xopen" : "")} ref={sheetRef} tabIndex={-1} role="region" aria-label="한 줄 정리와 확인 문제">
      {/* 개념 카드: 그림 칸 → 개념 이름 → 정의 한 줄 → 용어 */}
      <ConceptPicture sid={sid} k={k} />
      <h2 className={"cname" + (name.length > 14 ? " s" : name.length > 9 ? " m" : "")}>{name}</h2>
      {take ? (
        <p className={"csum" + (take.length > 60 ? " long" : "")}>
          <span className="sr">한 줄 정리: </span>
          {hl ? (
            <>
              {hl[0]}
              <mark>{hl[1]}</mark>
              {hl[2]}
            </>
          ) : (
            take
          )}
        </p>
      ) : null}
      {terms.length > 0 && (
        <div className="terms">
          {terms.map((t, i) => (
            <div key={i}>
              <b>{t.t}</b>
              {t.plain}
            </div>
          ))}
        </div>
      )}
      {quiz.length > 0 && (
        <div className="qz">
          {quiz.slice(0, shown).map((q, i) => {
            const pick = picks[i];
            const done = pick != null;
            const ok = done && pick === q.answer;
            const streak = streakAt[i] ?? 0;
            return (
              <div className="qb" key={i}>
                <div className="qhead">
                  <span className="label ink">{`QUIZ #${i + 1}`}</span>
                  <span className="sr">{` (${quiz.length}문제 중)`}</span>
                  {ok && streak >= 2 ? <span className="combo">{`COMBO ×${streak}`}</span> : null}
                </div>
                <div className={"q" + (q.q.length > 34 ? " long" : "")}>{q.q}</div>
                <div className="opts">
                  {q.choices.map((c, m) => {
                    const st = done ? (m === q.answer ? " right" + (m === pick ? " picked" : "") : m === pick ? " wrong" : " dim") : "";
                    return (
                      <button
                        key={m}
                        type="button"
                        className={"opt" + st}
                        // 답한 뒤에도 초점이 사라지지 않게 disabled 대신 aria-disabled를 쓴다 (answer가 두 번째 누름을 무시한다)
                        aria-disabled={done}
                        onClick={(e) => answer(i, m, { x: e.clientX, y: e.clientY }, e.currentTarget)}
                      >
                        <span className="n" aria-hidden="true">
                          {m + 1}
                        </span>
                        <span className="t">
                          {c}
                          {done && m === q.answer ? (
                            <span className="tick" aria-hidden="true">
                              ✓
                            </span>
                          ) : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {/* 풀이: 화면 낭독기가 바로 읽게 늘 있는 자리. 시트가 떠 있는 동안은 눈에는 시트로만 보인다 */}
                <div className={"why" + (open === i ? " sr" : "")} role="status">
                  {done ? (
                    <>
                      <b className={ok ? "ok" : "no"}>{ok ? "정답!" : "아깝다!"}</b>
                      {(ok ? "" : `정답은 ${q.choices[q.answer]}. `) + (q.why || "")}
                    </>
                  ) : (
                    ""
                  )}
                </div>
                {open === i && done ? (
                  <div className={"xsheet" + (ok ? "" : " no")}>
                    <div className="xt" aria-hidden="true">
                      <span className="xi">
                        <Mark ok={ok} />
                      </span>
                      {ok ? "정답이에요!" : "아깝다!"}
                    </div>
                    {!ok ? (
                      <p className="xa" aria-hidden="true">
                        {`정답: ${q.choices[q.answer]}`}
                      </p>
                    ) : null}
                    {q.why ? (
                      <p className="xw" aria-hidden="true">
                        {q.why}
                      </p>
                    ) : null}
                    {!ok ? (
                      <p className="xs" aria-hidden="true">
                        아래 오답노트에 담았어요
                      </p>
                    ) : null}
                    <button type="button" className={"btn " + (ok ? "primary" : "red")} onClick={() => goOn(i)}>
                      {ok ? (i + 1 < quiz.length ? "다음 문제 →" : "결과 보기 →") : "알겠어요, 다음 →"}
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
      {/* 완주 */}
      <div className="fin">
        <span className="label">FINISH</span>
        <h2 ref={finRef} tabIndex={-1}>
          완주했어요!
        </h2>
        <p className="sub">{(s && s.kind !== "ex" ? (s.title || "") + " · " + k + "편" : "맛보기") + (s && s.kind !== "ex" && n ? ` / ${n}편` : "")}</p>
        <div className="stats">
          <div>
            <b>{askOk === true ? "맞힘" : askOk === false ? "아깝다" : "-"}</b>
            <span>영상 속 질문</span>
          </div>
          <div className="hi">
            <b>{quiz.length ? `${right}/${quiz.length}` : "-"}</b>
            <span>퀴즈 정답</span>
          </div>
          <div>
            <b>{best >= 2 ? `×${best}` : "-"}</b>
            <span>최고 콤보</span>
          </div>
        </div>
        {wrong.length ? (
          <div className="wnote">
            <div className="wh">
              {`오답노트 ${wrong.length}개`}
              <span>다시 보면 또 풀 수 있어요</span>
            </div>
            {wrong.map(({ q, m }) => (
              <div className="wr" key={m}>
                <span>{q.q}</span>
                <span>{`QUIZ #${m + 1}`}</span>
              </div>
            ))}
          </div>
        ) : null}
        <div className="cta">
          {next}
          <button type="button" className="btn ghost" onClick={onReplay}>
            처음부터 다시 보기
          </button>
        </div>
        {cost && <p className="cost">{cost}</p>}
      </div>
    </div>
  );
}
