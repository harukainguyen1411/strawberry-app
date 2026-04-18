import { describe, it, expect } from "vitest";

// Unit tests for label filtering logic (extracted from github.ts for testability)

function filterBotIssues(
  issues: Array<{ labels: Array<string | { name?: string }>; pull_request?: object }>,
): Array<{ labels: Array<string | { name?: string }>; pull_request?: object }> {
  return issues
    .filter((issue) => !issue.pull_request)
    .filter((issue) => {
      const labelNames = issue.labels.map((l) =>
        typeof l === "string" ? l : l.name ?? "",
      );
      return (
        !labelNames.includes("bot-in-progress") &&
        !labelNames.includes("bot-pr-opened")
      );
    });
}

describe("filterBotIssues", () => {
  it("passes issues with myapps+ready only", () => {
    const issues = [{ labels: [{ name: "myapps" }, { name: "ready" }] }];
    expect(filterBotIssues(issues)).toHaveLength(1);
  });

  it("excludes pull requests", () => {
    const issues = [
      { labels: [{ name: "ready" }], pull_request: {} },
    ];
    expect(filterBotIssues(issues)).toHaveLength(0);
  });

  it("excludes bot-in-progress issues", () => {
    const issues = [
      { labels: [{ name: "ready" }, { name: "bot-in-progress" }] },
    ];
    expect(filterBotIssues(issues)).toHaveLength(0);
  });

  it("excludes bot-pr-opened issues", () => {
    const issues = [
      { labels: [{ name: "ready" }, { name: "bot-pr-opened" }] },
    ];
    expect(filterBotIssues(issues)).toHaveLength(0);
  });

  it("handles string label format", () => {
    const issues = [{ labels: ["ready", "bot-in-progress"] }];
    expect(filterBotIssues(issues)).toHaveLength(0);
  });
});
