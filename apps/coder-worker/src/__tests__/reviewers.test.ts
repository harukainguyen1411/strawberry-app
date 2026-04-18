import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolveReviewers } from "../config/reviewers.js";

describe("resolveReviewers", () => {
  const originalEnv = process.env.CODER_WORKER_DEFAULT_REVIEWERS;

  beforeEach(() => {
    delete process.env.CODER_WORKER_DEFAULT_REVIEWERS;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.CODER_WORKER_DEFAULT_REVIEWERS = originalEnv;
    } else {
      delete process.env.CODER_WORKER_DEFAULT_REVIEWERS;
    }
  });

  it("returns the hardcoded default when env var is unset", () => {
    const reviewers = resolveReviewers([]);
    expect(reviewers).toEqual(["Duongntd"]);
  });

  it("returns reviewers from env var when set", () => {
    process.env.CODER_WORKER_DEFAULT_REVIEWERS = "alice,bob";
    const reviewers = resolveReviewers([]);
    expect(reviewers).toEqual(["alice", "bob"]);
  });

  it("trims whitespace from env var entries", () => {
    process.env.CODER_WORKER_DEFAULT_REVIEWERS = " alice , bob ";
    const reviewers = resolveReviewers([]);
    expect(reviewers).toEqual(["alice", "bob"]);
  });

  it("filters out the PR author to prevent self-review", () => {
    process.env.CODER_WORKER_DEFAULT_REVIEWERS = "alice,Duongntd";
    const reviewers = resolveReviewers([], "Duongntd");
    expect(reviewers).not.toContain("Duongntd");
    expect(reviewers).toContain("alice");
  });

  it("deduplicates reviewer entries", () => {
    process.env.CODER_WORKER_DEFAULT_REVIEWERS = "alice,alice,bob";
    const reviewers = resolveReviewers([]);
    expect(reviewers).toEqual(["alice", "bob"]);
  });

  it("ignores labels (no per-label overrides in single-repo setup)", () => {
    // Confirm that passing labels does not affect the result
    const withLabels = resolveReviewers(["app:myapp", "type:bug"]);
    const withoutLabels = resolveReviewers([]);
    expect(withLabels).toEqual(withoutLabels);
  });

  it("returns an empty array if all reviewers are filtered as PR author", () => {
    process.env.CODER_WORKER_DEFAULT_REVIEWERS = "alice";
    const reviewers = resolveReviewers([], "alice");
    expect(reviewers).toEqual([]);
  });
});
