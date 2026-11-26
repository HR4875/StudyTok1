"use client";
// 모션 쇼츠 화면의 뼈대: 주소의 # 뒤를 읽어 화면을 고르고, 재생기는 그 화면 위에 덮어 띄운다.
//   #home(또는 없음) 홈 · #s-<id> 시리즈 · #make 만들기 · #price 요금제 · #w-<id>-<k> 재생기
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { initGen } from "@/lib/film/gen";
import { entryOf, getSeries, unsavedMade, useFilmStore } from "@/lib/film/store";
import { installPressFx } from "./fx";
import HomeView from "./HomeView";
import MakeView from "./MakeView";
import Player from "./Player";
import PriceView from "./PriceView";
import SeriesView from "./SeriesView";

type Screen = { name: "home" } | { name: "series"; id: string } | { name: "make" } | { name: "price" };
interface Watch {
  sid: string;
  k: number;
}
interface Route {
  hash: string;
  /** 보이는 화면. 재생기가 열려 있으면 그 아래에 있는 화면 */
  under: Screen;
  watch: Watch | null;
}

const HOME: Screen = { name: "home" };
const isSeriesPage = (id: string) => {
  const s = getSeries(id);
  return !!s && s.kind !== "ex";
};

function watchOf(hash: string): Watch | null {
  const m = /^#w-([a-z0-9]+)-(\d+)$/.exec(hash);
  return m ? { sid: m[1], k: Number(m[2]) } : null;
}
function screenOf(hash: string): Screen {
  const m = /^#s-([a-z0-9]+)$/.exec(hash);
  if (m) return { name: "series", id: m[1] };
  if (hash === "#make") return { name: "make" };
  if (hash === "#price") return { name: "price" };
  return HOME;
}
/** 재생기 주소로 바로 들어왔을 때 그 아래에 둘 화면: 그 편의 시리즈 (맛보기면 홈) */
const underOf = (sid: string): Screen => (isSeriesPage(sid) ? { name: "series", id: sid } : HOME);

function routeOf(hash: string, prev: Route | null): Route {
  const watch = watchOf(hash);
  if (watch) return { hash, watch, under: prev ? prev.under : underOf(watch.sid) };
  return { hash, watch: null, under: screenOf(hash) };
}

/** 주소가 가리키는 것이 없을 때 대신 갈 주소 (없으면 null) */
function fixOf(r: Route): string | null {
  if (r.watch) {
    if (entryOf(r.watch.sid, r.watch.k)) return null;
    return isSeriesPage(r.watch.sid) ? "#s-" + r.watch.sid : "#home";
  }
  if (r.under.name === "series" && !isSeriesPage(r.under.id)) return "#home";
  return null;
}

const keyOf = (s: Screen) => (s.name === "series" ? "s-" + s.id : s.name);

export default function FilmApp() {
  const version = useFilmStore();
  const [route, setRoute] = useState<Route>(() => routeOf(window.location.hash, null));

  useEffect(() => {
    initGen();
    installPressFx();
    const on = () => setRoute((prev) => routeOf(window.location.hash, prev));
    window.addEventListener("hashchange", on);
    // 이 화면이 뜨기 전에 주소가 바뀌었을 수도 있다
    on();
    return () => window.removeEventListener("hashchange", on);
  }, []);

  // 없는 시리즈나 편을 가리키면 뒤로 가기 기록을 남기지 않고 주소를 고친다
  useEffect(() => {
    const to = fixOf(route);
    if (to) window.location.replace(to);
  }, [route, version]);

  // 아래 화면이 바뀔 때만 맨 위로 올린다. 재생기를 열고 닫을 때는 보던 자리를 그대로 둔다.
  const underKey = keyOf(route.under);
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [underKey]);

  const fix = fixOf(route);
  const under = route.under.name === "series" && !isSeriesPage(route.under.id) ? HOME : route.under;
  const watch = !fix && route.watch ? route.watch : null;

  // 재생기를 닫으면 그 편을 열었던 줄로 초점을 돌려준다: 키보드와 화면 낭독기가 보던 자리를 잃지 않게
  const watchHash = watch ? route.hash : "";
  const lastWatch = useRef("");
  useEffect(() => {
    if (watchHash) {
      lastWatch.current = watchHash;
      return;
    }
    const from = lastWatch.current;
    lastWatch.current = "";
    if (!from) return;
    const a = document.activeElement;
    if (a && a !== document.body && a !== document.documentElement) return;
    document.querySelector<HTMLElement>(`.film .wrap a[href="${from}"]`)?.focus({ preventScroll: true });
  }, [watchHash]);

  return (
    <div className="film">
      {/* 재생기가 열려 있는 동안 아래 화면은 초점과 화면 낭독기에서 뺀다 */}
      <div className="wrap" inert={!!watch}>
        {unsavedMade() ? (
          <p className="note warnbar" role="status">
            방금 만든 것을 이 기기에 저장하지 못했어요. 브라우저의 저장 공간이 꽉 찼거나 저장이 막혀 있어요. 이 창을 닫으면 사라집니다.
          </p>
        ) : null}
        {under.name === "series" ? (
          <SeriesView key={under.id} id={under.id} />
        ) : under.name === "make" ? (
          <MakeView />
        ) : under.name === "price" ? (
          <PriceView />
        ) : (
          <HomeView paused={!!watch} />
        )}
      </div>
      {watch ? <Player key={watch.sid + "-" + watch.k} sid={watch.sid} k={watch.k} /> : null}
    </div>
  );
}
