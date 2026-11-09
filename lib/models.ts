// 선택 가능한 모델과 1M 토큰당 가격 (USD, Anthropic 공개 가격 기준).
export interface ModelOption {
  id: string;
  label: string;
  note: string;
  inputPerM: number;
  outputPerM: number;
  serverFallback: boolean; // 서버측 refusal fallback 지원 여부
}

export const MODELS: ModelOption[] = [
  {
    id: "claude-opus-5-5",
    label: "Opus 5.5",
    note: "기본 · 품질 우선",
    inputPerM: 4,
    outputPerM: 20,
    serverFallback: true,
  },
  {
    id: "claude-sonnet-5-5",
    label: "Sonnet 5.5",
    note: "중간 비용",
    inputPerM: 2,
    outputPerM: 10,
    serverFallback: true,
  },
  {
    id: "claude-haiku-5-5",
    label: "Haiku 5.5",
    note: "최저 비용",
    inputPerM: 0.1,
    outputPerM: 0.5,
    serverFallback: false,
  },
];

export const DEFAULT_MODEL = MODELS[0].id;
export const DEFAULT_EFFORT = "medium" as const;

export function findModel(id: string): ModelOption | undefined {
  return MODELS.find((m) => m.id === id);
}

export function estimateCost(id: string, input: number, output: number): number {
  const m = findModel(id) ?? MODELS[0];
  return (input * m.inputPerM + output * m.outputPerM) / 1_000_000;
}

// 입력 상한 (비용·60초 함수 제한 대비)
export const LIMITS = {
  maxPages: 30, // 한 번에 고를 수 있는 최대 페이지 수
  pagesPerChunk: 3, // AI 한 번 호출에 넣는 페이지 수
  maxCharsPerChunk: 12000,
  maxPdfBytes: 3_000_000, // 스캔 PDF 조각 (Vercel 요청 본문 4.5MB 제한 아래)
  maxOutputTokens: { text: 8000, motion: 12000 },
};
