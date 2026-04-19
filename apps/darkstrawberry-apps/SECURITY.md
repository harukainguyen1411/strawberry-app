# Security: Removing Committed Firebase Config

If you've already committed your Firebase config to Git, follow these steps to remove it:

## Option 1: Remove from Git History (Recommended for Public Repos)

If this is a public repository or you want to completely remove the sensitive data:

```bash
# Remove the file from git history (use with caution)
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch src/firebase/config.ts" \
  --prune-empty --tag-name-filter cat -- --all

# Force push (WARNING: This rewrites history)
git push origin --force --all
```

**Note:** This rewrites Git history. Only do this if:
- You're the only one working on the repo, OR
- You've coordinated with your team
- You understand the implications

## Option 2: Just Remove from Future Commits (Safer)

If you just want to stop tracking it going forward:

```bash
# Remove from git tracking (but keep local file)
git rm --cached src/firebase/config.ts

# Commit the removal
git commit -m "Remove Firebase config from version control"

# Push the change
git push
```

## Option 3: Rotate Your Firebase Keys (Safest)

If your keys are already exposed:

1. Go to Firebase Console > Project Settings
2. Regenerate your API keys
3. Update your `.env` file with the new keys
4. Follow Option 2 to remove the old config from Git

## After Removal

1. Make sure `.env` is in `.gitignore` (it already is)
2. Create your `.env` file from `.env.example`
3. Add your Firebase config to `.env`
4. Verify `.env` is not tracked: `git status` should not show `.env`

## Verify It's Working

```bash
# Check that .env is ignored
git check-ignore .env
# Should output: .env

# Verify .env is not in git
git ls-files | grep .env
# Should output nothing
```
