"use client";
import type { Visual as V } from "@/lib/types";

// AI가 고른 도식 종류와 항목만 받아 코드(HTML/SVG)로 그린다. 이미지 생성 API를 쓰지 않는다.
export default function Visual({ v, animate }: { v: V; animate: boolean }) {
  const cls = `viz viz-${v.type} ${animate ? "viz-anim" : ""}`;
  return (
    <figure className={cls}>
      {v.title && <figcaption>{v.title}</figcaption>}
      <Body v={v} />
    </figure>
  );
}

function Body({ v }: { v: V }) {
  switch (v.type) {
    case "bar": {
      const max = Math.max(...v.items.map((i) => Math.abs(i.value ?? 0)), 1);
      return (
        <div className="bars">
          {v.items.map((it, i) => (
            <div className="bar-row" key={i} style={{ ["--d" as string]: `${i * 0.15}s` }}>
              <span className="bar-label">{it.label}</span>
              <span className="bar-track">
                <span className="bar-fill" style={{ width: `${(Math.abs(it.value ?? 0) / max) * 100}%` }} />
              </span>
              <span className="bar-val">{fmt(it.value)}</span>
            </div>
          ))}
        </div>
      );
    }
    case "pie": {
      const total = v.items.reduce((s, i) => s + Math.max(0, i.value ?? 0), 0) || 1;
      let acc = 0;
      const colors = ["var(--c1)", "var(--c2)", "var(--c3)", "var(--c4)", "var(--c5)", "var(--c6)"];
      const stops = v.items
        .map((it, i) => {
          const a = (acc / total) * 360;
          acc += Math.max(0, it.value ?? 0);
          const b = (acc / total) * 360;
          return `${colors[i % colors.length]} ${a}deg ${b}deg`;
        })
        .join(", ");
      return (
        <div className="pie-wrap">
          <div className="pie" style={{ background: `conic-gradient(${stops})` }} />
          <ul className="legend">
            {v.items.map((it, i) => (
              <li key={i}>
                <i style={{ background: colors[i % colors.length] }} />
                {it.label} <b>{fmt(it.value)}</b>
              </li>
            ))}
          </ul>
        </div>
      );
    }
    case "flow":
    case "timeline":
      return (
        <ol className={v.type === "flow" ? "flow" : "timeline"}>
          {v.items.map((it, i) => (
            <li key={i} style={{ ["--d" as string]: `${i * 0.25}s` }}>
              <span className="node">{it.label}</span>
              {it.note && <small>{it.note}</small>}
            </li>
          ))}
        </ol>
      );
    case "cycle": {
      const n = v.items.length;
      return (
        <div className="cycle">
          <svg viewBox="0 0 200 200" aria-hidden>
            <circle cx="100" cy="100" r="70" className="cycle-ring" />
          </svg>
          {v.items.map((it, i) => {
            const ang = (i / n) * Math.PI * 2 - Math.PI / 2;
            return (
              <span
                key={i}
                className="cycle-node"
                style={{
                  left: `${50 + Math.cos(ang) * 35}%`,
                  top: `${50 + Math.sin(ang) * 35}%`,
                  ["--d" as string]: `${i * 0.2}s`,
                }}
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
        <div className="compare">
          {v.items.slice(0, 2).map((it, i) => (
            <div key={i} className={`cmp cmp-${i}`} style={{ ["--d" as string]: `${i * 0.2}s` }}>
              <b>{it.label}</b>
              {it.note && <p>{it.note}</p>}
            </div>
          ))}
          <span className="vs">VS</span>
        </div>
      );
    case "keywords":
      return (
        <div className="keywords">
          {v.items.map((it, i) => (
            <span key={i} className="kw" style={{ ["--d" as string]: `${i * 0.12}s` }}>
              #{it.label}
            </span>
          ))}
        </div>
      );
    case "formula":
      return (
        <div className="formula">
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
