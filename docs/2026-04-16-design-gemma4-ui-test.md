# Gemma 4 UI Detection Test Workbench — Design

**Date:** 2026-04-16
**Status:** Throwaway test UI (scratch-quality, not a production feature)
**Parent track:** SAM3 / geometry-augmentation backlog (`docs/plans/2026-04-09-extract-refine-backlog.md`, Track 2)

## Goal

Build a minimal web UI to empirically test Gemma 4's ability to detect UI elements on a slide image: return a list of elements with bounding boxes + per-element descriptions + an overall slide description. Bounding boxes must be displayed in the original image coordinate system.

The UI is a quick throwaway for probing Gemma 4's vision quality on slide-type inputs. If results are promising, this informs whether Gemma 4 is a viable geometry-augmentation signal alongside or instead of SAM3.

## Non-Goals

- Not a production feature. No auth, no rate limit, no persistence, no tests.
- No integration with `/workbench/extract` or the refine loop.
- No provider abstraction — direct Gemma-only calls.
- No prompt editor in the UI (edit in source).
- No drag-and-drop (paste + upload cover our needs).

## User flow

1. Open `/workbench/gemma-test` in the dev server.
2. Either Cmd+V an image from the clipboard, or click "Upload" to pick a file.
3. Select the model (default `gemma-4-31b-it`, alternative `gemma-4-26b-a4b-it`).
4. Click Run.
5. See:
   - The image with numbered bounding boxes drawn as overlays.
   - An "Overall" description above an "Elements" list (numbered to match boxes).
   - A raw JSON panel with the full response for copy/inspect.

## Architecture

### Route layout

- `src/app/workbench/gemma-test/page.tsx` — client-only page, all interaction.
- `src/app/api/gemma-detect/route.ts` — server route that proxies to Google AI.

### Client (`page.tsx`)

- Single-file React component, no state library.
- Local state:
  - `imageBlob: Blob | null`
  - `imageDims: { width: number; height: number } | null`
  - `model: "gemma-4-31b-it" | "gemma-4-26b-a4b-it"`
  - `result: DetectResponse | null`
  - `loading: boolean`
  - `error: string | null`
- Event handlers:
  - `document.addEventListener("paste", ...)` — reads `ClipboardItem` with image MIME, sets `imageBlob`.
  - File input `onChange` — sets `imageBlob`.
- Render:
  - Left column: `<canvas>` with the image + bbox overlays (drawn in a `useEffect`).
  - Right column: model select, Run button, overall description, element list, raw JSON block.

### Server (`route.ts`)

- POST handler, `multipart/form-data` input: `image` (File) + `model` (string).
- Flow:
  1. Read image bytes from the form data.
  2. Use `sharp(buffer).metadata()` to get original `width`/`height` — needed later for bbox conversion.
  3. Call `@google/genai`:
     ```ts
     const client = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY! });
     const response = await client.models.generateContent({
       model,
       contents: [
         { inlineData: { data: b64, mimeType: file.type } },
         { text: PROMPT },
       ],
     });
     ```
  4. Extract text, strip code fences if present, `JSON.parse`.
  5. Convert each `box_2d: [y1, x1, y2, x2]` from 1000×1000 normalized → original-pixel `{ x, y, width, height }`:
     ```
     x      = x1 / 1000 * imageWidth
     y      = y1 / 1000 * imageHeight
     width  = (x2 - x1) / 1000 * imageWidth
     height = (y2 - y1) / 1000 * imageHeight
     ```
  6. Return JSON: `{ overall, elements: [{ label, description, bbox }], raw, imageWidth, imageHeight }`.

### Prompt

```
Analyze this slide image. Return strict JSON with this exact shape:

{
  "overall_description": "one-paragraph summary of the slide",
  "elements": [
    {
      "box_2d": [y1, x1, y2, x2],
      "label": "short noun phrase",
      "description": "one sentence about this element"
    }
  ]
}

Coordinates are normalized to 1000x1000 relative to the input image.
Detect every distinct UI element: text blocks, headings, icons, shapes,
images, buttons, background panels.
Return ONLY the JSON, no prose, no code fences.
```

### Coordinate conversion

Gemma 4's documented output is `[y1, x1, y2, x2]` on a 1000×1000 grid. This is TF-style (ymin, xmin, ymax, xmax), not COCO. The conversion formula above handles both the format flip (y/x swap) and the 1000→original scaling.

If the conversion is off-by-many-pixels, the likely cause is model non-compliance with the grid convention — we'll spot it visually in the canvas overlay and adjust.

## Data contract

```ts
type BBox = { x: number; y: number; width: number; height: number };

type DetectElement = {
  label: string;
  description: string;
  bbox: BBox;           // original-pixel coords
  raw_box_2d: [number, number, number, number]; // preserved for debugging
};

type DetectResponse = {
  overall: string;
  elements: DetectElement[];
  imageWidth: number;
  imageHeight: number;
  raw: unknown;         // full parsed Gemma JSON, for the raw panel
};
```

## Error handling

Only what's needed for a scratch UI:

- Missing `GOOGLE_API_KEY` → 500 with a clear message; client shows it in the error slot.
- Gemma returns non-JSON (prose with no parseable block) → 502, message "Gemma did not return parseable JSON", raw text shown in UI.
- Image too large (> 20 MB) → 413.
- All other errors → 500 with the underlying message.

No retries. No circuit breakers.

## Dependencies

- New dep: `@google/genai` (regular dependency, not dev — server route uses it).
- Existing dep reuse: `sharp` (already used in extract pipeline).

## Env

- `.env.local` must have `GOOGLE_API_KEY=...`.
- Document this in a one-line comment in the route file.

## Visual design (minimal)

- Tailwind styling, matches the extract workbench visual tone.
- Canvas max-width `min(100%, 1920px)`.
- BBox colors cycle through a fixed palette (6 colors) by index.
- Each bbox has a small numbered label tag at its top-left.
- Clicking a list item flashes the matching bbox (nice-to-have; drop if it inflates scope).

## Testing strategy

None. This is a scratch UI. Visual inspection only. If Gemma 4's results look promising, the follow-up task will be to build a proper provider module in `src/lib/extract/` with vitest coverage (separate plan).

## Scope summary

| File | LOC estimate | Purpose |
|---|---|---|
| `src/app/workbench/gemma-test/page.tsx` | ~200 | Client UI (paste, upload, canvas, JSON panel) |
| `src/app/api/gemma-detect/route.ts` | ~80 | Server proxy to Gemma, bbox normalization |
| `package.json` | 1 line | Add `@google/genai` |
| `.env.local` | 1 line | `GOOGLE_API_KEY` |

## Open questions (defer until first run)

- Does Gemma 4 reliably emit `[y1,x1,y2,x2]` or does it ever flip to `[x1,y1,x2,y2]`? (We'll see visually.)
- Does 31B do materially better than 26B A4B on slide-style content? (This is what the UI lets us probe.)
- What's the right prompt for compound slides (dense text, nested panels)? Iteration in code, not in UI.
