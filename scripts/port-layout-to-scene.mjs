import fs from "fs/promises";
import path from "path";
import { parse, stringify } from "yaml";
import { importLayoutPresentation } from "../src/lib/scene/import-layout.ts";

async function exists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function rewriteDeckAssetPath(sourceSlug, destSlug) {
  return (assetPath) => assetPath.replace(`/${sourceSlug}/`, `/${destSlug}/`);
}

async function copyIfExists(sourcePath, destPath) {
  if (!(await exists(sourcePath))) return;
  await fs.cp(sourcePath, destPath, { recursive: true, force: true });
}

async function main() {
  const [sourceDirArg, destSlugArg] = process.argv.slice(2);
  if (!sourceDirArg || !destSlugArg) {
    console.error("Usage: bun scripts/port-layout-to-scene.mjs <source-dir> <dest-slug>");
    process.exit(1);
  }

  const sourceDir = path.resolve(sourceDirArg);
  const destSlug = destSlugArg;
  const sourceSlug = path.basename(sourceDir);
  const destDir = path.join(process.cwd(), "content", destSlug);

  const layoutPath = path.join(sourceDir, "layout.json");
  const slidesPath = path.join(sourceDir, "slides.yaml");

  const [layoutRaw, slidesRaw] = await Promise.all([
    fs.readFile(layoutPath, "utf8"),
    fs.readFile(slidesPath, "utf8"),
  ]);

  const layoutPresentation = JSON.parse(layoutRaw);
  const sourcePresentation = parse(slidesRaw);

  const imported = importLayoutPresentation(layoutPresentation, {
    rewriteAssetPath: rewriteDeckAssetPath(sourceSlug, destSlug),
    idPrefix: "imp-",
  });

  const output = {
    title: sourcePresentation.title ?? imported.title,
    ...(sourcePresentation.author ? { author: sourcePresentation.author } : {}),
    ...(sourcePresentation.theme ? { theme: sourcePresentation.theme } : {}),
    slides: imported.slides,
  };

  await fs.mkdir(destDir, { recursive: true });
  await Promise.all([
    fs.writeFile(path.join(destDir, "slides.yaml"), stringify(output), "utf8"),
    copyIfExists(path.join(sourceDir, "layout.json"), path.join(destDir, "layout.json")),
    copyIfExists(path.join(sourceDir, "animations.css"), path.join(destDir, "animations.css")),
    copyIfExists(path.join(sourceDir, "images"), path.join(destDir, "images")),
  ]);

  console.log(`ported ${sourceSlug} -> ${destSlug}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
