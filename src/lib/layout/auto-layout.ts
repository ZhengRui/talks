/**
 * Auto-layout engine for GroupElement.
 *
 * Walks an element tree and computes absolute rects for children of
 * groups that have a `layout` property (flex or grid).
 *
 * Immutable: returns new element objects — input is never mutated.
 */

import type {
  LayoutElement,
  GroupElement,
  FlexLayout,
  GridLayout,
  Rect,
} from "./types";

// ---------------------------------------------------------------------------
// Padding helper
// ---------------------------------------------------------------------------

interface Padding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

function resolvePadding(
  p?: number | [number, number, number, number],
): Padding {
  if (p === undefined) return { top: 0, right: 0, bottom: 0, left: 0 };
  if (typeof p === "number")
    return { top: p, right: p, bottom: p, left: p };
  return { top: p[0], right: p[1], bottom: p[2], left: p[3] };
}

// ---------------------------------------------------------------------------
// Flex layout
// ---------------------------------------------------------------------------

function resolveFlexRow(
  children: LayoutElement[],
  groupRect: Rect,
  layout: FlexLayout,
): LayoutElement[] {
  // When wrap is enabled, split children into rows and lay out each row
  if (layout.wrap) {
    return resolveFlexRowWrap(children, groupRect, layout);
  }

  return resolveFlexRowSingle(children, groupRect, layout);
}

/** Wrap mode: split children into rows when they overflow container width. */
function resolveFlexRowWrap(
  children: LayoutElement[],
  groupRect: Rect,
  layout: FlexLayout,
): LayoutElement[] {
  const pad = resolvePadding(layout.padding);
  const gap = layout.gap ?? 0;
  const innerW = groupRect.w - pad.left - pad.right;

  // Split children into rows based on explicit widths
  // Children without explicit width get equal share of the row they end up in
  const rows: LayoutElement[][] = [];
  let currentRow: LayoutElement[] = [];
  let currentRowW = 0;

  for (const child of children) {
    const childW = child.rect.w > 0 ? child.rect.w : 0;
    const gapW = currentRow.length > 0 ? gap : 0;
    if (currentRow.length > 0 && currentRowW + gapW + childW > innerW) {
      rows.push(currentRow);
      currentRow = [child];
      currentRowW = childW;
    } else {
      currentRow.push(child);
      currentRowW += gapW + childW;
    }
  }
  if (currentRow.length > 0) rows.push(currentRow);

  // Lay out each row, stacking vertically using content height (tallest child per row)
  const result: LayoutElement[] = [];
  let cursorY = pad.top;

  for (const row of rows) {
    // Row height = tallest child's explicit height (fall back to 0)
    const rowH = Math.max(...row.map((c) => (c.rect.h > 0 ? c.rect.h : 0)), 0);
    // Create a virtual sub-rect for this row
    const rowRect: Rect = { x: groupRect.x, y: groupRect.y, w: groupRect.w, h: rowH + pad.top + pad.bottom };
    const rowLayout: FlexLayout = { ...layout, wrap: false, padding: [0, pad.right, 0, pad.left] };
    const laidOut = resolveFlexRowSingle(row, rowRect, rowLayout);

    // Offset by row's Y position
    for (const el of laidOut) {
      result.push({ ...el, rect: { ...el.rect, y: el.rect.y + cursorY } });
    }
    cursorY += rowH + gap;
  }

  return result;
}

function resolveFlexRowSingle(
  children: LayoutElement[],
  groupRect: Rect,
  layout: FlexLayout,
): LayoutElement[] {
  const pad = resolvePadding(layout.padding);
  const gap = layout.gap ?? 0;
  const innerW = groupRect.w - pad.left - pad.right;
  const innerH = groupRect.h - pad.top - pad.bottom;
  const align = layout.align ?? "start";
  const justify = layout.justify ?? "start";

  // Measure children on main axis (width)
  let totalExplicitW = 0;
  let autoCount = 0;
  for (const child of children) {
    if (child.rect.w > 0) {
      totalExplicitW += child.rect.w;
    } else {
      autoCount++;
    }
  }

  const totalGap = (children.length - 1) * gap;
  const autoW =
    autoCount > 0
      ? (innerW - totalExplicitW - totalGap) / autoCount
      : 0;

  // Assign widths
  const widths = children.map((c) => (c.rect.w > 0 ? c.rect.w : autoW));

  // Compute total content width (for justify calculations)
  const totalContentW =
    widths.reduce((sum, w) => sum + w, 0) + totalGap;

  // Compute x positions based on justify
  const xPositions: number[] = [];

  switch (justify) {
    case "center": {
      const offset = (innerW - totalContentW) / 2;
      let x = pad.left + offset;
      for (let i = 0; i < children.length; i++) {
        xPositions.push(x);
        x += widths[i] + gap;
      }
      break;
    }
    case "end": {
      const offset = innerW - totalContentW;
      let x = pad.left + offset;
      for (let i = 0; i < children.length; i++) {
        xPositions.push(x);
        x += widths[i] + gap;
      }
      break;
    }
    case "space-between": {
      if (children.length <= 1) {
        xPositions.push(pad.left);
      } else {
        const totalItemW = widths.reduce((s, w) => s + w, 0);
        const spaceBetween =
          (innerW - totalItemW) / (children.length - 1);
        let x = pad.left;
        for (let i = 0; i < children.length; i++) {
          xPositions.push(x);
          x += widths[i] + spaceBetween;
        }
      }
      break;
    }
    case "space-around": {
      const totalItemW = widths.reduce((s, w) => s + w, 0);
      const spaceAround =
        (innerW - totalItemW) / children.length;
      let x = pad.left + spaceAround / 2;
      for (let i = 0; i < children.length; i++) {
        xPositions.push(x);
        x += widths[i] + spaceAround;
      }
      break;
    }
    default: {
      // "start"
      let x = pad.left;
      for (let i = 0; i < children.length; i++) {
        xPositions.push(x);
        x += widths[i] + gap;
      }
      break;
    }
  }

  // Compute y positions and heights based on align (cross-axis)
  return children.map((child, i) => {
    const childH =
      align === "stretch"
        ? innerH
        : child.rect.h > 0
          ? child.rect.h
          : innerH;

    let y: number;
    switch (align) {
      case "center":
        y = pad.top + (innerH - childH) / 2;
        break;
      case "end":
        y = pad.top + innerH - childH;
        break;
      case "stretch":
      case "start":
      default:
        y = pad.top;
        break;
    }

    return {
      ...child,
      rect: { x: xPositions[i], y, w: widths[i], h: childH },
    };
  });
}

function resolveFlexColumn(
  children: LayoutElement[],
  groupRect: Rect,
  layout: FlexLayout,
): LayoutElement[] {
  const pad = resolvePadding(layout.padding);
  const gap = layout.gap ?? 0;
  const innerW = groupRect.w - pad.left - pad.right;
  const innerH = groupRect.h - pad.top - pad.bottom;
  const align = layout.align ?? "start";
  const justify = layout.justify ?? "start";

  // Measure children on main axis (height)
  let totalExplicitH = 0;
  let autoCount = 0;
  for (const child of children) {
    if (child.rect.h > 0) {
      totalExplicitH += child.rect.h;
    } else {
      autoCount++;
    }
  }

  const totalGap = (children.length - 1) * gap;
  const autoH =
    autoCount > 0
      ? (innerH - totalExplicitH - totalGap) / autoCount
      : 0;

  // Assign heights
  const heights = children.map((c) => (c.rect.h > 0 ? c.rect.h : autoH));

  // Compute total content height
  const totalContentH =
    heights.reduce((sum, h) => sum + h, 0) + totalGap;

  // Compute y positions based on justify
  const yPositions: number[] = [];

  switch (justify) {
    case "center": {
      const offset = (innerH - totalContentH) / 2;
      let y = pad.top + offset;
      for (let i = 0; i < children.length; i++) {
        yPositions.push(y);
        y += heights[i] + gap;
      }
      break;
    }
    case "end": {
      const offset = innerH - totalContentH;
      let y = pad.top + offset;
      for (let i = 0; i < children.length; i++) {
        yPositions.push(y);
        y += heights[i] + gap;
      }
      break;
    }
    case "space-between": {
      if (children.length <= 1) {
        yPositions.push(pad.top);
      } else {
        const totalItemH = heights.reduce((s, h) => s + h, 0);
        const spaceBetween =
          (innerH - totalItemH) / (children.length - 1);
        let y = pad.top;
        for (let i = 0; i < children.length; i++) {
          yPositions.push(y);
          y += heights[i] + spaceBetween;
        }
      }
      break;
    }
    case "space-around": {
      const totalItemH = heights.reduce((s, h) => s + h, 0);
      const spaceAround =
        (innerH - totalItemH) / children.length;
      let y = pad.top + spaceAround / 2;
      for (let i = 0; i < children.length; i++) {
        yPositions.push(y);
        y += heights[i] + spaceAround;
      }
      break;
    }
    default: {
      // "start"
      let y = pad.top;
      for (let i = 0; i < children.length; i++) {
        yPositions.push(y);
        y += heights[i] + gap;
      }
      break;
    }
  }

  // Compute x positions and widths based on align (cross-axis)
  return children.map((child, i) => {
    const childW =
      align === "stretch"
        ? innerW
        : child.rect.w > 0
          ? child.rect.w
          : innerW;

    let x: number;
    switch (align) {
      case "center":
        x = pad.left + (innerW - childW) / 2;
        break;
      case "end":
        x = pad.left + innerW - childW;
        break;
      case "stretch":
      case "start":
      default:
        x = pad.left;
        break;
    }

    return {
      ...child,
      rect: { x, y: yPositions[i], w: childW, h: heights[i] },
    };
  });
}

function resolveFlex(
  children: LayoutElement[],
  groupRect: Rect,
  layout: FlexLayout,
): LayoutElement[] {
  if (layout.direction === "column") {
    return resolveFlexColumn(children, groupRect, layout);
  }
  return resolveFlexRow(children, groupRect, layout);
}

// ---------------------------------------------------------------------------
// Grid layout
// ---------------------------------------------------------------------------

function resolveGrid(
  children: LayoutElement[],
  groupRect: Rect,
  layout: GridLayout,
): LayoutElement[] {
  const pad = resolvePadding(layout.padding);
  const innerW = groupRect.w - pad.left - pad.right;
  const colGap = layout.columnGap ?? layout.gap ?? 0;
  const rowGap = layout.rowGap ?? layout.gap ?? 0;
  const columns = layout.columns;

  const colW = (innerW - (columns - 1) * colGap) / columns;

  // Group children into rows
  const rows: LayoutElement[][] = [];
  for (let i = 0; i < children.length; i += columns) {
    rows.push(children.slice(i, i + columns));
  }

  const result: LayoutElement[] = [];
  let cursorY = pad.top;

  for (const row of rows) {
    // Row height = max explicit height among children, or 0 if none are explicit
    let rowH = 0;
    for (const child of row) {
      if (child.rect.h > 0) {
        rowH = Math.max(rowH, child.rect.h);
      }
    }
    // If no child has explicit height, use a default based on remaining space
    // For now, if all are zero we'll leave them at 0 (the consumer should set heights)
    // Actually, let's give them equal share of remaining vertical space
    if (rowH === 0) {
      const innerH = groupRect.h - pad.top - pad.bottom;
      const totalRowGap = (rows.length - 1) * rowGap;
      rowH = (innerH - totalRowGap) / rows.length;
    }

    for (let colIdx = 0; colIdx < row.length; colIdx++) {
      const child = row[colIdx];
      result.push({
        ...child,
        rect: {
          x: pad.left + colIdx * (colW + colGap),
          y: cursorY,
          w: colW,
          h: child.rect.h > 0 ? child.rect.h : rowH,
        },
      });
    }

    cursorY += rowH + rowGap;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Walk an element tree and resolve auto-layout groups.
 *
 * For each GroupElement with a `layout` property, children's rects are
 * recomputed according to the flex/grid rules. Nested layout groups are
 * resolved top-down: the parent layout assigns rects to children first,
 * then child groups are recursively resolved using their newly-assigned
 * rects.
 *
 * Returns a new array — input elements are never mutated.
 */
export function resolveLayouts(
  elements: LayoutElement[],
): LayoutElement[] {
  return elements.map((el) => {
    if (el.kind !== "group") return el;

    const group = el as GroupElement;

    if (!group.layout) {
      // No layout mode — just recurse into children for nested groups
      return { ...group, children: resolveLayouts(group.children) };
    }

    // Step 1: Apply this group's layout to assign rects to direct children
    let laidOut: LayoutElement[];
    if (group.layout.type === "flex") {
      laidOut = resolveFlex(group.children, group.rect, group.layout);
    } else {
      laidOut = resolveGrid(group.children, group.rect, group.layout);
    }

    // Step 2: Recursively resolve any child groups (now that they have rects)
    laidOut = resolveLayouts(laidOut);

    return { ...group, children: laidOut };
  });
}
