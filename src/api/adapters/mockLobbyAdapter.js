// Mock implementation of the lobby API contract (see ../lobbyApi.js). Backed
// by an in-memory Map — the source of truth in every environment, including
// plain-Node test runs with no `window` — that additionally mirrors to
// `localStorage` and listens for the native `storage` event when a real
// browser is present, so two tabs of the app genuinely see the same lobby.
// A later real backend (REST/WebSocket) just needs to export the same 6
// functions from a new adapter file; nothing else in the app changes.
import { COLOR_PALETTE } from "../../game/constants";
import { LobbyError, LOBBY_ERROR_CODES } from "../lobbyErrors";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // excludes 0/O/1/I
const CODE_LENGTH = 6;
const STORAGE_PREFIX = "territorygames-lobby-";
const DEFAULT_MAX_PLAYERS = 4;

const memoryStore = new Map();
const listeners = new Map(); // code -> Set<callback>, for same-tab notification

function hasBrowserStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function storageKey(code) {
  return `${STORAGE_PREFIX}${code}`;
}

function notify(code, lobby) {
  const set = listeners.get(code);
  if (!set) return;
  for (const cb of set) cb(lobby);
}

function persist(code, lobby) {
  memoryStore.set(code, lobby);
  if (hasBrowserStorage()) window.localStorage.setItem(storageKey(code), JSON.stringify(lobby));
  notify(code, lobby);
}

function remove(code) {
  memoryStore.delete(code);
  if (hasBrowserStorage()) window.localStorage.removeItem(storageKey(code));
  notify(code, null);
}

function read(code) {
  if (memoryStore.has(code)) return memoryStore.get(code);
  if (hasBrowserStorage()) {
    const raw = window.localStorage.getItem(storageKey(code));
    if (raw) {
      const lobby = JSON.parse(raw);
      memoryStore.set(code, lobby);
      return lobby;
    }
  }
  return null;
}

if (hasBrowserStorage()) {
  window.addEventListener("storage", (event) => {
    if (!event.key || !event.key.startsWith(STORAGE_PREFIX)) return;
    const code = event.key.slice(STORAGE_PREFIX.length);
    const lobby = event.newValue ? JSON.parse(event.newValue) : null;
    if (lobby) memoryStore.set(code, lobby);
    else memoryStore.delete(code);
    notify(code, lobby);
  });
}

function generateCode() {
  let code;
  do {
    code = Array.from({ length: CODE_LENGTH }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join("");
  } while (read(code) != null);
  return code;
}

function randomId() {
  return Math.random().toString(36).slice(2, 10);
}

function colorForSlot(index) {
  return COLOR_PALETTE[index % COLOR_PALETTE.length];
}

// Simulated network latency, so loading states in the UI are real/exercisable.
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function createLobby({ gameType, config, hostName }) {
  await delay(150);
  const code = generateCode();
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
  persist(code, lobby);
  return { lobby, playerId: hostId };
}

export async function joinLobby(code, { name }) {
  await delay(150);
  const normalizedCode = code.toUpperCase();
  const lobby = read(normalizedCode);
  if (!lobby) throw new LobbyError(LOBBY_ERROR_CODES.NOT_FOUND);
  if (lobby.status !== "waiting") throw new LobbyError(LOBBY_ERROR_CODES.ALREADY_STARTED);
  if (lobby.players.length >= lobby.config.maxPlayers) throw new LobbyError(LOBBY_ERROR_CODES.FULL);

  const playerId = randomId();
  const next = {
    ...lobby,
    players: [...lobby.players, { id: playerId, name, color: colorForSlot(lobby.players.length), isHost: false }],
  };
  persist(normalizedCode, next);
  return { lobby: next, playerId };
}

export async function getLobby(code) {
  await delay(50);
  const lobby = read(code.toUpperCase());
  if (!lobby) throw new LobbyError(LOBBY_ERROR_CODES.NOT_FOUND);
  return lobby;
}

export async function leaveLobby(code, playerId) {
  await delay(50);
  const normalizedCode = code.toUpperCase();
  const lobby = read(normalizedCode);
  if (!lobby) return;

  const remainingPlayers = lobby.players.filter((p) => p.id !== playerId);
  if (remainingPlayers.length === 0) {
    remove(normalizedCode);
    return;
  }
  const nextHostId = lobby.hostId === playerId ? remainingPlayers[0].id : lobby.hostId;
  const next = {
    ...lobby,
    hostId: nextHostId,
    players: remainingPlayers.map((p) => ({ ...p, isHost: p.id === nextHostId })),
  };
  persist(normalizedCode, next);
}

export async function startLobby(code, playerId) {
  await delay(100);
  const normalizedCode = code.toUpperCase();
  const lobby = read(normalizedCode);
  if (!lobby) throw new LobbyError(LOBBY_ERROR_CODES.NOT_FOUND);
  if (lobby.hostId !== playerId) throw new LobbyError(LOBBY_ERROR_CODES.NOT_HOST);
  if (lobby.players.length < 2) throw new LobbyError(LOBBY_ERROR_CODES.NOT_ENOUGH_PLAYERS);

  const next = { ...lobby, status: "started" };
  persist(normalizedCode, next);
  return next;
}

/** Subscribes to every future change to a lobby (not the current snapshot — call getLobby first). Returns an unsubscribe function. */
export function subscribeToLobby(code, onUpdate) {
  const normalizedCode = code.toUpperCase();
  if (!listeners.has(normalizedCode)) listeners.set(normalizedCode, new Set());
  const set = listeners.get(normalizedCode);
  set.add(onUpdate);
  return function unsubscribe() {
    set.delete(onUpdate);
    if (set.size === 0) listeners.delete(normalizedCode);
  };
}
