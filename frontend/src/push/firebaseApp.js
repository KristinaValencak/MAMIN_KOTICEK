import { initializeApp, getApps } from "firebase/app";

function requiredEnv(name) {
  const v = import.meta.env[name];
  if (v == null || v === "") {
    throw new Error(`missing_env:${name}`);
  }
  return String(v);
}

const firebaseConfig = {
  apiKey: requiredEnv("VITE_FIREBASE_API_KEY"),
  authDomain: requiredEnv("VITE_FIREBASE_AUTH_DOMAIN"),
  projectId: requiredEnv("VITE_FIREBASE_PROJECT_ID"),
  storageBucket: requiredEnv("VITE_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: requiredEnv("VITE_FIREBASE_MESSAGING_SENDER_ID"),
  appId: requiredEnv("VITE_FIREBASE_APP_ID"),
  measurementId: String(import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || ""),
};

export function getFirebaseApp() {
  if (getApps().length) return getApps()[0];
  return initializeApp(firebaseConfig);
}

