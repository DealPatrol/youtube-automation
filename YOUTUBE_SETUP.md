# YouTube Upload Integration Setup

## Overview
This guide explains how to set up YouTube direct upload functionality for the YouTube AI Builder app.

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project called "YouTube AI Builder"
3. Enable the YouTube Data API v3:
   - Search for "YouTube Data API v3"
   - Click "Enable"

## Step 2: Create OAuth 2.0 Credentials

1. Go to **Credentials** in the left sidebar
2. Click **+ Create Credentials** → **OAuth client ID**
3. Choose **Web application**
4. Add Authorized redirect URIs:
   ```
   http://localhost:3000/api/auth/youtube/callback
   https://your-domain.com/api/auth/youtube/callback
   ```
5. Copy the **Client ID** and **Client Secret**

## Step 3: Add Environment Variables

Add these to your v0 Vars section:

```
YOUTUBE_CLIENT_ID=your_client_id_here
YOUTUBE_CLIENT_SECRET=your_client_secret_here
NEXTAUTH_URL=https://your-domain.com (or http://localhost:3000 for local dev)
NEXT_PUBLIC_YOUTUBE_CLIENT_ID=your_client_id_here
```

## Step 4: How It Works

1. User clicks "Upload to YouTube" button on results page
2. Redirected to Google OAuth consent screen
3. After approval, receives access token
4. Token used to upload video to YouTube
5. Uploaded video appears as private (can be changed to unlisted/public)

## Step 5: Testing

### Local Development
- Add `NEXTAUTH_URL=http://localhost:3000`
- OAuth redirect URI: `http://localhost:3000/api/auth/youtube/callback`

### Production
- Update `NEXTAUTH_URL` to your domain
- Add production redirect URI to Google Cloud Console
- Example: `https://myapp.com/api/auth/youtube/callback`

## Troubleshooting

**"Invalid redirect URI"**
- Make sure redirect URI in code matches exactly with Google Cloud Console
- Include the full path: `/api/auth/youtube/callback`

**"Access Denied"**
- User may have rejected permissions
- Clear browser cookies and try again
- Ensure YouTube Data API v3 is enabled

**OAuth callback not working**
- Check that `NEXTAUTH_URL` environment variable is set correctly
- Verify redirect URI is whitelisted in Google Cloud Console

## Notes

- Videos are uploaded as **private** by default for safety
- Users can change privacy settings on YouTube after upload
- Uploads work with video files under 128GB
- Requires valid YouTube account with uploads enabled
