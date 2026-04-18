import { Octokit } from "@octokit/rest";
import { config } from "../config.js";

let _octokit: Octokit | null = null;

export function getOctokit(): Octokit {
  if (!_octokit) {
    const token = config.github.token;
    if (!token) {
      throw new Error("GITHUB_TOKEN is required for PR merge/close operations");
    }
    _octokit = new Octokit({ auth: token });
  }
  return _octokit;
}
