// Tiny dependency-free SVG charts: line, stacked bar, donut, heatmap.

import { useMemo } from "react";

const COLORS = {
  primary: "#f59e0b",
  primarySoft: "#fbbf2466",
  good: "#6ee7b7",
  bad: "#fca5a5",
  warn: "#fbbf24",
  info: "#93c5fd",
  grid: "#1f2937",
  text: "#9ca3af",
};

function niceMax(n) {
  if (!n || n <= 1) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(n)));
  for (const m of [1, 2, 2.5, 5, 10]) {
    const cap = m * exp;
    if (cap >= n) return cap;
  }
  return n;
}

// ------------------------ LINE CHART (revenue) ------------------------
export function LineChart({ data, height = 220, valueKey = "amountLkr", labelKey = "date" }) {
  const width = 600;
  const padL = 40, padR = 12, padT = 12, padB = 28;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const max = niceMax(Math.max(1, ...data.map((d) => Number(d[valueKey] || 0))));
  const stepX = data.length > 1 ? innerW / (data.length - 1) : innerW;

  const points = data.map((d, i) => {
    const x = padL + i * stepX;
    const y = padT + innerH - (Number(d[valueKey] || 0) / max) * innerH;
    return [x, y];
  });

  const path = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area =
    points.length > 0
      ? `${path} L${points[points.length - 1][0]},${padT + innerH} L${points[0][0]},${padT + innerH} Z`
      : "";

  const ticks = 4;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none">
      {[...Array(ticks + 1)].map((_, i) => {
        const y = padT + (innerH * i) / ticks;
        const v = max * (1 - i / ticks);
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={width - padR} y2={y} stroke={COLORS.grid} strokeDasharray="2 4" />
            <text x={padL - 6} y={y + 3} fontSize="9" fill={COLORS.text} textAnchor="end">
              {Math.round(v).toLocaleString()}
            </text>
          </g>
        );
      })}
      {area && <path d={area} fill={COLORS.primarySoft} />}
      {path && <path d={path} fill="none" stroke={COLORS.primary} strokeWidth="2" />}
      {points.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2.5" fill={COLORS.primary} />
      ))}
      {data.map((d, i) => {
        if (i % Math.ceil(data.length / 7) !== 0 && i !== data.length - 1) return null;
        const x = padL + i * stepX;
        return (
          <text key={i} x={x} y={height - 8} fontSize="9" fill={COLORS.text} textAnchor="middle">
            {String(d[labelKey]).slice(5)}
          </text>
        );
      })}
    </svg>
  );
}

// ------------------------ STACKED BAR (bookings per day) ------------------------
export function StackedBar({ data, statuses, height = 240, labelKey = "date" }) {
  const width = 600;
  const padL = 36, padR = 12, padT = 12, padB = 28;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const totals = data.map((d) => statuses.reduce((s, k) => s + Number(d[k] || 0), 0));
  const max = niceMax(Math.max(1, ...totals));
  const barW = innerW / Math.max(1, data.length) * 0.6;
  const stepX = innerW / Math.max(1, data.length);

  const colorFor = (st) =>
    ({ CONFIRMED: COLORS.good, PENDING: COLORS.warn, CANCELLED: COLORS.bad, REJECTED: "#f87171" }[st] || COLORS.info);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none">
      {[0, 1, 2, 3, 4].map((i) => {
        const y = padT + (innerH * i) / 4;
        const v = max * (1 - i / 4);
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={width - padR} y2={y} stroke={COLORS.grid} strokeDasharray="2 4" />
            <text x={padL - 6} y={y + 3} fontSize="9" fill={COLORS.text} textAnchor="end">
              {Math.round(v)}
            </text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const xCenter = padL + stepX * (i + 0.5);
        const x = xCenter - barW / 2;
        let yCursor = padT + innerH;
        return (
          <g key={i}>
            {statuses.map((st) => {
              const v = Number(d[st] || 0);
              if (v <= 0) return null;
              const h = (v / max) * innerH;
              yCursor -= h;
              return (
                <rect key={st} x={x} y={yCursor} width={barW} height={h} fill={colorFor(st)} />
              );
            })}
            {(i % Math.ceil(data.length / 7) === 0 || i === data.length - 1) && (
              <text x={xCenter} y={height - 8} fontSize="9" fill={COLORS.text} textAnchor="middle">
                {String(d[labelKey]).slice(5)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ------------------------ DONUT (vehicle type / occupancy) ------------------------
export function Donut({ items, size = 200 }) {
  const total = items.reduce((s, x) => s + Number(x.value || 0), 0);
  const r = size / 2;
  const innerR = r * 0.62;
  let acc = 0;

  const palette = ["#f59e0b", "#6ee7b7", "#93c5fd", "#fbbf24", "#fca5a5", "#a78bfa", "#fda4af", "#5eead4"];

  if (total === 0) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={r} cy={r} r={r - 4} fill="none" stroke="#1f2937" strokeWidth="20" />
        <text x={r} y={r + 4} textAnchor="middle" fontSize="11" fill={COLORS.text}>
          No data
        </text>
      </svg>
    );
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {items.map((it, i) => {
        const v = Number(it.value || 0);
        if (v <= 0) return null;
        const start = (acc / total) * Math.PI * 2;
        acc += v;
        const end = (acc / total) * Math.PI * 2;
        const large = end - start > Math.PI ? 1 : 0;
        const x1 = r + r * Math.sin(start);
        const y1 = r - r * Math.cos(start);
        const x2 = r + r * Math.sin(end);
        const y2 = r - r * Math.cos(end);
        const xi1 = r + innerR * Math.sin(end);
        const yi1 = r - innerR * Math.cos(end);
        const xi2 = r + innerR * Math.sin(start);
        const yi2 = r - innerR * Math.cos(start);
        const d = [
          `M ${x1} ${y1}`,
          `A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`,
          `L ${xi1} ${yi1}`,
          `A ${innerR} ${innerR} 0 ${large} 0 ${xi2} ${yi2}`,
          "Z",
        ].join(" ");
        return <path key={i} d={d} fill={it.color || palette[i % palette.length]} />;
      })}
      <text x={r} y={r - 4} textAnchor="middle" fontSize="14" fontWeight="700" fill="#e6edf3">
        {total.toLocaleString()}
      </text>
      <text x={r} y={r + 12} textAnchor="middle" fontSize="10" fill={COLORS.text}>
        total
      </text>
    </svg>
  );
}

// ------------------------ HEATMAP (peak hours) ------------------------
export function Heatmap({ matrix, daysLabels, hoursLabels }) {
  const max = useMemo(() => {
    let m = 0;
    for (const row of matrix) for (const v of row) if (v > m) m = v;
    return m || 1;
  }, [matrix]);

  const cellColor = (v) => {
    if (!v) return "#0a0e14";
    const t = v / max;
    // amber gradient
    const r = Math.round(245 * t + 30 * (1 - t));
    const g = Math.round(158 * t + 30 * (1 - t));
    const b = Math.round(11 * t + 60 * (1 - t));
    return `rgb(${r},${g},${b})`;
  };

  return (
    <div className="heatmapWrap">
      <table className="heatmap">
        <thead>
          <tr>
            <th></th>
            {hoursLabels.map((h, i) => (
              <th key={i}>{i % 3 === 0 ? h : ""}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, di) => (
            <tr key={di}>
              <th>{daysLabels[di]}</th>
              {row.map((v, hi) => (
                <td key={hi} style={{ background: cellColor(v) }} title={`${daysLabels[di]} ${hoursLabels[hi]}: ${v}`}>
                  {v > 0 ? v : ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
