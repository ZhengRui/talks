# PRD: Presentation Hub

## Overview

A web application serving as a central repository for hosting and presenting talks. Each presentation is authored as a single YAML file paired with images — no custom code required.

## Goals

- Single platform for all presentations
- Zero-code authoring: YAML + images only
- Auto-discovery: adding a presentation requires no code changes
- Consistent, polished slide layouts via reusable templates

## Non-Goals

- Visual slide editor
- Real-time collaboration
- PDF export (may add later)

## Requirements

### Content Authoring
- Presentations defined in `content/[slug]/slides.yaml`
- Images referenced by filename, served from `public/[slug]/`
- Template field selects layout; all styling handled by template components

### Template System
- Each template is a pure React component returning a Reveal.js `<section>`
- Adding a template is a 3-file change (type, component, registry)
- Templates available at launch: `cover`, `bullets`, `image-text`, `full-image`

### Discovery & Routing
- Home page auto-discovers all presentations by scanning `content/`
- Each presentation gets a dynamic route at `/{slug}`
- Static generation via `generateStaticParams` at build time

### Presentation Runtime
- Reveal.js handles navigation, transitions, and speaker notes
- Fixed 1920x1080 aspect ratio for consistency
