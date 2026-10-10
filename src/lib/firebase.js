import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Configuration WEB Firebase : publique par nature (la sécurité repose sur les règles Firestore).
const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseConfigured = Boolean(cfg.apiKey && cfg.projectId && cfg.appId);
export const app = firebaseConfigured ? initializeApp(cfg) : null;
export const auth = firebaseConfigured ? getAuth(app) : null;
export const db = firebaseConfigured ? getFirestore(app) : null;
