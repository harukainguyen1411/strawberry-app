import {
  collection,
  doc,
  type Firestore,
  type CollectionReference,
  type DocumentReference,
  type DocumentData
} from 'firebase/firestore'

/**
 * Returns a Firestore CollectionReference scoped to:
 *   /appData/{appId}/users/{userId}/{collectionName}
 */
export function appCollection(
  db: Firestore,
  appId: string,
  userId: string,
  collectionName: string
): CollectionReference<DocumentData> {
  return collection(db, `appData/${appId}/users/${userId}/${collectionName}`)
}

/**
 * Returns a Firestore DocumentReference scoped to:
 *   /appData/{appId}/users/{userId}/{collectionName}/{docId}
 */
export function appDoc(
  db: Firestore,
  appId: string,
  userId: string,
  collectionName: string,
  docId: string
): DocumentReference<DocumentData> {
  return doc(db, `appData/${appId}/users/${userId}/${collectionName}/${docId}`)
}
