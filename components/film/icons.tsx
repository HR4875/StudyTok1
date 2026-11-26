// 모션 쇼츠 화면의 아이콘 (24×24, 색은 글자색을 따른다). 크기는 CSS에서 정한다.
import type { ReactNode } from "react";

const stroke = (w: number) => ({ fill: "none", stroke: "currentColor", strokeWidth: w, strokeLinecap: "round" as const, strokeLinejoin: "round" as const });

const ICONS = {
  back: <path d="M15 5l-7 7 7 7" {...stroke(2.4)} />,
  play: <path d="M7 4.6v14.8a1 1 0 0 0 1.52.85l12.1-7.4a1 1 0 0 0 0-1.7L8.52 3.75A1 1 0 0 0 7 4.6z" fill="currentColor" />,
  pause: (
    <>
      <rect x="6" y="4.5" width="4.6" height="15" rx="1.3" fill="currentColor" />
      <rect x="13.4" y="4.5" width="4.6" height="15" rx="1.3" fill="currentColor" />
    </>
  ),
  sound: (
    <>
      <path d="M4 9.5v5h3.5l4.5 4v-13l-4.5 4z" fill="currentColor" />
      <path d="M15.5 8.6a5 5 0 0 1 0 6.8M18 6a8.6 8.6 0 0 1 0 12" {...stroke(2)} />
    </>
  ),
  mute: (
    <>
      <path d="M4 9.5v5h3.5l4.5 4v-13l-4.5 4z" fill="currentColor" />
      <path d="M16 9.5l5 5M21 9.5l-5 5" {...stroke(2)} />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" {...stroke(2.8)} />,
  up: <path d="M12 16V5m0 0L7.5 9.5M12 5l4.5 4.5M5 19h14" {...stroke(2.2)} />,
  prev: (
    <>
      <path d="M18 5.2v13.6a.8.8 0 0 1-1.25.66L7 12.66a.8.8 0 0 1 0-1.32l9.75-6.8A.8.8 0 0 1 18 5.2z" fill="currentColor" />
      <rect x="4" y="5" width="2.6" height="14" rx="1.1" fill="currentColor" />
    </>
  ),
  next: (
    <>
      <path d="M6 5.2v13.6a.8.8 0 0 0 1.25.66L17 12.66a.8.8 0 0 0 0-1.32l-9.75-6.8A.8.8 0 0 0 6 5.2z" fill="currentColor" />
      <rect x="17.4" y="5" width="2.6" height="14" rx="1.1" fill="currentColor" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof ICONS;

export function Icon({ name }: { name: IconName }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}
