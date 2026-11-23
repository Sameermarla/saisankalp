/**
 * Sai Sankalp — Firebase / Cloud Firestore & Persistent Database Client
 * ====================================================================
 * Connects directly to Google Firebase Firestore when credentials are provided in .env:
 *   - VITE_FIREBASE_API_KEY
 *   - VITE_FIREBASE_AUTH_DOMAIN
 *   - VITE_FIREBASE_PROJECT_ID
 *   - VITE_FIREBASE_STORAGE_BUCKET
 *   - VITE_FIREBASE_MESSAGING_SENDER_ID
 *   - VITE_FIREBASE_APP_ID
 *
 * If Firebase credentials are not yet supplied, it gracefully operates via a robust
 * localStorage-backed Firestore persistence simulation seeded with authentic Sai Sankalp
 * catalog items, categories, coupons, and orders.
 */

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  type Firestore,
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';

export interface FirebaseConfig {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  databaseURL?: string;
}

const firebaseConfig: FirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || '',
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.projectId && (firebaseConfig.apiKey || firebaseConfig.authDomain)
);

let app: FirebaseApp | null = null;
let firestoreDb: Firestore | null = null;

if (isFirebaseConfigured) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    firestoreDb = getFirestore(app);
    console.log(`[Firebase] Initialized Cloud Firestore for project "${firebaseConfig.projectId}"`);
  } catch (err) {
    console.warn('[Firebase] Initialization error, falling back to local persistent store:', err);
    firestoreDb = null;
  }
} else {
  console.info(
    '[Firebase] Running in Local Persistent mode. To link live Cloud Firestore, populate VITE_FIREBASE_* variables in .env'
  );
}

export { app, firestoreDb };
