import React, { useEffect, useMemo, useRef, useState } from "react";
import slotsRaw from "./ss.json";
import "./ParkingMap.css";

export default function ParkingMap({
  selectedSlotLabel = null,
  interactive = true,
}) {
  const stageRef = useRef(null);

  const [slotState, setSlotState] = useState({});
  const [stageSize, setStageSize] = useState({ w: 1, h: 1 });

  // ✅ Normalize slots from JSON
  const slots = useMemo(() => {
    return (Array.isArray(slotsRaw) ? slotsRaw : [])
      .filter(
        (s) =>
          s?.type === "slot" && s?.label && s?.position && s?.dimensions
      )
      .map((s) => ({
        type: "slot",
        id: s.id,
        label: String(s.label),
        position: { x: Number(s.position.x), y: Number(s.position.y) },
        dimensions: {
          width: Number(s.dimensions.width),
          height: Number(s.dimensions.height),
        },
        rotation: Number(s.rotation || 0),
        occupied: !!s.occupied,
        corners: s.corners || null,
      }));
  }, []);

  // init occupied/free from JSON
  useEffect(() => {
    const initial = {};
    for (const s of slots) initial[s.label] = { occupied: !!s.occupied };
    setSlotState(initial);
  }, [slots]);

  // ResizeObserver for stage
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;

    const update = () =>
      setStageSize({ w: el.clientWidth || 1, h: el.clientHeight || 1 });
    update();

    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Rect from corners if available (better for rotated geometry)
  const getRect = (s) => {
    if (s.corners) {
      const pts = [
        s.corners.topLeft,
        s.corners.topRight,
        s.corners.bottomRight,
        s.corners.bottomLeft,
      ].filter(Boolean);

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

    return {
      x: s.position.x,
      y: s.position.y,
      w: s.dimensions.width,
      h: s.dimensions.height,
    };
  };

  // ✅ Original bounds (unrotated)
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

  // ✅ Rotate entire map LEFT by 90° in local-bounds space
  // newX = y
  // newY = bounds.width - (x + w)
  // newW = h
  // newH = w
  const rotateRectLeft = (x, y, w, h) => ({
    x: y,
    y: bounds.width - (x + w),
    w: h,
    h: w,
  });

  // ✅ After 90° left: new map width = old height, new map height = old width
  const rotatedMapSize = useMemo(
    () => ({
      width: bounds.height,
      height: bounds.width,
    }),
    [bounds.width, bounds.height]
  );

  // ✅ Fit-to-container scale (mobile friendly)
  const padding = 18;
  const sx =
    (stageSize.w - padding * 2) / (rotatedMapSize.width || 1);
  const sy =
    (stageSize.h - padding * 2) / (rotatedMapSize.height || 1);
  const scale = Math.max(0.06, Math.min(sx, sy));

  const offsetX =
    padding +
    (stageSize.w - padding * 2 - rotatedMapSize.width * scale) / 2;
  const offsetY =
    padding +
    (stageSize.h - padding * 2 - rotatedMapSize.height * scale) / 2;

  const occ = (label) => !!slotState[label]?.occupied;

  const toggle = (label) => {
    if (!interactive) return;
    setSlotState((prev) => ({
      ...prev,
      [label]: {
        ...(prev[label] || {}),
        occupied: !prev[label]?.occupied,
      },
    }));
  };

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

      {/* ✅ Scroll + pinch friendly on mobile */}
      <div className="stageOuter">
        <div className="jsonStage" ref={stageRef}>
          {slots.map((s) => {
            const r = getRect(s);

            // normalize into local bounds
            const nx = r.x - bounds.minX;
            const ny = r.y - bounds.minY;

            // rotate whole map left
            const rr = rotateRectLeft(nx, ny, r.w, r.h);

            const left = offsetX + rr.x * scale;
            const top = offsetY + rr.y * scale;
            const w = rr.w * scale;
            const h = rr.h * scale;

            // slot rotation corrected because map rotated
            const totalRot = (s.rotation || 0) - 90;

            const labelFont = Math.max(
              7,
              Math.min(11, Math.min(w, h) / 4.6)
            );
            const borderRadius = Math.max(
              6,
              Math.min(12, Math.min(w, h) * 0.22)
            );

            const isSelected =
              selectedSlotLabel &&
              String(selectedSlotLabel) === String(s.label);

            return (
              <button
                key={s.id || s.label}
                type="button"
                className={`jsonSlot ${
                  occ(s.label) ? "occupied" : "free"
                } ${isSelected ? "selected" : ""}`}
                style={{
                  left,
                  top,
                  width: w,
                  height: h,
                  borderRadius,
                  ["--labelSize"]: `${labelFont}px`,
                }}
                title={`${s.label} • ${
                  occ(s.label) ? "Occupied" : "Available"
                }`}
                onClick={() => toggle(s.label)}
                disabled={!interactive}
              >
                <div
                  className="slotPlate"
                  style={{
                    transform: `rotate(${totalRot}deg)`,
                    transformOrigin: "center center",
                  }}
                >
                  <span
                    className="jsonSlotLabel"
                    style={{
                      transform: `rotate(${-totalRot}deg)`,
                      transformOrigin: "center center",
                    }}
                  >
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
