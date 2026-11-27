"use client";
// 보는 화면 (기존 앱의 피드 그대로): 한 화면에 한 편씩, 위로 넘기면 다음 편. 편이 끝나면 저절로 넘어가고,
// 넘기다 보면 그 편의 퀴즈가 한 장 올라온다 (답하면 해설 시트, "다음 →"으로 다음 편). 넘김은 카드 더미 움직임(11/23 확정).
// 지금 화면에 있는 편 하나만 재생 엔진을 띄우고, 나머지는 멈춘 그림으로 둔다.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { H, W, type Script } from "@/lib/film";
import { HOST } from "@/lib/film/host";
import { getPrefs, getSeries, loadShort, madeKs, markSeen, seenOf, titleOf, totalOf, useFilmStore } from "@/lib/film/store";
import { burstFrom } from "./fx";
import { Icon } from "./icons";
import { blip } from "./PlayerAudio";
import { Ahead, Settings } from "./Player";
import { EMPTY_VIEW, createPlayer, type PlayerApi, type PlayerView } from "./PlayerEngine";
import Still from "./Still";

type Item = { kind: "short"; k: number; key: string } | { kind: "quiz"; k: number; key: string } | { kind: "end"; key: string };

const pct = (v: number) => (v * 100).toFixed(3) + "%";
const reduced = () => {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
};
const closeHref = (sid: string) => (sid !== "ex" ? "#s-" + sid : "#home");

/** 지금 화면에 있는 편: 재생 엔진을 띄워 바로 틀고, 끝나면 onEnded */
function LiveShort({ sid, k, script, apiRef, onView, onEnded }: { sid: string; k: number; script: Script; apiRef: { current: PlayerApi | null }; onView: (v: PlayerView) => void; onEnded: () => void }) {
  const [view, setView] = useState<PlayerView>(EMPTY_VIEW);
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const segsRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const started = useRef(false);
  const endedRef = useRef(onEnded);
  endedRef.current = onEnded;
  const viewRef = useRef(onView);
  viewRef.current = onView;
  useEffect(() => {
    const svg = svgRef.current, wrap = wrapRef.current, box = boxRef.current, segs = segsRef.current, time = timeRef.current;
    if (!svg || !wrap || !box || !segs || !time) return;
    started.current = false;
    let was = false;
    const p = createPlayer({
      sid,
      k,
      script,
      els: { svg, wrap, box, segs, time },
      onView: (v) => {
        setView(v);
        viewRef.current(v);
        // 실리면 바로 튼다 (피드에서는 표지를 누를 필요가 없다)
        if (v.info && !started.current) {
          started.current = true;
          p.play();
        }
        if (v.ended && !was) endedRef.current();
        was = v.ended;
      },
      onClose: () => {
        location.hash = closeHref(sid);
      },
    });
    apiRef.current = p;
    return () => {
      p.destroy();
      if (apiRef.current === p) apiRef.current = null;
    };
  }, [sid, k, script, apiRef]);
  useLayoutEffect(() => {
    apiRef.current?.refreshFills();
  }, [view.info, apiRef]);
  const ask = view.ask;
  return (
    <div className="fstage">
      <div className="fbox" ref={wrapRef}>
      <div className="stagebox" ref={boxRef} onClick={(e) => apiRef.current?.onStage(e.clientX, e.clientY)}>
        <svg className="st" aria-hidden="true" ref={svgRef} />
        <div key={view.flash ? view.flash.n : 0} className={view.flash ? "flash on" : "flash"}>
          {view.flash && <Icon name={view.flash.name} />}
        </div>
        {ask && (
          <div className="askbtns" role="group" aria-label="답을 골라 주세요">
            {ask.choices.map((c, i) => {
              const r = ask.rects[i];
              if (!r) return null;
              return (
                <button
                  key={i}
                  type="button"
                  className="askbtn"
                  style={{ left: pct(r.x / W), top: pct(r.y / H), width: pct(r.w / W), height: pct(r.h / H) }}
                  onClick={(e) => {
                    e.stopPropagation();
                    apiRef.current?.answer(ask.n, i);
                  }}
                >
                  <span className="sr">{`${i + 1}번: ${c}`}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
      </div>
      <div className="fsegs" ref={segsRef} onPointerDown={(e) => apiRef.current?.scrubStart(e.nativeEvent)} role="slider" aria-label="재생 위치" tabIndex={0}>
        {view.info?.beats.map((_, i) => (
          <div key={i} className="seg">
            <i />
          </div>
        ))}
      </div>
      <span className="sr" ref={timeRef} />
    </div>
  );
}

/** 넘기다 만나는 퀴즈 한 장 (기존 앱의 퀴즈 카드): 고르면 해설 시트가 올라오고, 시트의 단추로 다음 편 */
function QuizItem({ sid, k, streak, onAnswer, onNext }: { sid: string; k: number; streak: number; onAnswer: (ok: boolean) => void; onNext: () => void }) {
  const sh = loadShort(sid, k);
  const q = sh?.script.quiz?.[0];
  const [pick, setPick] = useState<number | null>(null);
  if (!q) return null;
  const done = pick != null;
  const ok = done && pick === q.answer;
  return (
    <div className="fquiz">
      <div className="qhead">
        <span className="label ink">QUIZ</span>
        <span className="fterm">{titleOf(sid, k)}</span>
        {streak >= 2 ? <span className="combo">{`COMBO ×${streak}`}</span> : null}
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
              aria-disabled={done}
              onClick={(e) => {
                if (done) return;
                setPick(m);
                const right = m === q.answer;
                blip(right);
                if (right) burstFrom(e.currentTarget, { x: e.clientX, y: e.clientY });
                const prev = seenOf(sid, k)?.quiz || [];
                markSeen(sid, k, { quiz: [right, ...prev.slice(1)] });
                onAnswer(right);
              }}
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
      {done ? (
        <div className={"xsheet fx" + (ok ? "" : " no")} role="status">
          <div className="xt">{ok ? "정답이에요!" : "아깝다!"}</div>
          {!ok ? <p className="xa">{`정답: ${q.choices[q.answer]}`}</p> : null}
          {q.why ? <p className="xw">{q.why}</p> : null}
          {!ok ? <p className="xs">오답노트에 담았어요</p> : null}
          <button type="button" className={"btn " + (ok ? "primary" : "red")} onClick={onNext}>
            {ok ? "다음 →" : "알겠어요, 다음 →"}
          </button>
        </div>
      ) : (
        <p className="fhint">정답을 골라 보세요 · 넘기면 건너뛰기</p>
      )}
    </div>
  );
}

export default function FeedView({ sid, k }: { sid: string; k: number }) {
  useFilmStore();
  const s = getSeries(sid);
  const ks = useMemo(() => (s ? madeKs(s) : []), [s]);
  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    for (const n of ks) {
      const sh = loadShort(sid, n);
      if (!sh || !sh.scenes) continue;
      out.push({ kind: "short", k: n, key: "s" + n });
      if (sh.script.quiz && sh.script.quiz.length) out.push({ kind: "quiz", k: n, key: "q" + n });
    }
    out.push({ kind: "end", key: "end" });
    return out;
  }, [sid, ks]);
  const startAt = Math.max(0, items.findIndex((it) => it.kind === "short" && it.k === k));
  const [index, setIndex] = useState(startAt);
  const scroller = useRef<HTMLDivElement>(null);
  const api = useRef<PlayerApi | null>(null);
  const [view, setView] = useState<PlayerView>(EMPTY_VIEW);
  const [sets, setSets] = useState(false);
  const [streak, setStreak] = useState(0);
  const prefs = getPrefs();
  const cur = items[Math.min(index, items.length - 1)];
  const curK = cur && cur.kind !== "end" ? cur.k : ks[ks.length - 1] || k;
  const total = s ? totalOf(s) : 0;

  // 처음 열 때 고른 편으로 바로 간다
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = startAt * el.clientHeight;
  }, [startAt]);
  // 열려 있는 동안 뒤 화면이 스크롤되지 않게
  useEffect(() => {
    const de = document.documentElement;
    const prev = de.style.overflow;
    de.style.overflow = "hidden";
    return () => {
      de.style.overflow = prev;
    };
  }, []);

  const scrollTo = useCallback(
    (i: number) => {
      const el = scroller.current;
      if (!el) return;
      const to = Math.max(0, Math.min(items.length - 1, i));
      el.scrollTo({ top: to * el.clientHeight, behavior: reduced() ? "auto" : "smooth" });
    },
    [items.length],
  );

  /* 카드 더미 넘김 (기존 앱, 11/23 확정): 지금 장은 왼쪽 위로 날아가고 다음 장은 뒤에서 앞으로 커진다 */
  const layers = useRef<(HTMLDivElement | null)[]>([]);
  const raf = useRef(0);
  const applyStack = useCallback(() => {
    raf.current = 0;
    const el = scroller.current;
    if (!el) return;
    const pos = el.scrollTop / Math.max(1, el.clientHeight);
    const top = Math.floor(pos);
    const red = reduced();
    layers.current.forEach((node, i) => {
      if (!node) return;
      if (red || (i !== top && i !== top + 1)) {
        if (node.style.transform) node.style.transform = "";
        return;
      }
      const p = pos - i;
      if (p >= 0) {
        if (p < 0.001) {
          node.style.transform = "";
          return;
        }
        const e = p * p * (0.6 + 0.4 * p);
        node.style.transform = `translateY(${(p * 100).toFixed(2)}%) translate(${(-30 * e).toFixed(2)}%, ${(-110 * e).toFixed(2)}%) rotate(${(-14 * e).toFixed(2)}deg)`;
      } else {
        const kk = 1 + p;
        const g = 1 - Math.pow(1 - kk, 3) + 0.05 * Math.sin(Math.PI * kk) * kk;
        node.style.transform = `translateY(${(p * 100).toFixed(2)}%) translateY(${(6 * (1 - g)).toFixed(2)}%) scale(${(0.86 + 0.14 * g).toFixed(4)})`;
      }
    });
  }, []);
  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    if (!raf.current) raf.current = requestAnimationFrame(applyStack);
    const i = Math.round(el.scrollTop / Math.max(1, el.clientHeight));
    if (i !== index) setIndex(i);
  };
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  // 아래·위 글쇠로도 넘긴다 (영상의 글쇠는 엔진이 받는다)
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (sets) return;
      if (["ArrowDown", "PageDown", "j"].includes(e.key)) {
        e.preventDefault();
        scrollTo(index + 1);
      } else if (["ArrowUp", "PageUp"].includes(e.key)) {
        e.preventDefault();
        scrollTo(index - 1);
      }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [index, scrollTo, sets]);

  // 주소는 지금 보는 편을 따라간다 (뒤로 가기 기록은 남기지 않는다)
  useEffect(() => {
    if (cur && cur.kind === "short") {
      const h = `#w-${sid}-${cur.k}`;
      if (location.hash !== h) history.replaceState(null, "", h);
    }
  }, [cur, sid]);

  const scenes = view.info ? view.info.beats.length : 0;
  const due = cur?.kind === "short" && view.started && !view.ended && scenes > 0 && view.beat + 1 >= Math.ceil(scenes * HOST.prefetchAt);
  const more = !!s && s.kind !== "ex" && ks.length < total;
  const label = s ? (s.kind === "ex" ? "맛보기" : s.title || "") : "";

  return (
    <div className="watch feed" role="dialog" aria-modal="true" aria-label={label}>
      <div className="wcol">
        <div className="fscroll" ref={scroller} onScroll={onScroll} inert={sets}>
          {items.map((it, i) => (
            <section key={it.key} className="fitem" style={{ zIndex: items.length - i }} aria-label={it.kind === "short" ? titleOf(sid, it.k) : it.kind === "quiz" ? "퀴즈" : "끝"}>
              <div
                className="flayer"
                ref={(n) => {
                  layers.current[i] = n;
                }}
              >
                {it.kind === "short" ? (
                  i === index ? (
                    <LiveShort sid={sid} k={it.k} script={loadShort(sid, it.k)!.script} apiRef={api} onView={setView} onEnded={() => setTimeout(() => scrollTo(i + 1), 700)} />
                  ) : (
                    <div className="fstage">
                      <div className="fbox">
                        <div className="stagebox still">{Math.abs(i - index) <= 2 ? <Still sid={sid} k={it.k} /> : null}</div>
                      </div>
                      <div className="fsegs" />
                    </div>
                  )
                ) : it.kind === "quiz" ? (
                  <QuizItem
                    sid={sid}
                    k={it.k}
                    streak={streak}
                    onAnswer={(ok) => setStreak((n) => (ok ? n + 1 : 0))}
                    onNext={() => scrollTo(i + 1)}
                  />
                ) : (
                  <div className="fend">
                    <span className="label">FINISH</span>
                    <h2>{more ? "여기까지 만든 편을 다 봤어요" : "완주했어요!"}</h2>
                    <p className="sub">{label + (s && s.kind !== "ex" && total ? ` · ${ks.length}/${total}편` : "")}</p>
                    <div className="cta">
                      {more ? (
                        <a className="btn primary" href={"#s-" + sid}>
                          다음 편 만들러 가기 →
                        </a>
                      ) : (
                        <a className="btn primary" href="#home">
                          홈으로
                        </a>
                      )}
                      <button type="button" className="btn ghost" onClick={() => scrollTo(0)}>
                        처음부터 다시 보기
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>
        {/* 위쪽 줄: 뒤로 · 제목 · 몇 편째 · 소리 · 설정 */}
        <div className="fbar" inert={sets}>
          <a className="ib" href={closeHref(sid)} aria-label="닫기">
            <Icon name="back" />
          </a>
          <span className="fttl">{cur?.kind === "short" ? titleOf(sid, cur.k) : label}</span>
          {total && s?.kind !== "ex" ? <span className="count">{`${curK} / ${total}`}</span> : null}
          <button type="button" className="ib" aria-label={prefs.sound ? "소리 끄기" : "소리 켜기"} onClick={() => api.current?.toggleSound()}>
            <Icon name={prefs.sound ? "sound" : "mute"} />
          </button>
          <button type="button" className="ib" aria-label="보기 설정" onClick={() => setSets(true)}>
            <Icon name="gear" />
          </button>
        </div>
        {index === startAt && cur?.kind === "short" ? (
          <p className="fswipe" aria-hidden="true">
            <span className="bob">↑</span> 넘기면 다음
          </p>
        ) : null}
        {cur?.kind === "short" ? <Ahead sid={sid} k={cur.k} due={due} /> : null}
        {sets && <Settings api={api} onClose={() => setSets(false)} />}
      </div>
    </div>
  );
}
