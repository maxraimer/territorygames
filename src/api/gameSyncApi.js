// Public contract for syncing an online match's live game state, parallel
// to lobbyApi.js's lobby-lifecycle contract — never call an adapter
// directly from components/App.jsx. Backed by Firebase Realtime Database,
// same project as lobbyApi.js; adapters/mockGameSyncAdapter.js is the same
// contract backed by localStorage instead — swap back to it by re-pointing
// this one import line.
export { pushGameState, getGameState, subscribeToGameState } from "./adapters/firebaseGameSyncAdapter";
