import { randomUUID } from "crypto";
import { rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import type { ProviderContentImage } from "./types";

function extensionFromImage(image: ProviderContentImage): string {
  const fileName = image.fileName?.toLowerCase() ?? "";
  if (fileName.endsWith(".jpg") || fileName.endsWith(".jpeg")) return "jpg";
  if (fileName.endsWith(".webp")) return "webp";
  if (image.mediaType === "image/jpeg") return "jpg";
  if (image.mediaType === "image/webp") return "webp";
  return "png";
}

export async function withCodexTempImages<T>(
  images: ProviderContentImage[],
  fn: (paths: string[]) => Promise<T>,
): Promise<T> {
  const paths = await Promise.all(
    images.map(async (image, index) => {
      const filePath = join(
        tmpdir(),
        `talks-codex-${index + 1}-${randomUUID()}.${extensionFromImage(image)}`,
      );
      await writeFile(filePath, image.buffer);
      return filePath;
    }),
  );

  try {
    return await fn(paths);
  } finally {
    await Promise.all(paths.map(async (filePath) => {
      await rm(filePath, { force: true });
    }));
  }
}
