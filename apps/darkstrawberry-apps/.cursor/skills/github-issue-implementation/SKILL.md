---
name: github-issue-implementation
description: Fetches GitHub issues by issue number or project identifier (e.g., MA-1), analyzes them, breaks them down into actionable deliverables, assigns the issue, updates it with the breakdown, creates a branch, implements the solution, and opens a pull request. Use when the user provides a GitHub issue number, project identifier, or asks to implement a GitHub issue.
---

# GitHub Issue Implementation

## Overview

This skill automates the workflow of:
1. Fetching a GitHub issue by issue number or project identifier (e.g., MA-1)
2. Analyzing the issue content and requirements
3. Breaking it down into actionable deliverables (including testing tasks)
4. Assigning the issue to the user or agent
5. Updating the issue with the breakdown as a comment
6. Creating a feature branch
7. Creating a structured task list
8. Implementing the solution **and tests** (unit tests always; E2E when the feature has user-facing flows)
9. Committing and pushing changes
10. Creating a pull request

## Workflow

**IMPORTANT**: This workflow requires network access for GitHub API calls. When executing this skill:
- Request network permissions upfront: Use `required_permissions: ['network']` in all tool calls that access GitHub
- This ensures smooth execution without repeated approval prompts
- Network access is needed for fetching issues, searching, assigning, commenting, and creating PRs

### Step 1: Fetch the GitHub Issue

When the user provides an issue identifier (e.g., "#42", "42", or "MA-1"):

1. **Determine the repository**:
   - Check `git remote -v` to get the repository URL
   - Extract owner and repo name (e.g., `owner/repo` from `https://github.com/owner/repo.git`)
   - Default repo if not specified: `https://github.com/Duongntd/myapps.git`

2. **Resolve project identifier** (if provided):
   - If identifier matches pattern like "MA-1", "PROJ-123", etc.:
     - **Request network permissions** for API calls (use `required_permissions: ['network']` in tool calls)
     - Search issues using GitHub API: `GET /repos/{owner}/{repo}/issues?state=all&per_page=100`
     - Look for issue title or body containing the project identifier
     - Alternatively, check GitHub Projects API if identifier is a project item
     - If found, extract the actual issue number
   - If no project identifier pattern, treat as direct issue number

3. **Fetch the issue**:
   - **Request network permissions** when making API calls (use `required_permissions: ['network']` in tool calls)
   - Use GitHub API: `https://api.github.com/repos/{owner}/{repo}/issues/{issue_number}`
   - If API fails or no token available, use `mcp_web_fetch` with: `https://github.com/{owner}/{repo}/issues/{issue_number}`
   - Extract: title, body, labels, assignees, comments, issue number (if available)

4. **Display the issue**:
   - Show title, description, labels, and status
   - Highlight any code blocks, checklists, or structured requirements
   - Note the actual issue number if resolved from project identifier

### Step 2: Analyze and Break Down

Analyze the issue content to identify:

- **Core requirements**: What must be implemented
- **Acceptance criteria**: How to verify completion
- **Dependencies**: What needs to be done first
- **Components affected**: Files, modules, or features that need changes
- **Edge cases**: Special scenarios to handle

Break down into deliverables using this structure:

```
Deliverable 1: [Specific task]
- Subtask 1.1: [Actionable item]
- Subtask 1.2: [Actionable item]

Deliverable 2: [Specific task]
- Subtask 2.1: [Actionable item]

Deliverable N: Testing (always include when adding features)
- Add unit tests for [new/changed components, utils, stores]
- Add E2E tests for [user-facing flows] (if the feature has navigable UI or critical paths)
```

When the issue adds or changes user-facing behavior or logic, always include a **Testing** deliverable: unit tests for new/changed code, and E2E tests when the feature has pages, flows, or critical user journeys.


### Step 3: Create Feature Branch

Before starting implementation, create a branch:

1. **Generate branch name**:
   - Format: `issue-{issue_number}-{slug}` or `{project_id}-{slug}`
   - Examples: `issue-42-dark-mode-toggle`, `ma-1-theme-switcher`
   - Slug: Convert issue title to lowercase, replace spaces with hyphens, remove special chars
   - Keep under 50 characters total

2. **Create and checkout branch**:
   ```bash
   git checkout -b issue-42-dark-mode-toggle
   ```
   - Ensure starting from latest main/master branch: `git checkout main && git pull`
   - Create branch from main/master

3. **Verify branch creation**:
   - Confirm branch exists: `git branch`
   - Verify clean working directory before starting

### Step 4: Create Task List

Use `todo_write` to create a structured task list:

- Group related tasks under logical deliverables
- Mark dependencies clearly (e.g., "pending" until prerequisite completes)
- **Always include testing tasks**: unit tests for new/modified logic, and E2E tests when the feature has user-facing flows (see [Testing Requirements](#testing-requirements) below)
- Set first task to "in_progress"

### Step 5: Start Implementation

Begin with the first task:

1. **Read relevant files**: Understand current codebase structure
2. **Make changes**: Implement the feature following project conventions
3. **Add unit tests**: For every new or meaningfully changed component, util, or store, add Vitest + @testing-library/vue tests (see [Testing Requirements](#testing-requirements))
4. **Add E2E tests when needed**: If the feature introduces or changes a core user flow (e.g. new page, new journey, critical path), add Playwright E2E tests in `e2e/`
5. **Update todos**: Mark completed tasks, move to next
6. **Continue iteratively**: Work through deliverables systematically
7. **Commit incrementally**: Commit logical units of work with descriptive messages

### Step 6: Commit Changes

After completing implementation:

1. **Review changes**:
   - Check status: `git status`
   - Review diff: `git diff`
   - Ensure all relevant files are included

2. **Stage changes**:
   ```bash
   git add .
   # Or selectively: git add path/to/file1 path/to/file2
   ```

3. **Commit with descriptive message**:
   ```bash
   git commit -m "feat: implement dark mode toggle [MA]

   - Add theme state management with Pinia store
   - Create theme toggle component
   - Apply theme styles across components
   - Persist theme preference to localStorage
   
   Closes #42"
   ```
   - Use conventional commit format: `feat:`, `fix:`, `refactor:`, etc.
   - Reference issue number: `Closes #42` or `Fixes #42`
   - Include project identifier if applicable: `[MA]`


## Issue Analysis Guidelines

### Identifying Requirements

Look for:
- **Explicit requirements**: "Add X", "Implement Y", "Fix Z"
- **User stories**: "As a user, I want..."
- **Acceptance criteria**: Checkboxes, "should" statements
- **Technical specs**: API endpoints, data structures, UI components
- **Examples**: Code snippets, mockups, references

### Breaking Down Complex Issues

For large issues:
- **Phase 1**: Core functionality (MVP)
- **Phase 2**: Enhancements and polish
- **Phase 3**: Edge cases and error handling

For feature requests:
- **Backend**: Data models, API endpoints, business logic
- **Frontend**: UI components, state management, routing
- **Integration**: Connect frontend to backend
- **Testing**: Unit tests, integration tests

### Dependencies

Identify and order tasks by:
- **Prerequisites**: What must exist first (e.g., data model before API)
- **Logical flow**: Natural progression (e.g., create before update)
- **Risk**: High-risk items first to catch issues early

## Implementation Best Practices

### Code Quality

- Follow existing project patterns and conventions
- Maintain consistency with codebase style
- Add appropriate comments for complex logic
- Update related documentation

### Testing Requirements

**When developing a new feature, always add tests.** Treat testing as part of the implementation, not optional.

1. **Unit / component tests (always)**
   - Add tests for every new or meaningfully changed:
     - Vue components (use `src/test/utils.ts` → `renderWithProviders` and Vitest + @testing-library/vue)
     - Composables, utils, and store logic
   - Place specs next to the module or in the same area (e.g. `Foo.vue` → `Foo.spec.ts` or `Foo.test.ts`)
   - Test behavior and user-visible outcomes; avoid testing implementation details
   - Run with: `npm run test:run`

2. **E2E tests (when the feature has user-facing flows)**
   - Add E2E tests when the feature:
     - Adds or changes a **page or main screen**
     - Introduces a **critical user journey** (e.g. sign-up, checkout, core workflow)
     - Changes **navigation or routing** in a way users will notice
   - Put E2E tests in `e2e/` (e.g. `e2e/my-feature.spec.ts`)
   - Use Playwright; write resilient, deterministic tests (user-visible state, no brittle timeouts)
   - Run with: `npm run test:e2e` or `npm run test:e2e:ci`

3. **When to skip E2E**
   - Internal refactors, config-only changes, or fixes with no new UI flow often need only unit tests.
   - When in doubt, add at least one E2E test for the main happy path of the new or changed flow.

4. **Check before finishing**
   - `npm run lint` and `npm run typecheck` pass
   - `npm run test:run` passes and includes tests for the new/changed code
   - If the feature has a user-facing flow, `npm run test:e2e` (or relevant E2E subset) passes

### Documentation

- Update README if user-facing features change
- Add code comments for complex logic
- Update API docs if endpoints change

## Example Workflow

**User input**: "Implement #42" or "Start #42"

**Step 1**: Fetch issue from GitHub
- Found: Issue #42 contains "MA" identifier
```
Issue #42: Add dark mode toggle [MA]
Description: Users should be able to switch between light and dark themes...
Labels: enhancement, frontend
```

**Step 2**: Break down
```
Deliverable 1: Theme state management
- Add theme store/context
- Persist preference to localStorage

Deliverable 2: UI toggle component
- Create theme toggle button
- Add to header/settings

Deliverable 3: Apply theme styles
- Update CSS variables
- Ensure all components respect theme

Deliverable 4: Testing
- Unit tests for theme store and toggle component
- E2E test: load app, toggle theme, verify class/attribute changes
```

**Step 3**: Create branch `issue-42-dark-mode-toggle`

**Step 4**: Create todos (include unit + E2E testing tasks) and start implementation

**Step 5**: Implement features and tests, commit incrementally


## Error Handling

If issue fetch fails:
- Check if issue number is valid
- Verify repository access
- Try alternative fetch method (web vs API)

If breakdown is unclear:
- Ask user for clarification on ambiguous requirements
- Make reasonable assumptions and note them
- Proceed with best-effort breakdown


## Notes

### Network Permissions

**IMPORTANT**: All GitHub API calls require network permissions. When making API calls:
- Always use `required_permissions: ['network']` in tool calls that fetch from GitHub
- This allows the agent to make network requests without asking for approval each time
- Network permissions are needed for:
  - Fetching issues
  - Searching for project identifiers
  - Assigning issues
  - Posting comments
  - Creating pull requests

### Authentication

**IMPORTANT**: Authentication is required for write operations (assigning issues, posting comments, creating PRs). Read operations (fetching issues) work without auth for public repos but have rate limits.

1. **Check for token before making authenticated API calls**:
   ```bash
   # Check for GITHUB_TOKEN environment variable
   if [ -n "$GITHUB_TOKEN" ]; then
     echo "Token available, proceeding with API call"
   else
     echo "Token not set, skipping authenticated API call"
   fi
   ```

2. **Token sources (in order of preference)**:
   - `GITHUB_TOKEN` environment variable (most common)
   - GitHub CLI authentication: `gh auth status` (if GitHub CLI is installed and authenticated)
   - Git credential helper (for git operations only, not API calls)

3. **Setting up authentication**:
   - **GitHub Personal Access Token**:
     - Create at: GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
     - Required scopes: `repo`, `issues:write`, `pull_requests:write`
     - Set environment variable: `export GITHUB_TOKEN=your_token_here`
   - **GitHub CLI**:
     - Install: `brew install gh` (macOS) or see https://cli.github.com/
     - Authenticate: `gh auth login`
     - CLI will handle authentication automatically

4. **Handling authentication failures**:
   - **401 Bad credentials**: Token is invalid or expired
     - Check if `GITHUB_TOKEN` is set correctly
     - Verify token has required permissions
     - Try regenerating token
   - **403 Forbidden**: Token lacks required permissions
     - Ensure token has `repo`, `issues:write`, `pull_requests:write` scopes
   - **No token available**: Skip authenticated operations gracefully
     - Inform user that manual steps are needed
     - Provide URLs and instructions for manual completion

5. **Best practices**:
   - Always check for token availability before making authenticated API calls
   - Never hardcode tokens in code or commit them to version control
   - Use environment variables or secure credential storage
   - For public repos, read operations work without auth (with rate limits)
   - For write operations, authentication is always required
   - If authentication fails, gracefully fall back to manual instructions

### Git Operations

**IMPORTANT**: Git operations (push, commit) require proper permissions:
- Always use `required_permissions: ['git_write']` for git write operations
- Use `required_permissions: ['network', 'git_write']` for push operations
- If push fails with authentication errors:
  1. Retry with proper permissions set
  2. Check if credentials are cached (may work on retry)
  3. If still failing, provide manual instructions to user
- Git push may succeed even if initial error message suggests failure - always verify with `git status` or by checking remote

### Other Notes

- Project identifiers (MA-1, PROJ-123, etc.) are searched in issue titles and bodies
- Assignment, commenting, and PR creation require GitHub API authentication
- **Always check for token availability before attempting authenticated API calls**
- If API operations fail due to authentication, continue with local workflow and inform user
- Provide clear manual instructions when automated operations cannot complete
- Branch names should be descriptive and reference the issue number
- Use conventional commit messages for better project history
- PR descriptions should reference the issue to auto-close on merge
- Git push authentication issues are common - always retry with proper permissions before giving up

### Authentication Error Handling

When making GitHub API calls that require authentication:

1. **Before the call**: Check if `GITHUB_TOKEN` is set or GitHub CLI is authenticated
2. **During the call**: Include proper error handling for 401/403 responses
3. **After failure**: Provide clear instructions for manual completion
4. **Example pattern**:
   ```bash
   # Check token first
   if [ -z "$GITHUB_TOKEN" ]; then
     echo "GITHUB_TOKEN not set. Skipping API call."
     echo "Manual step: Visit https://github.com/{owner}/{repo}/issues/{issue_number}"
     exit 0
   fi
   
   # Make API call with error handling
   response=$(curl -s -w "\n%{http_code}" -X POST \
     -H "Authorization: token $GITHUB_TOKEN" \
     -H "Accept: application/vnd.github.v3+json" \
     "https://api.github.com/repos/{owner}/{repo}/issues/{issue_number}/comments" \
     -d '{"body": "..."}')
   
   http_code=$(echo "$response" | tail -n1)
   if [ "$http_code" = "201" ] || [ "$http_code" = "200" ]; then
     echo "Success"
   elif [ "$http_code" = "401" ]; then
     echo "Authentication failed: Bad credentials"
     echo "Please check your GITHUB_TOKEN"
   elif [ "$http_code" = "403" ]; then
     echo "Permission denied: Token lacks required permissions"
   else
     echo "API call failed with status: $http_code"
   fi
   ```