// Public contract for syncing an online match's live game state, parallel
// to lobbyApi.js's lobby-lifecycle contract — never call an adapter
// directly from components/App.jsx. To move off the mock later, write a new
// adapter (e.g. firebaseGameSyncAdapter.js) exporting the same 3 functions
// and re-point this one import line at it, exactly like lobbyApi.js.
export { pushGameState, getGameState, subscribeToGameState } from "./adapters/mockGameSyncAdapter";
