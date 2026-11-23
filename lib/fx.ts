/* 버튼 손맛 (2026-11-23 확정)
   - 기본 버튼: 말랑 스쿼시 (.press) — 누르면 아래 두께만큼 납작하게 눌리고, 떼면 통통 튀며 돌아옴
   - 정답·완료 순간: 팡 파티클 (burstFrom) — 누른 자리에서 확정 색 조각이 터짐
   - 퀴즈 선택지: .opt-press — 같은 손맛으로 눌리고, 정답은 튀며 ✓, 오답은 흔들림 */

const COLORS = ["#0A5FC2", "#FFD43B", "#F2241B", "#1286F0", "#232325"];

function reduced(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

let installed = false;

/** 앱 시작 시 한 번: .press 버튼에서 손을 떼면 튀어 오르는 반동을 다시 재생 */
export function installPressFx(): void {
  if (installed || typeof document === "undefined") return;
  installed = true;
  // iOS 사파리에서 :active가 동작하도록
  document.addEventListener("touchstart", () => {}, { passive: true });
  document.addEventListener("pointerup", (e) => {
    const el = (e.target as Element | null)?.closest?.(".press, .opt-press") as HTMLElement | null;
    if (!el || (el as HTMLButtonElement).disabled || reduced()) return;
    el.classList.remove("pop");
    void el.offsetWidth;
    el.classList.add("pop");
  });
}

/** 요소 가운데(또는 지정한 점)에서 확정 색 조각이 터져 나감 */
export function burstFrom(el: Element | null, point?: { x: number; y: number }, count = 18): void {
  if (!el || typeof document === "undefined" || reduced()) return;
  const r = el.getBoundingClientRect();
  const x = point?.x ?? r.left + r.width / 2;
  const y = point?.y ?? r.top + r.height / 2;
  for (let i = 0; i < count; i++) {
    const p = document.createElement("span");
    const a = Math.random() * Math.PI * 2;
    const d = 60 + Math.random() * 80;
    p.className = "fx-pt";
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    p.style.background = COLORS[i % COLORS.length];
    p.style.setProperty("--dx", `${Math.cos(a) * d}px`);
    p.style.setProperty("--dy", `${Math.sin(a) * d - 24}px`);
    p.style.setProperty("--r", `${Math.random() * 540 - 270}deg`);
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 800);
  }
}
