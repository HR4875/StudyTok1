"use client";
import { useState } from "react";
import Feed from "@/components/Feed";
import Setup, { type SetupChoice } from "@/components/Setup";
import { sampleDeck } from "@/data/sampleDeck";
import { callGenerate, loadCached, saveCached } from "@/lib/generate";
import { extractChunks, hashFile } from "@/lib/pdf";
import type { Deck, GenerateUsage, RenderMode } from "@/lib/types";

interface Cached {
  deck: Deck;
  usage: GenerateUsage[];
}

export default function Home() {
  const [deck, setDeck] = useState<Deck | null>(null);
  const [usage, setUsage] = useState<GenerateUsage[]>([]);
  const [generating, setGenerating] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);

  function openSample(mode: RenderMode) {
    setError(null);
    setUsage([]);
    setDeck({ ...sampleDeck, mode });
  }

  async function start(c: SetupChoice) {
    setError(null);
    setGenerating(true);
    setStatus("PDF에서 글을 뽑는 중…");
    const title = c.file.name.replace(/\.pdf$/i, "");
    try {
      const key = `${await hashFile(c.data)}:${c.from}-${c.to}:${c.mode}:${c.model}`;
      const cached = loadCached<Cached>(key);
      if (cached) {
        setUsage(cached.usage);
        setDeck(cached.deck);
        setGenerating(false);
        return;
      }

      const chunks = await extractChunks(c.data, c.from, c.to);
      const base: Deck = {
        title,
        source: `${c.file.name} p.${c.from}-${c.to}`,
        mode: c.mode,
        model: c.model,
        isSample: false,
        cards: [],
      };
      let current = base;
      const used: GenerateUsage[] = [];

      for (let i = 0; i < chunks.length; i++) {
        const ch = chunks[i];
        setStatus(`${ch.label} 카드 만드는 중 (${i + 1}/${chunks.length})`);
        const res = await callGenerate({
          text: ch.text || undefined,
          pdfBase64: ch.pdfBase64,
          pageLabel: ch.label,
          mode: c.mode,
          model: c.model,
          chunkIndex: i,
          chunkCount: chunks.length,
          docTitle: title,
        });
        used.push(res.usage);
        current = {
          ...current,
          title: i === 0 && res.title ? res.title : current.title,
          cards: [...current.cards, ...res.cards],
        };
        setUsage([...used]);
        setDeck(current); // 첫 조각이 오면 바로 피드를 연다
      }
      saveCached(key, { deck: current, usage: used } satisfies Cached);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "생성 중 오류가 났어요.";
      setError(msg);
      setStatus(msg);
    } finally {
      setGenerating(false);
    }
  }

  if (deck && deck.cards.length > 0) {
    return (
      <div className="app">
      <Feed
        key={deck.source + deck.mode}
        deck={deck}
        generating={generating}
        status={status}
        usage={usage}
        error={error}
        onExit={() => {
          setDeck(null);
          setUsage([]);
        }}
      />
      </div>
    );
  }

  return <Setup busy={generating} status={status} error={error} onStart={start} onSample={openSample} />;
}
