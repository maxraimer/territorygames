# Territory Games

A suite of browser-based territory-claiming board games, all sharing one generic placement/scoring engine:

- **Diceritory** — roll two dice, place the resulting w×h rectangle.
- **Tetritory** — draw a random tetromino (classic 7-bag), place it.
- **Dominotory** — roll a domino, place its two numbered halves; a matching number must touch an existing half.
- **Hexoritory** — hex-grid board; roll a shape (1/2/3-line/3-triangle) and a count (1-3), place that many copies.

Each game supports 3 modes: **hot-seat** (2-4 players, one device), **bots** (1 human + 1-3 bot players — bot *data* only for now, see Scope below), and **online** (a lobby: create or join by code). Players are 2-4 (2-4 total including bots/remote players). UI is localized into 7 languages (uk/en/ru/es/fr/pl/de) via i18next; Ukrainian is the master/reference locale.

## Scope note: what's real vs. architecture-only

Two things are deliberately **data/plumbing only, with no behavior yet** — don't be surprised the app doesn't "do" these:
- **Bots don't act.** A bot player (`player.type === "bot"`, plus `player.difficulty`) is otherwise played exactly like a human — someone still has to click for it. Real bot decision-making is a future stage.
- **Online play isn't synced move-by-move.** The lobby (create/join/see players/host starts) is fully real and works across browser tabs (see the mock adapter below). But once the host starts, every subscribed client independently boots its own local game engine from the same starting config/roster — moves made in one tab are not pushed to others. Real-time sync needs a real backend, which is exactly what the API layer below was built to slot in later.

## Stack

React 19 + Vite + Tailwind v4 (`@tailwindcss/vite`) + daisyUI v5 + i18next/react-i18next + react-icons + country-flag-icons. Themes: light = `emerald`, dark = `dim` (registered in `src/index.css` via `@plugin "daisyui"`; the *initial* pick still follows OS `prefers-color-scheme`, but `src/hooks/useTheme.js` layers a manual, localStorage-persisted `data-theme` toggle on top — see below).

## Commands

```
npm run dev      # vite dev server
npm test          # vitest run (all *.test.js under src/game/)
npm run lint      # oxlint
npm run build     # vite build — always rm -rf dist afterward, it's not committed
```

## Architecture

**`src/game/`** — pure, framework-agnostic logic modules, no React. This is where almost all real complexity lives and where nearly all tests are.

- `rules.js` — the shared engine every game reuses: a `Board` is `{ cols, rows, pieces }`, a `Piece` is `{ id, playerId, cells: [{x,y}, ...] }`. Generic over cell shape — a rectangle, a tetromino, a domino (cells carry a `.value`), and a hex figure (offset coords) are all just cell lists. Owns placement validity (`validPlacement`, `enumerateValidPlacements`), corner seeding (`createInitialBoard`, `cornerSeedPosition`), area/flood-fill (`playerArea`, `reachableEmptyCellCount`), and auto-win heuristics (`isOutcomeDecided`, `hasMajorityShare`). Flood-fill functions take an optional `neighborsFn` (default 4-directional `squareNeighbors`, exported for reuse) so Hexoritory can plug in hex adjacency without duplicating the algorithm.
- `tetromino.js`, `domino.js`, `hex.js` — each game's shape-specific bits only: piece/shape tables, rotation generation, and a validity layer that reuses `rules.js` primitives (`buildOccupiedSet`, `buildOwnSet`, `isInsideBoard`) but adds its own adjacency/matching rule where the game's rule differs (hex has 6-neighbor adjacency; domino requires a matching number touching, not just any own-territory touch).
  - `hex.js` stores the board in offset `(col, row)` coordinates but does rotation math in axial coordinates (cube-coordinate 60° rotation), converting at the edges. Rotation states for every shape are derived programmatically (rotate 6 ways, normalize, dedupe) rather than hand-authored — trust this over guessing rotation counts by hand.
  - `tetromino.js` has `packTetrominoesGreedy`, a greedy polyomino packer used by Tetritory's auto-fill-enclosed-territory toggle. `hex.js` has the equivalent `packHexShapesGreedy` for Hexoritory's version of the same toggle — it can't reuse tetromino's packer as-is because offset coordinates aren't uniformly translatable (row parity shifts columns), so each candidate anchor is converted to axial first. Its shape-rotation list is sorted **largest-first**: hex's 1-cell shape trivially "fits" anywhere, so if tried first it would win every placement and shapes 2-4 would never get used.
- `outline.js` — traces a polyomino/polyhex's outer boundary and builds a single rounded SVG path per placed piece (convex corners round outward, concave corners round the other way), so a multi-cell piece reads as one smooth shape instead of a mosaic of rounded unit cells.
- `enclosure.js` — `findEnclosedRegions(board, neighborsFn = squareNeighbors)` flood-fills empty regions and reports which ones are bordered exclusively by one player's cells. Used by both Tetritory (default square neighbors) and Hexoritory (`hexNeighbors` passed in) for their auto-fill-enclosed-territory toggles.
- `elimination.js` — pure helpers for 3+ player games: `detectNewEliminations` marks a player eliminated once they have zero possible future moves (their pieces/score stay on the board, they're just skipped); `nextActivePlayerIndex` skips eliminated players in turn rotation. Not used for 2-player games — those already end via the ordinary "nobody can move" check.
- `color.js` — `contrastTextColor`, shared black/white contrast pick for text over a player's color.
- `dice.js`, `time.js` — trivial helpers.
- `players.js` — `makeHumanPlayer`/`makeBotPlayer` factories shared by every mode's setup screen. Every player object carries `type: "human" | "bot"` (bots also get `difficulty`); this is the "distinguish human from bot" data shape the Bots mode needs — see Scope note above for what it doesn't do yet. Mirrors `constants.js`'s `nameFn`-injection pattern (the caller passes an i18n-bound name function) instead of importing react-i18next into `src/game/`.

**`src/api/`** — the lobby API layer. Components/hooks never call `fetch` or touch `localStorage` directly for lobby data; they only import from `lobbyApi.js`.
- `lobbyApi.js` — the public contract: `createLobby`, `joinLobby`, `getLobby`, `leaveLobby`, `startLobby`, `subscribeToLobby`. It's a thin facade that re-exports whichever adapter is currently active — swapping the mock for a real backend later means writing a new adapter file with the same 6 exports and changing this one import line, no component changes.
- `adapters/mockLobbyAdapter.js` — today's (only) adapter. Source of truth is an in-memory `Map`, so it works in plain-Node tests with no `window`/jsdom; when a real browser is present it also mirrors to `localStorage` and listens for the native `storage` event, so two tabs of the app genuinely see the same lobby (this is what makes the online mode demoable without a backend — but see the browser-context gotcha in Conventions below). 6-char uppercase codes, `status: "waiting" | "started"`, leaving the host promotes the next player.
- `lobbyErrors.js` — `LobbyError` with `.code` (`NOT_FOUND`/`FULL`/`ALREADY_STARTED`/`NOT_HOST`/`NOT_ENOUGH_PLAYERS`) so UI can branch on typed errors instead of parsing messages.

**`src/i18n/`** — `index.js` initializes i18next/react-i18next (fallback + detected language is `"uk"`, persisted to `localStorage["territorygames-lang"]`) and exports a `changeLanguage()` wrapper components call instead of touching i18next directly. `locales/{uk,en,ru,es,fr,pl,de}.json` are structurally identical resource files — **`uk.json` is the master/reference copy**; edit it first, then re-translate the rest (the other 6 were bulk-translated from it and should stay in key-parity). Inside components, use the `useTranslation()` hook's `t()` (reactive, re-renders on language change). Outside components — the module-level helper functions in `App.jsx` that build imperative log-entry strings (`applyAutoFillEnclosed`, `rollWeightedDice`, etc. and the event handlers that build `log` entries) — use the raw `i18n.t()` from `import i18n from "./i18n"` instead, since there's no hook available there; it reads the same live singleton so language switches still apply. Brand names (`Diceritory`, `Tetritory`, `Dominotory`, `Hexoritory`, `Territory Games`) and each language's own native name in `common.languages` are never translated, by design.

**`src/hooks/`**
- `useTheme.js` — manual light/dark toggle. Reads/writes `localStorage["territorygames-theme"]`, falls back to `prefers-color-scheme` only on first visit, and sets `data-theme` on `<html>` directly (daisyUI reads that attribute over the CSS media-query default once it's present).
- `useNickname.js` — the persisted display name (`localStorage["territorygames-nickname"]`), required on the home screen and used as player 1 in every mode.
- `useLobby.js` — live view of one lobby for the API layer above: `getLobby` once on mount, `subscribeToLobby` for updates, cleans up on unmount/code change; exposes `start`/`leave` action wrappers. Used only by `LobbyScreen`; the create/join screens call `lobbyApi.js` directly for their one-shot calls.

**`src/components/`** — rendering only.

- `Board.jsx` — square-grid SVG renderer (Diceritory/Tetritory/Dominotory), uses `outline.js` for per-piece rounded paths.
- `HexBoard.jsx` — separate hex-grid SVG renderer (pointy-top hexagons, per-cell polygons; axial↔pixel conversion and cube-coordinate rounding for hover detection live here, not in `hex.js`).
- `HeaderControls.jsx` — the theme toggle + language dropdown (flags via `country-flag-icons/react/3x2`), shared verbatim across the home, mode-select, setup (all 3 variants), and playing screens (not the game-over screen — out of scope by request).
- `RulesModal.jsx` — native `<dialog>` + daisyUI `modal` classes; renders `rules.<gameType>.*` plus the shared `rules.common.*` blurbs (corner seeding, scoring, and every optional-toggle explanation) from the active locale. Opened from a "Rules" button on the setup screens.
- `GameConfigFields.jsx` — the board-size sliders + rule toggles, extracted out of `SetupScreen.jsx` so `BotSetupScreen.jsx` and `online/CreateLobbyScreen.jsx` can reuse the same ~80 lines instead of duplicating them; also exports the small `Toggle` component all three use.
- `SetupScreen.jsx` — hot-seat config: one screen for all four games, `firstPlayerName` prop seeds player 1's (non-editable, same as every other player's name) display name from the nickname; a `setup.copy.<gameType>` i18n lookup supplies per-game hint text; game-specific toggles (doubles-give-second-turn is dice-only; auto-fill-enclosed is tetromino **and** hex) are conditionally rendered.
- `ModeSelectScreen.jsx` — shown after picking a game, before any config: hot-seat / bots / online.
- `BotSetupScreen.jsx` — bot count (1 to `MAX_BOTS`) + difficulty (shared across all bots in the lobby, not per-bot) + a color swatch for the human, then the same `GameConfigFields`. Builds players via `makeHumanPlayer`/`makeBotPlayer` from `game/players.js`.
- `online/` — the online mode, kept out of `App.jsx` entirely:
  - `OnlineModeScreen.jsx` — owns the sub-flow state (`"choice" | "create" | "join" | "lobby"`); the only piece `App.jsx` renders directly for online.
  - `OnlineChoiceScreen.jsx`, `CreateLobbyScreen.jsx` (calls `createLobby`, reuses `GameConfigFields` + a max-players picker), `JoinLobbyScreen.jsx` (code input force-uppercased as typed; maps `LobbyError.code` to a localized message).
  - `LobbyScreen.jsx` — the waiting room, backed by `useLobby`: code + copy-to-clipboard, live player list with host/you badges, host-only Start (disabled under 2 players), Leave. Watches `lobby.status`, and once it flips to `"started"` calls `onGameStart(...)` — same shape every other mode's `onStart` produces — to hand off to `App.jsx`.
- `GameOverScreen.jsx` — picks `Board` vs `HexBoard` by `gameType`.

**`src/App.jsx`** — the state machine. One big component; `game` state's shape varies by `gameType` (see `makeGameState`). `screen` is `"home" | "mode" | "setup" | "botSetup" | "online" | "playing" | "gameover"`; `handleStart(config)` is the single funnel every mode's config screen (or `LobbyScreen`'s `onGameStart`) calls into to actually create the `game` and enter `"playing"` — new modes only ever add a dispatch branch + a screen component, never new game-creation logic, which is what keeps this file from re-bloating as modes were added. Notable non-obvious bits:
- Hexoritory's turn can require placing *multiple* pieces (`piecesRemaining`) and has an optional single-slot storage a player can bank one figure into and retrieve later (`activeSource: 'roll' | 'stored'`); Dominotory has a 4-slot storage. Both reuse the same `G` (store) / digit-key (retrieve) keyboard convention, dispatched through gameType-aware wrapper functions (`handleStoreCurrent`, `handlePickStorageOrToggle`) so the keydown handler itself stays game-agnostic. The rolled piece-count (`hexCount`) is displayed by reusing the `Dice` component as-is (`<Dice value={hexCount} rolling={...} />`) rather than a bespoke widget — its pip layout already covers 1-3 and it already has the roll-flicker/land animation.
- `finishTurn` is the shared post-roll resolution path (sets `turnPhase`, checks `isGameOver`/auto-win); board-mutating placement handlers (`handlePlaceClick`, `handleHexPlaceClick`) are separate per rendering system and each independently run elimination detection and auto-fill (Tetritory via `applyAutoFillEnclosed`, Hexoritory via `applyAutoFillEnclosedHex`) after mutating the board.
- Auto-win / game-over checks take an explicit `hasMoveFn` and (for Hexoritory) `neighborsFn` per game type — there's no implicit per-game dispatch table, each call site passes the right function.
- The playing screen's "Exit" button (`playing.exit`, `FiLogOut` icon) discards the in-progress game and returns to the current mode's config screen (`handleBackToSetup`: hot-seat → `setup`, bots → `botSetup`, online → `mode`, since a finished lobby can't be meaningfully resumed) — no confirmation dialog. A bot player in the in-game player bar gets a small `FiCpu` badge next to its name.

## Conventions

- **No comments unless the WHY is non-obvious** (a hidden constraint, a subtle invariant). Never restate what a well-named function does.
- Prefer generalizing `rules.js` (e.g. adding an optional param with a backward-compatible default) over duplicating an algorithm in a new game module. Check `rules.js` before writing a new flood-fill/validity function — it's often almost what you need.
- New per-game shape/rotation logic goes in its own `src/game/<game>.js`; don't grow `rules.js` with game-specific rules.
- Every non-trivial pure function in `src/game/` should have a matching `*.test.js`. Rotation counts, adjacency edge cases, and packing behavior are exactly the kind of thing worth verifying by test rather than by hand-derivation — see how `hex.js`'s rotation states are checked by dumping them via a throwaway probe test before writing the real assertions.
- **No hardcoded UI strings.** Every user-facing string goes through i18next (`t("namespace.key")` in components, `i18n.t(...)` outside them — see `src/i18n/`). Add new keys to `uk.json` first, then translate into the other 6 locale files, keeping key structure identical across all 7. Interpolation placeholders (`{{name}}`, `{{count}}`, …) must exist verbatim in every locale.
- **Manual browser verification uses Playwright, but it is *not* a project dependency.** The convention across this codebase's history: `npm install -D playwright`, write a throwaway `smoke_*.mjs` script at the repo root, run it against a `vite --port <free port>` dev server started in the background, inspect screenshots/console output, then delete the smoke script(s) and `npm uninstall playwright` before finishing. Never leave Playwright or smoke scripts committed.
- When a smoke test's bot behaves oddly, suspect the test script first (stale selectors picking the wrong `<svg>` when a page has more than one, roll-animation timing races, locale-specific text assertions breaking once a placeholder locale gets translated, etc.) before assuming the app is broken — this has been the actual cause more than once. Testing the online lobby specifically: use two *pages in the same Playwright browser context* for "two tabs" — separate `browser.newContext()`s are isolated profiles with separate `localStorage`, which will make `joinLobby` legitimately fail with `NOT_FOUND` and look like the cross-tab mock is broken when it isn't.
