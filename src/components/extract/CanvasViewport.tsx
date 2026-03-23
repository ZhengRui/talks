"use client";

import { useCallback, useEffect, useRef } from "react";
import { useExtractStore } from "./store";
import SlideCard from "./SlideCard";

type LiveTransform = {
  x: number;
  y: number;
  zoom: number;
};

// ---------------------------------------------------------------------------
// Direct-DOM transform helpers — bypass React for smooth 120fps gestures
// ---------------------------------------------------------------------------

function applyTransform(
  viewport: HTMLElement | null,
  transform: HTMLElement | null,
  panX: number,
  panY: number,
  zoom: number,
) {
  if (transform) {
    transform.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
  }
  if (viewport) {
    const size = 20 * zoom;
    viewport.style.backgroundSize = `${size}px ${size}px`;
    viewport.style.backgroundPosition = `${panX % size}px ${panY % size}px`;
  }
}

function zoomTowardPoint(
  live: LiveTransform,
  clientX: number,
  clientY: number,
  deltaY: number,
  rect: DOMRect,
) {
  const cx = clientX - rect.left;
  const cy = clientY - rect.top;
  const oldZoom = live.zoom;
  const delta = Math.abs(deltaY);
  const step = Math.min(delta / 300, 0.06);
  const factor = deltaY > 0 ? 1 - step : 1 + step;
  const newZoom = Math.min(2.5, Math.max(0.25, oldZoom * factor));

  live.x = cx - (cx - live.x) * (newZoom / oldZoom);
  live.y = cy - (cy - live.y) * (newZoom / oldZoom);
  live.zoom = newZoom;
}

function isLikelyTrackpadWheel(e: WheelEvent) {
  if (e.deltaMode !== WheelEvent.DOM_DELTA_PIXEL) {
    return false;
  }

  if (Math.abs(e.deltaX) > 0) {
    return true;
  }

  if (!Number.isInteger(e.deltaY)) {
    return true;
  }

  return Math.abs(e.deltaY) < 16;
}

export default function CanvasViewport() {
  const pan = useExtractStore((s) => s.pan);
  const zoom = useExtractStore((s) => s.zoom);
  const cardOrder = useExtractStore((s) => s.cardOrder);
  const setPan = useExtractStore((s) => s.setPan);
  const selectCard = useExtractStore((s) => s.selectCard);

  const viewportRef = useRef<HTMLDivElement>(null);
  const transformRef = useRef<HTMLDivElement>(null);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const panOrigin = useRef({ x: 0, y: 0 });
  const didDrag = useRef(false);

  // Keep a mutable copy of pan/zoom so gesture handlers can read the
  // latest values without depending on React state.
  const liveRef = useRef({ x: pan.x, y: pan.y, zoom });
  liveRef.current = { x: pan.x, y: pan.y, zoom };

  // ---- Wheel: two-finger scroll → pan, pinch → zoom toward cursor ----
  // Writes directly to the DOM for instant feedback, then syncs React
  // state once per frame via rAF.
  const syncRaf = useRef(0);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    function syncState() {
      syncRaf.current = 0;
      const live = liveRef.current;
      const state = useExtractStore.getState();
      // Only update if values actually changed (avoids no-op re-renders)
      if (state.pan.x !== live.x || state.pan.y !== live.y) {
        state.setPan({ x: live.x, y: live.y });
      }
      if (state.zoom !== live.zoom) {
        state.setZoom(live.zoom);
      }
    }

    function scheduleSyncState() {
      if (!syncRaf.current) {
        syncRaf.current = requestAnimationFrame(syncState);
      }
    }

    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const live = liveRef.current;

      if (e.ctrlKey) {
        // Pinch gesture → zoom toward cursor
        zoomTowardPoint(
          live,
          e.clientX,
          e.clientY,
          e.deltaY,
          el.getBoundingClientRect(),
        );
      } else if (isLikelyTrackpadWheel(e)) {
        // Two-finger trackpad scroll → pan
        live.x -= e.deltaX;
        live.y -= e.deltaY;
      } else {
        // Mouse wheel and coarse wheel devices keep the original zoom behavior
        zoomTowardPoint(
          live,
          e.clientX,
          e.clientY,
          e.deltaY,
          el.getBoundingClientRect(),
        );
      }

      // Instant DOM update — no React in the loop
      applyTransform(viewportRef.current, transformRef.current, live.x, live.y, live.zoom);
      scheduleSyncState();
    }

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      if (syncRaf.current) cancelAnimationFrame(syncRaf.current);
    };
  }, []);

  // ---- Mouse drag on empty canvas → pan ----
  const onMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (
        e.target !== viewportRef.current &&
        e.target !== viewportRef.current?.firstElementChild
      ) {
        return;
      }
      isPanning.current = true;
      didDrag.current = false;
      panStart.current = { x: e.clientX, y: e.clientY };
      panOrigin.current = { ...liveRef.current };
    },
    [],
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isPanning.current) return;
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      if (Math.abs(dx) >= 3 || Math.abs(dy) >= 3) {
        didDrag.current = true;
      }
      setPan({
        x: panOrigin.current.x + dx,
        y: panOrigin.current.y + dy,
      });
    },
    [setPan],
  );

  const onMouseUp = useCallback(() => {
    if (!isPanning.current) return;
    isPanning.current = false;
    if (!didDrag.current) {
      selectCard(null);
    }
  }, [selectCard]);

  // ---- Cmd+V paste ----
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (!file) continue;
          const state = useExtractStore.getState();
          const id = state.addCard(file);
          state.selectCard(id);
          e.preventDefault();
          return;
        }
      }
    }

    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, []);

  const isEmpty = cardOrder.length === 0;

  return (
    <div
      ref={viewportRef}
      data-testid="canvas-viewport"
      className="overflow-hidden cursor-grab active:cursor-grabbing"
      style={{
        position: "absolute",
        inset: 0,
        backgroundColor: "#f0f0f0",
        backgroundImage: "radial-gradient(circle, #ccc 1px, transparent 1px)",
        backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
        backgroundPosition: `${pan.x % (20 * zoom)}px ${pan.y % (20 * zoom)}px`,
      }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      <div
        ref={transformRef}
        data-testid="canvas-transform"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "0 0",
          willChange: "transform",
          position: "relative",
          width: "100%",
          height: "100%",
        }}
      >
        {cardOrder.map((id) => (
          <SlideCard key={id} cardId={id} />
        ))}
      </div>

      {isEmpty && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <span className="text-[#999] text-lg">
            Paste an image (Cmd+V) to add slides
          </span>
        </div>
      )}
    </div>
  );
}
