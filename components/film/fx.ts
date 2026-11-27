"use client";
// 버튼 손맛 (확정안 2026-11-23, 원래 앱의 lib/fx.ts와 같은 수치): 주·보조 버튼에서 손을 떼면 통통 튀어 오르고,
// 정답·완주 순간에는 확정 색 조각이 터져 나간다. 앱의 lib/fx.ts는 쓰지 않는다: 그쪽은 눌린 단추에 "pop" 클래스를 붙이는데
// 이 화면에서 .pop은 고르기 칸의 이름이고, 조각을 body에 붙여 .film 밖의 CSS(globals.css)가 있어야 보인다.

const COLORS = ["#0A5FC2", "#FFD43B", "#F2241B", "#1286F0", "#232325"];

function reduced(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

let installed = false;

/** 한 번만: .film 안의 .btn에서 손을 떼면 튀어 오르는 반동을 다시 재생한다 */
export function installPressFx(): void {
  if (installed || typeof document === "undefined") return;
  installed = true;
  // iOS 사파리에서 :active가 동작하도록
  document.addEventListener("touchstart", () => {}, { passive: true });
  document.addEventListener("pointerup", (e) => {
    const el = (e.target as Element | null)?.closest?.(".film .btn") as HTMLElement | null;
    if (!el || el.hasAttribute("disabled") || el.classList.contains("small") || reduced()) return;
    el.classList.remove("bounce");
    void el.offsetWidth;
    el.classList.add("bounce");
  });
}

/** 요소 가운데(또는 지정한 점)에서 확정 색 조각이 터져 나간다. 조각은 .film 안에 붙여 이 화면의 CSS만으로 보이게 한다 */
export function burstFrom(el: Element | null, point?: { x: number; y: number }, count = 18): void {
  if (!el || typeof document === "undefined" || reduced()) return;
  const root = el.closest(".film");
  if (!root) return;
  const r = el.getBoundingClientRect();
  // 화면이 변형된 틀(예: 체험 페이지의 폰 틀) 안에 있으면 고정 위치는 그 틀 기준이다
  const frame = root.closest("[data-fixed-frame]")?.getBoundingClientRect();
  const x = (point && point.x ? point.x : r.left + r.width / 2) - (frame ? frame.left : 0);
  const y = (point && point.y ? point.y : r.top + r.height / 2) - (frame ? frame.top : 0);
  for (let i = 0; i < count; i++) {
    const p = document.createElement("span");
    const a = Math.random() * Math.PI * 2;
    const d = 60 + Math.random() * 80;
    p.className = "fx-pt";
    p.setAttribute("aria-hidden", "true");
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    p.style.background = COLORS[i % COLORS.length];
    p.style.setProperty("--dx", `${Math.cos(a) * d}px`);
    p.style.setProperty("--dy", `${Math.sin(a) * d - 24}px`);
    p.style.setProperty("--r", `${Math.random() * 540 - 270}deg`);
    root.appendChild(p);
    window.setTimeout(() => p.remove(), 800);
  }
}
