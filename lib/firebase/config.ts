'use client'

import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

// Check if we have Firebase credentials
const hasFirebaseConfig = Object.values(firebaseConfig).every(value => value && value.length > 0)

if (!hasFirebaseConfig) {
  console.error('[Firebase] Missing Firebase configuration environment variables')
  console.error('[Firebase] Required variables:')
  console.error('  - NEXT_PUBLIC_FIREBASE_API_KEY')
  console.error('  - NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN')
  console.error('  - NEXT_PUBLIC_FIREBASE_PROJECT_ID')
  console.error('  - NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET')
  console.error('  - NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID')
  console.error('  - NEXT_PUBLIC_FIREBASE_APP_ID')
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
