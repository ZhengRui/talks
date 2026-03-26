# Replicate-Layout Skill Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a `replicate-layout` skill that replicates slide layout skeletons as pure component tree wireframes — colored placeholder boxes with labels, no content, no raw IR.

**Architecture:** Single SKILL.md file at `.claude/skills/replicate-layout/SKILL.md`. References the existing `replicate-slides/reference.md` for box behavior rules and component defaults. Uses only `box`, `text`, and `spacer` components. Output is valid YAML that renders as a colored wireframe on the 1920×1080 canvas.

**Tech Stack:** Markdown skill documentation + YAML slide output. Verification via `bun run dev` + visual inspection.

---

### Task 1: Create the replicate-layout SKILL.md

**Files:**
- Create: `.claude/skills/replicate-layout/SKILL.md`

**Step 1: Create the skill directory**

```bash
mkdir -p .claude/skills/replicate-layout
```

**Step 2: Write the SKILL.md file**

Write the complete skill file with these sections:

**Frontmatter:**
```yaml
---
name: replicate-layout
description: Use when replicating the layout skeleton of a slide from a screenshot. Produces a pure component-tree wireframe with colored placeholder boxes — no content, no raw IR. Use this to verify spatial proportions before full replication with replicate-slides.
---
```

**Body sections (in order):**

1. **Purpose** — One paragraph: replicates spatial skeleton as colored wireframe. Position in pipeline: `screenshot → replicate-layout → wireframe → replicate-slides → final slide`. Links to `../replicate-slides/reference.md` for box behavior rules.

2. **Input** — Same table as replicate-slides (screenshot / HTML / description with priority). Add: "Ask for the presentation slug if not obvious."

3. **Core Principle: Pure Component Wireframe** — Short section explaining:
   - Every region is a `box` with a colored fill and a `text` label child
   - Only uses `box`, `text`, and `spacer` components — no `raw`, no `heading`, no `stat`, etc.
   - Components handle centering, spacing, distribution automatically via `verticalAlign`, `layout`, `padding`, `gap`
   - The skeleton IS the scaffold that `replicate-slides` fills in later

4. **Color Coding Convention** — Table:
   | Region type | Fill | Use for |
   |-------------|------|---------|
   | Content area | `#2a2a3a` | Text blocks (heading, body, tag regions) |
   | Panel / sidebar | `#1a1a2a` | Distinct background panels |
   | Card / item | `#3a3a4a` | Repeated items (cards, list items, stats) |
   | Decorative | `#4a3a2a` | Accent strips, dividers, decorative shapes |
   | Image | `#2a3a2a` | Image placeholders |

5. **Two-Phase Process**

   **Phase 1: Analyze Layout** — Examine the source and produce a structured breakdown. Output format:
   ```
   LAYOUT ANALYSIS:
     Canvas: 1920×1080
     Structure: [single-column | two-panel (ratio) | grid | hero-centered | freeform]
     Regions:
       - [region name] → [position/size description] → [box purpose]
       - ...
     Vertical distribution: [centered | top-aligned | space-between | custom padding]
     Gaps: [key spacing values in px]
     Decorative elements: [noted for replicate-slides, represented as simple boxes here]
   ```

   What to detect:
   - Overall structure type and split ratios
   - Every distinct visual region with approximate position/size
   - How content is vertically distributed (centered? top-padded? evenly spaced?)
   - Gap and padding patterns
   - Decorative elements (noted but rendered as simple colored boxes)

   **Phase 2: Build Skeleton** — Translate analysis to component tree:
   1. Start with slide `background` color
   2. Top-level `box` (variant: flat, padding: 0, height: 1080)
   3. For panel splits: `layout: { type: flex, direction: row }` with child boxes having explicit `width`
   4. For vertical stacking: `layout: { type: flex, direction: column, gap: N }`
   5. For grids: `layout: { type: grid, columns: N, gap: N }`
   6. For vertical centering: `verticalAlign: center` on the containing box
   7. Every leaf region: `box` with `variant: panel`, `background: <color>`, `height: <estimated>`, with a `text` child labeling it

   **Critical rules** (link to reference.md for full list):
   - Box default padding is 28px — set `padding: 0` on structural containers
   - Box default variant is `card` (has fill/shadow/border) — use `variant: flat` for invisible containers, `variant: panel` for placeholder regions
   - Flex children without explicit `width` get equal shares
   - `verticalAlign` shifts content within the box, not the box position
   - Gap is inside `layout`, not a direct box prop: `layout: { type: flex, direction: column, gap: 24 }`

6. **Workflow Summary** — Numbered steps:
   1. Receive screenshot + slug
   2. Phase 1: Output `LAYOUT ANALYSIS` block
   3. Phase 2: Build skeleton component tree
   4. Output complete YAML, append to `content/[slug]/slides.yaml`
   5. User renders and compares wireframe against original

7. **Examples** — Three examples showing increasing complexity:

   **Example 1: Single-column centered hero**
   - Input: dark slide, centered heading + subtitle
   - Analysis: hero-centered, 2 text regions, vertically centered
   - Output: box(flat, h:1080, verticalAlign:center) → box(panel, HEADING) + box(panel, SUBTITLE)

   ```yaml
   - background: "#0a0a0a"
     children:
       - type: box
         variant: flat
         padding: 0
         height: 1080
         verticalAlign: center
         layout: { type: flex, direction: column, gap: 24 }
         children:
           - type: box
             variant: panel
             background: "#2a2a3a"
             height: 70
             width: 600
             margin: [0, auto]
             children:
               - type: text
                 text: "HEADING"
                 fontSize: 14
                 color: "#666"
                 textAlign: center
           - type: box
             variant: panel
             background: "#2a2a3a"
             height: 30
             width: 400
             margin: [0, auto]
             children:
               - type: text
                 text: "SUBTITLE"
                 fontSize: 12
                 color: "#666"
                 textAlign: center
   ```

   **Example 2: Two-panel split (65/35)**
   - Input: left panel with tag + heading + body + 2×2 cards, right panel with chart/stats
   - Analysis: two-panel 65/35, left has 4 text regions + card grid, right has stats panel
   - Output: box(flex-row) → left box(w:1250, flex-col, padding) + right box(panel bg, verticalAlign:center)

   ```yaml
   - background: "#1c1d35"
     children:
       - type: box
         variant: flat
         padding: 0
         height: 1080
         layout: { type: flex, direction: row }
         children:
           # Left panel
           - type: box
             variant: flat
             width: 1250
             padding: [180, 80, 80, 220]
             layout: { type: flex, direction: column, gap: 24 }
             children:
               - type: box
                 variant: panel
                 background: "#2a2a3a"
                 height: 24
                 width: 200
                 children:
                   - type: text
                     text: "TAG"
                     fontSize: 12
                     color: "#666"
               - type: box
                 variant: panel
                 background: "#2a2a3a"
                 height: 52
                 children:
                   - type: text
                     text: "HEADING"
                     fontSize: 14
                     color: "#666"
               - type: box
                 variant: panel
                 background: "#4a3a2a"
                 height: 4
                 width: 80
               - type: box
                 variant: panel
                 background: "#2a2a3a"
                 height: 55
                 width: 530
                 children:
                   - type: text
                     text: "BODY TEXT"
                     fontSize: 12
                     color: "#666"
               # Card grid
               - type: box
                 variant: flat
                 padding: 0
                 layout: { type: grid, columns: 2, gap: 20 }
                 children:
                   - type: box
                     variant: panel
                     background: "#3a3a4a"
                     height: 115
                     borderRadius: 10
                     children:
                       - type: text
                         text: "CARD 1"
                         fontSize: 12
                         color: "#666"
                   - type: box
                     variant: panel
                     background: "#3a3a4a"
                     height: 115
                     borderRadius: 10
                     children:
                       - type: text
                         text: "CARD 2"
                         fontSize: 12
                         color: "#666"
                   - type: box
                     variant: panel
                     background: "#3a3a4a"
                     height: 115
                     borderRadius: 10
                     children:
                       - type: text
                         text: "CARD 3"
                         fontSize: 12
                         color: "#666"
                   - type: box
                     variant: panel
                     background: "#3a3a4a"
                     height: 115
                     borderRadius: 10
                     children:
                       - type: text
                         text: "CARD 4"
                         fontSize: 12
                         color: "#666"

           # Right panel
           - type: box
             variant: panel
             background: "#1a1a2a"
             verticalAlign: center
             padding: [40, 40]
             borderRadius: 14
             layout: { type: flex, direction: column, gap: 16 }
             children:
               - type: box
                 variant: panel
                 background: "#3a3a4a"
                 height: 65
                 children:
                   - type: text
                     text: "ICON"
                     fontSize: 12
                     color: "#666"
                     textAlign: center
               - type: box
                 variant: panel
                 background: "#2a2a3a"
                 height: 26
                 children:
                   - type: text
                     text: "PANEL TITLE"
                     fontSize: 12
                     color: "#666"
                     textAlign: center
               - type: box
                 variant: panel
                 background: "#3a3a4a"
                 height: 26
                 children:
                   - type: text
                     text: "BAR 1"
                     fontSize: 12
                     color: "#666"
               - type: box
                 variant: panel
                 background: "#3a3a4a"
                 height: 26
                 children:
                   - type: text
                     text: "BAR 2"
                     fontSize: 12
                     color: "#666"
               - type: box
                 variant: panel
                 background: "#3a3a4a"
                 height: 26
                 children:
                   - type: text
                     text: "BAR 3"
                     fontSize: 12
                     color: "#666"
               - type: box
                 variant: panel
                 background: "#3a3a4a"
                 height: 26
                 children:
                   - type: text
                     text: "BAR 4"
                     fontSize: 12
                     color: "#666"
   ```

   **Example 3: Grid of cards with decorative top strip**
   - Input: dark slide, 3-column grid of 6 cards, centered heading above, thin accent strip at top
   - Analysis: single-column with grid, heading centered, decorative strip
   - Output: box(flat, h:1080) → decorative strip box + centered heading box + grid box(3 cols)

   ```yaml
   - background: "#0f0f0f"
     children:
       - type: box
         variant: flat
         padding: 0
         height: 1080
         layout: { type: flex, direction: column }
         children:
           # Decorative accent strip
           - type: box
             variant: panel
             background: "#4a3a2a"
             height: 4
           # Spacing above heading
           - type: spacer
             height: 160
           # Heading region
           - type: box
             variant: panel
             background: "#2a2a3a"
             height: 60
             width: 500
             margin: [0, auto]
             children:
               - type: text
                 text: "HEADING"
                 fontSize: 14
                 color: "#666"
                 textAlign: center
           # Spacing
           - type: spacer
             height: 40
           # Card grid
           - type: box
             variant: flat
             padding: [0, 80]
             layout: { type: grid, columns: 3, gap: 24 }
             children:
               - type: box
                 variant: panel
                 background: "#3a3a4a"
                 height: 200
                 borderRadius: 12
                 children:
                   - type: text
                     text: "CARD 1"
                     fontSize: 12
                     color: "#666"
               - type: box
                 variant: panel
                 background: "#3a3a4a"
                 height: 200
                 borderRadius: 12
                 children:
                   - type: text
                     text: "CARD 2"
                     fontSize: 12
                     color: "#666"
               - type: box
                 variant: panel
                 background: "#3a3a4a"
                 height: 200
                 borderRadius: 12
                 children:
                   - type: text
                     text: "CARD 3"
                     fontSize: 12
                     color: "#666"
               - type: box
                 variant: panel
                 background: "#3a3a4a"
                 height: 200
                 borderRadius: 12
                 children:
                   - type: text
                     text: "CARD 4"
                     fontSize: 12
                     color: "#666"
               - type: box
                 variant: panel
                 background: "#3a3a4a"
                 height: 200
                 borderRadius: 12
                 children:
                   - type: text
                     text: "CARD 5"
                     fontSize: 12
                     color: "#666"
               - type: box
                 variant: panel
                 background: "#3a3a4a"
                 height: 200
                 borderRadius: 12
                 children:
                   - type: text
                     text: "CARD 6"
                     fontSize: 12
                     color: "#666"
           # Bottom spacing
           - type: spacer
             flex: true
   ```

**Step 3: Commit**

```bash
git add .claude/skills/replicate-layout/SKILL.md
git commit -m "feat(skills): add replicate-layout skill for wireframe skeleton replication"
```

---

### Task 2: Test — Replicate the test-replicate slide layout

**Files:**
- Modify: `content/test-replicate/slides.yaml` (replace existing slide with wireframe version)

**Step 1: Use the replicate-layout skill**

Use the new skill to replicate the layout of the original test-replicate slide (the "Axis of Resistance" slide). The original screenshot should be available — use it as input with slug `test-replicate`.

Run through both phases:
1. Produce the `LAYOUT ANALYSIS` block
2. Build the skeleton component tree

**Step 2: Replace the slide YAML**

Replace the existing pure-raw-IR slide in `content/test-replicate/slides.yaml` with the wireframe skeleton output.

**Step 3: Visual verification**

```bash
bun run dev
```

Open `http://localhost:3000/test-replicate` and take a screenshot. Compare the wireframe against the original slide screenshot — verify:
- Overall structure matches (two-panel split, card grid placement)
- Content is vertically centered/distributed correctly (not pushed to top)
- Panel proportions are right
- Card grid spacing is right
- Right panel is properly positioned

**Step 4: Iterate if needed**

If spatial proportions are off, adjust the skeleton YAML and re-check. This is the key test — if the wireframe matches, the skill works.

**Step 5: Commit**

```bash
git add content/test-replicate/slides.yaml
git commit -m "test(replicate-layout): wireframe skeleton for axis-of-resistance slide"
```

---

### Task 3: Verify skill docs are accurate

**Step 1: Review SKILL.md against test results**

After Task 2, check if any box behavior surprised us:
- Did `variant: panel` add unexpected styling?
- Did padding/gap defaults interfere?
- Did `verticalAlign: center` work as documented?

**Step 2: Fix any documentation gaps**

Update SKILL.md if any critical rules were missing or wrong.

**Step 3: Commit if changes were made**

```bash
git add .claude/skills/replicate-layout/SKILL.md
git commit -m "docs(replicate-layout): refinements from visual verification"
```
