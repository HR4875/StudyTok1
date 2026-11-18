// zod 스키마 → Claude 구조화 출력용 JSON 스키마.
// SDK 도우미는 enum을 설명 글로 옮겨 버려서(문법으로 강제되지 않음) 직접 바꾼다:
// enum·required는 그대로 두고, 지원하지 않는 숫자·길이 제약만 뺀다.
import { z } from "zod";

const DROP = new Set([
  "$schema",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "minLength",
  "maxLength",
  "pattern",
  "maxItems",
  "uniqueItems",
  "examples",
]);

function strict(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(strict);
  if (!node || typeof node !== "object") return node;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    if (DROP.has(k)) continue;
    if (k === "minItems" && v !== 0 && v !== 1) continue;
    if ((k === "properties" || k === "$defs") && v && typeof v === "object") {
      out[k] = Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([pk, pv]) => [pk, strict(pv)]));
    } else out[k] = strict(v);
  }
  if (out.type === "object") {
    out.additionalProperties = false;
    if (out.properties) out.required = Object.keys(out.properties as object);
  }
  return out;
}

const cache = new WeakMap<object, Record<string, unknown>>();

export function toStrictJsonSchema(schema: z.ZodType): Record<string, unknown> {
  let s = cache.get(schema);
  if (!s) {
    s = strict(z.toJSONSchema(schema)) as Record<string, unknown>;
    cache.set(schema, s);
  }
  return s;
}
