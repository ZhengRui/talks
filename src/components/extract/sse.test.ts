import { describe, expect, it } from "vitest";
import { consumeSseChunk, createSseParserState } from "./sse";

describe("consumeSseChunk", () => {
  it("keeps the event name across chunk boundaries", () => {
    const state = createSseParserState();

    expect(consumeSseChunk(state, "event: prompt\n")).toEqual([]);

    expect(
      consumeSseChunk(
        state,
        "data: {\"phase\":\"extract\",\"userPrompt\":\"hello\"}\n\n",
      ),
    ).toEqual([
      {
        event: "prompt",
        data: "{\"phase\":\"extract\",\"userPrompt\":\"hello\"}",
      },
    ]);
  });

  it("flushes the final record even without a trailing blank line", () => {
    const state = createSseParserState();

    expect(
      consumeSseChunk(
        state,
        "event: text\ndata: {\"partial\":true}",
      ),
    ).toEqual([]);

    expect(consumeSseChunk(state, "", true)).toEqual([
      {
        event: "text",
        data: "{\"partial\":true}",
      },
    ]);
  });
});
