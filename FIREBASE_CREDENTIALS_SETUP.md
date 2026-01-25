# Getting Firebase Credentials for v0

## Step 1: Get Client-Side Credentials (Public)
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Click the Settings icon (gear) → **Project Settings**
4. Under "Your apps" section, find your web app (or create one if needed)
5. Copy these values and add to v0 **Vars** section:

```
NEXT_PUBLIC_FIREBASE_API_KEY = (apiKey from config)
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = (authDomain from config)
NEXT_PUBLIC_FIREBASE_PROJECT_ID = (projectId from config)
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = (storageBucket from config)
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = (messagingSenderId from config)
NEXT_PUBLIC_FIREBASE_APP_ID = (appId from config)
```

## Step 2: Get Server-Side Credentials (Private)
For backend operations (API routes), you need the service account key:

1. In Firebase Console, go to **Settings** → **Service Accounts** tab
2. Click **Generate New Private Key**
3. A JSON file downloads with your credentials
4. Open the JSON file and add these to v0 **Vars**:

```
FIREBASE_PROJECT_ID = (project_id from JSON)
FIREBASE_PRIVATE_KEY_ID = (private_key_id from JSON)
FIREBASE_PRIVATE_KEY = (private_key from JSON - entire private key string)
FIREBASE_CLIENT_EMAIL = (client_email from JSON)
FIREBASE_CLIENT_ID = (client_id from JSON)
OPENAI_API_KEY = (Your OpenAI API key)
```

## Step 3: Enable Authentication Methods
In Firebase Console:
1. Go to **Authentication** → **Sign-in method**
2. Enable **Email/Password**
3. Enable **Google** (configure OAuth consent screen if needed)

## Step 4: Create Firestore Database
1. Go to **Firestore Database** 
2. Click **Create Database**
3. Start in **test mode** (for development)
4. Choose region (default is fine)

## Step 5: Add Environment Variables to v0
In v0 project settings:
1. Click **Vars** in the left sidebar
2. Add all the NEXT_PUBLIC_* variables (these are visible to browser)
3. Add all the FIREBASE_* variables (these are private/server-only)
4. Add OPENAI_API_KEY for content generation

That's it! Your app should now connect to Firebase successfully.
