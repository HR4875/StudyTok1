"use client";
// 내 자료로 만들기: 주제, 파일, 붙여 넣은 글로 시리즈를 계획하고 1편까지 만든다.
import type { DragEvent, FormEvent } from "react";
import { makePlan, stopGen, useGen } from "@/lib/film/gen";
import { FILM_LIMITS } from "@/lib/film/types";
import { Icon } from "./icons";
import { getDraft, setDraft, sourceOf, takeFile, useDraft } from "./makeDraft";
import { SubTop, busyLine, useNow } from "./parts";

const FILE_HINT = "글자가 들어 있는 PDF를 읽어요. 파일은 이 기기에서 열고, 뽑은 글자만 보내요.";

async function submit() {
  const d = getDraft();
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

function Planning({ message, titles, t0 }: { message: string; titles: string[]; t0: number }) {
  const now = useNow(true);
  return (
    <>
      <div className="planbox">
        <h3>시리즈를 계획하고 있어요</h3>
        <p className="busy mt10">
          <span className="spin" />
          <span>{busyLine(message, t0, now)}</span>
        </p>
        <ol>
          {titles.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ol>
        <p className="fine mt12">처음 30초쯤은 조용히 생각만 해요. 계획이 끝나면 1편을 바로 만듭니다.</p>
      </div>
      <div className="cta">
        <button className="btn ghost" type="button" onClick={stopGen}>
          그만두기
        </button>
      </div>
    </>
  );
}

export default function MakeView() {
  const gen = useGen();
  const d = useDraft();
  const busy = gen.busy && gen.busy.kind === "plan" ? gen.busy : null;
  const ok = gen.avail === "ok";

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

  const msg = d.err || (gen.error && gen.error.kind === "plan" ? gen.error.message : gen.avail === "none" ? "지금은 서버에 AI 키가 없어서 만들 수 없어요. 이미 있는 시리즈는 그대로 볼 수 있어요." : "");

  return (
    <>
      <SubTop />
      <div className="shead">
        <h1>내 자료로 만들기</h1>
      </div>
      {busy ? (
        <Planning message={busy.message} titles={busy.titles} t0={busy.t0} />
      ) : (
        <>
          <p className="lead">전공책, 강의자료, 자격증 교재를 올리거나 주제만 적어도 돼요.</p>
          <form className="form" noValidate onSubmit={onSubmit}>
            <div className="field">
              <label htmlFor="topic">주제 (자료를 올리면 비워 둬도 돼요)</label>
              <input type="text" id="topic" placeholder="예: 옵션 가격의 이항모형, 신용장 거래" value={d.topic} autoComplete="off" onChange={(e) => setDraft({ topic: e.target.value })} />
            </div>
            <label className="drop" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
              <span className="ic">
                <Icon name="up" />
              </span>
              <span>
                <b>{d.file || "PDF나 텍스트 파일 고르기"}</b>
                <span>{d.note || FILE_HINT}</span>
              </span>
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
              <div className="field">
                <label htmlFor="range">{`읽을 쪽 (모두 ${d.pages.length}쪽, 비워 두면 앞에서부터)`}</label>
                <input type="text" id="range" placeholder="예: 12-45" value={d.range} inputMode="numeric" autoComplete="off" onChange={(e) => setDraft({ range: e.target.value })} />
              </div>
            ) : null}
            <div className="field">
              <label htmlFor="paste">또는 내용 붙여 넣기</label>
              <textarea id="paste" placeholder="교재나 필기 내용을 그대로 붙여 넣어도 돼요" value={d.paste} onChange={(e) => setDraft({ paste: e.target.value })} />
            </div>
            {msg ? <p className="note mt0">{msg}</p> : null}
            <button className="btn primary" type="submit" disabled={!ok || d.reading}>
              {d.reading ? "파일 읽는 중" : "계획 세우고 1편 만들기"}
            </button>
          </form>
          <ol className="steps">
            <li>자료를 읽고 가장 쉬운 설명 순서로 시리즈를 계획해요. 1분쯤 걸려요.</li>
            <li>1편을 바로 만들어요. 15초 안팎 걸려요.</li>
            <li>나머지 편은 누를 때마다 한 편씩 만들어요.</li>
          </ol>
          <p className="fine mt16">{`자료는 글자만 뽑아 서버로 보내고, 서버에 저장하지 않아요. 한 번에 앞부분 ${FILM_LIMITS.planDefault}편까지 계획해요.`}</p>
        </>
      )}
    </>
  );
}
