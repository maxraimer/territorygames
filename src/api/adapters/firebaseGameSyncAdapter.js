// Firebase Realtime Database implementation of the game-sync contract (see
// ../gameSyncApi.js) — the same 3 functions as mockGameSyncAdapter.js, so
// swapping back to the mock for local/offline work is changing
// gameSyncApi.js's one import line. Stores each match's live snapshot at
// `games/{code}`. This is the active adapter (see gameSyncApi.js) — the
// project config lives in ../firebaseConfig.js.
//
// `state` (App.jsx's whole `game` object) is stored JSON-stringified into a
// single string leaf, not as a nested Firebase object tree — Realtime
// Database has no representation for "empty object/array" or a key whose
// value is `null`: writing one deletes that key, and a container that ends
// up with no keys (e.g. a per-player map that's `null` for every player,
// which every game type's storageByPlayer legitimately is at the very
// start) disappears from the tree entirely, reading back as `undefined`
// instead of `{}`. That surfaced as every online guest crashing on the
// very first synced snapshot (`storageByPlayer[playerId]` on an
// `undefined` storageByPlayer). A plain string value has no such
// stripping — Firebase stores exactly the bytes it's given — so
// JSON.stringify/parse on the way in/out preserves the state exactly as
// App.jsx produced it.
import { ref, set, get, onValue, off } from "firebase/database";
import { getFirebaseDb } from "./firebaseApp";

function gameRef(db, code) {
  return ref(db, `games/${code.toUpperCase()}`);
}

export async function pushGameState(code, state, seq) {
  const db = getFirebaseDb();
  await set(gameRef(db, code), { seq, updatedAt: Date.now(), stateJson: JSON.stringify(state) });
}

function parseEntry(raw) {
  if (!raw) return null;
  return { seq: raw.seq, updatedAt: raw.updatedAt, state: JSON.parse(raw.stateJson) };
}

export async function getGameState(code) {
  const db = getFirebaseDb();
  const snap = await get(gameRef(db, code));
  return snap.exists() ? parseEntry(snap.val()) : null;
}

/** Subscribes to every future snapshot for `code` (not the current one — call getGameState first, matching mockGameSyncAdapter). Returns an unsubscribe function. */
export function subscribeToGameState(code, onUpdate) {
  const db = getFirebaseDb();
  const target = gameRef(db, code);
  // onValue fires immediately with the current value on subscribe, unlike
  // the mock's listener set — skip that first firing so both adapters
  // honor the same "future changes only" contract.
  let skippedInitial = false;
  const handler = (snap) => {
    if (!skippedInitial) {
      skippedInitial = true;
      return;
    }
    onUpdate(snap.exists() ? parseEntry(snap.val()) : null);
  };
  onValue(target, handler);
  return function unsubscribe() {
    off(target, "value", handler);
  };
}
