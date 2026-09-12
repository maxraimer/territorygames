// The territorygames Firebase project's web config. A Firebase web app's
// apiKey/authDomain/projectId are not secrets — access control is entirely
// via Realtime Database security rules, not by hiding these values (see
// https://firebase.google.com/docs/projects/api-keys) — so committing them
// is normal practice and, on a static GitHub Pages site with no server to
// keep a real secret on, the only practical option anyway. Vite env vars
// (see .env.example) override these when present, e.g. to point a local
// dev build at a different project without touching this file.
const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyAMvgGUJXnc4JKzi6t2yNhYZrR3aEHHGaw",
  authDomain: "territorygames-364bd.firebaseapp.com",
  databaseURL: "https://territorygames-364bd-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "territorygames-364bd",
};

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || DEFAULT_FIREBASE_CONFIG.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || DEFAULT_FIREBASE_CONFIG.authDomain,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || DEFAULT_FIREBASE_CONFIG.databaseURL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || DEFAULT_FIREBASE_CONFIG.projectId,
};

/** True once every value createInitialApp/getDatabase actually need is present. */
export function hasFirebaseConfig() {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.databaseURL && firebaseConfig.projectId);
}
