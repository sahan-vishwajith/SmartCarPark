import React, { useEffect, useMemo, useRef, useState } from "react";
import slotsRaw from "./ss_with_entrance_exit.json";
import "./ParkingMap.css";

/* ---------- Pathfinding helpers (grid A*) ---------- */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function simplifyCollinear(points) {
  if (!points || points.length <= 2) return points;
  const out = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const a = out[out.length - 1];
    const b = points[i];
    const c = points[i + 1];
    const abx = b.x - a.x,
      aby = b.y - a.y;
    const bcx = c.x - b.x,
      bcy = c.y - b.y;
    if (abx * bcy - aby * bcx !== 0) out.push(b);
  }
  out.push(points[points.length - 1]);
  return out;
}

function buildBlockedGrid(rects, w, h, cell, padPx) {
  const gw = Math.ceil(w / cell);
  const gh = Math.ceil(h / cell);
  const blocked = new Uint8Array(gw * gh);

  const key = (x, y) => y * gw + x;
  const mark = (cx, cy) => {
    if (cx < 0 || cy < 0 || cx >= gw || cy >= gh) return;
    blocked[key(cx, cy)] = 1;
  };

  for (const r of rects) {
    const x0 = Math.max(0, r.left - padPx);
    const y0 = Math.max(0, r.top - padPx);
    const x1 = Math.min(w, r.left + r.w + padPx);
    const y1 = Math.min(h, r.top + r.h + padPx);

    const c0x = Math.floor(x0 / cell);
    const c0y = Math.floor(y0 / cell);
    const c1x = Math.floor(x1 / cell);
    const c1y = Math.floor(y1 / cell);

    for (let cy = c0y; cy <= c1y; cy++) {
      for (let cx = c0x; cx <= c1x; cx++) mark(cx, cy);
    }
  }

  return { gw, gh, blocked };
}

function nearestFreeCell(grid, startCx, startCy) {
  const { gw, gh, blocked } = grid;
  const inb = (x, y) => x >= 0 && y >= 0 && x < gw && y < gh;
  const key = (x, y) => y * gw + x;

  const sx = clamp(startCx, 0, gw - 1);
  const sy = clamp(startCy, 0, gh - 1);

  const q = [[sx, sy]];
  const seen = new Uint8Array(gw * gh);
  seen[key(sx, sy)] = 1;

  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  while (q.length) {
    const [x, y] = q.shift();
    if (!blocked[key(x, y)]) return [x, y];

    for (const [dx, dy] of dirs) {
      const nx = x + dx,
        ny = y + dy;
      if (!inb(nx, ny)) continue;
      const k = key(nx, ny);
      if (seen[k]) continue;
      seen[k] = 1;
      q.push([nx, ny]);
    }
  }
  return [sx, sy];
}

function aStar(grid, start, goal) {
  const { gw, gh, blocked } = grid;
  const key = (x, y) => y * gw + x;
  const inb = (x, y) => x >= 0 && y >= 0 && x < gw && y < gh;

  const startK = key(start[0], start[1]);
  const goalK = key(goal[0], goal[1]);
  if (blocked[startK] || blocked[goalK]) return null;

  const h = (x, y) => Math.abs(x - goal[0]) + Math.abs(y - goal[1]);

  const gScore = new Float32Array(gw * gh);
  gScore.fill(Infinity);
  gScore[startK] = 0;

  const came = new Int32Array(gw * gh);
  came.fill(-1);

  const open = [];
  open.push([start[0], start[1], h(start[0], start[1])]);

  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  while (open.length) {
    open.sort((a, b) => a[2] - b[2]);
    const [x, y] = open.shift();
    const k = key(x, y);

    if (k === goalK) {
      const path = [];
      let cur = k;
      while (cur !== -1) {
        const cy = Math.floor(cur / gw);
        const cx = cur - cy * gw;
        path.push([cx, cy]);
        cur = came[cur];
      }
      path.reverse();
      return path;
    }

    for (const [dx, dy] of dirs) {
      const nx = x + dx,
        ny = y + dy;
      if (!inb(nx, ny)) continue;
      const nk = key(nx, ny);
      if (blocked[nk]) continue;

      const tentative = gScore[k] + 1;
      if (tentative < gScore[nk]) {
        came[nk] = k;
        gScore[nk] = tentative;
        open.push([nx, ny, tentative + h(nx, ny)]);
      }
    }
  }

  return null;
}

/**
 * ✅ Reject routes where the final pointer line would cross other slot rectangles.
 * Liang–Barsky line-rect intersection.
 */
function segmentIntersectsRect(p1, p2, rect, pad = 0) {
  const xMin = rect.left - pad;
  const yMin = rect.top - pad;
  const xMax = rect.left + rect.w + pad;
  const yMax = rect.top + rect.h + pad;

  const x1 = p1.x,
    y1 = p1.y;
  const x2 = p2.x,
    y2 = p2.y;

  const dx = x2 - x1;
  const dy = y2 - y1;

  let u1 = 0,
    u2 = 1;
  const p = [-dx, dx, -dy, dy];
  const q = [x1 - xMin, xMax - x1, y1 - yMin, yMax - y1];

  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false;
    } else {
      const t = q[i] / p[i];
      if (p[i] < 0) u1 = Math.max(u1, t);
      else u2 = Math.min(u2, t);
      if (u1 > u2) return false;
    }
  }
  return true;
}

/* ---------- Component ---------- */
export default function ParkingMap({
  selectedSlotLabel = null,
  interactive = true,
  tracking = null,
  showRoute = false,
}) {
  const stageRef = useRef(null);

  const [slotState, setSlotState] = useState({});
  const [stageSize, setStageSize] = useState({ w: 1, h: 1 });

  const slots = useMemo(() => {
    return (Array.isArray(slotsRaw) ? slotsRaw : [])
      .filter((s) => s?.type === "slot" && s?.label && s?.position && s?.dimensions)
      .map((s) => ({
        type: "slot",
        id: s.id,
        label: String(s.label),
        position: { x: Number(s.position.x), y: Number(s.position.y) },
        dimensions: { width: Number(s.dimensions.width), height: Number(s.dimensions.height) },
        rotation: Number(s.rotation || 0),
        occupied: !!s.occupied,
        corners: s.corners || null,
      }));
  }, []);

  useEffect(() => {
    const initial = {};
    for (const s of slots) initial[s.label] = { occupied: !!s.occupied };
    setSlotState(initial);
  }, [slots]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;

    const update = () => setStageSize({ w: el.clientWidth || 1, h: el.clientHeight || 1 });
    update();

    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const getRect = (s) => {
    if (s.corners) {
      const pts = [s.corners.topLeft, s.corners.topRight, s.corners.bottomRight, s.corners.bottomLeft].filter(Boolean);
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      for (const p of pts) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      }
      return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    }
    return { x: s.position.x, y: s.position.y, w: s.dimensions.width, h: s.dimensions.height };
  };

  const bounds = useMemo(() => {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    for (const s of slots) {
      const r = getRect(s);
      minX = Math.min(minX, r.x);
      minY = Math.min(minY, r.y);
      maxX = Math.max(maxX, r.x + r.w);
      maxY = Math.max(maxY, r.y + r.h);
    }

    if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
      return { minX: 0, minY: 0, width: 1, height: 1 };
    }
    return { minX, minY, width: maxX - minX, height: maxY - minY };
  }, [slots]);

  const rotateRectLeft = (x, y, w, h) => ({
    x: y,
    y: bounds.width - (x + w),
    w: h,
    h: w,
  });

  const rotatedMapSize = useMemo(() => ({ width: bounds.height, height: bounds.width }), [bounds.width, bounds.height]);

  const padding = 18;
  const sx = (stageSize.w - padding * 2) / (rotatedMapSize.width || 1);
  const sy = (stageSize.h - padding * 2) / (rotatedMapSize.height || 1);
  const scale = Math.max(0.06, Math.min(sx, sy));

  const offsetX = padding + (stageSize.w - padding * 2 - rotatedMapSize.width * scale) / 2;
  const offsetY = padding + (stageSize.h - padding * 2 - rotatedMapSize.height * scale) / 2;

  const occLocal = (label) => !!slotState[label]?.occupied;

  const toggle = (label) => {
    if (!interactive) return;
    setSlotState((prev) => ({
      ...prev,
      [label]: { ...(prev[label] || {}), occupied: !prev[label]?.occupied },
    }));
  };

  const selectedSlot = useMemo(() => {
    if (!selectedSlotLabel) return null;
    return slots.find((s) => String(s.label) === String(selectedSlotLabel)) || null;
  }, [slots, selectedSlotLabel]);

  const entrancePoint = useMemo(() => {
    const entry = (Array.isArray(slotsRaw) ? slotsRaw : []).find((x) => x?.type === "entrance" && x?.position);
    if (!entry) return null;

    const px = Number(entry.position.x);
    const py = Number(entry.position.y);

    const nx = px - bounds.minX;
    const ny = py - bounds.minY;
    const rr = rotateRectLeft(nx, ny, 0, 0);

    return { x: offsetX + rr.x * scale, y: offsetY + rr.y * scale };
  }, [bounds.minX, bounds.minY, offsetX, offsetY, scale]);

  // pixel rects for obstacles
  const slotRectsPx = useMemo(() => {
    return slots.map((s) => {
      const r = getRect(s);
      const nx = r.x - bounds.minX;
      const ny = r.y - bounds.minY;
      const rr = rotateRectLeft(nx, ny, r.w, r.h);

      const left = offsetX + rr.x * scale;
      const top = offsetY + rr.y * scale;
      const w = rr.w * scale;
      const h = rr.h * scale;

      return { label: s.label, left, top, w, h };
    });
  }, [slots, bounds.minX, bounds.minY, offsetX, offsetY, scale]);

  // ✅ Route: MUST approach from TOP, never "cross from bottom"
  const routeModel = useMemo(() => {
    if (!showRoute || !selectedSlot || stageSize.w < 10 || stageSize.h < 10) return null;

    const stageW = stageSize.w;
    const stageH = stageSize.h;

    // ✅ start from TOP if no entrance defined
    const start = entrancePoint ? entrancePoint : { x: offsetX + 10, y: offsetY + 10 };

    const sel = slotRectsPx.find((r) => String(r.label) === String(selectedSlotLabel));
    if (!sel) return null;

    const slotCenter = { x: sel.left + sel.w / 2, y: sel.top + sel.h / 2 };

    const ROUTE_STROKE = 6;
    const END_R = 7;
    const CLEAR_PAD = Math.ceil(ROUTE_STROKE / 2 + END_R + 16);
    const cell = 10;

    const grid = buildBlockedGrid(slotRectsPx, stageW, stageH, cell, CLEAR_PAD);
    const sCell = nearestFreeCell(grid, Math.floor(start.x / cell), Math.floor(start.y / cell));

    const approach = Math.max(20, CLEAR_PAD);

    // ✅ ONLY TOP approach as primary
    const topCandidate = {
      x: clamp(slotCenter.x, 0, stageW),
      y: clamp(sel.top - approach, 0, stageH),
    };

    const tryBuild = (pathCells, end) => {
      if (!pathCells) return null;

      const pts = pathCells.map(([cx, cy]) => ({ x: cx * cell + cell / 2, y: cy * cell + cell / 2 }));
      pts[0] = start;
      pts[pts.length - 1] = end;

      // Reject if final pointer to center crosses another slot (prevents crossing P55 etc.)
      const pointerBad = slotRectsPx.some((r) => {
        if (String(r.label) === String(selectedSlotLabel)) return false;
        return segmentIntersectsRect(end, slotCenter, r, 6);
      });
      if (pointerBad) return null;

      return { path: simplifyCollinear(pts), end, slotCenter };
    };

    // 1) TOP
    {
      const g0 = [Math.floor(topCandidate.x / cell), Math.floor(topCandidate.y / cell)];
      const g = nearestFreeCell(grid, g0[0], g0[1]);
      const p = aStar(grid, sCell, g);
      const end = { x: g[0] * cell + cell / 2, y: g[1] * cell + cell / 2 };
      const model = tryBuild(p, end);
      if (model) return model;
    }

    // 2) fallback LEFT/RIGHT (still avoids invalid crossing)
    const fallbacks = [
      { x: clamp(sel.left - approach, 0, stageW), y: clamp(slotCenter.y, 0, stageH) }, // left
      { x: clamp(sel.left + sel.w + approach, 0, stageW), y: clamp(slotCenter.y, 0, stageH) }, // right
    ];

    for (const cand of fallbacks) {
      const g0 = [Math.floor(cand.x / cell), Math.floor(cand.y / cell)];
      const g = nearestFreeCell(grid, g0[0], g0[1]);
      const p = aStar(grid, sCell, g);
      const end = { x: g[0] * cell + cell / 2, y: g[1] * cell + cell / 2 };
      const model = tryBuild(p, end);
      if (model) return model;
    }

    // 3) last fallback
    const fallbackPts = simplifyCollinear([start, { x: slotCenter.x, y: start.y }, slotCenter]);
    return { path: fallbackPts, end: fallbackPts[fallbackPts.length - 1], slotCenter };
  }, [
    showRoute,
    selectedSlot,
    selectedSlotLabel,
    stageSize.w,
    stageSize.h,
    entrancePoint,
    offsetX,
    offsetY,
    slotRectsPx,
  ]);

  const isSelectedOccupiedLive = !!tracking?.slotOccupied;

  return (
    <div className="parkingWrap">
      <div className="parkingHead">
        <div className="parkingTitleBlock">
          <div className="parkingTitle">Parking</div>
          <div className="parkingSub">
            {slots.length} slots
            {interactive ? " • tap to toggle (demo)" : ""}
          </div>
        </div>

        <div className="parkingLegend">
          <div className="legendItem">
            <span className="dot free" /> Available
          </div>
          <div className="legendItem">
            <span className="dot occ" /> Occupied
          </div>
        </div>
      </div>

      <div className="stageOuter">
        <div className="jsonStage" ref={stageRef} style={{ position: "relative" }}>
          {/* ✅ Route overlay */}
          {showRoute && routeModel && (
            <svg className="routeOverlay" viewBox={`0 0 ${stageSize.w} ${stageSize.h}`}>
              <polyline
                className="routeMain"
                points={routeModel.path.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none"
                strokeWidth="6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle className="routeEnd" cx={routeModel.end.x} cy={routeModel.end.y} r="7" />
              <line
                className="routePointer"
                x1={routeModel.end.x}
                y1={routeModel.end.y}
                x2={routeModel.slotCenter.x}
                y2={routeModel.slotCenter.y}
              />
              <circle className="routeTarget" cx={routeModel.slotCenter.x} cy={routeModel.slotCenter.y} r="10" />
            </svg>
          )}

          {slots.map((s) => {
            const r = getRect(s);

            const nx = r.x - bounds.minX;
            const ny = r.y - bounds.minY;

            const rr = rotateRectLeft(nx, ny, r.w, r.h);

            const left = offsetX + rr.x * scale;
            const top = offsetY + rr.y * scale;
            const w = rr.w * scale;
            const h = rr.h * scale;

            const totalRot = (s.rotation || 0) - 90;

            const labelFont = Math.max(7, Math.min(11, Math.min(w, h) / 4.6));
            const borderRadius = Math.max(6, Math.min(12, Math.min(w, h) * 0.22));

            const isSelected = selectedSlotLabel && String(selectedSlotLabel) === String(s.label);
            const occupiedNow = isSelected ? (isSelectedOccupiedLive || occLocal(s.label)) : occLocal(s.label);

            return (
              <button
                key={s.id || s.label}
                type="button"
                className={`jsonSlot ${occupiedNow ? "occupied" : "free"} ${isSelected ? "selected" : ""} ${
                  isSelected && isSelectedOccupiedLive ? "liveOccupied" : ""
                }`}
                style={{
                  left,
                  top,
                  width: w,
                  height: h,
                  borderRadius,
                  ["--labelSize"]: `${labelFont}px`,
                }}
                title={`${s.label} • ${occupiedNow ? "Occupied" : "Available"}`}
                onClick={() => toggle(s.label)}
                disabled={!interactive}
              >
                <div className="slotPlate" style={{ transform: `rotate(${totalRot}deg)`, transformOrigin: "center center" }}>
                  <span className="jsonSlotLabel" style={{ transform: `rotate(${-totalRot}deg)`, transformOrigin: "center center" }}>
                    {s.label}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}