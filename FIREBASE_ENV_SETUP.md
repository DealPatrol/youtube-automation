# Firebase Environment Variables Setup

Add these variables to your **Vars** section in v0 (left sidebar):

## Public Variables (NEXT_PUBLIC_*)

Copy-paste each key and value exactly:

| Variable Name | Value |
|---|---|
| NEXT_PUBLIC_FIREBASE_API_KEY | AIzaSyBAd8xRGWUOr5rwE6VVw3THTL7s2klgZ0o |
| NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN | automation-483620.firebaseapp.com |
| NEXT_PUBLIC_FIREBASE_PROJECT_ID | youtube-automation-483620 |
| NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET | youtube-automation-483620.firebasestorage.app |
| NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID | 613511477324 |
| NEXT_PUBLIC_FIREBASE_APP_ID | 1:613511477324:web:bf347d3adfd7d83e48dce9 |

## Server Variables (Private)

Also add these from your Firebase service account JSON:

| Variable Name | Value |
|---|---|
| FIREBASE_PROJECT_ID | youtube-automation-483620 |
| FIREBASE_PRIVATE_KEY_ID | (from service account JSON) |
| FIREBASE_PRIVATE_KEY | (from service account JSON - preserve newlines) |
| FIREBASE_CLIENT_EMAIL | firebase-adminsdk-fbsvc@youtube-automation-483620.iam.gserviceaccount.com |
| FIREBASE_CLIENT_ID | (from service account JSON) |
| OPENAI_API_KEY | (your OpenAI API key) |

## Steps to Add:

1. Click the **Vars** section in the left sidebar
2. For each variable above, click **Add** 
3. Enter the **key** and **value** exactly as shown
4. Click **Save**

Once all variables are added, the Firebase authentication error will be resolved and your app will work!
