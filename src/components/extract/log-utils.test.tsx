import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { LogEntryRow } from "./log-utils";

describe("LogEntryRow", () => {
  it("renders parseable json text entries as a formatted code block", () => {
    const { container } = render(
      <LogEntryRow
        entry={{
          type: "text",
          content: "{\"alpha\":1,\"nested\":{\"beta\":true}}",
          timestamp: 1,
          stage: "extract",
        }}
      />,
    );

    const pre = container.querySelector("pre");
    expect(pre).not.toBeNull();
    expect(pre?.textContent).toContain("\"alpha\"");
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
});
