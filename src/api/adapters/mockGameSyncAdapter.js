// Mock implementation of the game-sync contract (see ../gameSyncApi.js).
// Mirrors mockLobbyAdapter.js's own approach on purpose: an in-memory Map as
// the source of truth (works in plain-Node tests with no `window`), which
// also mirrors to `localStorage` and listens for the native `storage` event
// when a real browser is present — so two tabs of the app genuinely see the
// same live game state, the same trick that already makes the lobby
// demoable without a backend. A later real backend (Firebase/REST/WS) just
// needs to export the same functions from a new adapter file.
const STORAGE_PREFIX = "territorygames-game-";

const memoryStore = new Map(); // code -> { seq, updatedAt, state }
const listeners = new Map(); // code -> Set<callback>, for same-tab notification

function hasBrowserStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function storageKey(code) {
  return `${STORAGE_PREFIX}${code}`;
}

function notify(code, entry) {
  const set = listeners.get(code);
  if (!set) return;
  for (const cb of set) cb(entry);
}

function read(code) {
  if (memoryStore.has(code)) return memoryStore.get(code);
  if (hasBrowserStorage()) {
    const raw = window.localStorage.getItem(storageKey(code));
    if (raw) {
      const entry = JSON.parse(raw);
      memoryStore.set(code, entry);
      return entry;
    }
  }
  return null;
}

if (hasBrowserStorage()) {
  window.addEventListener("storage", (event) => {
    if (!event.key || !event.key.startsWith(STORAGE_PREFIX)) return;
    const code = event.key.slice(STORAGE_PREFIX.length);
    const entry = event.newValue ? JSON.parse(event.newValue) : null;
    if (entry) memoryStore.set(code, entry);
    else memoryStore.delete(code);
    notify(code, entry);
  });
}

/**
 * Publishes `state` as the current game snapshot for `code`. `seq` is a
 * caller-supplied monotonic counter (App.jsx keeps one per session) so
 * subscribers can tell a genuinely newer snapshot from a stale/duplicate
 * one arriving out of order — the transport (storage events) doesn't
 * guarantee delivery order across tabs on its own.
 */
export async function pushGameState(code, state, seq) {
  const normalizedCode = code.toUpperCase();
  const entry = { seq, updatedAt: Date.now(), state };
  memoryStore.set(normalizedCode, entry);
  if (hasBrowserStorage()) window.localStorage.setItem(storageKey(normalizedCode), JSON.stringify(entry));
  notify(normalizedCode, entry);
}

/** The current snapshot for `code` (`{ seq, updatedAt, state }`), or null if nobody has pushed one yet. */
export async function getGameState(code) {
  return read(code.toUpperCase());
}

/** Subscribes to every future snapshot for `code` (not the current one — call getGameState first). Returns an unsubscribe function. */
export function subscribeToGameState(code, onUpdate) {
  const normalizedCode = code.toUpperCase();
  if (!listeners.has(normalizedCode)) listeners.set(normalizedCode, new Set());
  const set = listeners.get(normalizedCode);
  set.add(onUpdate);
  return function unsubscribe() {
    set.delete(onUpdate);
    if (set.size === 0) listeners.delete(normalizedCode);
  };
}
