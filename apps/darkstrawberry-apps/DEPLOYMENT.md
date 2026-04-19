# Deployment Guide

This guide will help you deploy the MyApps application to Firebase Hosting.

## Prerequisites

1. **Firebase CLI**: Firebase CLI is included as a dev dependency. You can use it via npm scripts or npx:
   ```bash
   # Using npm scripts (recommended)
   npm run firebase login
   
   # Or using npx directly
   npx firebase login
   ```

2. **Firebase Login**: Login to Firebase:
   ```bash
   npm run firebase login
   ```
   
   Or if you have Firebase CLI installed globally:
   ```bash
   firebase login
   ```

3. **Firebase Project**: Ensure your Firebase project is set up (already configured in `.firebaserc`)

## Deployment Steps

### 1. Build the Production Version

First, build the optimized production bundle:

```bash
npm run build
```

This will:
- Create an optimized production build in the `dist` folder
- Minify and compress JavaScript and CSS
- Remove console logs and debuggers
- Split code into chunks for better caching

### 2. Preview the Production Build (Optional)

Before deploying, you can preview the production build locally:

```bash
npm run preview
```

Visit `http://localhost:4173` to preview your production build.

### 3. Deploy to Firebase Hosting

#### Option A: Deploy Everything (Recommended)
```bash
npm run deploy
```

#### Option B: Deploy Only Hosting
```bash
npm run deploy:hosting
```

#### Option C: Manual Deploy
```bash
npm run build
npm run firebase deploy --only hosting
```

### 4. Verify Deployment

After deployment, Firebase will provide you with a URL like:
```
https://myapps-b31ea.web.app
```

or

```
https://myapps-b31ea.firebaseapp.com
```

Visit the URL to verify your deployment.

## Environment Variables

**Important**: Make sure your Firebase environment variables are set in your Firebase Hosting environment:

1. Go to Firebase Console → Hosting → Your site
2. Add environment variables in the hosting configuration
3. Or use Firebase Functions environment config (if using Functions)

For local development, ensure your `.env` file contains:
```
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

**Note**: For production, these should be set in your build environment or Firebase Hosting configuration.

## Firebase Hosting Configuration

The `firebase.json` file is already configured with:
- **Public directory**: `dist` (Vite output)
- **Rewrites**: All routes redirect to `index.html` for SPA routing
- **Caching**: Optimized cache headers for static assets
- **Security headers**: XSS protection, frame options, content type options

## Custom Domain (Optional)

To set up a custom domain:

1. Go to Firebase Console → Hosting
2. Click "Add custom domain"
3. Follow the instructions to verify domain ownership
4. Update DNS records as instructed
5. Wait for SSL certificate provisioning (automatic)

## Firebase Analytics

Firebase Analytics is automatically initialized when:
- The app is running in a browser environment
- Analytics is supported by the browser
- Measurement ID is configured

Analytics will track:
- Page views
- User engagement
- Custom events (can be added as needed)

## Troubleshooting

### Build Errors

If you encounter build errors:
1. Check that all dependencies are installed: `npm install`
2. Verify TypeScript compilation: `npm run build`
3. Check for linting errors

### Deployment Errors

If deployment fails:
1. Verify Firebase login: `firebase login`
2. Check project ID in `.firebaserc`
3. Ensure `dist` folder exists (run `npm run build` first)
4. Check Firebase Hosting quota limits

### Environment Variables Not Working

If environment variables aren't working in production:
1. Ensure variables are prefixed with `VITE_`
2. Rebuild the application after changing variables
3. Check Firebase Hosting environment configuration

## Continuous Deployment (Optional)

You can set up continuous deployment using GitHub Actions:

1. Create `.github/workflows/deploy.yml`
2. Add Firebase service account credentials as GitHub secrets
3. Configure workflow to build and deploy on push to main branch

## Rollback

To rollback to a previous deployment:

```bash
firebase hosting:rollback
```

Or use the Firebase Console:
1. Go to Firebase Console → Hosting
2. Click on "Release history"
3. Select a previous release and click "Rollback"

## Performance Optimization

The production build includes:
- Code splitting for better caching
- Minified JavaScript and CSS
- Optimized asset loading
- Tree shaking to remove unused code

## Monitoring

Monitor your deployment:
- **Firebase Console**: View hosting metrics, bandwidth usage
- **Firebase Analytics**: Track user engagement and events
- **Firebase Performance**: Monitor app performance (if enabled)

## Support

For issues or questions:
- Check Firebase Hosting documentation
- Review Firebase Console for error logs
- Check browser console for client-side errors
