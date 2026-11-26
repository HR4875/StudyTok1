"use client";
// 시리즈 한 개: 편 목록. 있는 편은 바로 보고, 없는 편은 그 자리에서 만든다.
import { useState } from "react";
import { makeShort, stopGen, useGen, type GenState } from "@/lib/film/gen";
import { loadShort, madeKs, removeSeries, seenOf, titleOf, totalOf, useFilmStore, getSeries, type Series } from "@/lib/film/store";
import { secs } from "./format";
import { Icon } from "./icons";
import { SubTop, busyLine, useNow } from "./parts";

function ShortRow({ s, k, first, gen, now }: { s: Series; k: number; first: boolean; gen: GenState; now: number }) {
  const sid = s.id;
  const sh = loadShort(sid, k);
  const sn = seenOf(sid, k);
  const title = titleOf(sid, k);
  if (sh && sh.scenes) {
    const quiz = (sh.script.quiz || []).length;
    const got = sn?.quiz ? sn.quiz.filter(Boolean).length : 0;
    const asks = sh.script.beats.filter((b) => b.ask).length;
    let meta = secs(sh.dur) + (sn?.done ? (sn.quiz && sn.quiz.length ? ` · 문제 ${got}/${quiz} 맞힘` : " · 다 봤어요") : ` · 질문 ${asks} · 문제 ${quiz}`);
    if (sh.entry.from === "mine") meta += " · 내가 만든 편";
    return (
      <a className={"row" + (sn?.done ? " done" : "")} href={`#w-${sid}-${k}`}>
        <span className="num">{sn?.done ? <Icon name="check" /> : String(k)}</span>
        <span>
          <span className="t">{title}</span>
          <span className="m">{meta}</span>
        </span>
        <span className="go">
          <Icon name="play" />
        </span>
      </a>
    );
  }
  const busy = gen.busy && gen.busy.kind === "short" && gen.busy.sid === sid && gen.busy.k === k ? gen.busy : null;
  const err = gen.error && gen.error.kind === "short" && gen.error.sid === sid && gen.error.k === k ? gen.error : null;
  let m;
  if (busy)
    m = (
      <span className="busy">
        <span className="spin" />
        <span>{busyLine(busy.message, busy.t0, now)}</span>
      </span>
    );
  else m = err ? err.message : "아직 만들지 않은 편";
  let action;
  if (busy)
    action = (
      <button className="btn ghost small" type="button" onClick={stopGen}>
        그만
      </button>
    );
  else if (gen.avail === "ok")
    action = (
      <button className={"btn small " + (first ? "primary" : "ghost")} type="button" disabled={!!gen.busy} onClick={() => void makeShort(sid, k)}>
        만들기
      </button>
    );
  else action = <span className="chip">미공개</span>;
  return (
    <div className="row locked">
      <span className="num">{String(k)}</span>
      <span>
        <span className="t">{title}</span>
        <span className="m">{m}</span>
      </span>
      {action}
    </div>
  );
}

/** 내가 만든 시리즈 지우기: 한 번 더 묻고 지운다 */
function DeleteSeries({ id }: { id: string }) {
  const [asking, setAsking] = useState(false);
  const remove = () => {
    // 홈으로 옮긴 다음에 지워야 지워진 시리즈 화면이 잠깐도 비어 보이지 않는다
    window.addEventListener("hashchange", () => removeSeries(id), { once: true });
    window.location.hash = "#home";
  };
  return (
    <div className="del">
      {asking ? (
        <>
          <span className="fine">이 시리즈와 만든 편을 지울까요?</span>
          <button className="btn ghost small" type="button" onClick={remove}>
            지우기
          </button>
          <button className="btn ghost small" type="button" onClick={() => setAsking(false)}>
            취소
          </button>
        </>
      ) : (
        <button className="linkbtn" type="button" onClick={() => setAsking(true)}>
          이 시리즈 지우기
        </button>
      )}
    </div>
  );
}

function noteOf(gen: GenState): string {
  if (gen.avail === "ok")
    return "만들기를 누르면 그 편의 계획대로 Sonnet 5.5가 대본을 쓰고, 자동 점검을 거쳐 바로 볼 수 있어요. 보통 15초 안팎 걸려요." + (gen.mock ? " 지금은 예시 모드라 AI를 부르지 않고 준비된 대본으로 답해요." : "");
  if (gen.avail === "wait") return "새 편을 만들 수 있는지 확인하는 중이에요.";
  return "지금은 서버에 AI 키가 없어서 새 편을 만들 수 없어요. 이미 있는 편은 그대로 볼 수 있어요.";
}

export default function SeriesView({ id }: { id: string }) {
  useFilmStore();
  const gen = useGen();
  const now = useNow(!!gen.busy && gen.busy.kind === "short" && gen.busy.sid === id);
  const s = getSeries(id);
  if (!s || !s.plan || s.kind === "ex") return null;
  const n = totalOf(s);
  const have = madeKs(s);
  const ks = Array.from({ length: n }, (_, i) => i + 1);
  const next = ks.find((k) => !have.includes(k));
  return (
    <>
      <SubTop />
      <div className="shead">
        <div className="kick">{s.kicker}</div>
        <h1>{s.title || "이름 없는 시리즈"}</h1>
      </div>
      {s.plan.after ? (
        <div className="after">
          <b>다 보고 나면</b>
          {s.plan.after}
        </div>
      ) : null}
      {s.plan.example ? <p className="fine ex">{"시리즈 내내 쓰는 예시: " + s.plan.example}</p> : null}
      <div className="list">
        {ks.map((k) => (
          <ShortRow key={k} s={s} k={k} first={k === next} gen={gen} now={now} />
        ))}
      </div>
      {have.length < n ? <p className="note">{noteOf(gen)}</p> : null}
      {s.kind === "mine" ? (
        <>
          {s.cut ? <p className="fine ex">계획이 길어서 끝까지 받지 못한 편은 뺐어요.</p> : null}
          <DeleteSeries key={id} id={id} />
        </>
      ) : null}
    </>
  );
}
