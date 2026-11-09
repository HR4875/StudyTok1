// IP당 하루 AI 호출 횟수 제한 (메모리 기반, 최선 노력).
// 서버리스 인스턴스마다 따로 세므로 완벽하지 않다. 정확한 제한이 필요해지면 DB(예: Supabase)로 옮긴다.
const buckets = new Map<string, { day: string; count: number }>();

export function checkRateLimit(ip: string): { ok: boolean; remaining: number; limit: number } {
  const limit = Number(process.env.DAILY_LIMIT ?? 30);
  const day = new Date().toISOString().slice(0, 10);
  const b = buckets.get(ip);
  if (!b || b.day !== day) {
    buckets.set(ip, { day, count: 1 });
    return { ok: true, remaining: limit - 1, limit };
  }
  if (b.count >= limit) return { ok: false, remaining: 0, limit };
  b.count += 1;
  return { ok: true, remaining: limit - b.count, limit };
}
