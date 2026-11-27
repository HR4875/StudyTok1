"use client";

import { useEffect } from "react";

/* 스타일A 재생 화면. 피드가 iframe으로 띄우고 postMessage로 조종한다.
   그리는 엔진은 public/stylea 의 스크립트 그대로다 (영상 렌더와 같은 코드). */
const SCRIPTS = ["core", "icons", "scenes", "mech", "engine", "audio", "player"];
const FONT_CSS = "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@500;600;700&family=Noto+Sans+KR:wght@500;600;700;900&display=swap";

export default function PlayerPage() {
  useEffect(() => {
    if (document.querySelector("script[data-stylea]")) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = FONT_CSS;
    document.head.appendChild(link);
    for (const name of SCRIPTS) {
      const s = document.createElement("script");
      s.src = `/stylea/${name}.js`;
      s.async = false; // 순서대로 실행
      s.dataset.stylea = name;
      document.body.appendChild(s);
    }
  }, []);
  return (
    <svg
      id="stage"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1080 1920"
      style={{ position: "fixed", inset: 0, width: "100%", height: "100%", display: "block", background: "transparent" }}
    >
      <defs id="defs" />
      <rect id="bg" width="1080" height="1920" />
      <g id="world" />
    </svg>
  );
}
