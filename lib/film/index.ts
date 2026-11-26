// 모션 엔진 "Director 2": 모델이 쓴 장면 대본(글 표기)을 9:16 화면에 그려 재생한다.
//
//   core.ts    대본 → 시간표, "t초에 화면에 무엇이 있나", 대본 자동 점검(lint). DOM을 쓰지 않아 서버와 브라우저가 같이 쓴다.
//   script.ts  대본 표기 읽기(parseScript) · 쓰기(toText) · 고친 장면 합치기(applyPatch)
//   draw.ts    한 장면을 <svg>에 그린다. seek(t)는 t만의 함수라서 어느 시점이든 바로 그릴 수 있다.
//   audio.ts   화면의 움직임에 맞춘 배경음과 효과음을 코드로 만든다 (파일이 없고 비용도 없다).
//   skins.ts   디자인 5종. 내용은 대본이 정하고, 디자인은 색과 글꼴만 빌려준다.
//
// 이 폴더의 엔진 파일은 시리즈 계획(plan.ts) 말고는 앱의 다른 코드를 불러오지 않는다.
import { createDirector as createDirectorRaw } from "./draw";
import { renderScore as renderScoreRaw, toAudioBuffer as toAudioBufferRaw } from "./audio";
import type { Model, Script } from "./core";
import type { Skin } from "./skins";

export { prep, lint, describe, stateOf, beatTiming, normTerms, checkCalc, fmtV, W, H, ZONE, ASK_Y, TYPES } from "./core";
export type { Script, Beat, Action, Ask, Plan, PlanStep, Quiz, Issue, Model } from "./core";
export { SKINS, SKIN_LIST, skinOf } from "./skins";
export type { Skin } from "./skins";
export { ICONS, ICON_KO } from "./icons";
export { parseScript, toText, applyPatch, answerSlot } from "./script";

export interface DirectorOptions {
  /** 디자인: paper(기본) 등 SKIN_LIST의 id */
  skin?: string;
  /** 재생 속도. 기본 1.1 */
  speed?: number;
  /** true면 영상 속 질문에서 멈추고 답을 기다린다 */
  interactive?: boolean;
  /** 배경 무늬와 그림자 같은 꾸밈 */
  fancy?: boolean;
  /** 화면 아래에 작게 넣는 이름 */
  brand?: string;
}

/** 재생기에 필요한 한 편의 정보. 시간은 모두 실제 재생 시간(초)이다. */
export interface FilmInfo {
  dur: number;
  DUR: number;
  speed: number;
  skin: string;
  /** 장면마다: 시작 시각, 길이, 화면 맨 위 문장 */
  beats: { t0: number; dur: number; say: string }[];
  /** 장면 경계 시각 (0, 각 장면의 시작, 끝) */
  T: number[];
  /** 영상 속 질문: hold 시각에서 멈춰 답을 기다린다 */
  asks: { n: number; beat: number; t0: number; hold: number; t1: number; answer: number; choices: string[] }[];
  warn: string[];
}

export interface AskRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 소리 악보. director.score()가 만들고 renderScore()가 소리로 바꾼다. */
export type FilmScore = Record<string, unknown>;

export interface Director {
  /** 대본을 싣고 0초를 그린다 */
  load(script: Script, o?: DirectorOptions): Promise<FilmInfo>;
  /** t초(재생 시간)의 화면을 그린다 */
  seek(t: number): void;
  info(): FilmInfo;
  /** t초에 답을 기다리는 질문 (없으면 null). rects는 무대 좌표(1080×1920)의 보기 단추 자리 */
  pendingAsk(t: number): { n: number; hold: number; rects: AskRect[] } | null;
  /** 무대 좌표 (x, y)를 눌렀을 때 맞은 보기 */
  hitAsk(t: number, x: number, y: number): { n: number; choice: number } | null;
  /** n번 질문에 choice로 답한다. resume은 이어서 재생할 시각 */
  answer(n: number, choice: number): { correct: boolean; resume: number } | null;
  score(): FilmScore;
  readonly model: Model | null;
  readonly skin: Skin;
  setInteractive(v: boolean): void;
}

/** 소리 샘플 (48kHz 스테레오) */
export interface RenderedScore {
  L: Float32Array;
  R: Float32Array;
  SR: number;
  n: number;
}

export const createDirector = createDirectorRaw as unknown as (svg: SVGSVGElement, opts?: DirectorOptions) => Director;
export const renderScore = renderScoreRaw as unknown as (score: FilmScore, seconds: number, seed?: number) => Promise<RenderedScore>;
export const toAudioBuffer = toAudioBufferRaw as unknown as (ctx: BaseAudioContext, a: RenderedScore) => AudioBuffer;
