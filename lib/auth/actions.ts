'use client'

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  setPersistence,
  browserLocalPersistence,
} from 'firebase/auth'
import { auth, db } from '@/lib/firebase/config'
import { setDoc, doc, Timestamp, getDoc } from 'firebase/firestore'

const googleProvider = new GoogleAuthProvider()

export async function signUp(email: string, password: string, fullName: string) {
  try {
    await setPersistence(auth, browserLocalPersistence)
    const userCredential = await createUserWithEmailAndPassword(auth, email, password)
    
    // Create user document in Firestore
    await setDoc(doc(db, 'users', userCredential.user.uid), {
      email,
      full_name: fullName,
      created_at: Timestamp.now(),
    })
    
    return { data: userCredential.user, success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Signup failed'
    return { error: message }
  }
}

export async function signIn(email: string, password: string) {
  try {
    await setPersistence(auth, browserLocalPersistence)
    await signInWithEmailAndPassword(auth, email, password)
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Login failed'
    return { error: message }
  }
}

export async function signInWithGoogle() {
  try {
    await setPersistence(auth, browserLocalPersistence)
    const result = await signInWithPopup(auth, googleProvider)
    
    // Create or update user document
    const userRef = doc(db, 'users', result.user.uid)
    const userSnap = await getDoc(userRef)
    
    if (!userSnap.exists()) {
      await setDoc(userRef, {
        email: result.user.email,
        full_name: result.user.displayName || '',
        profile_picture: result.user.photoURL || '',
        created_at: Timestamp.now(),
      })
    }
    
    return { success: true, user: result.user }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Google sign-in failed'
    return { error: message }
  }
}

export async function signOut() {
  try {
    await firebaseSignOut(auth)
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Logout failed'
    return { error: message }
  }
}
