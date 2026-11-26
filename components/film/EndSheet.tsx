"use client";
// 한 편이 끝난 뒤 그림 위에 올라오는 끝 화면: 한 줄 정리, 용어, 확인 문제 두 개, 그리고 다음으로 가는 길.
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Script } from "@/lib/film";
import { makeShort, initGen, useGen } from "@/lib/film/gen";
import { entryOf, getSeries, markSeen, totalOf, useFilmStore, type Series, type ShortEntry } from "@/lib/film/store";
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
  const qzRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  // 끝 화면이 올라오면 초점을 여기로 옮긴다: 아래에 가려진 재생 단추에 남아 있으면 키보드와 화면 낭독기가 길을 잃는다
  useEffect(() => {
    sheetRef.current?.focus({ preventScroll: true });
  }, []);
  const shown = Math.min(quiz.length, picks.length + 1);
  const shownBefore = useRef(shown);

  useEffect(() => {
    if (shown <= shownBefore.current) return;
    shownBefore.current = shown;
    // 새로 열린 문제가 화면 밖이면 보이게 한다
    try {
      qzRef.current?.lastElementChild?.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "nearest" });
    } catch {
      /* 스크롤은 없어도 된다 */
    }
  }, [shown]);

  const answer = (i: number, j: number) => {
    const cur = picksRef.current;
    if (cur.length !== i) return;
    const next = [...cur, j];
    picksRef.current = next;
    setPicks(next);
    const score = next.map((p, m) => p === quiz[m].answer);
    blip(score[i]);
    markSeen(sid, k, { quiz: score });
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
        {`다음 ${k + 1}편 보기`}
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
        {`다음 ${k + 1}편 만들기`}
      </button>
    );
  else
    next = (
      <a className="btn primary" href={"#s-" + sid}>
        시리즈 목록으로
      </a>
    );

  const cost = costLine(entry, s);
  return (
    <div className="sheet" ref={sheetRef} tabIndex={-1} role="region" aria-label="한 줄 정리와 확인 문제">
      <div>
        <div className="lbl">한 줄 정리</div>
        <div className="take">{script.takeaway || script.plan?.goal || ""}</div>
      </div>
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
        <div className="qz" ref={qzRef}>
          {quiz.slice(0, shown).map((q, i) => {
            const pick = picks[i];
            const done = pick != null;
            const right = done && pick === q.answer;
            return (
              <div className="qb" key={i}>
                <div className="lbl">{`확인 문제 ${i + 1}/${quiz.length}`}</div>
                <div className="q">{q.q}</div>
                <div className="opts">
                  {q.choices.map((c, m) => (
                    <button
                      key={m}
                      type="button"
                      className={"opt" + (done ? (m === q.answer ? " right" : m === pick ? " wrong" : " dim") : "")}
                      // 답한 뒤에도 초점이 사라지지 않게 disabled 대신 aria-disabled를 쓴다 (answer가 두 번째 누름을 무시한다)
                      aria-disabled={done}
                      onClick={() => answer(i, m)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <div className="why" role="status">
                  {done ? (right ? "정답! " : "아쉬워요. ") + (q.why || "") : ""}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div className="rowb">
        <button type="button" className="btn ghost" onClick={onReplay}>
          다시 보기
        </button>
        {next}
      </div>
      {cost && <div className="cost">{cost}</div>}
    </div>
  );
}
