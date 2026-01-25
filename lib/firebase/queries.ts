import { getFirestore, collection, query, where, getDocs, doc, getDoc, setDoc, updateDoc, Timestamp } from 'firebase/firestore'
import { initializeApp } from 'firebase/app'

export async function getFirebaseUser(userId: string) {
  try {
    const app = initializeApp({})
    const db = getFirestore(app)
    const userDoc = await getDoc(doc(db, 'users', userId))
    return userDoc.exists() ? { id: userDoc.id, ...userDoc.data() } : null
  } catch (error) {
    console.error('Error getting user:', error)
    return null
  }
}

export async function getUserProjects(userId: string) {
  try {
    const app = initializeApp({})
    const db = getFirestore(app)
    const q = query(collection(db, 'projects'), where('user_id', '==', userId))
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      created_at: doc.data().created_at?.toDate?.().toISOString() || new Date().toISOString(),
    }))
  } catch (error) {
    console.error('Error getting projects:', error)
    return []
  }
}

export async function getResult(resultId: string) {
  try {
    const app = initializeApp({})
    const db = getFirestore(app)
    const docSnap = await getDoc(doc(db, 'results', resultId))
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null
  } catch (error) {
    console.error('Error getting result:', error)
    return null
  }
}

export async function createProject(userId: string, topic: string, description: string, title: string) {
  try {
    const app = initializeApp({})
    const db = getFirestore(app)
    const projectRef = doc(collection(db, 'projects'))
    await setDoc(projectRef, {
      user_id: userId,
      topic,
      description,
      title,
      created_at: Timestamp.now(),
    })
    return projectRef.id
  } catch (error) {
    console.error('Error creating project:', error)
    throw error
  }
}

export async function createResult(projectId: string, userId: string) {
  try {
    const app = initializeApp({})
    const db = getFirestore(app)
    const resultRef = doc(collection(db, 'results'))
    await setDoc(resultRef, {
      project_id: projectId,
      user_id: userId,
      processing_status: 'processing',
      created_at: Timestamp.now(),
    })
    return resultRef.id
  } catch (error) {
    console.error('Error creating result:', error)
    throw error
  }
}

export async function updateResult(resultId: string, updates: any) {
  try {
    const app = initializeApp({})
    const db = getFirestore(app)
    await updateDoc(doc(db, 'results', resultId), updates)
  } catch (error) {
    console.error('Error updating result:', error)
    throw error
  }
}
