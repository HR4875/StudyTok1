// 2단계: 개념 하나 → 장면 JSON. 검사에서 고칠 수 없는 문제가 나오면 문제 목록을 알려 주고 한 번 더 부른다.
// 그래도 안 되거나 시간이 모자라면 AI 없이 기본 텍스트 카드로 대신한다.
import { fallbackScene } from "../fallback";
import { LIMITS } from "../models";
import { SceneSchema, type RenderMode, type SceneRequest, type SceneResult, type StreamEvent, type Usage } from "../schema";
import { AiError, callJson, sumUsage, type Effort } from "./claude";
import { checkScene } from "./checks";
import { SCENE_SYSTEM, sceneUser } from "./prompts";

/** 설정 문제라 다시 해도 소용없는 오류: 그대로 알려 준다 */
const FATAL = new Set(["NO_KEY", "BAD_KEY", "NO_CREDIT", "BAD_MODEL", "CANCELLED"]);
/** 잠깐 기다리면 나아지는 오류: 브라우저가 조금 뒤 다시 부른다 */
const WAIT = new Set(["BUSY", "OVERLOADED", "NETWORK", "SERVER"]);

export async function runScene(
  req: SceneRequest & { mode: RenderMode; model: string; effort: Effort },
  send: (ev: StreamEvent<unknown>) => void,
  signal: AbortSignal,
  budgetMs: number,
): Promise<{ result: SceneResult; usage: Usage }> {
  const until = Date.now() + budgetMs;
  const issues: string[] = [];
  let usage: Usage | undefined;
  let severe: string[] | undefined;

  for (let attempt = 0; attempt < 2; attempt++) {
    const left = until - Date.now();
    if (left < 12_000) {
      issues.push("시간 부족");
      break;
    }
    if (attempt) send({ type: "status", message: "검사에 걸린 부분을 고쳐 다시 만드는 중…" });
    try {
      const r = await callJson({
        model: req.model,
        effort: req.effort,
        system: SCENE_SYSTEM[req.mode],
        user: [{ type: "text", text: sceneUser(req, severe) }],
        schema: SceneSchema,
        maxTokens: LIMITS.maxOutputTokens[req.mode],
        deadlineMs: left,
        signal,
      });
      usage = sumUsage(usage, r.usage);
      const chk = checkScene(r.raw, { term: req.concept.term, mode: req.mode });
      issues.push(...chk.issues);
      if (!chk.severe.length) return { result: { scene: chk.scene, fallback: false, issues }, usage };
      severe = chk.severe;
      issues.push(...chk.severe.map((s) => `검사 실패: ${s}`));
    } catch (e) {
      if (!(e instanceof AiError)) throw e;
      usage = sumUsage(usage, e.usage);
      if (FATAL.has(e.code)) throw e;
      if (WAIT.has(e.code)) throw Object.assign(e, { usage });
      issues.push(e.code);
      if (e.code === "TIMEOUT" || e.code === "REFUSED") break;
      // BAD_OUTPUT(잘림·깨진 JSON)·BAD_REQUEST는 한 번 더 시도
    }
  }

  const others = req.others ?? [];
  return { result: { scene: fallbackScene(req.concept, others, req.index), fallback: true, issues }, usage: usage ?? sumUsage() };
}
