// Firebase Realtime Database implementation of the lobby contract (see
// ../lobbyApi.js) — the same 6 functions as mockLobbyAdapter.js, so
// swapping back to the mock for local/offline work is changing
// lobbyApi.js's one import line. Stores each lobby at `lobbies/{code}`.
// This is the active adapter (see lobbyApi.js) — the project config lives
// in ../firebaseConfig.js.
//
// join/leave/start are plain get-validate-set, not runTransaction: a first
// attempt used transactions (the textbook choice for "read, decide, write"
// against concurrent writers) but a client joining a lobby path it had
// never touched before could have its transaction callback invoked with a
// premature `lobby === null` before the real server value arrived, and our
// callback's reasonable "null means doesn't exist, abort" response was
// then honored by the SDK as final instead of retried with real data —
// every first-time join failed with a wrong "lobby is full" error, and a
// get()-before-transaction workaround didn't reliably fix it either. For
// this app's actual concurrency (2-4 players joining a lobby seconds
// apart, never the same instant), a plain read-then-write's tiny race
// window is a far better trade than a transaction API that was
// demonstrably misbehaving in practice.
import { ref, get, set, onValue, off } from "firebase/database";
import { getFirebaseDb } from "./firebaseApp";
import { LobbyError, LOBBY_ERROR_CODES } from "../lobbyErrors";
import { COLOR_PALETTE } from "../../game/constants";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // excludes 0/O/1/I
const CODE_LENGTH = 6;
const DEFAULT_MAX_PLAYERS = 4;

function randomId() {
  return Math.random().toString(36).slice(2, 10);
}

function colorForSlot(index) {
  return COLOR_PALETTE[index % COLOR_PALETTE.length];
}

function lobbyRef(db, code) {
  return ref(db, `lobbies/${code.toUpperCase()}`);
}

async function generateUniqueCode(db) {
  for (;;) {
    const code = Array.from(
      { length: CODE_LENGTH },
      () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
    ).join("");
    const snap = await get(lobbyRef(db, code));
    if (!snap.exists()) return code;
  }
}

export async function createLobby({ gameType, config, hostName }) {
  const db = getFirebaseDb();
  const code = await generateUniqueCode(db);
  const hostId = randomId();
  const lobby = {
    code,
    gameType,
    config: { maxPlayers: DEFAULT_MAX_PLAYERS, ...config },
    hostId,
    players: [{ id: hostId, name: hostName, color: colorForSlot(0), isHost: true }],
    status: "waiting",
    createdAt: Date.now(),
  };
  await set(lobbyRef(db, code), lobby);
  return { lobby, playerId: hostId };
}

export async function joinLobby(code, { name }) {
  const db = getFirebaseDb();
  const normalizedCode = code.toUpperCase();
  const target = lobbyRef(db, normalizedCode);

  const snap = await get(target);
  if (!snap.exists()) throw new LobbyError(LOBBY_ERROR_CODES.NOT_FOUND);
  const lobby = snap.val();
  if (lobby.status !== "waiting") throw new LobbyError(LOBBY_ERROR_CODES.ALREADY_STARTED);
  if (lobby.players.length >= lobby.config.maxPlayers) throw new LobbyError(LOBBY_ERROR_CODES.FULL);

  const playerId = randomId();
  const nextLobby = {
    ...lobby,
    players: [...lobby.players, { id: playerId, name, color: colorForSlot(lobby.players.length), isHost: false }],
  };
  await set(target, nextLobby);
  return { lobby: nextLobby, playerId };
}

export async function getLobby(code) {
  const db = getFirebaseDb();
  const snap = await get(lobbyRef(db, code));
  if (!snap.exists()) throw new LobbyError(LOBBY_ERROR_CODES.NOT_FOUND);
  return snap.val();
}

export async function leaveLobby(code, playerId) {
  const db = getFirebaseDb();
  const normalizedCode = code.toUpperCase();
  const target = lobbyRef(db, normalizedCode);
  const snap = await get(target);
  if (!snap.exists()) return; // already gone
  const lobby = snap.val();

  const remainingPlayers = lobby.players.filter((p) => p.id !== playerId);
  if (remainingPlayers.length === 0) {
    await set(target, null); // delete the lobby
    return;
  }
  const nextHostId = lobby.hostId === playerId ? remainingPlayers[0].id : lobby.hostId;
  await set(target, {
    ...lobby,
    hostId: nextHostId,
    players: remainingPlayers.map((p) => ({ ...p, isHost: p.id === nextHostId })),
  });
}

export async function startLobby(code, playerId) {
  const db = getFirebaseDb();
  const normalizedCode = code.toUpperCase();
  const target = lobbyRef(db, normalizedCode);

  const snap = await get(target);
  if (!snap.exists()) throw new LobbyError(LOBBY_ERROR_CODES.NOT_FOUND);
  const lobby = snap.val();
  if (lobby.hostId !== playerId) throw new LobbyError(LOBBY_ERROR_CODES.NOT_HOST);
  if (lobby.players.length < 2) throw new LobbyError(LOBBY_ERROR_CODES.NOT_ENOUGH_PLAYERS);

  const nextLobby = { ...lobby, status: "started" };
  await set(target, nextLobby);
  return nextLobby;
}

/** Subscribes to every future change to a lobby (not the current snapshot, matching mockLobbyAdapter — call getLobby first). Returns an unsubscribe function. */
export function subscribeToLobby(code, onUpdate) {
  const db = getFirebaseDb();
  const target = lobbyRef(db, code);
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
