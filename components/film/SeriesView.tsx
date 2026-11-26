"use client";
// 시리즈 한 개: 트랙 라벨, 제목, 편 목록. 있는 편은 바로 보고, 없는 편은 그 자리에서 만든다.
import { useEffect, useState } from "react";
import { initGen, makeShort, stopGen, useGen, type GenState } from "@/lib/film/gen";
import { HOST } from "@/lib/film/host";
import { loadShort, madeKs, removeSeries, seenOf, titleOf, totalOf, useFilmStore, getSeries, type Series } from "@/lib/film/store";
import { secs } from "./format";
import { Icon } from "./icons";
import { Check, SubTop, busyLine, trackLabel, useNow } from "./parts";

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
  else m = err ? err.message : sh ? "이 기기에 남은 대본을 읽지 못했어요. 다시 만들 수 있어요." : "아직 만들지 않은 편";
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
        {sh ? "다시 만들기" : "만들기"}
      </button>
    );
  else action = <span className="chip">미공개</span>;
  return (
    <div className={"row locked" + (busy ? " making" : "")}>
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

function noteOf(gen: GenState, id: string): string {
  // 한 번에 하나만 만든다: 다른 곳에서 만드는 중이면 단추가 꺼져 있는 까닭을 알린다
  if (gen.busy && (gen.busy.kind === "plan" || gen.busy.sid !== id)) return "지금 다른 것을 만드는 중이에요. 한 번에 하나씩 만들어서, 끝나면 여기서도 만들 수 있어요.";
  if (gen.avail === "ok")
    return HOST.seriesReady + (gen.mock ? " 지금은 예시 모드라 AI를 부르지 않고 준비된 대본으로 답해요." : "");
  if (gen.avail === "wait") return "새 편을 만들 수 있는지 확인하는 중이에요.";
  if (gen.avail === "down") return HOST.seriesDown;
  return HOST.seriesNone;
}

/** 이 시리즈의 편을 만드는 동안 목록 위에 뜨는 칸: 확정안 로딩 화면과 같은 말 (단계, 편 이름 칩, 준비된 편부터 보기) */
function Making({ s, k, message, t0, have }: { s: Series; k: number; message: string; t0: number; have: number[] }) {
  const now = useNow(true);
  const n = totalOf(s);
  const gone = Math.max(0, (now - t0) / 1000);
  // 한 편은 보통 15초 안팎: 그 시간에 맞춰 차고, 끝까지 차지는 않는다
  const progress = Math.min(0.92, gone / 20);
  const first = have.find((x) => !seenOf(s.id, x)?.done) ?? have[0];
  return (
    <section className="mk" aria-label={`${k}편 만드는 중`}>
      <h2>{`${k}편 만드는 중 ${have.length}/${n}`}</h2>
      <div className="pbar" aria-hidden="true">
        <i style={{ width: Math.round(progress * 100) + "%" }} />
      </div>
      <p className="tip">{busyLine(message, t0, now)}</p>
      <div className="checks">
        <Check state="done" label="자료 읽기" />
        <Check state="done" label="개념 찾고 그림 고르기" detail={`${n}개`} />
        <Check state="doing" label="쇼츠 만들기" detail={`${have.length} / ${n}`} />
        <div className="tchips">
          {Array.from({ length: n }, (_, i) => i + 1).map((x) => (
            <span key={x} className={have.includes(x) ? "ok" : x === k ? "now" : ""}>
              {(have.includes(x) ? "✓ " : "") + titleOf(s.id, x)}
            </span>
          ))}
        </div>
      </div>
      {first ? (
        <a className="btn onblue" href={`#w-${s.id}-${first}`}>
          {`준비된 ${have.length}편부터 보기 →`}
        </a>
      ) : (
        <button className="btn onblue" type="button" disabled>
          1편이 준비되면 바로 볼 수 있어요
        </button>
      )}
    </section>
  );
}

export default function SeriesView({ id }: { id: string }) {
  useFilmStore();
  const gen = useGen();
  const mine = !!gen.busy && gen.busy.kind === "short" && gen.busy.sid === id ? gen.busy : null;
  const now = useNow(!!mine);
  // 서버 확인이 앞에서 실패했으면 이 화면에 들어올 때 다시 묻는다
  useEffect(() => {
    initGen();
  }, []);
  const s = getSeries(id);
  if (!s || !s.plan || s.kind === "ex") return null;
  const n = totalOf(s);
  const have = madeKs(s);
  const ks = Array.from({ length: n }, (_, i) => i + 1);
  const next = ks.find((k) => !have.includes(k));
  const done = have.filter((k) => seenOf(id, k)?.done).length;
  // 이어 보기: 아직 다 보지 않은 첫 편 (모두 봤으면 첫 편)
  const cont = have.find((k) => !seenOf(id, k)?.done) ?? have[0];
  return (
    <>
      <SubTop />
      <div className="shead">
        <span className="label">{trackLabel(s)}</span>
        <h1>{s.title || "이름 없는 시리즈"}</h1>
        <p className="sub">{s.kicker}</p>
      </div>
      <div className="seen">
        <span>본 편</span>
        <div className="bar" aria-hidden="true">
          <i style={{ width: (n ? Math.round((done / n) * 100) : 0) + "%" }} />
        </div>
        <b>{`${done} / ${n}`}</b>
      </div>
      {s.plan.after ? (
        <div className="after">
          <b>다 보고 나면</b>
          {s.plan.after}
        </div>
      ) : null}
      {s.plan.example ? <p className="fine ex">{"시리즈 내내 쓰는 예시: " + s.plan.example}</p> : null}
      {mine ? <Making s={s} k={mine.k} message={mine.message} t0={mine.t0} have={have} /> : null}
      <div className="list">
        {ks.map((k) => (
          <ShortRow key={k} s={s} k={k} first={k === next} gen={gen} now={now} />
        ))}
      </div>
      {have.length < n ? <p className="note">{noteOf(gen, id)}</p> : null}
      {s.kind === "mine" ? (
        <>
          {s.cut ? <p className="fine ex">계획이 길어서 끝까지 받지 못한 편은 뺐어요.</p> : null}
          <DeleteSeries key={id} id={id} />
        </>
      ) : null}
      {cont ? (
        <div className="dock">
          <a className="btn primary" href={`#w-${id}-${cont}`}>
            {done && done < have.length ? "이어 보기 →" : done ? "처음부터 다시 보기 →" : `${cont}편부터 보기 →`}
          </a>
        </div>
      ) : null}
    </>
  );
}
