"use client";
import type { CSSProperties } from "react";
import type { Motion, Visual as V } from "@/lib/types";

// AI가 고른 도식 종류와 항목만 받아 코드(HTML/CSS)로 '스티커' 스타일 그림을 그린다. 이미지 생성 API를 쓰지 않는다.
// 모션 모드에서는 카드가 화면에 들어올 때(.live) 차례로 튀어나오고, 연결선이 흐르고, 막대가 자란다.
const d = (i: number, step = 120): CSSProperties => ({ ["--d" as string]: `${i * step}ms` });

export default function Visual({ v, emoji, beats }: { v: V | null; emoji: string; beats?: Motion["beats"] }) {
  return (
    <div className="visual">
      {beats && beats.length > 0 && (
        <div className="bubbles">
          {beats.map((b, i) => (
            <span key={i} className={`bubble pop fx-${b.effect}`} style={d(i + 3, 350)}>
              {b.text}
            </span>
          ))}
        </div>
      )}
      {v ? <Body v={v} /> : <span className="emoji-sticker pop">{emoji}</span>}
      {v?.title && <p className="viz-cap">{v.title}</p>}
    </div>
  );
}

function Body({ v }: { v: V }) {
  switch (v.type) {
    case "bar": {
      const max = Math.max(...v.items.map((i) => Math.abs(i.value ?? 0)), 1);
      const top = Math.max(...v.items.map((i) => i.value ?? 0));
      return (
        <div className="v-bars">
          {v.items.map((it, i) => (
            <div className="v-bar-col" key={i}>
              <b className="v-bar-val">{fmt(it.value)}</b>
              <span
                className={`v-bar grow ${it.value === top ? "hi" : ""}`}
                style={{ height: `${Math.max(8, (Math.abs(it.value ?? 0) / max) * 100)}%`, ...d(i) }}
              />
              <span className="v-label">{it.label}</span>
            </div>
          ))}
        </div>
      );
    }
    case "pie": {
      const total = v.items.reduce((s, i) => s + Math.max(0, i.value ?? 0), 0) || 1;
      const colors = ["var(--sun)", "#fff", "var(--sky)", "var(--coral)", "var(--mint)", "#c9b8ff"];
      let acc = 0;
      const stops = v.items
        .map((it, i) => {
          const a = (acc / total) * 360;
          acc += Math.max(0, it.value ?? 0);
          return `${colors[i % colors.length]} ${a}deg ${(acc / total) * 360}deg`;
        })
        .join(", ");
      return (
        <div className="v-pie-wrap">
          <div className="v-pie pop" style={{ background: `conic-gradient(${stops})` }} />
          <ul className="v-legend">
            {v.items.map((it, i) => (
              <li key={i} className="pop" style={d(i + 2)}>
                <i style={{ background: colors[i % colors.length] }} />
                {it.label} <b>{fmt(it.value)}</b>
              </li>
            ))}
          </ul>
        </div>
      );
    }
    case "flow":
      return (
        <div className={`v-flow n${Math.min(v.items.length, 4)}`}>
          {v.items.slice(0, 4).map((it, i) => (
            <div className="v-flow-step" key={i}>
              {i > 0 && <span className="v-link flow" aria-hidden />}
              <div className={`v-box pop ${i === v.items.length - 1 ? "hi" : ""}`} style={d(i, 180)}>
                <span className="v-num">{i + 1}</span>
                <b>{it.label}</b>
                {it.note && <small>{it.note}</small>}
              </div>
            </div>
          ))}
        </div>
      );
    case "timeline":
      return (
        <div className="v-time">
          <span className="v-time-line flow" aria-hidden />
          {v.items.slice(0, 5).map((it, i) => (
            <div className="v-time-pt pop" key={i} style={d(i, 160)}>
              <i />
              <b>{it.label}</b>
              {it.note && <small>{it.note}</small>}
            </div>
          ))}
        </div>
      );
    case "cycle": {
      const n = v.items.length;
      return (
        <div className="v-cycle">
          <span className="v-ring spin" aria-hidden />
          <span className="v-hub pop">↻</span>
          {v.items.map((it, i) => {
            const ang = (i / n) * Math.PI * 2 - Math.PI / 2;
            return (
              <span
                key={i}
                className="v-node pop"
                style={{ left: `${50 + Math.cos(ang) * 40}%`, top: `${50 + Math.sin(ang) * 40}%`, ...d(i, 160) }}
              >
                {it.label}
              </span>
            );
          })}
        </div>
      );
    }
    case "compare":
      return (
        <div className="v-cmp">
          {v.items.slice(0, 2).map((it, i) => (
            <div key={i} className={`v-panel pop ${i === 1 ? "alt" : ""}`} style={d(i, 200)}>
              <b>{it.label}</b>
              {it.note && <small>{it.note}</small>}
            </div>
          ))}
          <span className="v-vs pop" style={d(3, 150)}>
            VS
          </span>
        </div>
      );
    case "keywords":
      return (
        <div className="v-kw">
          {v.items.map((it, i) => (
            <span key={i} className={`v-tag pop ${i === 0 ? "hi" : ""}`} style={{ ...d(i), rotate: `${((i % 3) - 1) * 3}deg` }}>
              {it.label}
            </span>
          ))}
        </div>
      );
    case "formula":
      return (
        <div className="v-board pop">
          <code>{v.items[0]?.label}</code>
          {v.items[0]?.note && <small>{v.items[0].note}</small>}
        </div>
      );
    default:
      return null;
  }
}

function fmt(n: number | null) {
  if (n === null) return "";
  return Number.isInteger(n) ? n.toLocaleString("ko-KR") : n.toFixed(1);
}
