import type { ActorColor, Palette } from "@/lib/schema";

/* 확정 UI 색 (C안): 잉크 #232325 · 오션 블루 #0A5FC2 · 연파랑 #C9E2FF · 블루 #1286F0 · 형광 노랑 #FFD43B · 레드 #F2241B
   AI가 고르는 palette 이름은 그대로 두고, 실제 색은 이 몇 가지로만 모은다. */
export const NAVY = "#232325";
export const YELLOW = "#FFD43B";
export const OCEAN = "#0A5FC2";
export const GREEN = "#1286F0";
export const RED = "#F2241B";

const OCEAN_BG = { top: "#0A5FC2", mid: "#0A58B5", bottom: "#084EA2", glow: "rgba(201,226,255,0.30)" };
const INK_BG = { top: "#38383C", mid: "#2B2B2E", bottom: "#1E1E20", glow: "rgba(10,95,194,0.35)" };

export const PALETTE_BG: Record<Palette, { top: string; mid: string; bottom: string; glow: string }> = {
  blue: OCEAN_BG,
  violet: OCEAN_BG,
  green: OCEAN_BG,
  teal: OCEAN_BG,
  orange: OCEAN_BG,
  pink: OCEAN_BG,
  navy: INK_BG,
  red: OCEAN_BG,
};

export const PALETTE_ACCENT: Record<Palette, string> = {
  blue: OCEAN,
  violet: OCEAN,
  green: OCEAN,
  teal: OCEAN,
  orange: OCEAN,
  pink: OCEAN,
  navy: NAVY,
  red: OCEAN,
};

export const FILL: Record<ActorColor, string> = {
  white: "#FFFFFF",
  yellow: "#FFE27A",
  blue: "#C9E2FF",
  green: "#E9E7E0",
  red: "#FFD3D0",
  purple: "#A9CCF7",
  orange: "#FFEFB0",
  navy: NAVY,
};

export const BAR_FILL: Record<ActorColor, string> = {
  white: "#FFFFFF",
  yellow: YELLOW,
  blue: "#1286F0",
  green: OCEAN,
  red: RED,
  purple: "#A9CCF7",
  orange: "#FFE27A",
  navy: NAVY,
};

export function bgCss(p: Palette) {
  const c = PALETTE_BG[p] ?? PALETTE_BG.blue;
  return `linear-gradient(180deg, ${c.top} 0%, ${c.mid} 55%, ${c.bottom} 100%)`;
}

export const outlineShadow = (w: number, drop: number, color = NAVY) =>
  [
    `${w}px 0 0 ${color}`,
    `-${w}px 0 0 ${color}`,
    `0 ${w}px 0 ${color}`,
    `0 -${w}px 0 ${color}`,
    `${w * 0.7}px ${w * 0.7}px 0 ${color}`,
    `-${w * 0.7}px ${w * 0.7}px 0 ${color}`,
    `${w * 0.7}px -${w * 0.7}px 0 ${color}`,
    `-${w * 0.7}px -${w * 0.7}px 0 ${color}`,
    `0 ${drop}px 0 ${color}`,
  ].join(", ");
