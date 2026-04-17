import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { LogEntryRow } from "./log-utils";

describe("LogEntryRow", () => {
  it("renders parseable json text entries as a formatted code block", () => {
    const { container } = render(
      <LogEntryRow
        entry={{
          type: "text",
          content: "{\"alpha\":1,\"dims\":{\"w\":640,\"h\":360},\"nested\":{\"beta\":true}}",
          timestamp: 1,
          stage: "extract",
        }}
      />,
    );

    const pre = container.querySelector("pre");
    expect(pre).not.toBeNull();
    expect(pre?.textContent).toContain("\"alpha\"");
    expect(pre?.textContent).toContain("\"dims\": { \"w\": 640, \"h\": 360 }");
    expect(pre?.textContent).toContain("\"nested\"");
  });

  it("renders non-json text entries as markdown prose", () => {
    const { container, getByText } = render(
      <LogEntryRow
        entry={{
          type: "text",
          content: "**hello** world",
          timestamp: 1,
          stage: "extract",
        }}
      />,
    );

    expect(container.querySelector("pre")).toBeNull();
    expect(getByText("hello")).toBeTruthy();
  });

  it("renders the final json block when merged text contains an earlier draft message", () => {
    const { container } = render(
      <LogEntryRow
        entry={{
          type: "text",
          content: "I’m drafting the response structure.\n\n{\"alpha\":1,\"nested\":{\"beta\":true}}",
          timestamp: 1,
          stage: "extract",
        }}
      />,
    );

    const pre = container.querySelector("pre");
    expect(pre).not.toBeNull();
    expect(pre?.textContent).toContain("\"alpha\"");
    expect(pre?.textContent).toContain("\"nested\"");
    expect(pre?.textContent).not.toContain("I’m drafting");
  });

  it("renders incomplete streamed json as a code block instead of markdown prose", () => {
    const { container } = render(
      <LogEntryRow
        entry={{
          type: "text",
          content: "{\"resolved\":[],\"issues\":[{\"priority\":1,\"issueId\":\"cards.panel-fill\",\"category\":\"signature_visual\"",
          timestamp: 1,
          stage: "extract",
        }}
      />,
    );

    const pre = container.querySelector("pre");
    expect(pre).not.toBeNull();
    const lines = pre?.textContent?.split("\n") ?? [];
    expect(lines.length).toBeGreaterThan(1);
    expect(pre?.textContent).toContain("\"resolved\": []");
    expect(pre?.textContent).toContain("\"issues\": [");
    expect(pre?.textContent).toContain("\"issueId\": \"cards.panel-fill\"");
  });

  it("keeps prose visible while rendering a trailing partial json fragment as a code block", () => {
    const { container, getByText } = render(
      <LogEntryRow
        entry={{
          type: "text",
          content: "Looking at the screenshot to generate the output.\n\n{\"alpha\":1,\"nested\":",
          timestamp: 1,
          stage: "extract",
        }}
      />,
    );

    expect(getByText("Looking at the screenshot to generate the output.")).toBeTruthy();
    const pre = container.querySelector("pre");
    expect(pre).not.toBeNull();
    expect(pre?.textContent).toContain("\"alpha\": 1");
    expect(pre?.textContent?.split("\n").length).toBeGreaterThan(1);
  });
});
