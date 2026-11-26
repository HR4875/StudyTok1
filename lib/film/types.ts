// 모션 쇼츠 API가 주고받는 것. 서버 라우트와 브라우저가 같이 쓴다.

/** POST /api/film/plan */
export interface FilmPlanRequest {
  /** 주제 한 줄. 자료가 있으면 비워도 된다 */
  topic: string;
  /** 자료의 글. 쪽마다 [p.N] 표시를 붙인 것 (lib/film/plan.ts 의 withMarks) */
  source: string;
  /** 이번에 계획할 최대 편 수 */
  max: number;
}

export interface FilmPlanResult {
  /** 계획 표기 (parsePlan으로 읽는다). 덜 채워진 편은 빠져 있다 */
  planText: string;
  shorts: number;
  /** 모델의 답이 중간에 끊겨 일부 편이 빠졌다 */
  cut: boolean;
  /** 서버에서 걸린 시간(초) */
  secs: number;
  model: string;
}

/** POST /api/film/short */
export interface FilmShortRequest {
  /** /api/film/plan 이 돌려준 계획 표기 그대로 */
  planText: string;
  /** 몇 편인지 (1부터) */
  k: number;
}

export interface FilmShortResult {
  /** 대본 표기 (자동 점검을 거친 최종본) */
  raw: string;
  scenes: number;
  /** 재생 길이(초) */
  dur: number;
  /** 남은 자동 점검 오류 수. 0이 정상이다 */
  errs: number;
  /** 모델을 부른 횟수: 1 또는 2 */
  calls: number;
  /** 자동 점검 뒤 한 번 고친 방법: 걸린 장면만(patch), 전체(rewrite), 고치지 않음("") */
  fix: "" | "patch" | "rewrite";
  secs: number;
  model: string;
}

export const FILM_LIMITS = {
  /** 한 번에 계획하는 편 수: 기본값과 상한 */
  planDefault: 6,
  planMax: 14,
  topicChars: 200,
  /** 기획 모델에 보내는 자료 글자 수 상한 ([p.N] 표시 포함) */
  sourceChars: 36000,
  planChars: 30000,
  /** 대본은 장면 6개 이상이어야 한 편으로 친다 */
  minScenes: 6,
};
