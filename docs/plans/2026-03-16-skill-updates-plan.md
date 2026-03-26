# Skill Updates Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Update slide generation skills to match the v9 scene-first architecture — delete replicate-layout, rewrite create-slides with scene-default + three-mode template routing.

**Architecture:** The create-slides skill becomes scene-first. Default mode auto-routes each slide: use a template when content naturally fits, otherwise emit freeform scene YAML. User can override to scene-only or template-only. Reference.md is rewritten to document scene syntax (FrameSpec, guides, presets, stack/row/grid) alongside template params.

**Tech Stack:** Skill markdown files, YAML scene format, Nunjucks templates.

---

### Task 1: Delete replicate-layout skill

**Files:**
- Delete: `.claude/skills/replicate-layout/SKILL.md`

**Step 1: Delete the skill directory**

```bash
rm -rf .claude/skills/replicate-layout
```

**Step 2: Verify deletion**

```bash
ls .claude/skills/
```

Expected: `create-slides/` and `replicate-slides/` only.

**Step 3: Commit**

```bash
git add -A .claude/skills/replicate-layout
git commit -m "chore(skills): remove replicate-layout skill

- Skill used v8 component wireframes (box + text + spacer)
- Component layer no longer exists in v9
- replicate-slides covers the replication use case directly"
```

---

### Task 2: Rewrite create-slides SKILL.md

**Files:**
- Modify: `.claude/skills/create-slides/SKILL.md`

**Step 1: Write the new SKILL.md**

The new skill must cover:

1. **Description** — updated to mention scene YAML as default, templates as opt-in
2. **Three generation modes** — auto (default), scene-only, template-only
3. **Decision tree** — how to route each slide
4. **Design philosophy** — keep existing (asymmetry, scale contrast, whitespace, etc.)
5. **Workflow** — same 5 phases, updated for scene output
6. **Scene YAML examples** — replacing all v8 component examples with scene equivalents:
   - Example 1: Template usage (concise, unchanged — templates still work)
   - Example 2: Two-panel scene layout with guides and groups
   - Example 3: Creative scene slide with overlapping shapes and layering
   - Example 4: Rich text in scene format
   - Example 5: Scene with presets for repeated styling

Key content for the decision tree section:

```markdown
## Generation Modes

| Mode | Trigger | Behavior |
|------|---------|----------|
| **Auto** (default) | No preference stated | Route each slide: template if natural fit, scene if not |
| **Scene-only** | "generate freely" / "no templates" / "freeform" | All slides as freeform scene YAML |
| **Template-only** | "use templates" / "only templates" | Pick best-fit template for each slide |

### Auto-Routing Decision

For each slide, ask: does the content map cleanly to a template's params?

**Use template when:**
- Title + subtitle → `cover`
- Title + 3-5 bullet points → `bullets`
- 2-4 numbers with labels → `stats`
- Single quote + attribution → `quote`
- Code block with optional title → `code`
- Before/after comparison → `comparison`
- Simple image + text → `image-text`

**Use scene when:**
- Custom multi-panel layouts
- Mixed content types in non-standard arrangements
- Visual/creative compositions with overlapping elements
- Data-heavy slides with custom positioning
- Anything that would require fighting the template to get the right result
```

Key content for scene examples — Example 2 (two-panel with guides):

```yaml
- mode: scene
  background: { type: solid, color: "theme.bg" }
  guides:
    x: { content-left: 160, split: 1200, right-content: 1280 }
    y: { top: 120 }
  presets:
    sectionTitle:
      style:
        fontFamily: heading
        fontWeight: 700
        color: "theme.heading"
        lineHeight: 1.15
    bodyText:
      style:
        fontFamily: body
        fontWeight: 400
        color: "theme.text"
        lineHeight: 1.6
  children:
    - kind: shape
      id: right-panel
      frame: { left: "@x.split", top: 0, right: 0, bottom: 0 }
      shape: rect
      style: { fill: "theme.bgSecondary" }
    - kind: group
      id: left-content
      frame: { left: "@x.content-left", top: "@y.top", w: 900, h: 800 }
      layout: { type: stack, gap: 28 }
      children:
        - kind: text
          id: eyebrow
          frame: { w: 900 }
          text: "CHAPTER ONE"
          style:
            fontFamily: body
            fontSize: 18
            fontWeight: 700
            color: "theme.accent"
            letterSpacing: 2
            textTransform: uppercase
        - kind: text
          id: title
          preset: sectionTitle
          frame: { w: 900 }
          text: "The Fall of Tang"
          style: { fontSize: 56 }
          entrance: { type: fade-up, delay: 0, duration: 600 }
        - kind: shape
          id: divider
          frame: { w: 120, h: 4 }
          shape: rect
          style:
            gradient: { type: linear, angle: 90, stops: [{ color: "theme.accent", position: 0 }, { color: "theme.accent2", position: 1 }] }
        - kind: text
          id: body
          preset: bodyText
          frame: { w: 700 }
          text: "A dynasty that lasted 289 years crumbled in a decade. Regional military governors became autonomous warlords."
          style: { fontSize: 28 }
    - kind: group
      id: stats
      frame: { x: "@x.right-content", top: "@y.top", w: 480, h: 400 }
      layout: { type: stack, gap: 36 }
      children:
        - kind: text
          id: stat-year
          frame: { w: 480 }
          text: "907"
          style: { fontFamily: heading, fontSize: 72, fontWeight: 700, color: "theme.accent", lineHeight: 1 }
          entrance: { type: scale-up, delay: 200 }
        - kind: text
          id: stat-label
          frame: { w: 480 }
          text: "Year of Tang's Fall"
          style: { fontFamily: body, fontSize: 24, color: "theme.textMuted", lineHeight: 1.4 }
```

**Step 2: Verify the file is well-formed**

Read the file back and confirm no markdown formatting issues.

**Step 3: Commit**

```bash
git add .claude/skills/create-slides/SKILL.md
git commit -m "feat(skills): rewrite create-slides for v9 scene-first authoring

- Default to freeform scene YAML (no templates)
- Three modes: auto (route per slide), scene-only, template-only
- Auto-routing picks templates when content naturally fits
- All examples rewritten in v9 scene format
- Remove all v8 component syntax (type: heading, type: box, etc.)"
```

---

### Task 3: Rewrite create-slides reference.md

**Files:**
- Modify: `.claude/skills/create-slides/reference.md`

**Step 1: Write the new reference.md**

Structure:

1. **Presentation Structure** — updated to show scene slides as default, templates as alternative
2. **Scene Slide Syntax** — the core new section:
   - Scene node types (text, shape, image, group, ir)
   - FrameSpec (partial geometry: left, right, centerX, etc.)
   - Guides (@x.name, @y.name)
   - Anchors (@nodeId.edge, { ref, offset })
   - Presets (node-level defaults, extends inheritance)
   - Layout primitives (stack, row, grid on groups)
   - sourceSize + fit + align (screenshot-space authoring)
   - Background spec (solid, image with overlay)
   - Theme tokens (theme.accent, theme.bg, etc.)
   - Rich text (string or TextRun[])
3. **Templates** — keep existing template params section (all 35 templates), but update intro text to say "templates emit scene slides internally"
4. **IR Element Types** — keep for `kind: ir` escape hatch reference (code, table, list, video, iframe)
5. **Animations** — keep entrance types table
6. **Theme Palettes** — keep all 16 theme descriptions unchanged
7. **Canvas & Sizing** — keep
8. **Content Density Limits** — keep
9. **Design Anti-Patterns** — keep

Sections to delete:
- "Component Tree Slides" section (all of it — box, heading, body, bullets, stat, tag, etc.)
- "Two-Panel Layout Pattern" (component version)
- "Full-Width Centered Layout Pattern" (component version)
- "Creative Techniques" section (rewrite with scene examples)

The scene syntax section should include compact reference examples like:

```yaml
# Text node
- kind: text
  id: title
  preset: sectionTitle           # optional, inherits style defaults
  frame: { left: 160, top: 120, w: 900 }
  text: "Title Text"             # string or TextRun[]
  style:
    fontFamily: heading           # heading | body | mono | CSS font-family
    fontSize: 56
    fontWeight: 700
    color: "theme.heading"        # theme token or hex
    lineHeight: 1.15
    textAlign: left               # left | center | right
    # also: fontStyle, letterSpacing, textTransform, verticalAlign, highlightColor, textShadow

# Shape node
- kind: shape
  id: panel
  frame: { left: "@x.split", top: 0, right: 0, bottom: 0 }
  shape: rect                     # rect | circle | line | pill | arrow | triangle | chevron | diamond | star | callout
  style:
    fill: "theme.bgSecondary"
    # also: gradient, stroke, strokeWidth, strokeDash, patternFill

# Image node
- kind: image
  id: photo
  frame: { x: 0, y: 0, w: 960, h: 1080 }
  src: "photo.jpg"                # relative to content/[slug]/images/
  objectFit: cover                # cover | contain
  clipCircle: false               # optional

# Group node (layout container)
- kind: group
  id: content-stack
  frame: { left: 160, top: 120, w: 900, h: 800 }
  layout:
    type: stack                   # stack | row | grid
    gap: 24
    align: start                  # start | center | end | stretch
    justify: center               # stack only: start | center | end
    padding: [20, 24, 20, 24]     # optional
  style: { fill: "theme.cardBg" } # optional group background
  clipContent: true               # optional
  children: [...]

# IR escape hatch (for code, table, list, video, iframe)
- kind: ir
  id: code-block
  frame: { x: 160, y: 400, w: 1600, h: 400 }
  element:
    kind: code
    id: code-element
    rect: { x: 0, y: 0, w: 1600, h: 400 }
    code: "const x = 42;"
    language: typescript
    style: { fontFamily: "theme.fontMono", fontSize: 24, color: "theme.codeText", background: "theme.codeBg", borderRadius: 12, padding: 32 }
```

Creative techniques section rewritten with scene:

```yaml
# Giant background text
- kind: text
  id: bg-number
  frame: { x: -50, y: 100, w: 1000 }
  text: "01"
  style: { fontFamily: "Inter, sans-serif", fontSize: 400, fontWeight: 900, color: "rgba(255,255,255,0.03)", lineHeight: 1.0 }

# Overlapping accent shape
- kind: shape
  id: accent-block
  frame: { x: 0, y: 250, w: 300, h: 300 }
  shape: rect
  style: { fill: "rgba(79,109,245,0.08)" }
  borderRadius: 16

# Rotated decorative shape
- kind: shape
  id: rotated-accent
  frame: { x: 1400, y: -100, w: 400, h: 400 }
  shape: rect
  style: { fill: "rgba(79,109,245,0.05)" }
  borderRadius: 24
  transform: { rotate: 25 }
```

**Step 2: Verify the file is well-formed**

Read the file back, check for broken markdown or YAML in code blocks.

**Step 3: Commit**

```bash
git add .claude/skills/create-slides/reference.md
git commit -m "feat(skills): rewrite create-slides reference for v9 scene syntax

- Add scene node reference (text, shape, image, group, ir)
- Add FrameSpec, guides, anchors, presets, layout primitives
- Rewrite creative techniques with scene examples
- Keep template params, theme palettes, animations, density limits
- Remove all v8 component syntax and patterns"
```

---

### Task 4: Verify skills work end-to-end

**Step 1: Check skill descriptions render correctly**

```bash
ls -la .claude/skills/
ls -la .claude/skills/create-slides/
```

Expected: SKILL.md and reference.md in create-slides, no replicate-layout directory.

**Step 2: Read both files and verify no broken references**

Read SKILL.md — check no references to v8 components, no `type: heading`, `type: box` etc.
Read reference.md — check no "Component Tree Slides" section, no `type: box` examples.

**Step 3: Verify no broken cross-references**

The replicate-slides skill references `../replicate-slides/reference.md` (itself) — that's fine.
Check create-slides SKILL.md references `reference.md` — should still work.
Check no skill references `replicate-layout`.

**Step 4: Final commit if any fixups needed**

```bash
git add .claude/skills/
git commit -m "fix(skills): fixup skill cross-references after v9 update"
```
