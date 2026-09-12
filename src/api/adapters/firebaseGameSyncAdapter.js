// Firebase Realtime Database implementation of the game-sync contract (see
// ../gameSyncApi.js) — the same 3 functions as mockGameSyncAdapter.js, so
// swapping to real cross-device sync is changing gameSyncApi.js's one
// import line to point here instead. Stores each match's live snapshot at
// `games/{code}`.
//
// NOT YET WIRED UP (gameSyncApi.js still points at the mock adapter) and
// UNTESTED against a real Firebase project — see .env.example for the
// config this needs. Written to the same contract mockGameSyncAdapter.js
// already exercises via App.jsx's sync effects, which is what should be
// re-verified (ideally with two real devices) before flipping the switch.
import { ref, set, get, onValue, off } from "firebase/database";
import { getFirebaseDb } from "./firebaseApp";

function gameRef(db, code) {
  return ref(db, `games/${code.toUpperCase()}`);
}

export async function pushGameState(code, state, seq) {
  const db = getFirebaseDb();
  await set(gameRef(db, code), { seq, updatedAt: Date.now(), state });
}

export async function getGameState(code) {
  const db = getFirebaseDb();
  const snap = await get(gameRef(db, code));
  return snap.exists() ? snap.val() : null;
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
    onUpdate(snap.exists() ? snap.val() : null);
  };
  onValue(target, handler);
  return function unsubscribe() {
    off(target, "value", handler);
  };
}
