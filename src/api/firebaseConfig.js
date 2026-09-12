// Reads the Firebase project config from Vite env vars — see .env.example
// at the repo root for the exact variable names and where to find each
// value in the Firebase console. Only actually used once lobbyApi.js /
// gameSyncApi.js are pointed at the firebase adapters (their own
// file-header comments explain the one-line swap) — importing this module
// on its own does nothing by itself.
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
};

/** True once every value createInitialApp/getDatabase actually need is present. */
export function hasFirebaseConfig() {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.databaseURL && firebaseConfig.projectId);
}
