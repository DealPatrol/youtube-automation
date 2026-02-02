# Firebase Environment Variables Setup

Add these variables to your v0 project's **Vars** section (click the gear icon in the sidebar):

## Server-Side Firebase Credentials (Private)

These should be added as private variables in v0:

\`\`\`
FIREBASE_PROJECT_ID=youtube-automation-483620

FIREBASE_PRIVATE_KEY_ID=71299b31215fdf02fe828c21d564004d07406fea

FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDVZANFXVCCPE0n\nvJ5YfEXLgaogH719iORCQxIxMJrRfCh35Q646kiLxWhXf2EBLK8gZtr0eBZKftb2\nWILmrtKmwlAJRCVozj36OMtDOCamcVfluWYDFAiIzfI8NcKLozKBzyd4p3S3JJF8\nN2WHXoVCghPoYqfmj3ZjH8xsHEDSUKSpS7WOKLouZd/eGlit4wePwcZQ5RtjgYhY\nmMXaAO/HgiyphD9JfI+10cCqSYrupbWyKyATbYT4IegXjL5S0ohwgLNpJP5qDIk4\nogwSXTl/NktAREzV1iNAvT6AAGGz9o8Z9sjO0ylDWvGNGSY2qOntnnfi12DJARaj\nFtX2IwZ9AgMBAAECggEAEPIu0lDdRmJsjCXN+1/vGQC0lnV+0lvPKLXz2WUvPkia\nXB8cIrI0TalBJoWume3HAI86fySUPJlDD/AqgRBMGUMgIQRA5khOorLk7XMlmp0w\nqkUlZUQvg1G7lW19hCJTLfzZ+RpvSeYFCbTKgswOUCBNXWyMQeKNt8R8Mu+xdCIf\nKy0uSUzhoOj0OIT36SuYO1pL+uqTameqiBOFgq+Ebmsiq1S59rMl8cPSrJGFOSg7\nFdfQkYkn39qBVLn1lYEK1WLa0UUNwALTz7CyDjvunIt+bexpj1xStCFaoe/+y3CQ\nrMdq7sCn/aoy+1yBDoNhSFllVe7TQCTH0Z5r+MoFMQKBgQD3MwmNmHVClP953WWU\nuBqqMnhNZwb5wk7DPn86iL4NJD6H6na8zogHA6dsRKYq8iHQIt3GtxJ8KbC49R5a\nMa7W30S8xXKw0UNiYsvdRvi3P3id4VoVkcLCPYQBqTLOTrJyWBXflOzNOSR7d/ts\n/+wJsQ8bn6PAnCOd7zuxkgMKxQKBgQDc/NhBdvvmes0F8IOOXNs1Zs2yzC4LveuS\nuKfEg1urn7gqg+i6HaPChV3IlbwT4i1c3LRnF3Tc1OqST6U+zCLQ8/IY6uDPQPTW\n7Z5qdpe+8sfikmXszl/D28vhHQNNbbVvskG6RIUm07o6r0wWYBuyO/xNnONwnJ6D\nL0HkUCeoWQKBgQCfVitrNIEoyKef4oAuizjMyblXkvghFwjzup4BmdB+4gTYUN32\nN13gv480L0+4UNhQs5imFKz6kVjS71SAKJQc9k71KoQRyuEXUr07RRrd6zCQ+4e4\nbXrO/x3OgEQ6TOmi4HpA4lp8sb99Qkoy6Qc4/ALT+GNxrHMcwu6EN6x0TQKBgQCJ\nTy3L13ODbRARPbVwcq/eCYeMLiP6NcK3Ardzei8uf2p+OEIVyq7jAd0Y8jjPnfyT\ns6sAV2nMgRtTV9uUHmEPtlPaOa7/+BtppHGHMzLseYvLcy2Tq1ODrgGLWWyg4qcW\nxQrkAwk869fN+Pfs+0CaSX1meDI12YsAdg+aHlfV2QKBgHao9CyWVXdaJBqkGQo7\nQ7/pAZseo6hpuCq05Iw8SUBa4mkGLqwYO7p5mS4zQHPVeNtX8KCwV0RPcSgZaOIP\nooRIVWg/Z36XTZ/BGRies2V8IvlEp6IM4YTD7SZbVT77S/6aDHmnpP7URrkO5lyc\nq+Bs+yTbKxvF3ysJR0twdMH/\n-----END PRIVATE KEY-----\n

FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@youtube-automation-483620.iam.gserviceaccount.com

FIREBASE_CLIENT_ID=106965128228729185031

OPENAI_API_KEY=<your-openai-api-key>
\`\`\`

## Client-Side Firebase Credentials (Public)

You still need these public variables from Firebase Console → Project Settings → Web App Config:

\`\`\`
NEXT_PUBLIC_FIREBASE_API_KEY=<get from firebase console>

NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=youtube-automation-483620.firebaseapp.com

NEXT_PUBLIC_FIREBASE_PROJECT_ID=youtube-automation-483620

NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=youtube-automation-483620.appspot.com

NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<get from firebase console>

NEXT_PUBLIC_FIREBASE_APP_ID=<get from firebase console>
\`\`\`

## How to Find the Remaining Values

1. Go to **Firebase Console** → Select your project
2. Click **Project Settings** (gear icon)
3. Go to **Your Apps** section
4. Find your web app config and copy:
   - `apiKey` → `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `messagingSenderId` → `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `appId` → `NEXT_PUBLIC_FIREBASE_APP_ID`

## Adding to v0

1. In v0, click the **Vars** icon in the left sidebar
2. Add each variable with its value
3. Once all are set, your app will have full Firebase authentication and Firestore database access
