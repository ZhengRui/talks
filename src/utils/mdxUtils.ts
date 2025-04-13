// src/utils/mdxUtils.ts
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

/**
 * Reads an MDX file, parses frontmatter, and returns the source content and data.
 * @param filePath Path to the MDX file, either relative to presentation folder or with full path
 * @param slug Optional presentation slug folder name, if provided filePath will be relative to this folder
 */
export async function getMdxSource(
  filePath: string,
  slug?: string
): Promise<{
  source: string;
  frontmatter: { [key: string]: unknown };
} | null> {
  // If filePath already starts with '/', treat as relative to src/app
  // Otherwise, if slug is provided, make relative to presentation folder
  let fullPath;
  if (filePath.startsWith('/')) {
    fullPath = path.join(process.cwd(), 'src', 'app', filePath);
  } else if (slug) {
    fullPath = path.join(process.cwd(), 'src', 'app', slug, filePath);
  } else {
    // If no slug and no leading slash, treat as relative to src/app
    fullPath = path.join(process.cwd(), 'src', 'app', filePath);
  }

  try {
    const fileContents = fs.readFileSync(fullPath, 'utf8');
    const { content: source, data: frontmatter } = matter(fileContents);
    return { source, frontmatter };
  } catch (error) {
    console.error(`Error reading MDX file at ${fullPath}:`, error);
    return null; // Handle file not found or parse errors gracefully
  }
}
