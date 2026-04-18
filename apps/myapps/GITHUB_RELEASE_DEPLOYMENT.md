# GitHub Release Deployment

This project uses GitHub Actions to automatically deploy to Firebase Hosting when a new release is created on GitHub.

## How It Works

1. **Create a GitHub Release**: When you create a new release on GitHub with release notes
2. **GitHub Action Triggers**: The workflow automatically runs
3. **Build & Deploy**: The app is built with the release version and notes, then deployed to Firebase
4. **Release Notes Display**: The release notes are displayed in the Settings page

## Setup Instructions

### 1. Get Firebase Service Account Key

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to **Project Settings** → **Service Accounts**
4. Click **Generate New Private Key**
5. Save the JSON file securely

### 2. Configure GitHub Secrets

Go to your GitHub repository → **Settings** → **Secrets and variables** → **Actions** and add:

- **`FIREBASE_SERVICE_ACCOUNT`**: The entire contents of the service account JSON file (from step 1)
- **`FIREBASE_PROJECT_ID`**: Your Firebase project ID (e.g., `myapps-b31ea`)

**Note**: `GITHUB_TOKEN` is automatically provided by GitHub Actions, no need to add it.

### 3. Create a Release

1. Go to your GitHub repository
2. Click **Releases** → **Create a new release**
3. Choose a tag (e.g., `v1.0.1`) or create a new one
4. Fill in the release title and description (release notes)
5. Click **Publish release**

The GitHub Action will automatically:
- Extract the version from the tag (removes `v` prefix if present)
- Build the app with the version and release notes
- Deploy to Firebase Hosting
- Display release notes in the Settings page

## Release Notes Format

Release notes support plain text and will be displayed in the Settings page. You can use:
- Plain text
- Line breaks (will be preserved)
- Basic formatting

Example release notes:
```
## What's New

- Added version tracking system
- Improved performance
- Fixed several bugs

## Improvements

- Better error handling
- Updated dependencies
```

## Manual Deployment

If you need to deploy manually without creating a GitHub release:

```bash
# Deploy with specific version
make deploy-v1.0.1

# Deploy hosting only with version
make deploy-hosting-v1.0.2

# Deploy with version parameter
make deploy VERSION=1.0.3
```

## Troubleshooting

### Workflow Not Running

- Ensure the workflow file exists at `.github/workflows/deploy-release.yml`
- Check that secrets are properly configured
- Verify the release was created (not just a tag)

### Deployment Fails

- Check GitHub Actions logs for error details
- Verify Firebase service account has proper permissions
- Ensure `FIREBASE_PROJECT_ID` matches your project

### Release Notes Not Showing

- Verify release notes were included when creating the release
- Check that the build completed successfully
- Ensure you're viewing the deployed version (not local dev)

## Workflow Details

The workflow (`deploy-release.yml`) does the following:

1. **Triggers**: On `release.created` event
2. **Extracts**: Version from tag, release notes from release body
3. **Builds**: With `VITE_APP_VERSION`, `VITE_RELEASE_TIME`, and `VITE_RELEASE_NOTES`
4. **Deploys**: To Firebase Hosting using the Firebase GitHub Action
5. **Displays**: Release notes in the Settings page of the deployed app
