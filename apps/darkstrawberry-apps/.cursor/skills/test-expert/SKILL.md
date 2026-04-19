---
name: test-expert
description: Reviews test adequacy after code changes, ensures e2e tests for core features, and requires regression tests for bug fixes. Use after implementing any change, when fixing bugs, or when the user asks for test coverage review.
---

# Test Expert

After implementing any change, review whether adequate tests were added. Apply the rules below and add or update tests as needed.

## When to Apply

- **After any implementation**: Before considering work done, check test coverage for the change.
- **When fixing a bug**: Always add a regression test so the bug cannot recur.
- **When the user asks**: For test review, coverage, or "did we test this?"

## Test Adequacy Review

For every change, ask:

1. **Does the change have tests?** New or modified code should have corresponding unit or component tests unless it is trivial (e.g. style-only, config-only).
2. **Do tests assert the right behavior?** Tests should cover success paths and important edge cases, not only "it doesn’t crash."
3. **Is this core functionality?** If yes, e2e tests are required (see next section).
4. **Is this a bug fix?** If yes, a regression test is required (see Bug Fixes below).

## Core Functionality → E2E Tests

**Core functionality** = main user journeys and critical features (e.g. auth, main flows, primary CRUD, navigation to key screens).

For such changes:

- Add or extend an e2e spec in `e2e/` that exercises the new or changed behavior through the UI.
- Follow existing patterns: `e2e/*.spec.ts`, Playwright, `test:e2e` / `test:e2e:ci`.
- Prefer one focused spec or a few clear scenarios over one huge file.

If the change is clearly non-core (e.g. internal refactor, styling, non-user-facing util), e2e is optional; unit/component tests may be enough.

## Bug Fixes → Regression Tests

When fixing a bug:

1. **Add a regression test first or in the same change** that would have failed before the fix and passes after it.
2. **Prefer the narrowest useful level**:
   - Unit test if the bug is in a single function or module.
   - Component test if the bug is in UI behavior.
   - E2e test if the bug is in a user flow (e.g. wrong screen, broken navigation, broken form submit).
3. **Name and describe clearly** so future readers see it’s a regression test (e.g. "rejects invalid input that previously crashed", "navigation to X no longer redirects to Y").
4. **Ensure it fails without the fix** (e.g. run tests before/after or temporarily revert the fix) so the test is not a no-op.

## Quick Checklist

Use this before marking implementation or bug-fix work complete:

- [ ] New/changed behavior has unit or component tests (or is explicitly trivial).
- [ ] If the change is core functionality, there are e2e tests covering it.
- [ ] If the change is a bug fix, there is a regression test that would have failed before the fix.
- [ ] Tests are named and scoped so it’s clear what they protect.

## Project Conventions (this repo)

- **Unit/component**: Vitest, `npm run test` / `npm run test:run`; `.spec.ts` next to source or in `src/`.
- **E2e**: Playwright, `npm run test:e2e` / `npm run test:e2e:ci`; specs in `e2e/*.spec.ts`.

When suggesting new tests, use these runners and locations unless the user requests otherwise.
