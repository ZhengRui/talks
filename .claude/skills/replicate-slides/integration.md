# Repo Integration Reference

> This file covers repo integration for the replicate-slides skill. It will be optimized in a future pass.

---

## Two-Layer Model

### Layer 1: Core Replication Contract

This is the default mode. It is the right model for an API or service.

- Input: screenshot or visual source, optional markup, optional user corrections
- Output: analysis, reusable template YAML (slide + block), slide instance YAML, verification plan
- No arbitrary repo reads
- No file writes
- No invented slugs, decks, or scratch paths

Use this layer unless the caller explicitly wants repo integration.

### Layer 2: Repo Adapter

This is the repo-specific wrapper around Layer 1.

- Input: Layer 1 inputs plus slug and target slide or explicit repo path
- Output: files written under `content/<slug>/...`, plus repo verification artifacts
- Minimal allowed reads: target `slides.yaml`, target template file if updating, target deck assets
- Minimal allowed writes: target templates (slide + block), target slide entry, optional overlay refs
- Verification surfaces: `/workbench/replicate` and `bun run slide:diff`

Do not enter Layer 2 just because the repo is available. Enter it only when the user asks for repo changes or provides a concrete target deck.

---

## Choose The Layer

- If the user asked for a service-style result, API payload, or did not provide a concrete slug or output path, stay in Layer 1.
- If the user explicitly asked for repo edits or provided a real deck target, use Layer 2.
- If slug or path is missing, do not invent one. Return Layer 1 output instead.

---

## Verify

- In Layer 1, return a verification plan and recommended commands or URLs.
- In Layer 2, use the repo's named verification surfaces:
  - interactive review: `/workbench/replicate`
  - overlay viewer:
    - `/<slug>?slide=12&chrome=0&overlay=refs/slide-12.png&overlayOpacity=0.5`
    - `/<slug>?slide=12&chrome=0&overlayDir=refs&overlayPattern=slide-{n}.png&overlayOpacity=0.5`
  - CLI diff:
    - `bun run slide:diff -- --slug <slug> --slide <n> --reference /absolute/path/to/reference.png`

Use `overlay` for alignment and spacing. Use `diff` for fast mismatch inspection.
If `slide:diff` is used, describe it by that name even though the script uses Playwright internally. Do not present a raw Playwright screenshot loop as the public workflow.

---

## Service-Safe Rules

### Default Read Boundary

In Layer 1, only read:

- the provided screenshot or reference asset
- the provided HTML/CSS or markup, if any
- this skill and its reference

Do not read:

- unrelated `slides.yaml` files
- existing decks just to infer format
- solver or engine internals
- arbitrary theme files or implementation code

### When Repo Reads Are Allowed

In Layer 2, read only what is minimally necessary:

- `content/<slug>/slides.yaml`
- `content/<slug>/templates/<template-name>.template.yaml` if updating rather than creating
- target deck assets or `public/<slug>/refs/` if verification setup needs them

Only inspect implementation code if:

- the skill/reference is insufficient to produce valid v9 scene YAML, or
- repo integration fails and you are debugging a compile or runtime issue

### Write Boundary

- Layer 1: no writes
- Layer 2: write only the requested templates (slide + block), slide instance, and verification support files
- Never invent a scratch slug or temporary deck unless the user explicitly asked for one
- If creating a new `slides.yaml`, write a full presentation wrapper with at least `title` and `slides`
- `theme` is optional; do not invent an invalid theme name
- If no repo theme is a good match, omit `theme` and rely on explicit scene styles for fidelity

### Output Contract

Layer 1 should return:

1. analysis (including block template candidates)
2. authoring decision
3. block-scope template YAML (if any)
4. slide-scope template YAML
5. slide instance YAML
6. verification plan

Layer 2 should return:

1. analysis
2. authoring decision
3. template file contents (slide + block)
4. slide instance YAML
5. concrete file paths written
6. verification method and, if run, diff result

---

## Repo Adapter Workflow

When Layer 2 is active:

1. run Layer 1 logic first
2. write or update block template files (if any)
3. write or update the slide template file
4. write or update the slide instance
5. set up overlay refs only if needed
6. verify with `/workbench/replicate` or `bun run slide:diff`

---

## Deck-Local Template Output

File location:

```text
content/<slug>/templates/<template-name>.template.yaml
```

The loader checks deck-local templates before built-ins, so no registry update is needed.

Typical replication output is:

1. block template files (if any)
2. slide template file
3. slide instance in `content/<slug>/slides.yaml`

This section applies to Layer 2 only. In Layer 1, return the same material as payload rather than writing files.

---

## Verification Tooling

### Workbench

Use `/workbench/replicate` for:

- slide selection
- reference upload
- render / reference / overlay / diff / split modes
- viewer URL generation

Reference path conventions:

- per-slide refs in `public/<slug>/refs/slide-12.png` can be entered as `refs/slide-12.png`
- absolute `/shared/...` style paths also work
- uploaded screenshots work without creating a public file

### CLI Diff

```bash
bun run slide:diff -- --slug <slug> --slide <n> --reference /absolute/path/to/reference.png
```

Useful flags:

- `--base-url http://127.0.0.1:3000`
- `--threshold 24`
- `--max-mismatch 0.02`
- `--out-dir .artifacts/slide-diff`

Outputs:

- rendered PNG
- diff PNG
- JSON report with mismatch ratio

`slide:diff` uses Playwright internally. Treat that as an implementation detail, not as a separate public workflow.
