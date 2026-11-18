// 선택 가능한 모델과 1M 토큰당 가격 (USD, Anthropic 공개 가격 기준).
export interface ModelOption {
  id: string;
  label: string;
  note: string;
  inputPerM: number;
  outputPerM: number;
  cacheReadPerM: number;
  cacheWritePerM: number; // 5분 캐시 쓰기 (입력가 × 1.25)
  serverFallback: boolean; // 서버측 refusal fallback 지원 여부
}

export const MODELS: ModelOption[] = [
  {
    id: "claude-opus-5-5",
    label: "Opus 5.5",
    note: "기본 · 품질 우선",
    inputPerM: 4,
    outputPerM: 20,
    cacheReadPerM: 0.2,
    cacheWritePerM: 5,
    serverFallback: true,
  },
  {
    id: "claude-sonnet-5-5",
    label: "Sonnet 5.5",
    note: "중간 비용",
    inputPerM: 2,
    outputPerM: 10,
    cacheReadPerM: 0.2,
    cacheWritePerM: 2.5,
    serverFallback: true,
  },
  {
    id: "claude-haiku-5-5",
    label: "Haiku 5.5",
    note: "최저 비용",
    inputPerM: 0.1,
    outputPerM: 0.5,
    cacheReadPerM: 0.01,
    cacheWritePerM: 0.125,
    serverFallback: false,
  },
];

export const DEFAULT_MODEL = MODELS[0].id;
export const DEFAULT_EFFORT = "medium" as const;

export function findModel(id: string | undefined): ModelOption | undefined {
  return MODELS.find((m) => m.id === id);
}

export function estimateCost(id: string, u: { input: number; output: number; cacheRead?: number; cacheWrite?: number }): number {
  const m = findModel(id) ?? MODELS[0];
  return (u.input * m.inputPerM + u.output * m.outputPerM + (u.cacheRead ?? 0) * m.cacheReadPerM + (u.cacheWrite ?? 0) * m.cacheWritePerM) / 1_000_000;
}

// 입력 상한 (비용·요청 크기·서버 함수 시간 제한 대비)
export const LIMITS = {
  maxPages: 300, // 글자 PDF 한 번에 넣는 쪽 수 상한 (보통 글자 수 한도가 먼저 걸린다)
  maxChars: 30000, // 한 번에 보내는 글자 수 (공백 제외)
  maxImages: 8, // 한 번에 보내는 그림 수: 스캔본 쪽 · 그림 위주 쪽 · 사진
  outlineChunks: 4, // 개념 뽑기를 나눠서 동시에 부르는 최대 조각 수
  chunkChars: 8000,
  maxBodyBytes: 4_200_000, // Vercel 요청 본문 4.5MB 제한 아래
  maxOutputTokens: { outline: 16000, text: 12000, motion: 16000 },
};
