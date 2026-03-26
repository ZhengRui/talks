# Skill Updates Design: v9 Scene Architecture

## Summary

Update the slide generation skills to match the v9 scene-first architecture. The component layer has been removed — skills must emit scene YAML, not component trees.

## Changes

### 1. Delete replicate-layout skill

The replicate-layout skill produces v8 component-tree wireframes (box + text + spacer). The component layer no longer exists. The skill's value was questionable even in v8 — it was a stepping stone before full replication, but in practice users went straight to replicate-slides. Delete it.

### 2. Rewrite create-slides skill

**Current state:** References v8 components (type: heading, type: box, type: raw), auto-layout (layout: { type: flex }), and templates expanding to component trees. All examples use component syntax.

**New design:**

#### Three generation modes

| Mode | Trigger | Behavior |
|------|---------|----------|
| Auto (default) | No preference stated | Route each slide: template if natural fit, scene YAML if not |
| Scene-only | User says "no templates" / "freely" / "freeform" | All slides as freeform scene YAML |
| Template-only | User says "use templates" / "only templates" | Pick best-fit template for each slide |

Mode is detected from user wording, not an explicit flag.

#### Auto-routing logic

"Fits naturally" = slide content maps to template params without stretching:
- Title + subtitle → cover
- Title + 3-5 bullets → bullets
- 2-4 numbers with labels → stats
- Single quote + attribution → quote
- Code block → code
- etc.

If you'd need to ignore half the template's params or add elements the template doesn't support → use scene.

#### Scene YAML output format

All freeform slides use v9 scene nodes:
- kind: text, shape, image, group, ir
- FrameSpec for positioning (left, right, centerX, etc.)
- Guides for named alignment points
- Presets for reusable style defaults
- Stack/row/grid layout on groups
- Theme tokens (theme.accent, theme.bg, etc.)

#### What stays

- Design philosophy (asymmetry, scale contrast, whitespace, layering, etc.)
- Theme selection guide
- Workflow phases (understand → theme → plan → write → review)
- All 35 templates (they already emit mode: scene)

#### What's deleted

- All v8 component syntax and examples
- Component tree reference in reference.md
- References to auto-layout, box variants, flex/grid component layout

### 3. Update replicate-slides skill (future)

Also references v8 raw IR + components. Needs updating to scene format. Not in scope for this task — can be done separately.

## Implementation Plan

1. Delete `.claude/skills/replicate-layout/` directory
2. Rewrite `.claude/skills/create-slides/SKILL.md` with scene-first content and three-mode decision tree
3. Rewrite `.claude/skills/create-slides/reference.md` with scene syntax reference, template params, theme palettes
4. Test by invoking the skill and verifying output is valid scene YAML
