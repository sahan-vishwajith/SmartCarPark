import React, { useEffect, useMemo, useRef, useState } from "react";
import slotsRaw from "./ss_with_entrance_exit.json";
import "./ParkingMap.css";
import { computeSafeRoute } from "./parkingPathfinding";

export default function ParkingMap({
  selectedSlotLabel = null,
  interactive = true,
  tracking = null,
  showRoute = false,
  navigation = null, // {show, mode:"TO_SLOT"|"TO_EXIT", color}
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
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
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
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
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

  const rotatedMapSize = useMemo(
    () => ({ width: bounds.height, height: bounds.width }),
    [bounds.width, bounds.height]
  );

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

  const entrancePoint = useMemo(() => {
    const entry = (Array.isArray(slotsRaw) ? slotsRaw : []).find((x) => x?.type === "entrance" && x?.position);
    if (!entry) return null;
    const px = Number(entry.position.x);
    const py = Number(entry.position.y);
    const nx = px - bounds.minX;
    const ny = py - bounds.minY;
    const rr = rotateRectLeft(nx, ny, 0, 0);
    return { x: offsetX + rr.x * scale, y: offsetY + rr.y * scale };
  }, [bounds.minX, bounds.minY, bounds.width, offsetX, offsetY, scale]);

  const exitPoint = useMemo(() => {
    const ex = (Array.isArray(slotsRaw) ? slotsRaw : []).find((x) => x?.type === "exit" && x?.position);
    if (!ex) return null;
    const px = Number(ex.position.x);
    const py = Number(ex.position.y);
    const nx = px - bounds.minX;
    const ny = py - bounds.minY;
    const rr = rotateRectLeft(nx, ny, 0, 0);
    return { x: offsetX + rr.x * scale, y: offsetY + rr.y * scale };
  }, [bounds.minX, bounds.minY, bounds.width, offsetX, offsetY, scale]);

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
  }, [slots, bounds.minX, bounds.minY, bounds.width, offsetX, offsetY, scale]);

  const navShow = navigation ? navigation.show !== false : showRoute;
  const navMode = navigation?.mode || "TO_SLOT";
  const routeColor = useMemo(() => {
    if (navigation?.color) return navigation.color;
    return tracking?.driverArrived ? "#ff4d4f" : "#22c55e";
  }, [navigation?.color, tracking?.driverArrived]);

  const selectedRectPx = useMemo(() => {
    if (!selectedSlotLabel) return null;
    return slotRectsPx.find((r) => String(r.label) === String(selectedSlotLabel)) || null;
  }, [slotRectsPx, selectedSlotLabel]);

  const slotCenterPx = useMemo(() => {
    if (!selectedRectPx) return null;
    return { x: selectedRectPx.left + selectedRectPx.w / 2, y: selectedRectPx.top + selectedRectPx.h / 2 };
  }, [selectedRectPx]);

  const routeModel = useMemo(() => {
    if (!navShow || !selectedRectPx || !slotCenterPx || stageSize.w < 10 || stageSize.h < 10) return null;

    return computeSafeRoute({
      mode: navMode,
      stageW: stageSize.w,
      stageH: stageSize.h,
      slotRectsPx,
      entrancePoint,
      exitPoint,
      selectedRectPx,
      slotCenterPx,
      routeStroke: 6,
    });
  }, [navShow, navMode, stageSize.w, stageSize.h, slotRectsPx, entrancePoint, exitPoint, selectedRectPx, slotCenterPx]);

  const isSelectedOccupiedLive = !!tracking?.slotOccupied;
  const shouldShowOverlay = Boolean(entrancePoint || exitPoint || navShow);

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
          {shouldShowOverlay && (
            <svg className="routeOverlay" viewBox={`0 0 ${stageSize.w} ${stageSize.h}`}>
              {/* POIs always */}
              {entrancePoint && (
                <g className="poi poiEntrance">
                  <circle className="poiCircle" cx={entrancePoint.x} cy={entrancePoint.y} r="9" />
                  <text className="poiLetter" x={entrancePoint.x} y={entrancePoint.y + 4} textAnchor="middle">E</text>
                  <text className="poiLabel" x={entrancePoint.x + 14} y={entrancePoint.y + 5}>ENTRANCE</text>
                </g>
              )}

              {exitPoint && (
                <g className="poi poiExit">
                  <circle className="poiCircle" cx={exitPoint.x} cy={exitPoint.y} r="9" />
                  <text className="poiLetter" x={exitPoint.x} y={exitPoint.y + 4} textAnchor="middle">X</text>
                  <text className="poiLabel" x={exitPoint.x + 14} y={exitPoint.y + 5}>EXIT</text>
                </g>
              )}

              {/* Route */}
              {navShow && routeModel && (
                <>
                  <polyline
                    className="routeMain"
                    points={routeModel.path.map((p) => `${p.x},${p.y}`).join(" ")}
                    fill="none"
                    stroke={routeColor}
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle className="routeEnd" cx={routeModel.end.x} cy={routeModel.end.y} r="7" fill={routeColor} />

                  {/* ✅ Pointer only if safe */}
                  {navMode === "TO_SLOT" && slotCenterPx && routeModel.pointerOk && (
                    <>
                      <line
                        className="routePointer"
                        x1={routeModel.end.x}
                        y1={routeModel.end.y}
                        x2={slotCenterPx.x}
                        y2={slotCenterPx.y}
                        stroke={routeColor}
                      />
                      <circle className="routeTarget" cx={slotCenterPx.x} cy={slotCenterPx.y} r="10" stroke={routeColor} />
                    </>
                  )}

                  {/* ✅ TO_EXIT pointer (optional) */}
                  {navMode === "TO_EXIT" && routeModel.slotStart && routeModel.pointerOk && slotCenterPx && (
                    <line
                      className="routePointer"
                      x1={slotCenterPx.x}
                      y1={slotCenterPx.y}
                      x2={routeModel.slotStart.x}
                      y2={routeModel.slotStart.y}
                      stroke={routeColor}
                    />
                  )}
                </>
              )}
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
                <div className="slotPlate" style={{ transform: `rotate(${totalRot}deg)` }}>
                  <span className="jsonSlotLabel" style={{ transform: `rotate(${-totalRot}deg)` }}>
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