"use client";
// 재생기: 한 편을 9:16 무대에 틀고, 영상 속 질문에서 멈춰 답을 받고, 끝나면 끝 화면을 올린다.
// 모양은 확정안의 위쪽 줄 "C"(뒤로 · 라벨 · 쪽수 · 칩 한 줄 · 설정 시트)와 아래 얇은 진행 막대.
// 편마다 새로 마운트된다 (FilmApp이 sid-k를 key로 준다).
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { H, SKINS, SKIN_LIST, W } from "@/lib/film";
import { makeShort, useGen } from "@/lib/film/gen";
import { HOST } from "@/lib/film/host";
import { SPEEDS, getPrefs, getSeries, loadShort, titleOf, totalOf, skinFor, useFilmStore, type LoadedShort } from "@/lib/film/store";
import { REVIEW_COUNTS, clockDays, reviewCount, setClockDays, setReviewCount, setSpaced, spacedOn, stepsLabel, useStudy } from "@/lib/film/study";
import EndSheet from "./EndSheet";
import { secs } from "./format";
import { Icon } from "./icons";
import { EMPTY_VIEW, createPlayer, spanOf, type PlayerApi, type PlayerMenu, type PlayerView } from "./PlayerEngine";

export interface PlayerProps {
  /** 시리즈 id ("ex"는 한 편짜리 맛보기 묶음) */
  sid: string;
  /** 몇 편인지 (1부터) */
  k: number;
}

const closeHref = (sid: string) => (sid !== "ex" ? "#s-" + sid : "#home");
const pct = (v: number) => (v * 100).toFixed(3) + "%";

/** 메뉴 안에서 위아래 화살표로 항목을 옮겨 다닌다 */
function popKey(e: KeyboardEvent<HTMLDivElement>) {
  if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
  const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>("button"));
  const i = items.indexOf(document.activeElement as HTMLElement);
  if (i < 0) return;
  e.preventDefault();
  items[(i + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length].focus();
}

export default function Player({ sid, k }: PlayerProps) {
  const sh = useMemo(() => loadShort(sid, k), [sid, k]);
  const ok = !!(sh && sh.scenes);
  useEffect(() => {
    // 없는 편으로 들어왔으면 기록을 남기지 않고 돌아간다
    if (!ok) location.replace(getSeries(sid) && sid !== "ex" ? "#s-" + sid : "#home");
  }, [ok, sid]);
  if (!sh || !ok) return null;
  return <Watch sid={sid} k={k} sh={sh} />;
}

function Watch({ sid, k, sh }: PlayerProps & { sh: LoadedShort }) {
  useFilmStore();
  const prefs = getPrefs();
  const [view, setView] = useState<PlayerView>(EMPTY_VIEW);
  const api = useRef<PlayerApi | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const segsRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const coverRef = useRef<HTMLButtonElement>(null);
  const ppRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const skinRef = useRef<HTMLButtonElement>(null);
  const speedRef = useRef<HTMLButtonElement>(null);
  const askRef = useRef<HTMLDivElement>(null);
  const setRef = useRef<HTMLButtonElement>(null);
  // 보기 설정 시트가 열려 있는지 (재생 엔진 밖에서 이 화면이 다룬다)
  const [sets, setSets] = useState(false);
  const script = sh.script;

  useEffect(() => {
    const svg = svgRef.current;
    const wrap = wrapRef.current;
    const box = boxRef.current;
    const segs = segsRef.current;
    const time = timeRef.current;
    if (!svg || !wrap || !box || !segs || !time) return;
    const p = createPlayer({
      sid,
      k,
      script,
      els: { svg, wrap, box, segs, time },
      onView: setView,
      onClose: () => {
        location.hash = closeHref(sid);
      },
    });
    api.current = p;
    return () => {
      p.destroy();
      api.current = null;
    };
  }, [sid, k, script]);

  // 열려 있는 동안 뒤 화면이 스크롤되지 않게
  useEffect(() => {
    const de = document.documentElement;
    const prev = de.style.overflow;
    de.style.overflow = "hidden";
    return () => {
      de.style.overflow = prev;
    };
  }, []);

  // 마지막 입력이 손가락·마우스였는지: 초점 테두리를 키보드로 쓸 때만 보이려고
  const byPointer = useRef(false);
  useEffect(() => {
    const ptr = () => {
      byPointer.current = true;
    };
    const key = () => {
      byPointer.current = false;
    };
    document.addEventListener("pointerdown", ptr, true);
    document.addEventListener("keydown", key, true);
    return () => {
      document.removeEventListener("pointerdown", ptr, true);
      document.removeEventListener("keydown", key, true);
    };
  }, []);

  // 열리면 표지의 재생 단추로. 표지, 질문의 보기, 끝 화면이 사라지며 초점을 잃으면 창 안에 다시 둔다.
  // 영상이 질문에서 멈추면, 키보드로 보던 사람의 초점은 첫 보기로 옮긴다.
  const askN = view.ask ? view.ask.n : -1;
  useLayoutEffect(() => {
    if (askN >= 0 && !byPointer.current) {
      askRef.current?.querySelector<HTMLElement>("button")?.focus({ preventScroll: true });
      return;
    }
    const a = document.activeElement;
    if (a && a !== document.body && rootRef.current?.contains(a)) return;
    const to = coverRef.current ?? (byPointer.current ? rootRef.current : ppRef.current);
    to?.focus({ preventScroll: true });
  }, [view.started, view.ended, askN]);

  // 메뉴가 열리면 지금 고른 항목으로, 닫히면 그 메뉴를 연 단추로 초점을 옮긴다 (키보드로 쓸 때만)
  const lastMenu = useRef<PlayerMenu>(null);
  useLayoutEffect(() => {
    if (view.menu) {
      lastMenu.current = view.menu;
      if (!byPointer.current) popRef.current?.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus({ preventScroll: true });
      return;
    }
    const was = lastMenu.current;
    lastMenu.current = null;
    if (!was || byPointer.current) return;
    const a = document.activeElement;
    if (a && a !== document.body && rootRef.current?.contains(a)) return;
    (was === "skin" ? skinRef : speedRef).current?.focus({ preventScroll: true });
  }, [view.menu]);

  // 보기 설정이 닫히면 그것을 연 단추로 초점을 돌려준다
  const setsWas = useRef(false);
  useLayoutEffect(() => {
    if (sets) {
      setsWas.current = true;
      return;
    }
    if (!setsWas.current) return;
    setsWas.current = false;
    setRef.current?.focus({ preventScroll: true });
  }, [sets]);

  // 진행 막대의 칸은 React가 그리고, 채우는 것은 엔진이 한다
  useLayoutEffect(() => {
    api.current?.refreshFills();
  }, [view.info]);

  const info = view.info;
  // 다음 편을 미리 만들기 시작할 때가 됐는지: 재생 중이고, 띄운 곳이 정한 만큼(HOST.prefetchAt) 봤을 때
  const scenes = info ? info.beats.length : 0;
  const due = view.started && !view.ended && scenes > 0 && view.beat + 1 >= Math.ceil(scenes * HOST.prefetchAt);
  const ser = getSeries(sid);
  const ttl = (ser?.kind === "ex" ? "맛보기" : k + "편") + " · " + titleOf(sid, k);
  const label = (ser?.kind === "ex" ? "맛보기 · " : "") + titleOf(sid, k);
  const total = ser ? totalOf(ser) : 0;
  const asks = script.beats.filter((b) => b.ask).length;
  const meta = secs(sh.dur) + (asks ? " · 보다가 질문에 직접 답해요" : "") + " · 화면 양옆을 누르면 장면을 넘겨요";
  const askBeats = useMemo(() => new Set(info ? info.asks.map((a) => a.beat) : []), [info]);
  const sk = SKINS[prefs.skin] ?? SKINS.paper;
  // 그림은 화면 낭독기에 보이지 않으니, 지금 장면의 문장을 글로도 알린다
  const caption = info && view.started && !view.ended && view.beat >= 0 ? (info.beats[view.beat]?.say ?? "") : "";
  const ask = view.ask;
  // 고르기 칸은 그것을 연 칩 바로 아래에 편다
  const popLeft = (view.menu === "skin" ? skinRef : speedRef).current?.offsetLeft ?? 16;
  const chipsRef = useRef<HTMLDivElement>(null);
  const popX = Math.max(8, popLeft - (chipsRef.current?.scrollLeft ?? 0));

  const openSets = () => {
    if (view.menu) api.current?.toggleMenu(view.menu);
    setSets(true);
  };

  return (
    <div className="watch" ref={rootRef} role="dialog" aria-modal="true" aria-label={ttl} tabIndex={-1}>
      <div className="wcol">
        {/* 위쪽 줄 (확정안 C): 뒤로 · 라벨 · 몇 편째 · 소리 */}
        <div className="wbar" inert={sets}>
          <a className="ib" href={closeHref(sid)} aria-label="닫기">
            <Icon name="back" />
          </a>
          <div className="ttl">
            <span className="label">
              <span>{label}</span>
            </span>
          </div>
          {total ? <span className="count" aria-label={`${total}편 중 ${k}편`}>{`${k} / ${total}`}</span> : null}
          <button type="button" className="ib" aria-label={prefs.sound ? "소리 끄기" : "소리 켜기"} onClick={() => api.current?.toggleSound()}>
            <Icon name={prefs.sound ? "sound" : "mute"} />
          </button>
        </div>
        {/* 그 아래 한 줄짜리 칩: 디자인, 속도, 보기 설정 */}
        <div className="wchips" ref={chipsRef} inert={sets}>
          <button type="button" className="pill" ref={skinRef} aria-haspopup="true" aria-expanded={view.menu === "skin"} aria-label={`디자인 바꾸기, 지금 ${sk.name}`} onClick={() => api.current?.toggleMenu("skin")}>
            <span className="sw" style={{ background: sk.bg }}>
              <i style={{ background: sk.primary }} />
            </span>
            {sk.name}
          </button>
          <button type="button" className="pill" ref={speedRef} aria-haspopup="true" aria-expanded={view.menu === "speed"} aria-label={`속도 바꾸기, 지금 ${prefs.speed}배`} onClick={() => api.current?.toggleMenu("speed")}>
            {prefs.speed + "×"}
          </button>
          <button type="button" className="pill set" ref={setRef} aria-haspopup="dialog" aria-expanded={sets} aria-label="보기 설정" onClick={openSets}>
            <Icon name="gear" />
            설정
          </button>
        </div>
        {view.menu === "skin" && (
          <div className="pop" ref={popRef} role="group" aria-label="디자인 고르기" onKeyDown={popKey} style={{ left: popX }}>
            <p className="ph" aria-hidden="true">
              영상 디자인
            </p>
            {SKIN_LIST.map((s) => (
              <button key={s.id} type="button" aria-pressed={prefs.skin === s.id} onClick={() => api.current?.pick({ skin: s.id })}>
                <span className="sw" style={{ background: SKINS[s.id].bg }}>
                  <i style={{ background: SKINS[s.id].primary }} />
                </span>
                {s.name}
              </button>
            ))}
          </div>
        )}
        {view.menu === "speed" && (
          <div className="pop" ref={popRef} role="group" aria-label="속도 고르기" onKeyDown={popKey} style={{ left: popX }}>
            <p className="ph" aria-hidden="true">
              재생 속도
            </p>
            {SPEEDS.map((v) => (
              <button key={v} type="button" aria-pressed={prefs.speed === v} onClick={() => api.current?.pick({ speed: v })}>
                {v + "×" + (v === 1.1 ? "  기본" : "")}
              </button>
            ))}
          </div>
        )}
        <p className="sr" aria-live="polite">
          {caption}
        </p>
        <div className="stagewrap" ref={wrapRef} inert={view.ended || sets}>
          <div className="stagebox" ref={boxRef} onClick={(e) => api.current?.onStage(e.clientX, e.clientY)}>
            <svg className="st" aria-hidden="true" ref={svgRef} />
            {!view.started && (
              <button
                type="button"
                className="cover"
                aria-label="재생"
                ref={coverRef}
                onClick={(e) => {
                  e.stopPropagation();
                  api.current?.play();
                }}
              >
                <span className="pl">
                  <Icon name="play" />
                </span>
                <b>{script.title || titleOf(sid, k)}</b>
                <span>{meta}</span>
              </button>
            )}
            <div key={view.flash ? view.flash.n : 0} className={view.flash ? "flash on" : "flash"}>
              {view.flash && <Icon name={view.flash.name} />}
            </div>
            {ask && (
              <div className="askbtns" ref={askRef} role="group" aria-label="답을 골라 주세요">
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
                        api.current?.answer(ask.n, i);
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
        {/* 영상 아래: 얇은 오션 블루 진행 막대와 재생 단추 */}
        <div className="wctl" inert={view.ended || sets}>
          <div
            className="segs"
            ref={segsRef}
            role="slider"
            aria-label="재생 위치"
            tabIndex={0}
            aria-valuemin={0}
            aria-valuemax={info ? Math.round(info.dur) : 0}
            onPointerDown={(e) => api.current?.scrubStart(e.nativeEvent)}
          >
            {info?.beats.map((_, i) => (
              <div key={i} className={askBeats.has(i) ? "seg ask" : "seg"} style={{ flex: `${Math.max(0.4, spanOf(info, i)[1] - spanOf(info, i)[0]).toFixed(2)} 1 0` }}>
                <i />
              </div>
            ))}
          </div>
          <div className="wrow">
            <button type="button" className="ib" ref={ppRef} aria-label="재생 또는 멈춤" onClick={() => api.current?.playPause()}>
              <Icon name={view.playing ? "pause" : "play"} />
            </button>
            <span className="time" ref={timeRef} />
            <span className="hintline" aria-hidden="true">
              양옆을 누르면 장면 넘기기
            </span>
          </div>
        </div>
        <Ahead sid={sid} k={k} due={due} />
        {sets && <Settings api={api} onClose={() => setSets(false)} />}
        {view.ended && <EndSheet sid={sid} k={k} script={script} entry={sh.entry} onReplay={() => api.current?.replay()} />}
      </div>
    </div>
  );
}

/**
 * 내 시리즈의 한 편을 보는 동안 다음 편을 미리 만든다: 끝 화면에 닿았을 때 기다리지 않게.
 * 한 편을 보는 동안 한 번만 시작한다. 다른 것을 만드는 중이면 그것이 끝난 뒤에 시작하고, 사람이 다른 만들기를 누르면 자리를 내준다 (gen.ts).
 * 그리는 것은 없다. 만들기 상태가 바뀔 때 재생기 전체가 다시 그려지지 않게 따로 둔 것이다.
 */
export function Ahead({ sid, k, due }: PlayerProps & { due: boolean }) {
  const gen = useGen();
  const tried = useRef(false);
  const can = gen.avail === "ok" && !gen.busy;
  useEffect(() => {
    if (tried.current || !due || !can) return;
    const s = getSeries(sid);
    if (!s || s.kind !== "mine" || k >= totalOf(s)) return;
    tried.current = true;
    void makeShort(sid, k + 1, { ahead: true });
  }, [due, can, sid, k]);
  return null;
}

/** 보기 설정 바텀 시트: 속도, 영상 디자인, 소리를 칩으로 고른다 (확정안의 설정 시트) */
export function Settings({ api, onClose, sid, k }: { api: RefObject<PlayerApi | null>; onClose: () => void; sid?: string; k?: number }) {
  useFilmStore();
  useStudy();
  const prefs = getPrefs();
  const sheetRef = useRef<HTMLDivElement>(null);
  // 열리면 지금 고른 속도로 초점을 옮긴다
  useLayoutEffect(() => {
    const el = sheetRef.current;
    (el?.querySelector<HTMLElement>('.chipbtn[aria-pressed="true"]') ?? el)?.focus({ preventScroll: true });
  }, []);
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    // 재생기 전체의 글쇠(Escape로 닫기, 화살표로 장면 넘기기, 숫자로 답하기)가 이 시트 안에서는 움직이지 않게 막는다
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (/^Arrow/.test(e.key)) {
      e.preventDefault();
      const group = (document.activeElement as HTMLElement | null)?.closest(".chips");
      if (!group) return;
      const items = Array.from(group.querySelectorAll<HTMLElement>(".chipbtn"));
      const i = items.indexOf(document.activeElement as HTMLElement);
      const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
      if (i >= 0) items[(i + d + items.length) % items.length].focus();
      return;
    }
    if (/^[1-4k]$/.test(e.key)) e.preventDefault();
  };
  return (
    <div className="setwrap" onKeyDown={onKey}>
      <div className="scrim" aria-hidden="true" onClick={onClose} />
      <div className="setsheet" ref={sheetRef} role="dialog" aria-modal="true" aria-label="보기 설정" tabIndex={-1}>
        <div className="grip" aria-hidden="true" />
        <h2>보기 설정</h2>
        <div className="sgroup">
          <p className="glabel" id="set-speed">
            재생 속도
          </p>
          <div className="chips" role="group" aria-labelledby="set-speed">
            {SPEEDS.map((v) => (
              <button key={v} type="button" className="chipbtn" aria-pressed={prefs.speed === v} onClick={() => api.current?.pick({ speed: v })}>
                {v + "×" + (v === 1.1 ? " 기본" : "")}
              </button>
            ))}
          </div>
        </div>
        <div className="sgroup">
          <p className="glabel" id="set-skin">
            영상 디자인
          </p>
          <div className="chips" role="group" aria-labelledby="set-skin">
            {SKIN_LIST.map((s) => (
              <button key={s.id} type="button" className="chipbtn" aria-pressed={(sid ? skinFor(sid, k) : prefs.skin) === s.id} onClick={() => api.current?.pick({ skin: s.id })}>
                <span className="sw" style={{ background: SKINS[s.id].bg }}>
                  <i style={{ background: SKINS[s.id].primary }} />
                </span>
                {s.name}
              </button>
            ))}
          </div>
        </div>
        <div className="sgroup">
          <p className="glabel" id="set-sound">
            소리
          </p>
          <div className="chips" role="group" aria-labelledby="set-sound">
            {[true, false].map((on) => (
              <button key={String(on)} type="button" className="chipbtn" aria-pressed={prefs.sound === on} onClick={() => prefs.sound !== on && api.current?.toggleSound()}>
                {on ? "소리 켬" : "소리 끔"}
              </button>
            ))}
          </div>
        </div>
        <div className="sgroup">
          <p className="glabel" id="set-review">
            {`간격 복습 (${stepsLabel()})`}
          </p>
          <div className="chips" role="group" aria-labelledby="set-review">
            {[true, false].map((on) => (
              <button key={String(on)} type="button" className="chipbtn" aria-pressed={spacedOn() === on} onClick={() => setSpaced(on)}>
                {on ? "켬" : "끔"}
              </button>
            ))}
          </div>
        </div>
        <div className="sgroup">
          <p className="glabel" id="set-count">
            복습 횟수
          </p>
          <div className="chips" role="group" aria-labelledby="set-count" style={spacedOn() ? undefined : { opacity: 0.4 }}>
            {REVIEW_COUNTS.map((c) => (
              <button
                key={c}
                type="button"
                className="chipbtn"
                aria-pressed={reviewCount() === c}
                disabled={!spacedOn()}
                title={`${stepsLabel(c)} 뒤에 다시`}
                onClick={() => setReviewCount(c)}
              >
                {`${c}회 (${stepsLabel(c)})`}
              </button>
            ))}
          </div>
        </div>
        <div className="sgroup">
          <p className="glabel" id="set-clock">
            {"시연용 가상 날짜" + (clockDays() ? ` · +${clockDays()}일` : " · 오늘")}
          </p>
          <div className="chips" role="group" aria-labelledby="set-clock">
            <button type="button" className="chipbtn" aria-pressed={false} onClick={() => setClockDays(clockDays() + 1)}>
              하루 뒤로 ›
            </button>
            <button type="button" className="chipbtn" aria-pressed={false} disabled={!clockDays()} onClick={() => setClockDays(0)}>
              되돌리기
            </button>
          </div>
        </div>
        <button type="button" className="btn ghost" onClick={onClose}>
          완료
        </button>
      </div>
    </div>
  );
}
