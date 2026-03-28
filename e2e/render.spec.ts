import { expect, test } from "@playwright/test";

const RED_SLIDE = {
  slide: {
    width: 1920,
    height: 1080,
    background: "#ff0000",
    elements: [
      {
        kind: "text",
        id: "title",
        rect: { x: 100, y: 100, w: 600, h: 80 },
        text: "RENDER TEST",
        style: {
          fontFamily: "Inter, sans-serif",
          fontSize: 64,
          fontWeight: 700,
          color: "#ffffff",
          lineHeight: 1.2,
        },
      },
    ],
  },
};

function readPngSize(buffer: Buffer): { width: number; height: number } {
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

test("POST /api/render returns a valid PNG", async ({ request }) => {
  const response = await request.post("/api/render", {
    data: RED_SLIDE,
  });

  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("image/png");

  const body = Buffer.from(await response.body());
  expect(body[0]).toBe(0x89);
  expect(body[1]).toBe(0x50);
  expect(body.length).toBeGreaterThan(1000);
});

test("POST /api/render respects output dimensions", async ({ request }) => {
  const response = await request.post("/api/render", {
    data: {
      ...RED_SLIDE,
      width: 800,
      height: 800,
      fit: "contain",
    },
  });

  expect(response.status()).toBe(200);
  expect(readPngSize(Buffer.from(await response.body()))).toEqual({
    width: 800,
    height: 800,
  });
});

test("POST /api/render returns 400 for missing slide", async ({ request }) => {
  const response = await request.post("/api/render", {
    data: {},
  });

  expect(response.status()).toBe(400);
});
