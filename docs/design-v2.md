# Design v2: Custom Slide Engine, Themes & Animations

## Motivation

The v1 system uses Reveal.js as the presentation runtime. While functional, Reveal.js imposes constraints that limit visual polish and animation control:

- Its CSS is opinionated — theme overrides fight with Reveal.js internals
- The fragment system (`opacity`/`transform` control) conflicts with custom element animations
- Extra bundle weight (~60kb) for features not used (speaker notes, overview mode, PDF export)
- Templates are visually raw — hardcoded colors, inconsistent spacing, no design system

v2 removes Reveal.js entirely and replaces it with a lightweight custom slide engine, a theme system with 4 visual styles, CSS-based element animations, and polished template designs.

## Architecture

```
content/[slug]/slides.yaml           <- text content + template choices + theme
src/lib/types.ts                     <- TypeScript types (discriminated union)
src/lib/loadPresentation.ts          <- YAML parser + content/ auto-discovery
src/components/SlideEngine.tsx       <- Custom presentation engine (replaces Presentation.tsx)
src/components/templates/index.ts    <- template registry (unchanged)
src/components/templates/*.tsx       <- one React component per template (restyled)
src/styles/engine.css                <- engine base styles (scaling, layout, transitions)
src/styles/animations.css            <- shared keyframes & animation utilities
src/styles/themes/modern.css         <- theme: modern & minimal
src/styles/themes/bold.css           <- theme: bold & expressive
src/styles/themes/elegant.css        <- theme: elegant & editorial
src/styles/themes/dark-tech.css      <- theme: dark & techy
src/app/[slug]/page.tsx              <- dynamic route: loads YAML -> templates
src/app/page.tsx                     <- home page: auto-discovers presentations
```

## Data Flow

1. `slides.yaml` is read by the server component at build time
2. The `theme` field (default: `modern`) determines which CSS theme is applied
3. Each slide entry is mapped to a template component via the registry
4. Templates render `<section>` elements using theme CSS variables
5. The `<SlideEngine>` client component manages navigation, scaling, and slide activation
6. CSS animations trigger automatically when a slide receives the `.active` class

## Custom Slide Engine

### SlideEngine.tsx

A React client component that replaces Reveal.js entirely.

**Responsibilities:**
- Maintain `currentSlide` index in React state
- Keyboard navigation: `ArrowRight`/`ArrowDown`/`Space` = next, `ArrowLeft`/`ArrowUp` = prev
- Apply `.active` class to the current slide, `.inactive` to others
- Viewport scaling: fixed 1920x1080 canvas scaled to fit the browser window via CSS `scale()`
- Slide transition: CSS-driven crossfade between outgoing and incoming slides

**What it does NOT do:**
- No speaker notes
- No overview mode
- No PDF export
- No fragment system (replaced by auto-animations)
- No hash-based navigation

**Scaling approach:**
```css
.slide-engine {
  width: 1920px;
  height: 1080px;
  transform-origin: top left;
  /* JS computes scale factor from window size */
}
```

The component calculates `scale = Math.min(windowWidth / 1920, windowHeight / 1080)` on mount and resize, applying it as a CSS transform.

### Navigation

Keyboard events captured on the engine container:

| Key | Action |
|-----|--------|
| `ArrowRight`, `ArrowDown`, `Space` | Next slide |
| `ArrowLeft`, `ArrowUp` | Previous slide |
| `Home` | First slide |
| `End` | Last slide |

Touch/swipe support via pointer events (optional, low priority).

## Theme System

### Design Principles

- Themes are CSS-only — no JavaScript logic per theme
- Templates consume theme variables via `var(--sl-*)` — they never reference theme names
- One set of templates renders correctly across all 4 themes
- Theme is selected in YAML and applied as a CSS class on the engine root

### Theme Selection

```yaml
title: "My Talk"
theme: dark-tech    # modern (default) | bold | elegant | dark-tech
slides:
  - template: cover
    title: "Hello World"
```

The `theme` field is optional. Omitting it defaults to `modern`.

### CSS Variables

Each theme defines these custom properties:

| Variable | Purpose |
|----------|---------|
| `--sl-bg` | Slide background color |
| `--sl-bg-secondary` | Content block / card background |
| `--sl-text` | Body text color |
| `--sl-text-muted` | Secondary / dimmed text |
| `--sl-heading` | Heading color |
| `--sl-accent` | Primary accent color |
| `--sl-accent-2` | Secondary accent color |
| `--sl-font-heading` | Heading font family |
| `--sl-font-body` | Body font family |
| `--sl-font-mono` | Monospace font family |
| `--sl-radius` | Border radius for cards/containers |
| `--sl-shadow` | Box shadow for elevated elements |
| `--sl-border` | Subtle border style |

### Theme Definitions

**modern** — Clean lines, generous whitespace, soft shadows
- Light backgrounds, dark text
- System sans-serif (Inter or equivalent)
- Soft gradient accents (blue -> purple)
- Rounded corners (12px), subtle drop shadows

**bold** — High contrast, saturated colors, large type
- Dark sections mixed with bright accent backgrounds
- Strong sans-serif (bold weights)
- Saturated accent colors (orange, electric blue)
- Minimal radius (4px), strong shadows

**elegant** — Serif headings, muted tones, refined spacing
- Warm or cool muted backgrounds (cream, slate)
- Serif headings + sans-serif body (Playfair Display + Inter or similar)
- Gold/bronze accents
- Generous padding, thin borders, no heavy shadows

**dark-tech** — Dark backgrounds, neon accents, monospace touches
- Near-black backgrounds (#0a0a12)
- Monospace headings (JetBrains Mono), sans body
- Neon cyan/green accents with glow effects
- Medium radius (8px), glow shadows

## Animation System

### Design Principles

- All animations are CSS-only (`@keyframes` + `animation` property)
- Animations trigger when a slide receives the `.active` class
- No JavaScript animation libraries — keeps bundle small
- Each template has a sensible default animation
- Per-slide override via `animation` YAML field
- `animation: none` disables animation on a specific slide

### Animation Categories

**Auto-stagger** — Items appear one by one with incremental delay
- Trigger: slide becomes `.active`
- Implementation: children have `animation-delay: calc(var(--i) * 150ms)`
- Used by: bullets, numbered-list, steps, timeline, icon-grid, image-grid, three-column

**Counter-up** — Numbers animate from 0 to target value
- Trigger: slide becomes `.active`
- Implementation: CSS `@property` registered custom property with transition
- Used by: stats

**Entrance** — Elements animate into view
- Types: fade-up, slide-in-left, slide-in-right, scale-up, blur-in
- Trigger: slide becomes `.active`
- Used by: cover (title + subtitle staggered), quote (fade + scale), comparison (left/right from sides)

**Decorative** — Continuous subtle animations
- Types: gradient-shift, subtle-float, pulse-glow
- Always running on `.active` slides
- Used by: theme-specific accent elements, background decorations

### Per-Template Defaults

| Template | Default Animation |
|----------|-------------------|
| `cover` | title fade-up, subtitle fade-up delayed |
| `bullets` | auto-stagger items |
| `numbered-list` | auto-stagger items |
| `stats` | counter-up on values |
| `steps` | auto-stagger steps |
| `timeline` | auto-stagger events |
| `icon-grid` | auto-stagger cards |
| `image-grid` | auto-stagger images |
| `comparison` | left from left, right from right |
| `quote` | fade-in + subtle scale |
| `code` | fade-in |
| `code-comparison` | left fade-in, right fade-in delayed |
| `three-column` | auto-stagger columns |
| All others | fade-up |

### YAML Override

```yaml
- template: bullets
  title: "Points"
  bullets: [...]
  animation: none      # disable animation for this slide

- template: stats
  stats: [...]
  animation: stagger   # override default counter to stagger instead
```

### CSS Implementation Pattern

```css
/* animations.css */

/* Auto-stagger: children animate in sequence */
.active .anim-stagger > * {
  opacity: 0;
  animation: fadeUp 0.5s ease both;
  animation-delay: calc(var(--i) * 150ms);
}

/* Counter-up: numbers count from 0 */
@property --counter-value {
  syntax: "<integer>";
  initial-value: 0;
  inherits: false;
}

.active .anim-counter {
  transition: --counter-value 1.5s ease-out;
  counter-reset: value var(--counter-value);
}

/* Entrance variants */
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(30px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes slideInLeft {
  from { opacity: 0; transform: translateX(-60px); }
  to   { opacity: 1; transform: translateX(0); }
}

@keyframes slideInRight {
  from { opacity: 0; transform: translateX(60px); }
  to   { opacity: 1; transform: translateX(0); }
}

@keyframes scaleUp {
  from { opacity: 0; transform: scale(0.9); }
  to   { opacity: 1; transform: scale(1); }
}

@keyframes blurIn {
  from { opacity: 0; filter: blur(8px); }
  to   { opacity: 1; filter: blur(0); }
}
```

Templates apply animation classes and set `--i` index:

```tsx
<ul className="anim-stagger">
  {items.map((item, i) => (
    <li key={i} style={{ '--i': i } as React.CSSProperties}>{item}</li>
  ))}
</ul>
```

## Template Polish

### Shared Improvements

All 35 templates receive these upgrades:

- **Theme variables everywhere** — Remove all hardcoded colors (#1a1a2e, #000000, etc.). Every color, font, radius, shadow comes from `var(--sl-*)`
- **Content containers** — Text and data wrapped in styled cards/panels with `var(--sl-bg-secondary)`, `var(--sl-radius)`, `var(--sl-shadow)`
- **Consistent spacing** — Replace ad-hoc Tailwind margins with a spacing system (e.g. CSS variables for section padding, item gaps)
- **Typography hierarchy** — Headings use `var(--sl-font-heading)`, body uses `var(--sl-font-body)`, code uses `var(--sl-font-mono)`. Consistent size scale
- **Subtle borders and dividers** — `var(--sl-border)` between sections where needed
- **Animation classes** — Each template applies its default animation class (e.g. `anim-stagger`, `anim-counter`)

### Notable Template Upgrades

| Template | Before | After |
|----------|--------|-------|
| `cover` | Plain h1 + h2 | Gradient accent line under title, author in pill badge, background blur on image |
| `bullets` | Bare `<li>` list | Accent-colored bullet markers, each item in subtle card, stagger animation |
| `code` | Hardcoded dark bg | Theme-aware code block with rounded corners, language badge top-right |
| `stats` | Plain big text | Each stat in a card with accent border-top, counter-up animation |
| `timeline` | Inline flex | Connected line with accent dots, content cards hanging off the line |
| `quote` | Plain blockquote | Large accent quote mark, italic text, attribution with dash separator |
| `comparison` | Two plain lists | Side-by-side cards with colored headers (green/red) |
| `profile` | Basic circle image | Card layout with gradient accent bar |
| `steps` | Numbered spans | Connected step indicators with accent circles, content cards |
| `image-text` | Image + text in flex | Image with rounded corners + shadow, text in content panel |

### Minimal-Change Templates

These templates are simple by design and only adopt theme variables:
- `blank`, `iframe`, `video`, `end`

## Type Changes

### PresentationData

```typescript
interface PresentationData {
  title: string;
  author?: string;
  theme?: 'modern' | 'bold' | 'elegant' | 'dark-tech';  // NEW
  slides: SlideData[];
}
```

### SlideData (base)

Each slide type in the discriminated union gains an optional field:

```typescript
animation?: 'stagger' | 'fade' | 'counter' | 'none';  // NEW — overrides template default
```

## Image Resolution

Unchanged from v1. YAML references images by filename, `imageBase` provides the path prefix, images served from `public/[slug]/`.

## Testing Strategy

### Updated Test Plan

| Layer | Tool | What it tests |
|-------|------|---------------|
| **Unit** | Vitest | `loadPresentation()`, `discoverPresentations()`, parser, theme field validation |
| **Integration** | Vitest + RTL | Template rendering with theme variables, animation class presence |
| **E2E** | Playwright | Slide navigation (keyboard), scaling, theme application, animation triggers |

### Key Test Cases (new)

- SlideEngine renders correct number of slides
- Keyboard navigation advances/retreats slides
- Only active slide has `.active` class
- Theme class applied to engine root matches YAML `theme` field
- Default theme is `modern` when `theme` is omitted
- Animation classes present on template elements
- `animation: none` suppresses animation classes
- Viewport scaling adjusts on window resize

## Migration

### Breaking Changes

- Reveal.js is removed — `<Presentation>` component deleted
- Reveal.js CSS imports removed from layout
- Templates no longer return Reveal.js-compatible `<section data-background-*>` attributes — backgrounds handled via theme CSS and inline styles

### Backward Compatibility

- YAML content structure unchanged — existing `slides.yaml` files work without modification
- All 35 template names unchanged — registry keys preserved
- Image resolution unchanged
- New fields (`theme`, `animation`) are optional with sensible defaults

### Migration Checklist

1. Remove `reveal.js` from `package.json`
2. Delete `src/components/Presentation.tsx`
3. Create `src/components/SlideEngine.tsx`
4. Create `src/styles/` directory with engine, animation, and theme CSS
5. Update `src/app/layout.tsx` — remove Reveal.js CSS, import new styles
6. Update `src/app/[slug]/page.tsx` — use `<SlideEngine>` with theme prop
7. Update `src/lib/types.ts` — add `theme` and `animation` fields
8. Restyle all 35 templates — theme variables, animation classes, visual polish
9. Update tests — remove Reveal.js assertions, add engine/theme/animation tests

## Design Decisions

- **No Reveal.js** — Full control over styling and animations. No CSS conflicts. Lighter bundle. The features Reveal.js provides (speaker notes, overview, PDF) are not used.
- **CSS-only animations** — No runtime JS animation library. Animations trigger via `.active` class. Performant, declarative, no bundle cost.
- **Theme as CSS variables** — Templates are theme-agnostic. Adding a new theme is one CSS file. No React component changes needed.
- **YAML theme selection** — Simple, per-presentation. No runtime theme switching needed. Build-time static generation still works.
- **Sensible defaults** — Theme defaults to `modern`, each template has a default animation. Zero-config for authors who don't care about theming/animation.
