"use client";

import { useCallback, useEffect, useRef } from "react";
import { useExtractStore } from "./store";
import SlideCard from "./SlideCard";

export default function CanvasViewport() {
  const pan = useExtractStore((s) => s.pan);
  const zoom = useExtractStore((s) => s.zoom);
  const cardOrder = useExtractStore((s) => s.cardOrder);
  const selectedCardId = useExtractStore((s) => s.selectedCardId);
  const setPan = useExtractStore((s) => s.setPan);
  const setZoom = useExtractStore((s) => s.setZoom);
  const selectCard = useExtractStore((s) => s.selectCard);
  const addCard = useExtractStore((s) => s.addCard);

  const viewportRef = useRef<HTMLDivElement>(null);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const panOrigin = useRef({ x: 0, y: 0 });
  const didDrag = useRef(false);

  // ---- Wheel → zoom toward cursor ----
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const rect = el!.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;

      const state = useExtractStore.getState();
      const oldZoom = state.zoom;
      // Smooth zoom: scale factor based on scroll delta magnitude
      const delta = Math.abs(e.deltaY);
      const step = Math.min(delta / 300, 0.06);
      const factor = e.deltaY > 0 ? 1 - step : 1 + step;
      const newZoom = Math.min(2.5, Math.max(0.25, oldZoom * factor));

      const newPanX =
        cursorX - (cursorX - state.pan.x) * (newZoom / oldZoom);
      const newPanY =
        cursorY - (cursorY - state.pan.y) * (newZoom / oldZoom);

      state.setZoom(newZoom);
      state.setPan({ x: newPanX, y: newPanY });
    }

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // ---- Mouse drag on empty canvas → pan ----
  const onMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Only start panning if the mousedown target is the viewport or transform div itself
      if (
        e.target !== viewportRef.current &&
        e.target !== viewportRef.current?.firstElementChild
      ) {
        return;
      }
      isPanning.current = true;
      didDrag.current = false;
      panStart.current = { x: e.clientX, y: e.clientY };
      panOrigin.current = { ...pan };
    },
    [pan],
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
        data-testid="canvas-transform"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "0 0",
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
