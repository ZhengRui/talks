/**
 * Quick test: what pixel coordinates does Claude's vision actually see?
 * Run: node scripts/test-vision-coords.mjs .tmp/extract/screenshot-c3c8a110.png
 */
import { query } from "@anthropic-ai/claude-agent-sdk";

const imagePath = process.argv[2];
if (!imagePath) {
  console.error("Usage: node scripts/test-vision-coords.mjs <image-path>");
  process.exit(1);
}

const prompt = `Look at this image: ${imagePath}

Do NOT generate any templates or YAML. Just answer these calibration questions precisely:

1. What pixel dimensions do you perceive this image to be? (width × height)
2. The "26 / 40" navigation text near the bottom center — what are its approximate x,y pixel coordinates?
3. The dark rounded card with "CIVILIAN DISPLACEMENT" title — what are the x,y coordinates of its top-left corner?
4. The orange "HUMANITARIAN CRISIS" eyebrow text — what are its x,y coordinates?
5. The callout box at the bottom-left with the medical icon — what are its x,y coordinates?

Be as precise as you can. Give coordinates as (x, y) pairs.`;

let result = "";
for await (const message of query({
  prompt,
  options: {
    cwd: process.cwd(),
    allowedTools: ["Read"],
    maxTurns: 2,
    systemPrompt: "You are measuring pixel coordinates in an image. Be precise. Report what you see, do not guess or infer from other information.",
  },
})) {
  const msg = message;
  if (msg.type === "assistant" && msg.message) {
    for (const block of msg.message.content) {
      if (block.type === "text") {
        result += block.text;
      }
    }
  }
  if (msg.type === "result" && typeof msg.result === "string") {
    result = msg.result;
  }
}

console.log("\n=== Claude's coordinate perception ===\n");
console.log(result);
console.log("\n=== Expected (measured from actual 1279×1292 image) ===\n");
console.log("Image size: 1279 × 1292");
console.log("'26 / 40' nav: ~(640, 580)");
console.log("CIVILIAN DISPLACEMENT card top-left: ~(390, 165)");
console.log("HUMANITARIAN CRISIS eyebrow: ~(35, 155)");
console.log("Callout box top-left: ~(35, 460)");
