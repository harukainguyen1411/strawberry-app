# GitHub Issue Implementation - Reference

## GitHub API Usage

### Fetching Issues

**Public Repository (no auth)**:
```bash
curl https://api.github.com/repos/owner/repo/issues/42
```

**Private Repository (with token)**:
```bash
curl -H "Authorization: token YOUR_TOKEN" \
     https://api.github.com/repos/owner/repo/issues/42
```

**Using mcp_web_fetch** (fallback):
```
https://github.com/owner/repo/issues/42
```

### API Response Structure

```json
{
  "number": 42,
  "title": "Add dark mode toggle",
  "body": "Users should be able to switch...",
  "state": "open",
  "labels": [
    {"name": "enhancement", "color": "a2eeef"},
    {"name": "frontend", "color": "0e8a16"}
  ],
  "assignees": [...],
  "comments": 3,
  "created_at": "2024-01-15T10:00:00Z",
  "updated_at": "2024-01-20T14:30:00Z"
}
```

### Resolving Project Identifiers

Project identifiers like "MA-1", "PROJ-123" are custom identifiers that may appear in:
- Issue titles: "Add feature [MA-1]"
- Issue body: "Related to MA-1"
- Issue labels (less common)

**Search Strategy**:
```bash
# Search all issues for project identifier
curl "https://api.github.com/repos/owner/repo/issues?state=all&per_page=100" \
  | jq '.[] | select(.title | contains("MA-1") or .body | contains("MA-1"))'
```

**Alternative**: If using GitHub Projects, check Projects API:
```bash
# List project items (requires Projects API)
curl -H "Authorization: token YOUR_TOKEN" \
     "https://api.github.com/repos/owner/repo/projects"
```

### Assigning Issues

**Assign to user**:
```bash
curl -X PATCH \
  -H "Authorization: token YOUR_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  "https://api.github.com/repos/owner/repo/issues/42" \
  -d '{"assignees": ["username"]}'
```

**Get current user**:
```bash
# From git config
git config user.name
git config github.user

# Or from GitHub API
curl -H "Authorization: token YOUR_TOKEN" \
     "https://api.github.com/user"
```

### Commenting on Issues

**Post breakdown comment (with token check)**:
```bash
if [ -z "$GITHUB_TOKEN" ]; then
  echo "GITHUB_TOKEN not set. Use GitHub CLI or set token."
  gh issue comment 42 --body "Comment text" 2>/dev/null || echo "Manual: Comment at https://github.com/{owner}/{repo}/issues/42"
else
  curl -X POST \
    -H "Authorization: token $GITHUB_TOKEN" \
    -H "Accept: application/vnd.github.v3+json" \
    "https://api.github.com/repos/owner/repo/issues/42/comments" \
    -d '{
      "body": "## Implementation Breakdown\n\n### Overview\n...\n\n### Deliverables\n..."
    }'
fi
```

**Alternative: Use GitHub CLI**:
```bash
gh issue comment 42 --body "Comment text"
```

**Comment Format Template**:
```markdown
## Implementation Breakdown

### Overview
[Brief summary of the approach and key decisions]

### Deliverables

**Deliverable 1: [Name]**
- [ ] Subtask 1.1: [Description]
- [ ] Subtask 1.2: [Description]

**Deliverable 2: [Name]**
- [ ] Subtask 2.1: [Description]

### Notes
[Any important considerations or dependencies]
```

### Creating Branches

**Branch naming conventions**:
- Format: `issue-{number}-{slug}` or `{project-id}-{slug}`
- Examples:
  - `issue-42-dark-mode-toggle`
  - `ma-1-theme-switcher`
  - `fix-123-date-timezone-bug`

**Create branch**:
```bash
# Ensure on latest main/master
git checkout main
git pull origin main

# Create and checkout new branch
git checkout -b issue-42-dark-mode-toggle
```

**Branch name generation**:
- Convert issue title to slug: lowercase, replace spaces with hyphens
- Remove special characters except hyphens
- Keep total length under 50 characters
- Include issue number or project ID for traceability

### Committing Changes

**Conventional commit format**:
```
<type>(<scope>): <subject>

<body>

<footer>
```

**Commit types**:
- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code refactoring
- `docs`: Documentation changes
- `style`: Formatting, missing semicolons, etc.
- `test`: Adding tests
- `chore`: Maintenance tasks

**Example commit message**:
```bash
git commit -m "feat: implement dark mode toggle [MA-1]

- Add theme state management with Pinia store
- Create theme toggle component in header
- Apply theme styles across all components
- Persist theme preference to localStorage

Closes #42"
```

**Incremental commits**:
- Commit logical units of work
- Use descriptive messages
- Reference issue number: `Closes #42` or `Fixes #42`
- Include project identifier if applicable: `[MA-1]`

### Pushing Branches

**Push branch to remote**:
```bash
# Push and set upstream tracking
git push -u origin issue-42-dark-mode-toggle

# Or if branch already exists
git push origin issue-42-dark-mode-toggle
```

**Handle push failures**:
- Check authentication: `git config credential.helper`
- Verify remote URL: `git remote -v`
- Check branch permissions

### Creating Pull Requests

**Create PR via GitHub API (with token check)**:
```bash
if [ -z "$GITHUB_TOKEN" ]; then
  echo "GITHUB_TOKEN not set. Use GitHub CLI or set token."
  gh pr create --title "Add dark mode toggle [MA-1]" \
    --body "## Summary\n\nImplements dark mode toggle feature...\n\nCloses #42" \
    --base main --head issue-42-dark-mode-toggle 2>/dev/null || \
    echo "Manual: Create PR at https://github.com/owner/repo/compare/main...issue-42-dark-mode-toggle"
else
  curl -X POST \
    -H "Authorization: token $GITHUB_TOKEN" \
    -H "Accept: application/vnd.github.v3+json" \
    "https://api.github.com/repos/owner/repo/pulls" \
    -d '{
      "title": "Add dark mode toggle [MA-1]",
      "body": "## Summary\n\nImplements dark mode toggle feature...\n\nCloses #42\n\n## Changes\n\n- Add theme state management\n- Create toggle component\n- Apply theme styles",
      "head": "issue-42-dark-mode-toggle",
      "base": "main"
    }'
fi
```

**Alternative: Use GitHub CLI**:
```bash
gh pr create --title "Add dark mode toggle [MA-1]" \
  --body "## Summary\n\nImplements dark mode toggle feature...\n\nCloses #42" \
  --base main --head issue-42-dark-mode-toggle
```

**PR Title Best Practices**:
- Use issue title or descriptive summary
- Include project identifier: `[MA-1]`
- Use conventional commit format: `feat: Add dark mode toggle`
- Keep concise but descriptive

**PR Body Template**:
```markdown
## Summary
[Brief description of what this PR does]

Closes #[issue_number]
[Project identifier if applicable, e.g., [MA-1]]

## Changes
- [Change 1: Description]
- [Change 2: Description]
- [Change 3: Description]

## Implementation Details
[Reference the breakdown comment or add implementation details]

## Testing
- [ ] Tested [scenario 1]
- [ ] Tested [scenario 2]
- [ ] Verified [requirement]

## Screenshots (if applicable)
[Add screenshots for UI changes]

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] No new warnings generated
- [ ] Tests added/updated
```

**Auto-close issues**:
Use these keywords in PR description to auto-close issues on merge:
- `Closes #42`
- `Fixes #42`
- `Resolves #42`

**PR URL template** (if API fails):
```
https://github.com/{owner}/{repo}/compare/{base}...{head}
Example: https://github.com/owner/repo/compare/main...issue-42-dark-mode-toggle
```

## Issue Breakdown Patterns

### Feature Request Pattern

**Input**: "Add user profile editing"

**Breakdown**:
```
Deliverable 1: Backend API
- Create PUT /api/users/:id endpoint
- Add validation middleware
- Update user model

Deliverable 2: Frontend Form
- Create ProfileForm component
- Add form validation
- Handle form submission

Deliverable 3: Integration
- Connect form to API
- Add error handling
- Show success feedback
```

### Bug Fix Pattern

**Input**: "Fix date display showing wrong timezone"

**Breakdown**:
```
Deliverable 1: Identify root cause
- Review date formatting code
- Test timezone conversion logic
- Document the bug

Deliverable 2: Fix implementation
- Update date formatting function
- Ensure UTC consistency
- Add timezone handling

Deliverable 3: Verify fix
- Test with different timezones
- Update affected components
- Add regression tests
```

### Enhancement Pattern

**Input**: "Improve loading performance"

**Breakdown**:
```
Deliverable 1: Analyze current performance
- Profile application
- Identify bottlenecks
- Measure baseline metrics

Deliverable 2: Implement optimizations
- Add code splitting
- Optimize images
- Implement lazy loading

Deliverable 3: Verify improvements
- Measure new metrics
- Test on slow connections
- Document changes
```

## Repository Detection

### From Git Remote

```bash
git remote -v
# origin  https://github.com/owner/repo.git (fetch)
# origin  https://github.com/owner/repo.git (push)
```

Extract: `owner/repo`

### From Package.json

Some projects include repository info:
```json
{
  "repository": {
    "type": "git",
    "url": "https://github.com/owner/repo.git"
  }
}
```

## Authentication

### GitHub Token Setup

For assignment, commenting, and PR creation, you need a GitHub Personal Access Token:

1. **Create token**:
   - GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
   - Generate new token with scopes: `repo`, `issues:write`, `pull_requests:write`

2. **Use token**:
   - Set environment variable: `export GITHUB_TOKEN=your_token`
   - Or pass in API calls: `-H "Authorization: token $GITHUB_TOKEN"`

3. **Token permissions needed**:
   - `repo` - Full repository access (for private repos)
   - `public_repo` - Public repository access (for public repos)
   - `issues:write` - Write access to issues (for assignment and comments)
   - `pull_requests:write` - Write access to pull requests (for creating PRs)

### Checking Token Availability

**Always check for token before making authenticated API calls**:

```bash
# Check if GITHUB_TOKEN is set
if [ -n "$GITHUB_TOKEN" ]; then
  echo "Token available"
else
  echo "Token not set - skipping authenticated API call"
fi

# Alternative: Check GitHub CLI authentication
if gh auth status 2>/dev/null; then
  echo "GitHub CLI authenticated"
else
  echo "GitHub CLI not authenticated"
fi
```

### Error Handling for Authentication

**Handle authentication errors gracefully**:

```bash
# Example: Posting a comment with error handling
if [ -z "$GITHUB_TOKEN" ]; then
  echo "GITHUB_TOKEN not set. Skipping API call."
  echo "Manual step: Add comment at https://github.com/{owner}/{repo}/issues/{issue_number}"
  exit 0
fi

response=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  "https://api.github.com/repos/{owner}/{repo}/issues/{issue_number}/comments" \
  -d '{"body": "Comment text"}')

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

case "$http_code" in
  201|200)
    echo "Success: Comment posted"
    ;;
  401)
    echo "Error: Bad credentials (401)"
    echo "Please check your GITHUB_TOKEN"
    ;;
  403)
    echo "Error: Permission denied (403)"
    echo "Token may lack required permissions"
    ;;
  *)
    echo "Error: API call failed with status $http_code"
    echo "Response: $body"
    ;;
esac
```

### Common Authentication Issues

1. **401 Bad credentials**:
   - Token is invalid, expired, or not set correctly
   - Solution: Verify `GITHUB_TOKEN` is set and valid
   - Regenerate token if needed

2. **403 Forbidden**:
   - Token lacks required permissions
   - Solution: Ensure token has `repo`, `issues:write`, `pull_requests:write` scopes
   - For organization repos, may need organization approval

3. **Token not set**:
   - `GITHUB_TOKEN` environment variable is not set
   - Solution: Set token: `export GITHUB_TOKEN=your_token`
   - Or use GitHub CLI: `gh auth login`

### Network Permissions

**For seamless GitHub API access without approval prompts**:

When using this skill, the agent will request network permissions using `required_permissions: ['network']` in tool calls. This allows:
- Fetching issues from GitHub API
- Searching for project identifiers
- Assigning issues
- Posting comments
- Creating pull requests

**Note**: The agent will request network permissions automatically when making GitHub API calls. If you want to pre-approve network access, you can configure Cursor settings, but the skill handles this automatically by requesting permissions in each API call.

## Git Workflow Best Practices

### Before Starting Work

1. **Ensure clean working directory**:
   ```bash
   git status  # Should show "nothing to commit"
   ```

2. **Update main branch**:
   ```bash
   git checkout main
   git pull origin main
   ```

3. **Verify remote configuration**:
   ```bash
   git remote -v
   ```

### During Implementation

1. **Commit frequently**:
   - Commit logical units of work
   - Use descriptive commit messages
   - Keep commits focused and atomic

2. **Keep branch up to date** (if long-running):
   ```bash
   git checkout main
   git pull origin main
   git checkout issue-42-dark-mode-toggle
   git merge main  # Or use rebase: git rebase main
   ```

### After Implementation

1. **Review before pushing**:
   ```bash
   git status
   git diff main..issue-42-dark-mode-toggle
   ```

2. **Push and create PR**:
   - Push branch to remote
   - Create PR via API or GitHub UI
   - Link PR to issue using keywords

## Common Issue Types

### UI/UX Issues
- Focus on component creation/modification
- State management updates
- Styling and responsive design
- User interaction flows

### Backend/API Issues
- Data model changes
- Endpoint creation/modification
- Business logic implementation
- Database migrations

### Integration Issues
- Connect frontend to backend
- Third-party service integration
- Authentication/authorization
- Data synchronization

### Performance Issues
- Code optimization
- Caching strategies
- Database query optimization
- Asset optimization

## Task Prioritization

### High Priority (Do First)
- Core functionality
- Security-related changes
- Breaking changes
- Dependencies for other tasks

### Medium Priority
- Enhancements
- UI polish
- Documentation
- Non-critical optimizations

### Low Priority
- Nice-to-have features
- Future considerations
- Optional improvements