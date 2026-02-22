// src/components/parkingPathfinding.js

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** Liang–Barsky segment-rect intersection (true if segment intersects rect). */
export function segmentIntersectsRect(p1, p2, rect, pad = 0) {
  const xMin = rect.left - pad;
  const yMin = rect.top - pad;
  const xMax = rect.left + rect.w + pad;
  const yMax = rect.top + rect.h + pad;

  const x1 = p1.x, y1 = p1.y;
  const x2 = p2.x, y2 = p2.y;

  const dx = x2 - x1;
  const dy = y2 - y1;

  let u1 = 0, u2 = 1;
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

function segmentClearOfSlots(a, b, slotRectsPx, pad) {
  for (const r of slotRectsPx) {
    if (segmentIntersectsRect(a, b, r, pad)) return false;
  }
  return true;
}

// ✅ same check, but ignore the selected slot (needed for pointer into the slot)
function segmentClearOfOtherSlots(a, b, slotRectsPx, selectedRectPx, pad) {
  for (const r of slotRectsPx) {
    if (r === selectedRectPx) continue;
    if (segmentIntersectsRect(a, b, r, pad)) return false;
  }
  return true;
}

/** Greedy line-of-sight simplification, only if the direct segment is 100% clear. */
function simplifyLineOfSight(points, slotRectsPx, pad) {
  if (!points || points.length <= 2) return points || [];
  const out = [];
  let i = 0;
  out.push(points[i]);

  while (i < points.length - 1) {
    let j = points.length - 1;
    while (j > i + 1) {
      if (segmentClearOfSlots(points[i], points[j], slotRectsPx, pad)) break;
      j--;
    }
    out.push(points[j]);
    i = j;
  }

  return out;
}

/* ---------- Grid helpers ---------- */

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

  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  while (q.length) {
    const [x, y] = q.shift();
    if (!blocked[key(x, y)]) return [x, y];

    for (const [dx, dy] of dirs) {
      const nx = x + dx, ny = y + dy;
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

  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];

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
      const nx = x + dx, ny = y + dy;
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

function cellsToPoints(pathCells, cell) {
  return pathCells.map(([cx, cy]) => ({
    x: cx * cell + cell / 2,
    y: cy * cell + cell / 2,
  }));
}

/**
 * Corridor fallback: tries 2-turn orthogonal path candidates and chooses shortest collision-free.
 */
function findOrthogonalCorridor(start, end, slotRectsPx, pad, w, h) {
  let best = null;

  const tryPath = (pts) => {
    const compact = [];
    for (const p of pts) {
      const last = compact[compact.length - 1];
      if (!last || last.x !== p.x || last.y !== p.y) compact.push(p);
    }

    for (let i = 0; i < compact.length - 1; i++) {
      if (!segmentClearOfSlots(compact[i], compact[i + 1], slotRectsPx, pad)) return;
    }

    const cost = compact.reduce((acc, p, i) => {
      if (i === 0) return 0;
      const q = compact[i - 1];
      return acc + Math.abs(p.x - q.x) + Math.abs(p.y - q.y);
    }, 0);

    if (!best || cost < best.cost) best = { path: compact, cost };
  };

  const step = 24;

  for (let y = 0; y <= h; y += step) {
    tryPath([start, { x: start.x, y }, { x: end.x, y }, end]);
  }
  for (let x = 0; x <= w; x += step) {
    tryPath([start, { x, y: start.y }, { x, y: end.y }, end]);
  }

  tryPath([start, { x: start.x, y: end.y }, end]);
  tryPath([start, { x: end.x, y: start.y }, end]);

  return best ? best.path : null;
}

/**
 * ✅ Adaptive route:
 * - Tries multiple (cell, gap) configs so route doesn't disappear.
 * - TO_SLOT prefers TOP approach and returns only if pointer-to-slot is valid.
 * Returns { path, start, end, pointerOk, slotStart? }
 */
export function computeSafeRoute({
  mode,
  stageW,
  stageH,
  slotRectsPx,
  entrancePoint,
  exitPoint,
  selectedRectPx,
  slotCenterPx,
  routeStroke = 6,
}) {
  if (!selectedRectPx || !slotCenterPx) return null;

  const attempts = [
    { cell: 6, safeGap: 12 },
    { cell: 8, safeGap: 10 },
    { cell: 10, safeGap: 8 },
    { cell: 12, safeGap: 6 },
  ];

  const attemptOnce = ({ cell, safeGap }) => {
    const pad = Math.ceil(routeStroke / 2 + safeGap);
    const grid = buildBlockedGrid(slotRectsPx, stageW, stageH, cell, pad);

    // keep approach outside the slot+padding so we can point into the slot cleanly
    const approach = Math.max(18, pad + 10);

    const buildAndValidate = (raw) => {
      for (let i = 0; i < raw.length - 1; i++) {
        if (!segmentClearOfSlots(raw[i], raw[i + 1], slotRectsPx, pad)) return null;
      }
      const simp = simplifyLineOfSight(raw, slotRectsPx, pad);
      for (let i = 0; i < simp.length - 1; i++) {
        if (!segmentClearOfSlots(simp[i], simp[i + 1], slotRectsPx, pad)) return null;
      }
      return simp;
    };

    // ✅ Try to end at exact approach point (goalRaw) to keep pointer straight.
    const maybeUseExactEnd = (pts, exactEnd) => {
      if (pts.length < 2) return pts;
      const prev = pts[pts.length - 2];
      // only replace if last hop is 100% clear
      if (segmentClearOfSlots(prev, exactEnd, slotRectsPx, pad)) {
        const copy = pts.slice(0, -1);
        copy.push(exactEnd);
        return copy;
      }
      return pts;
    };

    // ---------- TO_SLOT ----------
    if (mode === "TO_SLOT") {
      const startRaw = entrancePoint || { x: 16, y: 16 };
      const sCell = nearestFreeCell(
        grid,
        Math.floor(startRaw.x / cell),
        Math.floor(startRaw.y / cell)
      );
      const snappedStart = {
        x: sCell[0] * cell + cell / 2,
        y: sCell[1] * cell + cell / 2,
      };

      // slot true center (avoid any mismatch)
      const slotCx = selectedRectPx.left + selectedRectPx.w / 2;
      const slotCy = selectedRectPx.top + selectedRectPx.h / 2;

      // ✅ TOP-first candidates (only accept if pointer into slot doesn't cross other slots)
      const candidates = [
        // TOP (preferred)
        {
          name: "TOP",
          goalRaw: {
            x: clamp(slotCx, 0, stageW),
            y: clamp(selectedRectPx.top - approach, 0, stageH),
          },
        },
        // LEFT
        {
          name: "LEFT",
          goalRaw: {
            x: clamp(selectedRectPx.left - approach, 0, stageW),
            y: clamp(slotCy, 0, stageH),
          },
        },
        // RIGHT
        {
          name: "RIGHT",
          goalRaw: {
            x: clamp(selectedRectPx.left + selectedRectPx.w + approach, 0, stageW),
            y: clamp(slotCy, 0, stageH),
          },
        },
        // BOTTOM (last resort)
        {
          name: "BOTTOM",
          goalRaw: {
            x: clamp(slotCx, 0, stageW),
            y: clamp(selectedRectPx.top + selectedRectPx.h + approach, 0, stageH),
          },
        },
      ];

      for (const { goalRaw } of candidates) {
        const gCell = nearestFreeCell(
          grid,
          Math.floor(goalRaw.x / cell),
          Math.floor(goalRaw.y / cell)
        );
        const snappedEnd = {
          x: gCell[0] * cell + cell / 2,
          y: gCell[1] * cell + cell / 2,
        };

        const pathCells = aStar(grid, sCell, gCell);

        if (pathCells) {
          let pts = cellsToPoints(pathCells, cell);

          // use raw entrance only if first hop is safe
          pts[0] = segmentClearOfSlots(startRaw, pts[1] || snappedStart, slotRectsPx, pad)
            ? startRaw
            : snappedStart;

          // ✅ keep end aligned (prefer exact goalRaw if last hop is clear)
          pts[pts.length - 1] = snappedEnd;
          pts = maybeUseExactEnd(pts, goalRaw);

          const safe = buildAndValidate(pts);
          if (safe) {
            const endPt = safe[safe.length - 1];

            // ✅ IMPORTANT: only accept if pointer into slot is valid
            const pointerOk = segmentClearOfOtherSlots(
              endPt,
              slotCenterPx,
              slotRectsPx,
              selectedRectPx,
              pad
            );
            if (!pointerOk) continue;

            return { path: safe, start: safe[0], end: endPt, pointerOk };
          }
        }

        // corridor fallback for this goal
        const corridor = findOrthogonalCorridor(startRaw, snappedEnd, slotRectsPx, pad, stageW, stageH);
        if (corridor) {
          const corridor2 = maybeUseExactEnd(corridor, goalRaw);
          const safe2 = buildAndValidate(corridor2);
          if (safe2) {
            const endPt = safe2[safe2.length - 1];

            const pointerOk = segmentClearOfOtherSlots(
              endPt,
              slotCenterPx,
              slotRectsPx,
              selectedRectPx,
              pad
            );
            if (!pointerOk) continue;

            return { path: safe2, start: safe2[0], end: endPt, pointerOk };
          }
        }
      }

      return null;
    }

    // ---------- TO_EXIT ----------
    if (mode === "TO_EXIT") {
      const goalRaw = exitPoint || { x: stageW - 20, y: 20 };
      const gCell = nearestFreeCell(grid, Math.floor(goalRaw.x / cell), Math.floor(goalRaw.y / cell));
      const snappedEnd = { x: gCell[0] * cell + cell / 2, y: gCell[1] * cell + cell / 2 };

      const approach = Math.max(18, pad + 10);

      const startCandidates = [
        { x: clamp(slotCenterPx.x, 0, stageW), y: clamp(selectedRectPx.top - approach, 0, stageH) },
        { x: clamp(selectedRectPx.left + selectedRectPx.w + approach, 0, stageW), y: clamp(slotCenterPx.y, 0, stageH) },
        { x: clamp(selectedRectPx.left - approach, 0, stageW), y: clamp(slotCenterPx.y, 0, stageH) },
        { x: clamp(slotCenterPx.x, 0, stageW), y: clamp(selectedRectPx.top + selectedRectPx.h + approach, 0, stageH) },
      ];

      for (const startRaw of startCandidates) {
        // pointer from slot -> startRaw must not cross other slots
        const pointerOk = segmentClearOfOtherSlots(
          slotCenterPx,
          startRaw,
          slotRectsPx,
          selectedRectPx,
          pad
        );

        const sCell = nearestFreeCell(grid, Math.floor(startRaw.x / cell), Math.floor(startRaw.y / cell));
        const pathCells = aStar(grid, sCell, gCell);

        if (pathCells) {
          let pts = cellsToPoints(pathCells, cell);
          const snappedStart2 = { x: sCell[0] * cell + cell / 2, y: sCell[1] * cell + cell / 2 };

          pts[0] = snappedStart2;
          pts[pts.length - 1] = snappedEnd;
          pts = maybeUseExactEnd(pts, goalRaw);

          const safe = buildAndValidate([startRaw, ...pts.slice(1)]);
          if (safe) return { path: safe, start: safe[0], end: safe[safe.length - 1], pointerOk, slotStart: startRaw };
        }

        const corridor = findOrthogonalCorridor(startRaw, snappedEnd, slotRectsPx, pad, stageW, stageH);
        if (corridor) {
          const corridor2 = maybeUseExactEnd(corridor, goalRaw);
          const safe2 = buildAndValidate(corridor2);
          if (safe2) return { path: safe2, start: safe2[0], end: safe2[safe2.length - 1], pointerOk, slotStart: startRaw };
        }
      }

      return null;
    }

    return null;
  };

  for (const cfg of attempts) {
    const r = attemptOnce(cfg);
    if (r) return r;
  }

  return null;
}