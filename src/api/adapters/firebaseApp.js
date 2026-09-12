// Shared Firebase App + Realtime Database instance for firebaseLobbyAdapter.js
// and firebaseGameSyncAdapter.js — both talk to the same project, so this
// initializes it exactly once regardless of which (or both) adapters get
// imported.
import { initializeApp, getApps } from "firebase/app";
import { getDatabase } from "firebase/database";
import { firebaseConfig, hasFirebaseConfig } from "../firebaseConfig";

let dbInstance = null;

export function getFirebaseDb() {
  if (!hasFirebaseConfig()) {
    throw new Error(
      "Firebase isn't configured — set VITE_FIREBASE_* env vars (see .env.example) before using the firebase adapters."
    );
  }
  if (!dbInstance) {
    const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    dbInstance = getDatabase(app);
  }
  return dbInstance;
}
