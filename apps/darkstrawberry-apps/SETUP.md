# Setup Guide

## Step 1: Install Dependencies

Run the following command in your terminal:

```bash
npm install
```

## Step 2: Set Up Firebase

### 2.1 Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or select an existing project
3. Follow the setup wizard
4. Enable Google Analytics (optional, but recommended)

### 2.2 Enable Authentication

1. In Firebase Console, go to **Authentication**
2. Click **Get Started**
3. Go to **Sign-in method** tab
4. Enable **Google** provider:
   - Click on Google
   - Toggle "Enable"
   - Add your project's support email
   - Click **Save**

### 2.3 Create Firestore Database

1. In Firebase Console, go to **Firestore Database**
2. Click **Create database**
3. Choose **Start in test mode** (for development)
4. Select a location (choose closest to your users)
5. Click **Enable**

### 2.4 Get Firebase Configuration

1. In Firebase Console, go to **Project Settings** (gear icon)
2. Scroll down to **Your apps** section
3. Click the **Web** icon (`</>`)
4. Register your app with a nickname (e.g., "MyApps Web")
5. Copy the Firebase configuration object

### 2.5 Update Firebase Config

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Open `.env` and replace the placeholder values with your actual Firebase config from step 2.4:

```env
VITE_FIREBASE_API_KEY=your-actual-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=your-app-id
VITE_FIREBASE_MEASUREMENT_ID=your-measurement-id
```

**Important:** The `.env` file is already in `.gitignore` and will not be committed to version control. Never commit your actual Firebase credentials!

## Step 3: Set Up Firestore Security Rules

1. In Firebase Console, go to **Firestore Database** > **Rules**
2. Replace the rules with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only access their own data
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

3. Click **Publish**

## Step 4: Run the Development Server

```bash
npm run dev
```

The app should open at `http://localhost:5173` (or the port shown in terminal)

## Step 5: Test the Application

1. Navigate to the home page
2. Click on "Read Tracker" app card
3. You should see the Read Tracker layout with navigation tabs
4. All pages are currently placeholders (coming soon)

## Troubleshooting

### Firebase Authentication Not Working
- Make sure Google provider is enabled in Firebase Console
- Check that your Firebase config is correct
- Verify the domain is authorized in Firebase Console > Authentication > Settings > Authorized domains

### Firestore Permission Denied
- Check that security rules are published
- Ensure you're logged in before accessing Firestore data
- Verify the user ID matches in the rules

### Build Errors
- Make sure all dependencies are installed: `npm install`
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- Check Node.js version (should be v18 or higher)

## Next Steps

Once setup is complete, you can proceed with:
- Milestone 2: Implementing authentication UI
- Milestone 3: Building reading sessions feature
- And so on...

Refer to `PROJECT_PLAN.md` for detailed milestones and features.
