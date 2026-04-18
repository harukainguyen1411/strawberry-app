import { initializeApp, getApp as _getApp, getApps } from "firebase-admin/app";
import {
  getFirestore,
  Firestore,
  CollectionReference,
  DocumentData,
} from "firebase-admin/firestore";
import type { Run, Case, Artifact } from "./schema.js";

const APP_NAME = "dashboards-server";

function getApp() {
  if (getApps().find((a) => a.name === APP_NAME)) return _getApp(APP_NAME);
  // On Cloud Run, ADC (Application Default Credentials) is automatically
  // available via the attached service account — no credential arg needed.
  return initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID }, APP_NAME);
}

function db(): Firestore {
  return getFirestore(getApp());
}

function typedCollection<T extends DocumentData>(
  path: string
): CollectionReference<T> {
  return db().collection(path) as CollectionReference<T>;
}

export const runs = () => typedCollection<Run>("runs");
export const cases = () => typedCollection<Case>("cases");
export const artifacts = () => typedCollection<Artifact>("artifacts");

export { db };
