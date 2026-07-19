// Public contract every screen/hook imports — never call an adapter or
// fetch/localStorage directly from components. To move off the mock later,
// write a new adapter (e.g. restLobbyAdapter.js or wsLobbyAdapter.js) that
// exports the same 6 functions and re-point this one import line at it.
export {
  createLobby,
  joinLobby,
  getLobby,
  leaveLobby,
  startLobby,
  subscribeToLobby,
} from "./adapters/mockLobbyAdapter";

export { LobbyError, LOBBY_ERROR_CODES } from "./lobbyErrors";
