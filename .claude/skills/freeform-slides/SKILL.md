---
name: freeform-slides
description: Use when generating presentation slides using the freeform template, creating custom slide layouts with manually positioned elements, or when the user asks to create slides with direct control over element placement on a 1920x1080 canvas.
---

# Freeform Slide Generation

Generate slides using `template: freeform` which gives direct control over every element on a 1920x1080 canvas.

## Workflow

1. **Understand the request**: What content, visual style, and theme does the user want?
2. **Choose a theme**: Pick from available themes or use custom colors. See [reference.md](reference.md) for theme table.
3. **Plan the layout**: Sketch element positions mentally. Canvas is 1920x1080, safe area is 160..1760 x 60..1020.
4. **Write the YAML**: Use `template: freeform` with an `elements` array. Each element needs `kind`, `id`, `rect`, and type-specific props.
5. **Add animations**: Stagger `delay` by 100-150ms between elements for cascading reveal. Use `fade-up` for text, `fade-in` for shapes, `scale-up` for hero numbers.
6. **Save the file**: Write to `content/<slug>/slides.yaml` where `<slug>` is a kebab-case name (e.g. `content/ai-history/slides.yaml`). Create the directory if it doesn't exist. Images go in `content/<slug>/images/`. If adding images, run `bun run sync-content` to copy them to `public/` for the dev server.

## Quick Start

```yaml
title: "My Presentation"
theme: modern
slides:
  - template: freeform
    background: "#f5f0e8"
    elements:
      - kind: shape
        id: panel
        rect: { x: 960, y: 0, w: 960, h: 1080 }
        shape: rect
        style: { fill: "#1a1714" }
      - kind: text
        id: title
        rect: { x: 160, y: 200, w: 700, h: 80 }
        text: "Hello World"
        style:
          fontFamily: "Inter, system-ui, sans-serif"
          fontSize: 42
          fontWeight: 700
          color: "#1a1a2e"
          lineHeight: 1.2
          textAlign: left
        animation: { type: fade-up, delay: 0, duration: 500 }
```

## Key Rules

- **Canvas**: 1920x1080px. All `rect` values `{x, y, w, h}` in px. `{x,y}` is top-left.
- **Safe area**: x: 160..1760, y: 60..1020 (160px horizontal margin, 60px vertical).
- **IDs**: Must be unique per slide.
- **z-order**: Later elements render on top. Put background shapes first.
- **Groups**: Children use coordinates relative to the group's `rect` origin.
- **Animations on groups**: Animate the group element, not individual children.
- **PPTX**: All elements export. Avoid `count-up` (web-only). Duration 400-600ms.

## Element Types

7 element kinds: `text`, `shape`, `image`, `group`, `code`, `table`, `list`.

See [reference.md](reference.md) for full prop reference, theme values, and component recipes.

## Animation Types

| Type | Effect | Best for |
|------|--------|----------|
| `fade-up` | Fade + slide up 30px | Titles, body text, cards |
| `fade-in` | Fade in only | Background shapes, images |
| `slide-left` | Fade + slide from left | Left-panel content |
| `slide-right` | Fade + slide from right | Right-panel content |
| `scale-up` | Fade + scale 85%->100% | Stats, hero numbers |
| `count-up` | Number count-up (web only) | Stat values |
| `none` | No animation | Static elements |

Stagger: increment `delay` by 100-150ms between sequential elements.

## Common Patterns

- **Split layout**: Full-height shape as panel divider, content on each side
- **Stat block**: Large number text + small label text below, use `scale-up`
- **Card with border**: Group with `style.fill`, `border.sides: ["left"]`, text children
- **Seal/stamp**: Group with stroke shape + centered text
- **Tag/pill**: Group with pill shape + uppercase text

See [reference.md](reference.md) for complete YAML examples of each pattern.
