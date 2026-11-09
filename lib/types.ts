// StudyTok 공통 타입. AI 응답(JSON 스키마)과 화면이 같은 모양을 공유한다.

export type CardKind = "hook" | "concept" | "quiz" | "summary";

export type VisualType =
  | "none"
  | "bar" // 수치 비교 막대 그래프
  | "pie" // 비율
  | "flow" // 단계·과정 (A → B → C)
  | "cycle" // 순환 구조
  | "compare" // 두 대상 비교 (왼쪽/오른쪽)
  | "keywords" // 핵심어 묶음
  | "formula" // 공식 한 줄
  | "timeline"; // 연도·순서

export interface VisualItem {
  label: string;
  value: number | null; // bar/pie 에만 사용. 자료에 실제 숫자가 있을 때만
  note: string | null;
}

export interface Visual {
  type: VisualType;
  title: string | null;
  items: VisualItem[];
}

export interface Quiz {
  question: string;
  choices: string[];
  answer: number; // choices 의 0부터 시작하는 인덱스
  explanation: string; // 오답 시 끼워 넣는 해설 카드 본문
}

export type BeatEffect = "pop" | "slide" | "type" | "zoom" | "highlight";

export interface Motion {
  beats: { text: string; effect: BeatEffect }[];
  narration: string; // Web Speech API 로 읽는 대사
}

export interface Card {
  id: string;
  kind: CardKind;
  emoji: string;
  title: string;
  body: string;
  points: string[];
  visual: Visual | null;
  quiz: Quiz | null;
  motion: Motion | null;
  pages: string | null; // 출처 페이지 표시 (예: "p.3")
  // 화면에서만 쓰는 필드
  explainFor?: string; // 오답 해설 카드가 가리키는 퀴즈 카드 id
}

export type RenderMode = "text" | "motion";

export interface Deck {
  title: string;
  source: string; // 파일명 또는 "샘플"
  mode: RenderMode;
  model: string;
  isSample: boolean;
  cards: Card[];
}

export interface GenerateRequest {
  text?: string; // 클라이언트에서 추출한 텍스트
  pdfBase64?: string; // 텍스트가 거의 없는 스캔 PDF 조각
  pageLabel: string; // "p.3-5"
  mode: RenderMode;
  model: string;
  chunkIndex: number;
  chunkCount: number;
  docTitle: string;
}

export interface GenerateUsage {
  model: string;
  servedBy: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  ms: number;
}

export interface GenerateResponse {
  title: string;
  cards: Card[];
  usage: GenerateUsage;
}
