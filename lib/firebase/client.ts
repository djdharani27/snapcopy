import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function isMissingValue(value?: string) {
  return !value || value.includes("replace-me");
}

function getMissingClientEnvKeys() {
  return Object.entries(firebaseConfig)
    .filter(([, value]) => isMissingValue(value))
    .map(([key]) => key);
}

function assertClientEnv() {
  const missing = getMissingClientEnvKeys();

  if (missing.length > 0) {
    throw new Error(
      `Missing Firebase client env vars: ${missing.join(", ")}. Update .env.local.`,
    );
  }
}

export function hasFirebaseClientEnv() {
  return getMissingClientEnvKeys().length === 0;
}

function getClientApp() {
  assertClientEnv();
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

export function getFirebaseApp() {
  return getClientApp();
}

export function getFirebaseAuth() {
  return getAuth(getClientApp());
}

export function getFirebaseDb() {
  return getFirestore(getClientApp());
}
