# Template Normalization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Normalize the template system so slide and block templates use identical YAML conventions. Clean break — migrate all existing templates and slides to the new grammar, no backwards compatibility.

**Architecture:** (1) `scope: slide | block` becomes the canonical discriminator — `mode: scene` and `kind: group` are removed from template bodies. (2) Slide template references use nested `params:` — flat params are removed. (3) The expansion functions read `scope` from `DslTemplateDef` and inject the wrapper (`mode: scene` or `kind: group`) automatically. (4) All 35 built-in templates and 7 content `slides.yaml` files are migrated.

**Tech Stack:** TypeScript, Vitest, Nunjucks, YAML

---

## New Grammar

### Template file (both scopes identical structure)

```yaml
name: dashboard
scope: slide                 # ← the only difference
params:
  title: { type: string, required: true }
style:
  titleSize: { type: number, default: 56 }

# body: just children + scope-appropriate config (no mode: scene / kind: group)
background: { type: solid, color: "#111" }
guides: { x: { left: 160 } }
children:
  - kind: text
    id: title
    ...
```

```yaml
name: stat-badge
scope: block                 # ← block
params:
  value: { type: string, required: true }
style:
  valueSize: { type: number, default: 48 }

# body: children + block config
layout: { type: stack, gap: 8 }
children:
  - kind: text
    id: value
    ...
```

### Template reference in slides.yaml (both use params:)

```yaml
# Slide template reference
- template: dashboard
  params:
    title: "Hello"
    metrics: [...]
  style: { titleSize: 72 }

# Block template reference (inside children)
- kind: block
  id: metrics
  template: stat-badge
  params:
    value: "42"
  style: { valueSize: 36 }
```

---

### Task 1: Auto-infer `scope` in the loader + require it for new templates

**Files:**
- Modify: `src/lib/dsl/loader.ts:72-107`
- Modify: `src/lib/scene/block.test.ts`

**Step 1: Write the failing tests**

Add to `src/lib/scene/block.test.ts`:

```typescript
describe("scope auto-inference", () => {
  const slug = "__test-scope-infer__";
  const contentDir = path.join(process.cwd(), "content", slug);
  const templatesDir = path.join(contentDir, "templates");

  beforeAll(() => {
    fs.mkdirSync(templatesDir, { recursive: true });

    // Legacy template with mode: scene, no explicit scope → infer slide
    fs.writeFileSync(
      path.join(templatesDir, "legacy-slide.template.yaml"),
      `name: legacy-slide
params:
  title: { type: string }

mode: scene
children:
  - kind: text
    id: t
    frame: { w: 100 }
    text: "{{ title }}"
    style: { fontSize: 48, lineHeight: 1 }
`,
    );

    // Legacy template with kind: group, no explicit scope → infer block
    fs.writeFileSync(
      path.join(templatesDir, "legacy-block.template.yaml"),
      `name: legacy-block
params:
  label: { type: string }

kind: group
children:
  - kind: text
    id: t
    frame: { w: 100 }
    text: "{{ label }}"
    style: { fontSize: 16, lineHeight: 1 }
`,
    );

    // New normalized slide template (scope: slide, no mode: scene)
    fs.writeFileSync(
      path.join(templatesDir, "new-slide.template.yaml"),
      `name: new-slide
scope: slide
params:
  title: { type: string }

children:
  - kind: text
    id: t
    frame: { w: 100 }
    text: "{{ title }}"
    style: { fontSize: 48, lineHeight: 1 }
`,
    );
  });

  afterAll(() => {
    clearTemplateCache();
    fs.rmSync(contentDir, { recursive: true, force: true });
  });

  it("infers scope: slide from mode: scene", () => {
    const def = findTemplate("legacy-slide", slug);
    expect(def!.scope).toBe("slide");
  });

  it("infers scope: block from kind: group", () => {
    const def = findTemplate("legacy-block", slug);
    expect(def!.scope).toBe("block");
  });

  it("preserves explicit scope: slide without mode: scene", () => {
    const def = findTemplate("new-slide", slug);
    expect(def!.scope).toBe("slide");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun run test -- src/lib/scene/block.test.ts`
Expected: FAIL — inferred templates have `scope: undefined`

**Step 3: Implement**

In `src/lib/dsl/loader.ts`, add `inferScope` function and use it in `parseTemplateFile`:

```typescript
function inferScope(raw: string): "slide" | "block" | undefined {
  if (/^mode:\s*scene\b/m.test(raw)) return "slide";
  if (/^kind:\s*group\b/m.test(raw)) return "block";
  return undefined;
}
```

In `parseTemplateFile`, replace the scope line:

```typescript
const scope = (parsed.scope as "slide" | "block" | undefined) ?? inferScope(raw);

return {
  name: parsed.name ?? templateName,
  ...(parsed.alias ? { alias: parsed.alias } : {}),
  ...(scope ? { scope } : {}),
  params: parsed.params ?? {},
  style: parsed.style,
  sourcePath: filePath,
  rawBody: raw,
};
```

**Step 4: Run tests**

Run: `bun run test`
Expected: All pass

---

### Task 2: Switch `expandDslTemplate` to use `params:` key and `scope`

Remove flat param support. The function now reads params from `slideData.params`, and uses `scope` to decide whether `mode: scene` is required in the rendered output.

**Files:**
- Modify: `src/lib/dsl/engine.ts:195-283`
- Modify: `src/lib/dsl/engine.test.ts`

**Step 1: Write the failing tests**

Replace or add in `src/lib/dsl/engine.test.ts`:

```typescript
describe("normalized param passing", () => {
  it("reads params from nested params: key", () => {
    const def = makeDef({
      params: { title: { type: "string", required: true } },
      rawBody: `
mode: scene
children:
  - kind: text
    id: title
    frame: { x: 0, y: 0, w: 640 }
    text: "{{ title }}"
    style: { fontFamily: "heading", fontSize: 56, fontWeight: 700, color: "#fff", lineHeight: 1.1 }
`,
    });

    const result = expandDslTemplate(
      { template: "test", params: { title: "Nested Hello" } },
      def,
    );
    const children = (result as any).children;
    expect(children[0]).toMatchObject({ text: "Nested Hello" });
  });
});

describe("scope-based mode injection", () => {
  it("allows scope: slide templates to omit mode: scene", () => {
    const def = makeDef({
      scope: "slide",
      params: { title: { type: "string", required: true } },
      rawBody: `
name: normalized
scope: slide
params:
  title: { type: string, required: true }

background: { type: solid, color: "#111" }
children:
  - kind: text
    id: title
    frame: { x: 0, y: 0, w: 640 }
    text: "{{ title }}"
    style: { fontFamily: "heading", fontSize: 56, color: "#fff", lineHeight: 1.1 }
`,
    });

    const result = expandDslTemplate(
      { template: "test", params: { title: "No Mode" } },
      def,
    );
    expect(result).toHaveProperty("mode", "scene");
    expect((result as any).children[0]).toMatchObject({ text: "No Mode" });
  });

  it("rejects scope: block templates at slide level", () => {
    const def = makeDef({
      scope: "block",
      params: { label: { type: "string" } },
      rawBody: `kind: group\nchildren: []`,
    });

    expect(() =>
      expandDslTemplate({ template: "test", params: { label: "Hi" } }, def),
    ).toThrow(/scope.*block.*cannot.*slide/i);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bun run test -- src/lib/dsl/engine.test.ts`
Expected: FAIL

**Step 3: Implement**

In `expandDslTemplate`, make these changes:

1. Add scope validation at the top:
```typescript
if (templateDef.scope === "block") {
  throw new Error(
    `[dsl] Template "${templateDef.name}" has scope: block and cannot be used at slide level. ` +
    `Use it as a kind: block node inside children instead.`,
  );
}
```

2. Read params from `slideData.params` instead of flat `slideData`:
```typescript
const params = (slideData.params ?? {}) as Record<string, unknown>;
```

3. Update validation to use `params`:
```typescript
for (const [name, def] of Object.entries(templateDef.params)) {
  if (def.required && !(name in params)) {
    throw new Error(...);
  }
}
```

4. Update context building to use `params`:
```typescript
for (const name of Object.keys(templateDef.params)) {
  if (name in params) {
    context[name] = smartify(params[name]);
  }
}
```

5. Change `mode: scene` validation to allow omission when `scope: slide`:
```typescript
if (parsed.mode !== "scene" && parsed.mode !== undefined) {
  throw new Error(
    `[dsl] Template "${templateDef.name}" emits mode: ${parsed.mode}, expected scene or omitted`,
  );
}
```

6. Also update all existing tests in `engine.test.ts` that use flat params to use nested `params:` syntax:

Every test call like:
```typescript
expandDslTemplate({ template: "test", title: "Hello World" }, def)
```
becomes:
```typescript
expandDslTemplate({ template: "test", params: { title: "Hello World" } }, def)
```

And style overrides stay at the top level:
```typescript
expandDslTemplate({ template: "test", params: { title: "Test" }, style: { titleSize: 72 } }, def)
```

**Step 4: Run tests**

Run: `bun run test`
Expected: All pass

---

### Task 3: Update `expandBlockTemplate` for scope validation and optional `kind: group`

**Files:**
- Modify: `src/lib/dsl/block.ts:267-272`
- Modify: `src/lib/scene/block.test.ts`

**Step 1: Write the failing tests**

Add to `src/lib/scene/block.test.ts`:

```typescript
it("allows scope: block templates to omit kind: group", () => {
  const def = makeBlockDef({
    scope: "block",
    params: { label: { type: "string", required: true } },
    rawBody: `
name: norm
scope: block
params:
  label: { type: string, required: true }

layout: { type: stack, gap: 8 }
children:
  - kind: text
    id: label
    frame: { w: 200 }
    text: "{{ label }}"
    style: { fontSize: 24, lineHeight: 1.2 }
`,
  });

  const blockNode: SceneBlockNode = {
    kind: "block",
    id: "norm",
    template: "norm",
    params: { label: "Works" },
  };

  const result = expandBlockTemplate(blockNode, def);
  expect(result.node.kind).toBe("group");
  expect(result.node.layout).toMatchObject({ type: "stack", gap: 8 });
});

it("rejects scope: slide templates used as blocks", () => {
  const def = makeBlockDef({
    scope: "slide",
    rawBody: `mode: scene\nchildren: []`,
  });

  const blockNode: SceneBlockNode = {
    kind: "block",
    id: "wrong",
    template: "test-block",
  };

  expect(() => expandBlockTemplate(blockNode, def)).toThrow(
    /scope.*slide.*cannot.*block/i,
  );
});
```

**Step 2: Run tests to verify they fail**

Run: `bun run test -- src/lib/scene/block.test.ts`

**Step 3: Implement**

In `expandBlockTemplate` (block.ts):

1. Add scope validation at top:
```typescript
if (templateDef.scope === "slide") {
  throw new Error(
    `[block] Template "${templateDef.name}" has scope: slide and cannot be used as a block. ` +
    `Use it as a slide-level template: reference instead.`,
  );
}
```

2. Change the kind validation to allow omission:
```typescript
if (parsed.mode === "scene") {
  throw new Error(
    `[block] Block template "${templateDef.name}" must not emit mode: scene.`,
  );
}
if (parsed.kind !== undefined && parsed.kind !== "group") {
  throw new Error(
    `[block] Block template "${templateDef.name}" must emit kind: group. Got: ${parsed.kind}`,
  );
}
if (!parsed.children) {
  throw new Error(
    `[block] Block template "${templateDef.name}" must have children.`,
  );
}
```

**Step 4: Run tests**

Run: `bun run test`
Expected: All pass

---

### Task 4: Extract shared Nunjucks environment into `src/lib/dsl/nunjucks-env.ts`

**Files:**
- Create: `src/lib/dsl/nunjucks-env.ts`
- Modify: `src/lib/dsl/engine.ts`
- Modify: `src/lib/dsl/block.ts`

**Step 1: Create `src/lib/dsl/nunjucks-env.ts`**

Extract from engine.ts: `configureEnvironment`, `createEnvironment`, `SmartArray`, `smartify`, path constants, and the `estimateTextHeight` import. Export `createTemplateEnvironment` and `smartify`.

**Step 2: Update engine.ts**

Remove duplicated code. Import from shared:
```typescript
import { createTemplateEnvironment, smartify } from "./nunjucks-env";
```
Replace `createEnvironment(templateDef)` with `createTemplateEnvironment(templateDef)`.

**Step 3: Update block.ts**

Remove duplicated code. Import from shared:
```typescript
import { createTemplateEnvironment, smartify } from "./nunjucks-env";
```
Replace `createEnvironment(templateDef)` with `createTemplateEnvironment(templateDef)`.

**Step 4: Run full test suite**

Run: `bun run test`
Expected: All pass — pure refactor

---

### Task 5: Migrate 35 built-in templates

For each template in `src/lib/layout/templates/*.template.yaml`:
1. Add `scope: slide` after the `name:` line
2. Remove the `mode: scene` line from the body

**Files:**
- Modify: all 35 files in `src/lib/layout/templates/*.template.yaml`

**Step 1: Write a test that verifies all built-in templates have scope and no mode: scene**

Add to `src/lib/dsl/engine.test.ts`:

```typescript
describe("built-in template normalization", () => {
  const templateDir = path.join(process.cwd(), "src/lib/layout/templates");
  const files = fs.readdirSync(templateDir).filter((f) => f.endsWith(".template.yaml"));

  it.each(files)("%s has scope: slide and no mode: scene in body", (file) => {
    const raw = fs.readFileSync(path.join(templateDir, file), "utf-8");
    const def = findTemplate(file.replace(".template.yaml", ""));
    expect(def).not.toBeNull();
    expect(def!.scope).toBe("slide");
    // After migration, mode: scene should not be in the raw body
    // (unless it's inside a Nunjucks comment or something)
    expect(raw).not.toMatch(/^mode:\s*scene\b/m);
  });
});
```

**Step 2: Run test to verify it fails**

Expected: FAIL — templates still have `mode: scene` and no `scope: slide`

**Step 3: Migrate**

For each template file, mechanically:
- Add `scope: slide` right after the `name:` line (before `alias:` if present, otherwise before `params:`)
- Remove the line `mode: scene` from the body

This can be done with a script or manually. The templates all follow the same pattern:

```
name: <name>
[alias: <alias>]
params:
  ...
style:
  ...

[{% import ... %}]
[{% set ... %}]
mode: scene    ← remove this line
presets:
  ...
children:
  ...
```

Becomes:

```
name: <name>
scope: slide   ← add this line
[alias: <alias>]
params:
  ...
style:
  ...

[{% import ... %}]
[{% set ... %}]
presets:
  ...
children:
  ...
```

**Step 4: Run full test suite**

Run: `bun run test`
Expected: All pass

---

### Task 6: Migrate content `slides.yaml` files to nested `params:`

Migrate all 7 content presentations from flat params to nested `params:`. For each slide that uses `template:`, wrap the param values under a `params:` key.

**Files:**
- Modify: `content/example-v9/slides.yaml`
- Modify: `content/five-dynasties-v9/slides.yaml`
- Modify: `content/v9-features/slides.yaml`
- Modify: `content/v9-templates/slides.yaml`
- Modify: `content/superbowl-v9/slides.yaml`
- Modify: `content/us-israel-iran-war-2026-v9/slides.yaml`
- Modify: `content/replicate-iran-war-2026-v9/slides.yaml`

Each template reference like:

```yaml
- template: cover
  title: "Hello"
  subtitle: "World"
  image: photo.jpg
```

Becomes:

```yaml
- template: cover
  params:
    title: "Hello"
    subtitle: "World"
    image: photo.jpg
```

Reserved top-level keys that stay outside `params:`: `template`, `params`, `style`, `animation`, `theme`, `presets`, `background`, `guides`, `sourceSize`, `fit`, `align`.

Everything else (the template's declared params) moves under `params:`.

**Step 1: Write a migration script**

Create a temporary script (or do it inline) that for each `slides.yaml`:
1. Parse the YAML
2. For each slide with a `template:` key
3. Look up the template's param names via `findTemplate`
4. Move matching keys under `params:`
5. Write back

Alternatively, since `content/` is a submodule, this can be done carefully with manual edits or a purpose-built Node script.

**Step 2: Run full test suite after migration**

Run: `bun run test`
Expected: All pass

**Step 3: Verify presentations render**

Run: `bun run dev`
Check each presentation at `http://localhost:3000/<slug>` to confirm they render correctly.

---

### Task 7: Update `integration.test.ts` to use nested `params:`

The integration tests in `src/lib/dsl/integration.test.ts` use the `expandDsl` helper which passes flat params. Update to use nested `params:`.

**Files:**
- Modify: `src/lib/dsl/integration.test.ts`

**Step 1: Update the `expandDsl` helper**

Change from:
```typescript
function expandDsl(templateName: string, params: Record<string, unknown>): SlideData {
  const def = findTemplate(templateName);
  return expandDslTemplate({ template: templateName, ...params }, def!);
}
```

To:
```typescript
function expandDsl(templateName: string, params: Record<string, unknown>): SlideData {
  const def = findTemplate(templateName);
  return expandDslTemplate({ template: templateName, params }, def!);
}
```

**Step 2: Check for any other flat-param usage patterns**

Search the test file for direct `expandDslTemplate` calls that use flat params. Update them all to nested.

**Step 3: Run tests**

Run: `bun run test -- src/lib/dsl/integration.test.ts`
Expected: All pass

**Step 4: Run full suite**

Run: `bun run test`
Expected: All pass

---

### Task 8: Update `loadPresentation.test.ts` to use nested `params:`

**Files:**
- Modify: `src/lib/loadPresentation.test.ts`

Update any test slides.yaml content that uses flat params to use nested `params:`. The block expansion test from the earlier implementation already uses `params:` on the block node, but check for any template references that use flat params.

Run: `bun run test`
Expected: All pass

---

## Summary

| Task | What | Scope |
|------|------|-------|
| 1 | Auto-infer `scope` in loader | `loader.ts` |
| 2 | `expandDslTemplate` uses `params:` + scope | `engine.ts`, `engine.test.ts` |
| 3 | `expandBlockTemplate` scope validation + optional `kind: group` | `block.ts`, `block.test.ts` |
| 4 | Extract shared Nunjucks env (DRY) | new `nunjucks-env.ts`, `engine.ts`, `block.ts` |
| 5 | Migrate 35 built-in templates | `templates/*.template.yaml` |
| 6 | Migrate 7 content `slides.yaml` files | `content/*/slides.yaml` |
| 7 | Update `integration.test.ts` | `integration.test.ts` |
| 8 | Update `loadPresentation.test.ts` | `loadPresentation.test.ts` |

After this, the AI generation contract is:

1. **Set `scope: slide` or `scope: block`** in the template header
2. **Write `children:` plus scope-appropriate config** in the body
3. **Use `params:` + `style:` for all template references** — identical shape regardless of scope
