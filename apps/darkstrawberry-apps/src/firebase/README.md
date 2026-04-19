# Firebase Configuration

Firebase configuration is now managed through environment variables for security.

## Setup

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Open `.env` and fill in your Firebase configuration values.

You can find your Firebase config in:
Firebase Console > Project Settings > Your apps > Web app > Config

Example `.env` file:
```env
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=myapp-12345.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=myapp-12345
VITE_FIREBASE_STORAGE_BUCKET=myapp-12345.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abcdef123456
VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
```

**Important:** 
- The `.env` file is gitignored and will NOT be committed to version control
- Never commit your actual Firebase credentials
- The `.env.example` file serves as a template for other developers
