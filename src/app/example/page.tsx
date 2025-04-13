// src/app/example/page.tsx
import RevealPresentation from "@/components/RevealPresentation";
import { MdxSlide } from "@/components/MdxSlide";
import { MarkdownSlide } from "@/components/MarkdownSlide";
import SimpleComponent from "./SimpleComponent";

// Define components that can be used within MDX
const mdxComponents = {
  SimpleComponent,
};

export default async function PresentationPage() {
  // Get the current presentation slug based on the folder name
  const slug = "example";

  return (
    <main className="min-h-screen h-screen">
      <RevealPresentation>
        {/* Slide 1: Rendered from MDX (SSG/Server Component) */}
        <MdxSlide
          filePath="advanced.mdx"
          slug={slug}
          components={mdxComponents}
        />

        {/* Slide 2: Simple Markdown handled by reveal.js plugin (Client-side) */}
        <MarkdownSlide filePath="simple.md" slug={slug} />

        {/* Slide 3: A plain React component slide defined directly */}
        <section>
          <h1>React Component Slide</h1>
          <p>This slide is defined directly in the page.tsx component.</p>
        </section>
      </RevealPresentation>
    </main>
  );
}
