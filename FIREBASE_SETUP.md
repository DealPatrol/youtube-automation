## Firebase Setup Guide

Your YouTube AI Builder app requires Firebase credentials to work. Follow these steps to configure Firebase:

### 1. Create a Firebase Project
- Go to [Firebase Console](https://console.firebase.google.com)
- Click "Add project" and follow the setup wizard
- Enable Google Analytics if prompted

### 2. Get Your Firebase Config
- In Firebase Console, go to Project Settings (gear icon)
- Copy the following values from the "General" tab:

**Public Variables (NEXT_PUBLIC_*):**
\`\`\`
NEXT_PUBLIC_FIREBASE_API_KEY = [apiKey]
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = [authDomain]
NEXT_PUBLIC_FIREBASE_PROJECT_ID = [projectId]
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = [storageBucket]
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = [messagingSenderId]
NEXT_PUBLIC_FIREBASE_APP_ID = [appId]
\`\`\`

### 3. Setup Firestore Database
- In Firebase Console, go to "Firestore Database"
- Click "Create database"
- Choose "Start in test mode" (for development)
- Select your preferred region
- Click "Enable"

### 4. Setup Authentication
- In Firebase Console, go to "Authentication"
- Click "Get started"
- Enable "Google" provider:
  - Click "Google"
  - Toggle "Enable"
  - Add your support email
  - Save
- Enable "Email/Password" provider:
  - Click "Email/Password"
  - Toggle "Enable"
  - Save

### 5. Create Service Account (for backend)
- In Firebase Console, go to Project Settings
- Go to "Service Accounts" tab
- Click "Generate new private key"
- This downloads a JSON file with:
  - FIREBASE_PROJECT_ID
  - FIREBASE_PRIVATE_KEY_ID
  - FIREBASE_PRIVATE_KEY
  - FIREBASE_CLIENT_EMAIL
  - FIREBASE_CLIENT_ID

### 6. Add Environment Variables to Your Project
In your Vercel project (or local .env.local):

**Client-side (Public):**
\`\`\`
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
\`\`\`

**Server-side (Private):**
\`\`\`
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_PRIVATE_KEY_ID=your_private_key_id
FIREBASE_PRIVATE_KEY=your_private_key_with_newlines
FIREBASE_CLIENT_EMAIL=your_service_account_email
FIREBASE_CLIENT_ID=your_client_id
\`\`\`

### 7. Add Google OAuth Configuration
- In Firebase Console, go to Authentication → Settings
- Add your app domain to "Authorized domains"
- For local development: add localhost:3000

Your app will now have full authentication and data persistence capabilities!
