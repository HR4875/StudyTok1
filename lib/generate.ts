"use client";
import type { GenerateRequest, GenerateResponse } from "./types";

export async function callGenerate(req: GenerateRequest): Promise<GenerateResponse> {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? `요청 실패 (${res.status})`);
  return json as GenerateResponse;
}

// 생성 결과를 브라우저에 저장해 같은 자료·범위·형식·모델이면 AI를 다시 부르지 않는다.
const PREFIX = "studytok:deck:";

export function loadCached<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function saveCached(key: string, value: unknown) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // 저장 공간이 없거나 막혀 있으면 그냥 넘어간다
  }
}
