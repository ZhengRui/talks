// src/components/MdxSlide.tsx
import { MDXRemote } from "next-mdx-remote/rsc";
import { getMdxSource } from "@/utils/mdxUtils"; // Use path alias
import React from "react";

interface MdxSlideProps {
  /**
   * Path to the MDX file.
   * - If used with slug param: relative to presentation folder (e.g., 'advanced.mdx')
   * - If used without slug: relative to 'src/app' directory (e.g., '/example/advanced.mdx')
   */
  filePath: string;

  /** Optional presentation slug. If provided, filePath will be relative to this folder */
  slug?: string;

  /** Optional object mapping component names used in MDX to actual React components */
  components?: Record<string, React.ComponentType<any>>; // eslint-disable-line @typescript-eslint/no-explicit-any
}

/**
 * A Server Component that fetches MDX content from a file,
 * parses it, and renders it using MDXRemote.
 * Assumes the MDX content itself contains the necessary <section> tag(s).
 */
export const MdxSlide: React.FC<MdxSlideProps> = async ({
  filePath,
  slug,
  components = {},
}) => {
  const mdxData = await getMdxSource(filePath, slug);

  if (!mdxData) {
    return (
      <section data-background-color="red">
        <h2>Error Loading MDX Slide</h2>
        <p>Could not load content from {filePath}</p>
      </section>
    );
  }

  // Extract frontmatter data
  const { source, frontmatter } = mdxData;

  // The frontmatter object needs to be passed through options.scope
  return (
    <>
      {/* Make frontmatter available for reference in the MDX content */}
      <MDXRemote
        source={source}
        components={components}
        options={{
          scope: { frontmatter }, // This makes frontmatter available in MDX content
        }}
      />
    </>
  );
};
