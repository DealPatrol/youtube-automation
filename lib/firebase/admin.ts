import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getAuth as getAdminAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

// Check if credentials are available
const requiredEnvVars = [
  'FIREBASE_PROJECT_ID',
  'FIREBASE_PRIVATE_KEY_ID',
  'FIREBASE_PRIVATE_KEY',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_CLIENT_ID',
]

const missingVars = requiredEnvVars.filter(varName => !process.env[varName])

if (missingVars.length > 0) {
  console.error('[Firebase Admin] Missing required environment variables:')
  missingVars.forEach(varName => console.error(`  - ${varName}`))
  throw new Error(`Missing Firebase Admin credentials: ${missingVars.join(', ')}`)
}

const serviceAccount = {
  type: 'service_account',
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: 'https://accounts.google.com/o/oauth2/auth',
  token_uri: 'https://oauth2.googleapis.com/token',
  auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
  client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(process.env.FIREBASE_CLIENT_EMAIL || '')}`,
}

// Initialize Firebase Admin only if not already initialized
let app
if (getApps().length === 0) {
  try {
    app = initializeApp({
      credential: cert(serviceAccount as any),
    })
    console.log('[Firebase Admin] Successfully initialized')
  } catch (error) {
    console.error('[Firebase Admin] Initialization error:', error)
    throw error
  }
} else {
  app = getApps()[0]
}

export const adminAuth = getAdminAuth(app)
export const db = getFirestore(app)
