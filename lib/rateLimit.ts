// IP당 하루 AI 호출 횟수 제한 (메모리 기반, 최선 노력).
// 서버 인스턴스마다 따로 세므로 완벽하지 않다. 정확한 제한이 필요해지면 DB(예: Supabase)로 옮긴다.
// 학교 와이파이처럼 여러 명이 IP 하나를 같이 쓰는 경우가 많아 넉넉하게 잡는다. (카드 1장 = 1회)
const buckets = new Map<string, { day: string; count: number }>();

export function checkRateLimit(ip: string, weight = 1): { ok: boolean; remaining: number; limit: number } {
  const limit = Number(process.env.DAILY_LIMIT ?? 150);
  const day = new Date().toISOString().slice(0, 10);
  let b = buckets.get(ip);
  if (!b || b.day !== day) {
    b = { day, count: 0 };
    buckets.set(ip, b);
    if (buckets.size > 5000) buckets.clear();
  }
  if (b.count + weight > limit) return { ok: false, remaining: Math.max(0, limit - b.count), limit };
  b.count += weight;
  return { ok: true, remaining: limit - b.count, limit };
}
