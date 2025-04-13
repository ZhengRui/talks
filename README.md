# Presentation Hub

A centralized web application for creating, hosting, and presenting interactive slides. Built with Next.js, Reveal.js, and Three.js.

## Features

- **Centralized Presentation Repository**: Single platform for all presentations
- **Multiple Content Creation Methods**:
  - Server-side rendered MDX slides with React components
  - Client-side rendered Markdown via Reveal.js plugin
  - Custom React component slides
- **Interactive Elements**: Support for embedding 3D graphics with Three.js
- **Modern Stack**: Next.js, TypeScript, Tailwind CSS

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── page.tsx            # Home page with presentation listing
│   └── [slug]/             # Dynamic routes for presentations
│       └── page.tsx        # Individual presentation pages
├── components/             # Reusable components
│   ├── MdxSlide.tsx        # Server-rendered MDX slides
│   ├── MarkdownSlide.tsx   # Client-rendered Markdown slides
│   └── RevealPresentation.tsx # Core presentation component
└── utils/                  # Utility functions
    └── mdxUtils.ts         # MDX processing utilities
```

## Getting Started

1. **Installation**

```bash
bun install
```

2. **Development Server**

```bash
bun run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000).

## Creating a New Presentation

1. Create a new directory in `src/app/[your-presentation-slug]/`
2. Add your presentation content:
   - `advanced.mdx` for MDX content with React components
   - Markdown files in `public/[your-presentation-slug]/` for client-side rendering
   - Custom React components as needed
3. Create a `page.tsx` file using the components:

```tsx
import RevealPresentation from "@/components/RevealPresentation";
import { MdxSlide } from "@/components/MdxSlide";
import { MarkdownSlide } from "@/components/MarkdownSlide";

export default function PresentationPage() {
  const slug = "your-presentation-slug";
  
  return (
    <main className="min-h-screen h-screen">
      <RevealPresentation>
        <MdxSlide filePath="advanced.mdx" slug={slug} />
        <MarkdownSlide filePath="simple.md" slug={slug} />
        <section>
          <h1>React Component Slide</h1>
          <p>Custom slide content goes here</p>
        </section>
      </RevealPresentation>
    </main>
  );
}
```

## Project Status

See [status.md](./status.md) for current development status and roadmap.

## License

MIT
