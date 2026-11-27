"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import type { StyleASpec } from "@/lib/schema";
import { decodeWav, playMusic, speak, stopMusic, stopVoice } from "@/lib/sfx";

interface Props {
  spec: StyleASpec;
  mode: "active" | "near" | "far";
  speed: number;
  sound: boolean;
  /** 무료 기기 음성으로 장면마다 한 문장 읽기 */
  voice: boolean;
  /** true면 끝에서 처음으로 이어 돈다. false면 끝에서 멈추고 onEnded */
  loop: boolean;
  onEnded?: () => void;
  onProgress?: (p: number) => void;
  /** 엔진이 이 설계도를 그리지 못했을 때 */
  onError?: () => void;
  /** 위·아래 바가 가리는 높이(px). 영상은 그 사이에 9:16으로 들어간다 */
  top?: number;
  bottom?: number;
}

let voiceOwner = 0;
let seq = 0;

/* 스타일A 모션그래픽 한 편. 그리는 일은 /player(iframe)가 하고, 소리와 목소리는 여기서 낸다. */
export default function StyleACard({ spec, mode, speed, sound, voice, loop, onEnded, onProgress, onError, top = 100, bottom = 74 }: Props) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [booted, setBooted] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [paused, setPaused] = useState(false);
  const [hasAudio, setHasAudio] = useState(false);
  const me = useRef(++seq);
  const buf = useRef<AudioBuffer | null>(null);
  const asked = useRef(false);
  const musicId = useRef(0);
  const at = useRef(0);
  const dur = useRef(0);
  const live = mode === "active" && !paused && ready;
  const st = useRef({ live, sound, voice, speed, onEnded, onProgress, onError });
  st.current = { live, sound, voice, speed, onEnded, onProgress, onError };

  const send = useCallback((m: Record<string, unknown>) => {
    frame.current?.contentWindow?.postMessage({ to: "stylea", ...m }, window.location.origin);
  }, []);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== frame.current?.contentWindow) return;
      const m = e.data as { from?: string; type?: string; p?: number; dur?: number; line?: string; wav?: string };
      if (!m || m.from !== "stylea") return;
      const s = st.current;
      if (m.type === "boot") setBooted(true);
      else if (m.type === "ready") {
        dur.current = m.dur ?? 0;
        at.current = 0;
        setReady(true);
      } else if (m.type === "error") {
        setFailed(true);
        setReady(false);
        s.onError?.();
      }
      else if (m.type === "progress") {
        at.current = (m.p ?? 0) * dur.current;
        if (s.live) s.onProgress?.(m.p ?? 0);
      } else if (m.type === "scene") {
        if (s.live && s.voice && m.line) {
          voiceOwner = me.current;
          speak(m.line, s.speed);
        }
      } else if (m.type === "loop") {
        at.current = 0;
        if (s.live && s.sound && buf.current) musicId.current = playMusic(buf.current, 0, s.speed, s.voice);
      } else if (m.type === "ended") {
        stopMusic(musicId.current);
        if (s.live) s.onEnded?.();
      } else if (m.type === "audio" && m.wav) {
        void decodeWav(m.wav).then((b) => {
          buf.current = b;
          if (b) setHasAudio(true);
        });
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  // 설계도 보내기
  useEffect(() => {
    if (!booted) return;
    setReady(false);
    setFailed(false);
    buf.current = null;
    asked.current = false;
    setHasAudio(false);
    send({ type: "load", spec });
  }, [booted, spec, send]);

  // 화면 가운데로 오면 처음부터 재생, 벗어나면 멈춤
  const wasActive = useRef(false);
  useEffect(() => {
    if (!ready) return;
    const active = mode === "active";
    const restart = active && !wasActive.current;
    wasActive.current = active;
    if (!active && paused) setPaused(false);
    send({ type: "set", playing: live, speed, loop, restart });
    if (restart) at.current = 0;
  }, [ready, mode, live, paused, speed, loop, send]);

  // 배경 사운드
  useEffect(() => {
    if (live && sound) {
      if (buf.current) musicId.current = playMusic(buf.current, at.current, speed, voice);
      else if (!asked.current) {
        asked.current = true;
        send({ type: "audio" });
      }
    } else stopMusic(musicId.current);
  }, [live, sound, voice, speed, hasAudio, send]);

  // 목소리 끄기
  useEffect(() => {
    if ((!live || !voice) && voiceOwner === me.current) {
      stopVoice();
      voiceOwner = 0;
    }
  }, [live, voice]);

  useEffect(
    () => () => {
      stopMusic(musicId.current);
      if (voiceOwner === me.current) stopVoice();
    },
    [],
  );

  return (
    <div
      className="relative h-full w-full bg-[var(--paper)]"
      onClick={() => {
        if (mode === "active" && ready) setPaused((p) => !p);
      }}
    >
      <div className="absolute inset-x-0 flex items-center justify-center" style={{ top, bottom }}>
        {mode === "far" ? null : (
          <div className="relative h-full max-w-full overflow-hidden rounded-[18px] border-[2.5px] border-[var(--ink)] bg-white" style={{ aspectRatio: "9 / 16" }}>
            <iframe
              ref={frame}
              src="/player"
              title={spec.title ?? "모션그래픽"}
              className="pointer-events-none absolute inset-0 h-full w-full border-0"
              style={{ opacity: ready ? 1 : 0, transition: "opacity .2s" }}
            />
            {!ready ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center text-[var(--ink)]">
                {failed ? (
                  <p className="text-[14px] font-bold">이 영상을 그리지 못했어요</p>
                ) : (
                  <div className="h-10 w-10 animate-spin rounded-full border-[4px] border-[var(--ans)] border-t-[var(--ocean)]" />
                )}
              </div>
            ) : null}
            {paused && mode === "active" ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/15">
                <span className="flex h-16 w-16 items-center justify-center rounded-full border-[2.5px] border-[var(--ink)] bg-white">
                  <svg width="22" height="24" viewBox="0 0 22 24" aria-label="재생">
                    <path d="M3 2 L20 12 L3 22 Z" fill="var(--ink)" />
                  </svg>
                </span>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
