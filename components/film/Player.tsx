"use client";
// 재생기: 한 편을 9:16 무대에 틀고, 영상 속 질문에서 멈춰 답을 받고, 끝나면 끝 화면을 올린다.
// 편마다 새로 마운트된다 (FilmApp이 sid-k를 key로 준다).
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { SKINS, SKIN_LIST } from "@/lib/film";
import { SPEEDS, getPrefs, getSeries, loadShort, titleOf, useFilmStore, type LoadedShort } from "@/lib/film/store";
import EndSheet from "./EndSheet";
import { secs } from "./format";
import { Icon } from "./icons";
import { EMPTY_VIEW, createPlayer, type PlayerApi, type PlayerView } from "./PlayerEngine";

export interface PlayerProps {
  /** 시리즈 id ("ex"는 한 편짜리 맛보기 묶음) */
  sid: string;
  /** 몇 편인지 (1부터) */
  k: number;
}

const closeHref = (sid: string) => (sid !== "ex" ? "#s-" + sid : "#home");

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

  // 열리면 표지의 재생 단추로. 표지나 끝 화면이 사라지며 초점을 잃으면 창 안에 다시 둔다
  useLayoutEffect(() => {
    const a = document.activeElement;
    if (a && a !== document.body && rootRef.current?.contains(a)) return;
    const to = coverRef.current ?? (byPointer.current ? rootRef.current : ppRef.current);
    to?.focus({ preventScroll: true });
  }, [view.started, view.ended]);

  // 진행 막대의 칸은 React가 그리고, 채우는 것은 엔진이 한다
  useLayoutEffect(() => {
    api.current?.refreshFills();
  }, [view.info]);

  const info = view.info;
  const ser = getSeries(sid);
  const ttl = (ser?.kind === "ex" ? "맛보기" : k + "편") + " · " + titleOf(sid, k);
  const asks = script.beats.filter((b) => b.ask).length;
  const meta = secs(sh.dur) + (asks ? " · 보다가 질문에 직접 답해요" : "") + " · 화면 양옆을 누르면 장면을 넘겨요";
  const askBeats = useMemo(() => new Set(info ? info.asks.map((a) => a.beat) : []), [info]);
  const sk = SKINS[prefs.skin] ?? SKINS.paper;

  return (
    <div className="watch" ref={rootRef} role="dialog" aria-modal="true" aria-label={ttl} tabIndex={-1}>
      <div className="wbar">
        <a className="ib" href={closeHref(sid)} aria-label="닫기">
          <Icon name="back" />
        </a>
        <div className="ttl">{ttl}</div>
        <button type="button" className="ib" aria-label={prefs.sound ? "소리 끄기" : "소리 켜기"} onClick={() => api.current?.toggleSound()}>
          <Icon name={prefs.sound ? "sound" : "mute"} />
        </button>
      </div>
      <div className="stagewrap" ref={wrapRef}>
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
        </div>
        {view.menu === "skin" && (
          <div className="pop">
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
          <div className="pop">
            {SPEEDS.map((v) => (
              <button key={v} type="button" aria-pressed={prefs.speed === v} onClick={() => api.current?.pick({ speed: v })}>
                {v + "×" + (v === 1.1 ? "  기본" : "")}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="wctl">
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
          {info?.beats.map((b, i) => (
            <div key={i} className={askBeats.has(i) ? "seg ask" : "seg"} style={{ flex: `${Math.max(0.4, b.dur).toFixed(2)} 1 0` }}>
              <i />
            </div>
          ))}
        </div>
        <div className="wrow">
          <button type="button" className="ib" ref={ppRef} aria-label="재생 또는 멈춤" onClick={() => api.current?.playPause()}>
            <Icon name={view.playing ? "pause" : "play"} />
          </button>
          <span className="time" ref={timeRef} />
          <button type="button" className="pill" aria-label={`디자인 바꾸기, 지금 ${sk.name}`} onClick={() => api.current?.toggleMenu("skin")}>
            <span className="sw" style={{ background: sk.bg }}>
              <i style={{ background: sk.primary }} />
            </span>
            {sk.name}
          </button>
          <button type="button" className="pill" aria-label={`속도 바꾸기, 지금 ${prefs.speed}배`} onClick={() => api.current?.toggleMenu("speed")}>
            {prefs.speed + "×"}
          </button>
        </div>
      </div>
      {view.ended && <EndSheet sid={sid} k={k} script={script} entry={sh.entry} onReplay={() => api.current?.replay()} />}
    </div>
  );
}
