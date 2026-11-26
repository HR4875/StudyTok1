"use client";
// 내 자료로 만들기: 주제, 파일, 붙여 넣은 글로 시리즈를 계획하고 1편까지 만든다. 모양은 확정안의 쪽 고르기 화면.
import { useEffect, type DragEvent, type FormEvent } from "react";
import { initGen, makePlan, stopGen, useGen } from "@/lib/film/gen";
import { HOST } from "@/lib/film/host";
import { pagesIn, pickPages } from "@/lib/film/plan";
import { FILM_LIMITS } from "@/lib/film/types";
import { Icon } from "./icons";
import { getDraft, setDraft, sourceOf, takeFile, useDraft, type MakeDraft } from "./makeDraft";
import { CardStack, Check, busyLine, useNow } from "./parts";

const FILE_HINT = "글자가 들어 있는 PDF를 읽어요. 파일은 이 기기에서 열고, 뽑은 글자만 보내요.";

/** 읽을 쪽을 잘못 적었으면 그 까닭 (괜찮으면 ""). 말없이 다른 쪽을 읽거나 엉뚱한 안내가 나오지 않게 한다. */
function rangeProblem(d: MakeDraft): string {
  const r = d.range.trim();
  if (!r || !d.pages) return "";
  const last = d.pages.length ? d.pages[d.pages.length - 1].n : 0;
  const want = pagesIn(r);
  if (!want.size) return '읽을 쪽은 "12-45"처럼 숫자로 적어 주세요.';
  if (!d.pages.some((p) => want.has(p.n) && p.text)) return `그 쪽에는 읽을 글자가 없어요. 1쪽부터 ${last}쪽 사이에서 적어 주세요.`;
  return "";
}

async function submit() {
  const d = getDraft();
  const bad = rangeProblem(d);
  if (bad) {
    setDraft({ err: bad });
    return;
  }
  const topic = d.topic.trim();
  const source = sourceOf(d);
  if (!topic && !source) {
    setDraft({ err: "주제를 적거나 자료를 올려 주세요." });
    return;
  }
  setDraft({ err: "" });
  const id = await makePlan(topic, source, d.pages ? d.file : "");
  // 기다리는 동안 다른 화면으로 갔으면 그 화면을 그대로 둔다
  if (id && window.location.hash === "#make") window.location.hash = "#s-" + id;
}

/** 계획하는 동안: 확정안의 로딩 화면 (오션 블루 바탕, 기울어진 스티커 카드 더미, 진행을 세는 큰 제목, 단계 목록, 정해진 편 이름) */
function Planning({ message, titles, t0, file }: { message: string; titles: string[]; t0: number; file: string }) {
  const now = useNow(true);
  const plan = FILM_LIMITS.planDefault;
  const secsGone = Math.max(0, (now - t0) / 1000);
  // 계획에는 정해진 진행률이 없다: 편 이름이 하나씩 정해질 때마다 나아가고, 그 전에는 시간에 따라 조금씩 (끝까지 차지는 않는다)
  const progress = Math.min(0.9, titles.length ? 0.25 + (0.6 * titles.length) / plan : Math.min(0.22, secsGone / 150));
  return (
    <div className="load">
      <div className="xtop">
        <button type="button" className="xbtn" aria-label="그만두기" onClick={stopGen}>
          <Icon name="close" />
        </button>
        <span className="fname">{file || "새 시리즈"}</span>
      </div>
      <div className="mid">
        <CardStack label={titles.length ? titles[titles.length - 1] : "개념 찾는 중"} />
        <h2 role="status">{titles.length ? `시리즈 계획 중 ${titles.length}편째` : "자료를 읽고 있어요"}</h2>
        <div className="pbar" aria-hidden="true">
          <i style={{ width: Math.round(progress * 100) + "%" }} />
        </div>
        <p className="tip">{busyLine(message, t0, now)}</p>
      </div>
      <div className="checks">
        <Check state="done" label="자료 읽기" />
        <Check state="doing" label="개념 찾고 그림 고르기" detail={titles.length ? `${titles.length}개` : `${Math.round(secsGone)}초`} />
        <Check state="todo" label="쇼츠 만들기" detail={`0 / ${titles.length || plan}`} />
        {titles.length ? (
          <div className="tchips">
            {titles.map((t, i) => (
              <span key={i}>{t}</span>
            ))}
          </div>
        ) : null}
      </div>
      <div className="foot2">
        <button className="btn onblue" type="button" disabled>
          1편이 준비되면 바로 볼 수 있어요
        </button>
        <p className="fine">{HOST.planQuiet}</p>
      </div>
    </div>
  );
}

/** 고른 쪽과 그 양: 한 번에 보낼 수 있는 글자 수에 견준 비율 */
function amountOf(d: MakeDraft) {
  const cap = FILM_LIMITS.sourceChars;
  const paste = d.paste.trim();
  const pasteChars = paste ? Math.min(paste.length, d.pages ? Math.floor(cap / 3) : cap) : 0;
  if (!d.pages) return paste ? { pct: Math.round((paste.length / cap) * 100), pages: 0, used: 0, all: 0, lo: 0, hi: 0, cut: false, chars: paste.replace(/\s/g, "").length } : null;
  const want = pagesIn(d.range);
  const sel = (want.size ? d.pages.filter((p) => want.has(p.n)) : d.pages).filter((p) => p.text);
  const chars = sel.reduce((a, p) => a + p.text.length + 8, 0) + pasteChars;
  // 보여 주는 글자 수는 읽은 결과("글자 3,129자를 읽었어요")와 같은 셈으로 (빈칸 빼고)
  const shown = sel.reduce((a, p) => a + p.text.replace(/\s/g, "").length, 0);
  const picked = pickPages(d.pages, d.range, cap - pasteChars);
  const ns = want.size ? [...want].filter((n) => n >= 1) : picked.used.map((p) => p.n);
  const lo = ns.length ? Math.min(...ns) : 0;
  const hi = ns.length ? Math.max(...ns) : 0;
  return { pct: Math.round((chars / cap) * 100), pages: sel.length, used: picked.used.length, all: picked.all, lo, hi, cut: picked.used.length < picked.all, chars: shown };
}

/** 쪽 빨리 고르기 칩: 한 번에 되는 만큼(앞에서부터), 전체, 그다음 묶음 */
function rangeChips(d: MakeDraft): { label: string; range: string }[] {
  if (!d.pages || d.pages.length < 2) return [];
  const cap = FILM_LIMITS.sourceChars;
  const last = d.pages[d.pages.length - 1].n;
  const out: { label: string; range: string }[] = [];
  const front = pickPages(d.pages, "", cap).used;
  const fEnd = front.length ? front[front.length - 1].n : last;
  if (fEnd < last) out.push({ label: `추천 1–${fEnd}쪽`, range: `1-${fEnd}` });
  out.push({ label: `전체 1–${last}쪽`, range: `1-${last}` });
  // 한 번에 다 들어가는 짧은 자료는 앞뒤 절반도 고를 수 있게
  if (fEnd >= last && last >= 4) {
    const h = Math.floor(last / 2);
    out.push({ label: `앞 1–${h}쪽`, range: `1-${h}` }, { label: `뒤 ${h + 1}–${last}쪽`, range: `${h + 1}-${last}` });
    return out;
  }
  const want = pagesIn(d.range);
  const hi = want.size ? Math.max(...want) : fEnd;
  if (hi < last) {
    const next = pickPages(d.pages, `${hi + 1}-${last}`, cap).used;
    if (next.length) out.push({ label: `다음 ${hi + 1}–${next[next.length - 1].n}쪽`, range: `${hi + 1}-${next[next.length - 1].n}` });
  }
  return out;
}
const sameRange = (a: string, b: string) => {
  const x = pagesIn(a);
  const y = pagesIn(b);
  return x.size === y.size && [...x].every((n) => y.has(n));
};

function submitLabel(d: MakeDraft): string {
  if (d.reading) return "파일 읽는 중";
  if (d.pages && d.pages.length > 1) {
    const a = amountOf(d);
    if (a && a.lo && a.hi) return (a.lo === a.hi ? `${a.lo}쪽으로` : `${a.lo}–${a.hi}쪽으로`) + " 만들기 →";
  }
  if (d.pages) return "올린 자료로 만들기 →";
  if (d.paste.trim()) return "붙여 넣은 글로 만들기 →";
  if (d.topic.trim()) return "이 주제로 만들기 →";
  return "계획 세우고 1편 만들기 →";
}

export default function MakeView() {
  const gen = useGen();
  const d = useDraft();
  const busy = gen.busy && gen.busy.kind === "plan" ? gen.busy : null;
  const ok = gen.avail === "ok";
  // 한 번에 하나만 만든다: 다른 편을 만드는 동안에는 새 계획을 세울 수 없다
  const making = !!gen.busy && gen.busy.kind === "short";
  // 서버 확인이 앞에서 실패했으면 이 화면에 들어올 때 다시 묻는다
  useEffect(() => {
    initGen();
  }, []);

  const pick = (f: File | undefined | null) => {
    if (f) void takeFile(f);
  };
  const onDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    pick(e.dataTransfer?.files?.[0]);
  };
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!ok || gen.busy || d.reading) return;
    void submit();
  };

  const msg =
    d.err ||
    (gen.error && gen.error.kind === "plan"
      ? gen.error.message
      : gen.avail === "none"
        ? HOST.makeNone
        : gen.avail === "down"
          ? HOST.makeDown
          : making
            ? "지금 다른 편을 만드는 중이에요. 한 번에 하나씩 만들어서, 끝나면 새 계획을 세울 수 있어요."
            : "");

  if (busy) return <Planning message={busy.message} titles={busy.titles} t0={busy.t0} file={d.file || d.topic.trim()} />;

  const amount = amountOf(d);
  const chips = rangeChips(d);
  const last = d.pages && d.pages.length ? d.pages[d.pages.length - 1].n : 0;
  return (
    <>
      <div className="xtop">
        <a className="xbtn" href="#home" aria-label="닫기">
          <Icon name="close" />
        </a>
        <span className="fname">{d.file || "새 시리즈"}</span>
      </div>
      <div className="shead">
        <span className="label">Track #1 : 업로드</span>
        <h1>무엇으로 만들까요?</h1>
      </div>
      <p className="lead">전공책, 강의자료, 자격증 교재를 올리거나 주제만 적어도 돼요.</p>
      <form className="form" noValidate onSubmit={onSubmit}>
        <label className={"drop" + (d.pages ? " has" : "")} onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
          <span className="tab">PDF 올리기</span>
          <span className="ic">
            <Icon name={d.pages ? "check" : "up"} />
          </span>
          <b>{d.file || "PDF나 텍스트 파일 고르기"}</b>
          <span className="hint">{d.note || FILE_HINT}</span>
          <input
            type="file"
            accept=".pdf,.txt,.md,application/pdf,text/plain"
            onChange={(e) => {
              pick(e.target.files?.[0]);
              // 같은 파일을 다시 골라도 다시 읽도록 비운다
              e.target.value = "";
            }}
          />
        </label>
        {d.pages && d.pages.length > 1 ? (
          <div className="pick">
            <h2>어디까지 만들까요?</h2>
            <p className="sub">{`전체 ${last}쪽` + (amount ? ` · 고른 ${amount.pages}쪽 약 ${amount.chars.toLocaleString("ko-KR")}자` : "")}</p>
            {chips.length ? (
              <div className="chips" role="group" aria-label="읽을 쪽 빨리 고르기">
                {chips.map((c, i) => {
                  // 비워 두면 앞에서부터 읽으니 첫 칩(추천, 다 들어가면 전체)이 켜진 것과 같다
                  const on = d.range.trim() ? sameRange(d.range, c.range) : i === 0;
                  return (
                    <button key={c.label} type="button" className="chipbtn" aria-pressed={on} onClick={() => setDraft({ range: c.range, err: "" })}>
                      {c.label}
                    </button>
                  );
                })}
              </div>
            ) : null}
            <div className="field mt16">
              <label htmlFor="range">{`직접 적기 (모두 ${d.pages.length}쪽, 비워 두면 앞에서부터)`}</label>
              <input type="text" id="range" placeholder="예: 12-45" value={d.range} inputMode="numeric" autoComplete="off" onChange={(e) => setDraft({ range: e.target.value, err: "" })} />
            </div>
          </div>
        ) : null}
        <div className="field">
          <label htmlFor="topic">주제 (자료를 올리면 비워 둬도 돼요)</label>
          <input type="text" id="topic" placeholder="예: 옵션 가격의 이항모형, 신용장 거래" value={d.topic} autoComplete="off" onChange={(e) => setDraft({ topic: e.target.value, err: "" })} />
        </div>
        <div className="field">
          <label htmlFor="paste">또는 내용 붙여 넣기</label>
          <textarea id="paste" placeholder="교재나 필기 내용을 그대로 붙여 넣어도 돼요" value={d.paste} onChange={(e) => setDraft({ paste: e.target.value, err: "" })} />
        </div>
        {amount ? (
          <div className={"gauge" + (amount.pct > 100 ? " over" : "")}>
            <div className="gh">
              <span>한 번에 만들 수 있는 양</span>
              <b>{amount.pct}%</b>
            </div>
            <div className="gbar" role="img" aria-label={`한 번에 만들 수 있는 양의 ${amount.pct}%`}>
              <i style={{ width: Math.min(100, amount.pct) + "%" }} />
            </div>
            <p>
              {amount.cut
                ? `한 번에 다 담지 못해서 앞 ${amount.used}쪽만 읽어요. 나머지는 쪽을 바꿔 다음 시리즈로 만들 수 있어요.`
                : amount.pct > 100
                  ? "글이 길어서 앞부분만 읽어요."
                  : `앞에서부터 ${FILM_LIMITS.planDefault}편까지 계획하고, 1편부터 바로 볼 수 있어요.`}
            </p>
          </div>
        ) : null}
        <div className="dock">
          {msg ? <p className="note mt0">{msg}</p> : null}
          <button className={"btn primary" + (msg ? " mt12" : "")} type="submit" disabled={!ok || d.reading || making}>
            {submitLabel(d)}
          </button>
        </div>
      </form>
      <ol className="steps">
        {HOST.steps.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ol>
      <p className="fine mt16">{HOST.privacy(FILM_LIMITS.planDefault)}</p>
    </>
  );
}
