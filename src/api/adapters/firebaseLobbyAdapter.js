// Firebase Realtime Database implementation of the lobby contract (see
// ../lobbyApi.js) — the same 6 functions as mockLobbyAdapter.js, so
// swapping back to the mock for local/offline work is changing
// lobbyApi.js's one import line. Stores each lobby at `lobbies/{code}`;
// join/leave/start use runTransaction so two players joining (or leaving)
// at once can't both write a stale player list — the mock adapter doesn't
// need this (single-threaded JS, one write always finishes before the
// next starts) but a real multi-client backend does. This is the active
// adapter (see lobbyApi.js) — the project config lives in
// ../firebaseConfig.js.
import { ref, get, set, runTransaction, onValue, off } from "firebase/database";
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
  const playerId = randomId();

  const result = await runTransaction(lobbyRef(db, normalizedCode), (lobby) => {
    if (lobby === null) return; // abort — NOT_FOUND, diagnosed below
    if (lobby.status !== "waiting") return; // abort — ALREADY_STARTED
    if (lobby.players.length >= lobby.config.maxPlayers) return; // abort — FULL
    lobby.players.push({ id: playerId, name, color: colorForSlot(lobby.players.length), isHost: false });
    return lobby;
  });

  if (!result.committed) {
    const snap = await get(lobbyRef(db, normalizedCode));
    if (!snap.exists()) throw new LobbyError(LOBBY_ERROR_CODES.NOT_FOUND);
    const lobby = snap.val();
    if (lobby.status !== "waiting") throw new LobbyError(LOBBY_ERROR_CODES.ALREADY_STARTED);
    throw new LobbyError(LOBBY_ERROR_CODES.FULL);
  }
  return { lobby: result.snapshot.val(), playerId };
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
  await runTransaction(lobbyRef(db, normalizedCode), (lobby) => {
    if (lobby === null) return; // already gone
    const remainingPlayers = lobby.players.filter((p) => p.id !== playerId);
    if (remainingPlayers.length === 0) return null; // delete the lobby
    const nextHostId = lobby.hostId === playerId ? remainingPlayers[0].id : lobby.hostId;
    lobby.hostId = nextHostId;
    lobby.players = remainingPlayers.map((p) => ({ ...p, isHost: p.id === nextHostId }));
    return lobby;
  });
}

export async function startLobby(code, playerId) {
  const db = getFirebaseDb();
  const normalizedCode = code.toUpperCase();

  const result = await runTransaction(lobbyRef(db, normalizedCode), (lobby) => {
    if (lobby === null) return; // abort — NOT_FOUND
    if (lobby.hostId !== playerId) return; // abort — NOT_HOST
    if (lobby.players.length < 2) return; // abort — NOT_ENOUGH_PLAYERS
    lobby.status = "started";
    return lobby;
  });

  if (!result.committed) {
    const snap = await get(lobbyRef(db, normalizedCode));
    if (!snap.exists()) throw new LobbyError(LOBBY_ERROR_CODES.NOT_FOUND);
    const lobby = snap.val();
    if (lobby.hostId !== playerId) throw new LobbyError(LOBBY_ERROR_CODES.NOT_HOST);
    throw new LobbyError(LOBBY_ERROR_CODES.NOT_ENOUGH_PLAYERS);
  }
  return result.snapshot.val();
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
