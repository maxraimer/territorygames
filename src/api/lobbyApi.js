// Public contract every screen/hook imports — never call an adapter or
// fetch/localStorage directly from components. Backed by Firebase Realtime
// Database (see adapters/firebaseLobbyAdapter.js and .env.example for the
// project config); adapters/mockLobbyAdapter.js is the same contract
// backed by localStorage instead, useful for tests or working offline —
// swap back to it by re-pointing this one import line.
export {
  createLobby,
  joinLobby,
  getLobby,
  leaveLobby,
  startLobby,
  subscribeToLobby,
} from "./adapters/firebaseLobbyAdapter";

export { LobbyError, LOBBY_ERROR_CODES } from "./lobbyErrors";
