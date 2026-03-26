# Implementation Plan: v2 Custom Engine, Themes & Animations

**Design doc:** `docs/2026-02-07-design-v2.md`
**Date:** 2026-02-07
**Scope:** Remove Reveal.js, build custom slide engine, add 4 themes, add CSS animations, polish all 35 templates.

---

## Phase 1: Foundation — Custom Slide Engine

**Goal:** Replace Reveal.js with a working custom engine. Slides render and navigate.

### Step 1.1: Remove Reveal.js

- [ ] Remove `reveal.js` from `package.json` dependencies
- [ ] Remove `@types/reveal.js` if present
- [ ] Remove Reveal.js CSS imports from `src/app/layout.tsx`
- [ ] Delete `src/components/Presentation.tsx`
- [ ] Run `bun install` to clean lockfile

### Step 1.2: Create SlideEngine component

- [ ] Create `src/components/SlideEngine.tsx` — client component
- [ ] Implement `currentSlide` state with React `useState`
- [ ] Implement keyboard navigation (`ArrowRight`/`ArrowLeft`/`Space`/`Home`/`End`)
- [ ] Render all slides, apply `.active` to current, `.inactive` to others
- [ ] Accept `theme` prop, apply as CSS class on root element
- [ ] Accept `children` (slide elements) same as old `<Presentation>`

### Step 1.3: Create engine CSS

- [ ] Create `src/styles/engine.css`
- [ ] Fixed 1920x1080 canvas with CSS `transform: scale()`
- [ ] Slide visibility: `.active` visible, `.inactive` hidden
- [ ] Slide transition: crossfade between active/inactive
- [ ] Responsive scaling: JS computes scale factor on mount + resize

### Step 1.4: Wire up the route

- [ ] Update `src/app/[slug]/page.tsx` — replace `<Presentation>` with `<SlideEngine>`
- [ ] Pass `theme` from parsed YAML to `<SlideEngine>`
- [ ] Update `src/app/layout.tsx` — import `engine.css` instead of Reveal.js CSS

### Step 1.5: Update types

- [ ] Add `theme?: 'modern' | 'bold' | 'elegant' | 'dark-tech'` to `PresentationData`
- [ ] Add `animation?: 'stagger' | 'fade' | 'counter' | 'none'` to base slide fields

### Step 1.6: Update templates — remove Reveal.js coupling

- [ ] Remove `data-background-*` attributes from all templates
- [ ] Templates still render `<section>` elements (semantic, kept as slide wrapper)
- [ ] Background images/colors handled via inline styles or theme variables
- [ ] This step is minimal — just decouple from Reveal.js, no visual changes yet

### Step 1.7: Verify

- [ ] `bun run build` succeeds with no Reveal.js references
- [ ] Dev server shows slides, arrow keys navigate
- [ ] Existing YAML content renders (may look unstyled — that's fine)

**Checkpoint:** Engine works. Slides display and navigate. No Reveal.js dependency.

---

## Phase 2: Theme System

**Goal:** 4 themes selectable via YAML. Templates consume CSS variables.

### Step 2.1: Create theme CSS files

- [ ] Create `src/styles/themes/modern.css` — light, clean, soft gradients
- [ ] Create `src/styles/themes/bold.css` — high contrast, saturated
- [ ] Create `src/styles/themes/elegant.css` — serif + sans, muted tones
- [ ] Create `src/styles/themes/dark-tech.css` — dark bg, neon accents
- [ ] Each file defines `.theme-<name>` class with all `--sl-*` CSS variables
- [ ] Import all theme files in `src/app/layout.tsx` or a central `src/styles/index.css`

### Step 2.2: Load Google Fonts

- [ ] Add font imports for theme-specific fonts (Inter, Playfair Display, JetBrains Mono, etc.)
- [ ] Use `next/font` or CSS `@import` — prefer `next/font` for performance

### Step 2.3: Wire theme to engine

- [ ] `SlideEngine` applies `theme-${theme}` class to root div
- [ ] Default to `theme-modern` when theme is omitted
- [ ] `src/app/[slug]/page.tsx` reads `theme` from presentation data and passes to engine

### Step 2.4: Update globals.css

- [ ] Remove Reveal.js-specific overrides
- [ ] Set base styles using `var(--sl-*)` fallbacks
- [ ] Ensure Tailwind works alongside theme variables

### Step 2.5: Verify

- [ ] Add `theme: dark-tech` to example presentation YAML
- [ ] Confirm CSS variables resolve — backgrounds, text colors, fonts change
- [ ] Try all 4 themes, confirm each renders differently
- [ ] Confirm `theme` omission defaults to `modern`

**Checkpoint:** Themes work. Switching `theme:` in YAML changes the visual style.

---

## Phase 3: Animation System

**Goal:** CSS animations trigger on slide activation. Each template has default animation.

### Step 3.1: Create animation CSS

- [ ] Create `src/styles/animations.css`
- [ ] Define `@keyframes`: fadeUp, slideInLeft, slideInRight, scaleUp, blurIn
- [ ] Define animation utility classes: `.anim-stagger`, `.anim-fade`, `.anim-counter`
- [ ] Stagger: `.active .anim-stagger > *` with `animation-delay: calc(var(--i) * 150ms)`
- [ ] Counter: CSS `@property --counter-value` with transition
- [ ] Import in layout or central CSS

### Step 3.2: Engine integration

- [ ] SlideEngine resets animation state when slide changes (remove/re-add `.active` to retrigger)
- [ ] Pass `animation` prop from slide data to template if overridden

### Step 3.3: Apply animations to templates (batch 1 — stagger templates)

- [ ] `bullets` — wrap list in `.anim-stagger`, set `--i` on each item
- [ ] `numbered-list` — same pattern
- [ ] `steps` — stagger step cards
- [ ] `timeline` — stagger event cards
- [ ] `icon-grid` — stagger grid items
- [ ] `image-grid` — stagger images
- [ ] `three-column` — stagger columns
- [ ] `agenda` — stagger agenda items
- [ ] `definition` — stagger definition pairs

### Step 3.4: Apply animations to templates (batch 2 — entrance templates)

- [ ] `cover` — title fade-up, subtitle fade-up delayed
- [ ] `quote` — fade-in + scale
- [ ] `section-divider` — fade-up
- [ ] `statement` — fade-up
- [ ] `end` — fade-up
- [ ] `code` — fade-in
- [ ] `code-comparison` — left fade-in, right fade-in delayed
- [ ] `table` — fade-in

### Step 3.5: Apply animations to templates (batch 3 — special animations)

- [ ] `stats` — counter-up on stat values
- [ ] `comparison` — left slides from left, right from right
- [ ] `image-text` — image from one side, text from the other
- [ ] `image-comparison` — before from left, after from right
- [ ] `profile` — scale-up on image, fade-up on text

### Step 3.6: Animation override support

- [ ] Read `animation` field from slide data in each template
- [ ] If `animation: none`, skip animation classes
- [ ] If `animation: stagger|fade|counter`, apply that instead of default

### Step 3.7: Verify

- [ ] Navigate through example gallery — every template animates
- [ ] `animation: none` on a slide disables animation
- [ ] Animations retrigger when navigating back to a slide
- [ ] No janky or conflicting animations

**Checkpoint:** Animations work. Every template has smooth entrance animations.

---

## Phase 4: Template Visual Polish

**Goal:** All 35 templates look polished and professional using theme variables.

### Step 4.1: Establish shared component patterns

- [ ] Create reusable CSS classes for: content card, section padding, accent divider, pill badge
- [ ] These are CSS utility classes in engine.css or a new `src/styles/components.css`
- [ ] NOT React components — just CSS classes templates can apply

### Step 4.2: Polish text-focused templates

- [ ] `cover` — gradient accent line, author pill badge, background blur
- [ ] `bullets` — accent bullet markers, item cards, improved spacing
- [ ] `section-divider` — large centered title, accent underline
- [ ] `quote` — large accent quotation mark, italic styling, attribution separator
- [ ] `statement` — centered with accent glow/underline
- [ ] `numbered-list` — accent-colored numbers, item cards
- [ ] `definition` — term in accent color, description in card
- [ ] `agenda` — active item highlighted with accent bar

### Step 4.3: Polish image-focused templates

- [ ] `full-image` — improved overlay gradient, text positioning
- [ ] `image-text` — rounded image with shadow, text in content panel
- [ ] `image-grid` — rounded images, hover-subtle effect, caption styling
- [ ] `image-comparison` — labels on each image, divider line
- [ ] `image-caption` — rounded image, styled caption below
- [ ] `image-gallery` — consistent sizing, subtle shadows

### Step 4.4: Polish layout templates

- [ ] `two-column` — columns in cards with accent top border
- [ ] `three-column` — column cards with icon styling
- [ ] `top-bottom` — clear visual separation, accent divider
- [ ] `sidebar` — sidebar with secondary bg, main content clean

### Step 4.5: Polish data & technical templates

- [ ] `code` — theme-aware code block, language badge, line numbers
- [ ] `code-comparison` — side-by-side cards with before/after labels
- [ ] `table` — styled header row with accent bg, alternating row colors
- [ ] `timeline` — connected line with accent dots, event cards
- [ ] `stats` — stat cards with accent border-top
- [ ] `chart-placeholder` — rounded image container, styled caption
- [ ] `diagram` — rounded container, caption styling

### Step 4.6: Polish storytelling templates

- [ ] `comparison` — side-by-side cards, green/red headers for pros/cons
- [ ] `steps` — connected step indicators, accent circles, content cards
- [ ] `profile` — card with gradient accent bar, circular image
- [ ] `icon-grid` — icon in accent circle, label below
- [ ] `highlight-box` — variant-colored border/bg (info/warning/success)
- [ ] `qa` — question styled prominently, answer in reveal card

### Step 4.7: Polish special templates

- [ ] `video` — container with rounded corners, title overlay
- [ ] `iframe` — container styling, title bar
- [ ] `blank` — theme background, nothing else
- [ ] `end` — centered "Thank You" with accent styling

### Step 4.8: Verify visual quality

- [ ] Browse example gallery with each of the 4 themes
- [ ] Confirm consistent spacing, typography, and color usage
- [ ] No hardcoded colors remaining in templates
- [ ] All templates readable and polished across themes

**Checkpoint:** All templates are visually polished and theme-aware.

---

## Phase 5: Testing & Cleanup

**Goal:** All tests pass, code is clean, documentation updated.

### Step 5.1: Update unit tests

- [ ] Update `loadPresentation` tests for `theme` field
- [ ] Add parser tests for `animation` field
- [ ] Remove any Reveal.js-specific test assertions

### Step 5.2: Update integration tests

- [ ] Update template rendering tests — check for theme CSS variable usage
- [ ] Add tests for animation class presence on template elements
- [ ] Test `animation: none` suppresses animation classes

### Step 5.3: Update E2E tests

- [ ] Replace Reveal.js navigation tests with SlideEngine navigation
- [ ] Test keyboard navigation (arrow keys, Home, End)
- [ ] Test `.active` class applied to correct slide
- [ ] Test theme class applied to engine root
- [ ] Test viewport scaling

### Step 5.4: Add SlideEngine unit tests

- [ ] Test render with N slides
- [ ] Test keyboard event handlers
- [ ] Test scale calculation
- [ ] Test theme prop default

### Step 5.5: Cleanup

- [ ] Remove any remaining Reveal.js references (comments, types, etc.)
- [ ] Update `docs/design.md` to reference v2 or mark as superseded
- [ ] Update `CLAUDE.md` if any commands or architecture descriptions changed
- [ ] Run `bun run lint` — fix any issues
- [ ] Run `bun run build` — confirm clean production build

### Step 5.6: Final verification

- [ ] `bun run test` — all unit/integration tests pass
- [ ] `bun run test:e2e` — all E2E tests pass
- [ ] `bun run dev` — manually browse example gallery with all 4 themes
- [ ] Confirm existing `70-years-of-ai` presentation still renders correctly

**Checkpoint:** All tests green. Code is clean. Ready for commit.

---

## Phase Summary

| Phase | Description | Key Deliverable |
|-------|-------------|-----------------|
| 1 | Custom Slide Engine | Reveal.js removed, slides navigate with arrow keys |
| 2 | Theme System | 4 themes selectable via YAML `theme` field |
| 3 | Animation System | CSS animations auto-trigger on slide activation |
| 4 | Template Polish | All 35 templates visually upgraded and theme-aware |
| 5 | Testing & Cleanup | All tests pass, docs updated, clean build |

## Risk Notes

- **Phase 4 is the largest** — 35 templates to restyle. Can be parallelized by category (text, image, layout, data, storytelling, special).
- **CSS `@property` for counter-up** — check browser support. Fallback: use a small JS hook for number animation.
- **Font loading** — `next/font` is preferred but may need fallback for fonts not in Google Fonts.
- **Existing presentations** — `70-years-of-ai` must render correctly after migration. Test early in Phase 1.
