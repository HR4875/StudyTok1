"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { addUsage, getHealth } from "@/lib/api";
import { regenerateCard, startJob, type JobHandle, type JobState } from "@/lib/generate";
import { SAMPLE_DECKS } from "@/lib/sampleDecks";
import type { Deck } from "@/lib/schema";
import { unlockAudio } from "@/lib/sfx";
import { installPressFx } from "@/lib/fx";
import { quizOf } from "@/lib/cards";
import { isPdf } from "@/lib/extract";
import {
  clockOffsetDays,
  deleteDeck,
  dueReviews,
  loadDecks,
  loadProgress,
  loadProgressAll,
  loadSettings,
  reviewCount,
  saveDeck,
  saveProgress,
  saveSettings,
  setClockOffsetDays,
  type Settings,
} from "@/lib/storage";
import Feed from "./Feed";
import Home from "./Home";
import Library from "./Library";
import Loading from "./Loading";
import { PhoneFrame } from "./ui";

type Screen = "home" | "library" | "loading" | "feed";

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [settings, setSettingsState] = useState<Settings>(() => loadSettings());
  const [decks, setDecks] = useState<Deck[]>(() => loadDecks());
  const [openDeck, setOpenDeck] = useState<Deck | null>(null);
  const [job, setJob] = useState<JobState | null>(null);
  const [apiReady, setApiReady] = useState<boolean | null>(null);
  const handle = useRef<JobHandle | null>(null);
  const lastFiles = useRef<File[]>([]);
  const screenRef = useRef<Screen>("home");
  screenRef.current = screen;
  /** 피드를 열 때 정한 것: 이어볼 자리, 오늘 복습할 퀴즈 */
  const [feedCtx, setFeedCtx] = useState<{ resumeKey: string | null; reviewIds: string[] }>({ resumeKey: null, reviewIds: [] });
  /** 연습용 덱(틀린 문제만)이 나온 원래 덱. 맞히면 원래 덱 오답노트에서도 뺀다 */
  const parentDeck = useRef<Deck | null>(null);
  /** '다음 범위 이어서 만들기'에서 PDF를 다시 고를 때 */
  const nextInput = useRef<HTMLInputElement>(null);
  const nextFrom = useRef(1);
  /** 홈 이어보기·복습 수를 다시 읽게 하는 값 */
  const [, setTick] = useState(0);
  const goHome = () => {
    refreshDecks();
    setTick((t) => t + 1);
    setScreen("home");
  };

  useEffect(() => {
    installPressFx();
  }, []);

  useEffect(() => {
    getHealth().then((h) => setApiReady(h ? h.hasKey || h.mock : null));
    // warm up fonts used by the motion renderer
    try {
      void document.fonts?.load("800 40px 'Pretendard Variable'", "가나다");
      void document.fonts?.load("800 40px 'Wanted Sans Variable'", "가나다STUDY");
    } catch {}
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  const setSettings = (s: Settings) => {
    setSettingsState(s);
    saveSettings(s);
  };

  const refreshDecks = () => setDecks(loadDecks());

  const begin = useCallback(
    (files: File[], startFrom?: number) => {
      unlockAudio();
      handle.current?.cancel();
      lastFiles.current = files;
      setScreen("loading");
      handle.current = startJob(files, { count: settings.cardCount, mode: settings.mode, startFrom }, (s) => {
        setJob(s);
        const jd = s.deck;
        if (jd) {
          // keep the open feed in sync while cards are still being generated (keep quiz notes)
          setOpenDeck((d) => (d && d.id === jd.id ? { ...jd, wrong: d.wrong } : d));
        }
        if (s.phase === "done" && jd) {
          if (screenRef.current === "loading") {
            setFeedCtx({ resumeKey: null, reviewIds: [] });
            setOpenDeck(jd);
            setScreen("feed");
          } else {
            setOpenDeck((d) => {
              if (d && d.id === jd.id && d.wrong?.length) saveDeck({ ...jd, wrong: d.wrong });
              return d;
            });
          }
          refreshDecks();
        }
      });
    },
    [settings.cardCount, settings.mode],
  );

  const generatingId = job && (job.phase === "scenes" || job.phase === "outline") ? (job.deck?.id ?? null) : null;

  const findDeck = (id: string) => decks.find((d) => d.id === id) ?? SAMPLE_DECKS.find((d) => d.id === id) ?? null;

  const open = (d: Deck) => {
    unlockAudio();
    const p = loadProgress(d.id);
    const reviewIds = settings.spacedReview ? dueReviews(d.id).map((r) => r.cardId) : [];
    setFeedCtx({ resumeKey: p && !p.done ? p.key : null, reviewIds });
    setOpenDeck(d);
    setScreen("feed");
  };

  /** 오늘 복습할 퀴즈 카드 (지운 덱의 것은 뺀다) */
  const dueCards = () => {
    if (!settings.spacedReview) return [];
    return dueReviews()
      .map((r) => findDeck(r.deckId)?.cards.find((c) => c.id === r.cardId && c.status === "ready" && quizOf(c)))
      .filter((c): c is NonNullable<typeof c> => !!c);
  };

  const openDrill = (d: Deck) => {
    unlockAudio();
    setFeedCtx({ resumeKey: null, reviewIds: [] });
    setOpenDeck(d);
    setScreen("feed");
  };

  const openReview = () => {
    const cards = dueCards();
    if (!cards.length) return;
    openDrill({ id: `review-${Date.now()}`, title: "오늘의 복습", subject: "", source: "간격 복습", createdAt: Date.now(), cards, drill: "review", wrong: [] });
  };

  /** 완주 화면 '틀린 문제만 다시 풀기': 틀린 퀴즈만 모은 짧은 피드 */
  const drillWrong = () => {
    const cur = openDeck;
    if (!cur) return;
    const parent = cur.drill === "wrong" ? parentDeck.current : cur;
    if (!parent) return;
    parentDeck.current = parent;
    const cards = parent.cards.filter((c) => parent.wrong?.includes(c.id) && c.status === "ready" && quizOf(c));
    if (!cards.length) return;
    openDrill({
      id: `wrong-${parent.id}-${Date.now()}`,
      title: `${parent.title} · 틀린 문제`,
      subject: parent.subject,
      source: parent.source,
      createdAt: Date.now(),
      cards,
      drill: "wrong",
      parentId: parent.id,
      wrong: cards.map((c) => c.id),
      sample: parent.sample,
    });
  };

  /** 완주 화면 '다음 범위 이어서 만들기': 같은 PDF로 쪽 범위 화면을 다음 쪽부터 연다 */
  const nextRange = () => {
    const d = openDeck;
    if (!d?.range) return;
    const from = d.range.to + 1;
    const pdf = lastFiles.current.find(isPdf);
    if (pdf && pdf.name === d.source) {
      begin([pdf], from);
      return;
    }
    // 새로 고침 뒤에는 파일이 메모리에 없어서 같은 PDF를 다시 골라 달라고 한다
    nextFrom.current = from;
    nextInput.current?.click();
  };

  const onDeckChange = (d: Deck) => {
    if (d.drill) {
      setOpenDeck(d);
      const p = parentDeck.current;
      if (d.drill === "wrong" && p && p.id === d.parentId) {
        const ids = new Set(d.cards.map((c) => c.id));
        const next: Deck = { ...p, wrong: [...(p.wrong ?? []).filter((x) => !ids.has(x)), ...(d.wrong ?? [])] };
        parentDeck.current = next;
        if (!next.sample) {
          saveDeck(next);
          refreshDecks();
        }
      }
      return;
    }
    setOpenDeck(d);
    if (!d.sample) {
      saveDeck(d);
      refreshDecks();
    }
  };

  const onRetryCard = async (cardId: string) => {
    const d = openDeck;
    if (!d || d.sample) return;
    if (job?.deck?.id === d.id && generatingId) {
      await handle.current?.retryCard(cardId);
      return;
    }
    const pending: Deck = { ...d, cards: d.cards.map((c) => (c.id === cardId ? { ...c, status: "pending" as const, error: undefined } : c)) };
    setOpenDeck(pending);
    try {
      const { patch, usage } = await regenerateCard(d, cardId);
      const next: Deck = {
        ...pending,
        usage: addUsage(pending.usage, usage),
        cards: pending.cards.map((c) => (c.id === cardId ? { ...c, ...patch, status: "ready" as const, error: undefined } : c)),
      };
      setOpenDeck((cur) => (cur?.id === next.id ? next : cur));
      saveDeck(next);
    } catch (e) {
      const next = { ...pending, cards: pending.cards.map((c) => (c.id === cardId ? { ...c, status: "error" as const, error: (e as Error).message } : c)) };
      setOpenDeck((cur) => (cur?.id === next.id ? next : cur));
      saveDeck(next);
    }
    refreshDecks();
  };

  // 홈: 마지막으로 보다 만 덱 (완주한 덱은 뺀다)
  const resumeInfo = (() => {
    if (screen !== "home" && screen !== "library") return null;
    const all = loadProgressAll();
    for (const [id, p] of Object.entries(all).sort((a, b) => b[1].at - a[1].at)) {
      if (p.done) continue;
      const d = findDeck(id);
      if (d) return { id, title: d.title, n: Math.min(p.n, d.cards.length), total: d.cards.length };
    }
    return null;
  })();
  const dueCount = screen === "home" ? dueCards().length : 0;
  const reviewPending = screen === "home" ? reviewCount() : 0;

  return (
    <PhoneFrame>
      <input
        ref={nextInput}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f && isPdf(f)) begin([f], nextFrom.current);
        }}
      />
      {screen === "home" ? (
        <Home
          deckCount={decks.length}
          cardCount={settings.cardCount}
          onCardCount={(n) => setSettings({ ...settings, cardCount: n })}
          mode={settings.mode}
          onMode={(m) => setSettings({ ...settings, mode: m })}
          onFiles={begin}
          onLibrary={() => {
            refreshDecks();
            setScreen("library");
          }}
          onSample={() => open(SAMPLE_DECKS[0])}
          resume={resumeInfo}
          onResume={() => {
            const d = resumeInfo && findDeck(resumeInfo.id);
            if (d) open(d);
          }}
          reviewDue={settings.spacedReview ? dueCount : null}
          reviewPending={reviewPending}
          clockDays={clockOffsetDays()}
          onReview={openReview}
          onShiftDay={() => {
            setClockOffsetDays(clockOffsetDays() + 1);
            setTick((t) => t + 1);
          }}
          apiReady={apiReady}
        />
      ) : screen === "library" ? (
        <Library
          decks={decks}
          samples={SAMPLE_DECKS}
          generatingId={generatingId}
          onOpen={(d) => open(job?.deck?.id === d.id && job.deck ? job.deck : d)}
          onDelete={(id) => {
            deleteDeck(id);
            refreshDecks();
          }}
          onBack={goHome}
        />
      ) : screen === "loading" && job ? (
        <Loading
          job={job}
          count={settings.cardCount}
          onCancel={() => {
            handle.current?.cancel();
            setJob(null);
            goHome();
          }}
          onOpenEarly={() => job.deck && open(job.deck)}
          onChooseRange={(r) => handle.current?.chooseRange(r)}
          onRetry={() => begin(lastFiles.current)}
          onSample={() => open(SAMPLE_DECKS[0])}
        />
      ) : screen === "feed" && openDeck ? (
        <Feed
          key={openDeck.id}
          deck={openDeck}
          generating={generatingId === openDeck.id}
          settings={settings}
          onSettings={setSettings}
          onBack={goHome}
          onDeckChange={onDeckChange}
          onRetryCard={onRetryCard}
          resumeKey={feedCtx.resumeKey}
          reviewIds={feedCtx.reviewIds}
          onPosition={(p) => saveProgress(openDeck.id, { ...p, at: Date.now() })}
          onDrillWrong={drillWrong}
          onNextRange={nextRange}
        />
      ) : (
        <Home
          deckCount={decks.length}
          cardCount={settings.cardCount}
          onCardCount={(n) => setSettings({ ...settings, cardCount: n })}
          mode={settings.mode}
          onMode={(m) => setSettings({ ...settings, mode: m })}
          onFiles={begin}
          onLibrary={() => setScreen("library")}
          onSample={() => open(SAMPLE_DECKS[0])}
          resume={resumeInfo}
          onResume={() => {
            const d = resumeInfo && findDeck(resumeInfo.id);
            if (d) open(d);
          }}
          reviewDue={settings.spacedReview ? dueCount : null}
          reviewPending={reviewPending}
          clockDays={clockOffsetDays()}
          onReview={openReview}
          onShiftDay={() => {
            setClockOffsetDays(clockOffsetDays() + 1);
            setTick((t) => t + 1);
          }}
          apiReady={apiReady}
        />
      )}
    </PhoneFrame>
  );
}
