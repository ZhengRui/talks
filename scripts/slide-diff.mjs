#!/usr/bin/env node

import fs from "fs/promises";
import path from "path";
import { chromium } from "@playwright/test";

function parseArgs(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;

    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      result[key] = true;
      continue;
    }

    result[key] = next;
    i += 1;
  }
  return result;
}

function usage() {
  console.error(
    [
      "Usage:",
      "  bun run slide:diff -- --slug <slug> --slide <n> --reference <file>",
      "  bun run slide:diff -- --url <url> --reference <file>",
      "",
      "Options:",
      "  --base-url <url>       Default: http://127.0.0.1:3000",
      "  --slide <n>            1-based slide number. Default: 1",
      "  --out-dir <dir>        Default: .artifacts/slide-diff",
      "  --threshold <0-255>    Per-channel mismatch threshold. Default: 24",
      "  --max-mismatch <0-1>   Fail if mismatch ratio exceeds this value",
      "  --wait-ms <n>          Extra wait after load. Default: 300",
    ].join("\n"),
  );
}

function normalizePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeFloat(value, fallback) {
  const parsed = Number.parseFloat(value ?? "");
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sanitizeName(value) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

function toDataUrl(buffer) {
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

async function comparePngs(page, actualBuffer, referenceBuffer, threshold) {
  const actualUrl = toDataUrl(actualBuffer);
  const referenceUrl = toDataUrl(referenceBuffer);

  return page.evaluate(async ({ actualUrl: a, referenceUrl: b, threshold: t }) => {
    function loadImage(src) {
      return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error(`Failed to load ${src.slice(0, 32)}...`));
        image.src = src;
      });
    }

    const [actual, reference] = await Promise.all([loadImage(a), loadImage(b)]);
    if (
      actual.width !== reference.width ||
      actual.height !== reference.height
    ) {
      return {
        error: `Image dimensions differ: actual ${actual.width}x${actual.height}, reference ${reference.width}x${reference.height}`,
      };
    }

    const width = actual.width;
    const height = actual.height;
    const totalPixels = width * height;

    const actualCanvas = document.createElement("canvas");
    actualCanvas.width = width;
    actualCanvas.height = height;
    const actualCtx = actualCanvas.getContext("2d");
    actualCtx.drawImage(actual, 0, 0);
    const actualData = actualCtx.getImageData(0, 0, width, height);

    const refCanvas = document.createElement("canvas");
    refCanvas.width = width;
    refCanvas.height = height;
    const refCtx = refCanvas.getContext("2d");
    refCtx.drawImage(reference, 0, 0);
    const refData = refCtx.getImageData(0, 0, width, height);

    const diffCanvas = document.createElement("canvas");
    diffCanvas.width = width;
    diffCanvas.height = height;
    const diffCtx = diffCanvas.getContext("2d");
    const diffData = diffCtx.createImageData(width, height);

    let mismatchPixels = 0;

    for (let i = 0; i < actualData.data.length; i += 4) {
      const dr = Math.abs(actualData.data[i] - refData.data[i]);
      const dg = Math.abs(actualData.data[i + 1] - refData.data[i + 1]);
      const db = Math.abs(actualData.data[i + 2] - refData.data[i + 2]);
      const da = Math.abs(actualData.data[i + 3] - refData.data[i + 3]);
      const delta = Math.max(dr, dg, db, da);

      if (delta > t) {
        mismatchPixels += 1;
        diffData.data[i] = 255;
        diffData.data[i + 1] = 64;
        diffData.data[i + 2] = 64;
        diffData.data[i + 3] = 255;
      } else {
        const tone = Math.round(
          (actualData.data[i] + actualData.data[i + 1] + actualData.data[i + 2]) / 3,
        );
        diffData.data[i] = tone;
        diffData.data[i + 1] = tone;
        diffData.data[i + 2] = tone;
        diffData.data[i + 3] = 40;
      }
    }

    diffCtx.putImageData(diffData, 0, 0);

    return {
      width,
      height,
      mismatchPixels,
      mismatchRatio: mismatchPixels / totalPixels,
      diffDataUrl: diffCanvas.toDataURL("image/png"),
    };
  }, { actualUrl, referenceUrl, threshold });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if ((!args.slug && !args.url) || !args.reference) {
    usage();
    process.exit(1);
  }

  const baseUrl = args["base-url"] ?? process.env.SLIDE_DIFF_BASE_URL ?? "http://127.0.0.1:3000";
  const slide = normalizePositiveInt(args.slide, 1);
  const threshold = normalizeFloat(args.threshold, 24);
  const maxMismatch = args["max-mismatch"] ? normalizeFloat(args["max-mismatch"], 0) : undefined;
  const waitMs = normalizePositiveInt(args["wait-ms"], 300);
  const outDir = path.resolve(args["out-dir"] ?? ".artifacts/slide-diff");
  const referencePath = path.resolve(args.reference);
  const referenceBuffer = await fs.readFile(referencePath);

  const targetUrl = args.url
    ? args.url
    : `${baseUrl.replace(/\/$/, "")}/${args.slug}?slide=${slide}&chrome=0`;

  const baseName = sanitizeName(args.slug ? `${args.slug}-slide-${slide}` : `slide-${slide}`);
  await fs.mkdir(outDir, { recursive: true });

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
    });

    await page.goto(targetUrl, { waitUntil: "networkidle" });
    await page.waitForSelector(".slide-canvas.ready");
    await page.waitForSelector(".slide.active");
    await page.waitForTimeout(waitMs);

    const screenshotBuffer = await page.locator(".slide.active").screenshot();
    const renderPath = path.join(outDir, `${baseName}.rendered.png`);
    await fs.writeFile(renderPath, screenshotBuffer);

    const comparisonPage = await browser.newPage();
    const comparison = await comparePngs(comparisonPage, screenshotBuffer, referenceBuffer, threshold);
    await comparisonPage.close();

    if (comparison.error) {
      console.error(comparison.error);
      process.exit(1);
    }

    const diffPath = path.join(outDir, `${baseName}.diff.png`);
    const reportPath = path.join(outDir, `${baseName}.report.json`);
    const diffBuffer = Buffer.from(
      comparison.diffDataUrl.replace(/^data:image\/png;base64,/, ""),
      "base64",
    );
    await fs.writeFile(diffPath, diffBuffer);

    const report = {
      url: targetUrl,
      reference: referencePath,
      rendered: renderPath,
      diff: diffPath,
      threshold,
      mismatchPixels: comparison.mismatchPixels,
      mismatchRatio: comparison.mismatchRatio,
      width: comparison.width,
      height: comparison.height,
    };
    await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

    console.log(`rendered: ${renderPath}`);
    console.log(`diff:     ${diffPath}`);
    console.log(`report:   ${reportPath}`);
    console.log(`mismatch: ${(comparison.mismatchRatio * 100).toFixed(3)}% (${comparison.mismatchPixels} px)`);

    if (maxMismatch !== undefined && comparison.mismatchRatio > maxMismatch) {
      process.exit(2);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
