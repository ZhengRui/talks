"use client";

import React from "react";

interface MarkdownSlideProps {
  /** 
   * Path to the Markdown file.
   * - If used with slug param: relative to presentation folder (e.g., 'simple.md')
   * - If used without slug: relative to 'public' directory (e.g., '/example/simple.md') 
   */
  filePath: string;
  
  /** Optional presentation slug. If provided, filePath will be relative to this folder */
  slug?: string;
  
  /** Optional attributes to pass directly to the <section> element */
  sectionAttributes?: React.HTMLAttributes<HTMLElement>;
}

/**
 * Renders a Reveal.js <section> element that loads and displays
 * Markdown content from a file in the `public` directory using the
 * reveal.js Markdown plugin (client-side rendering).
 */
export const MarkdownSlide: React.FC<MarkdownSlideProps> = ({
  filePath,
  slug,
  sectionAttributes = {},
}) => {
  // If filePath already starts with '/', use as is (relative to public directory)
  // Otherwise, if slug is provided, make it relative to slug folder
  const fullPath = filePath.startsWith('/') ? filePath : slug ? `/${slug}/${filePath}` : filePath;
  
  return (
    <section data-markdown={fullPath} {...sectionAttributes}>
      {/* Reveal.js Markdown plugin will populate this section */}
    </section>
  );
};
