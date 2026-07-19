# Territory Games

A suite of browser-based territory-claiming board games, all sharing one generic placement/scoring engine:

- **Diceritory** — roll two dice, place the resulting w×h rectangle.
- **Tetritory** — draw a random tetromino (classic 7-bag), place it.
- **Dominotory** — roll a domino, place its two numbered halves; a matching number must touch an existing half.
- **Hexoritory** — hex-grid board; roll a shape (1/2/3-line/3-triangle) and a count (1-3), place that many copies.

Each game supports 3 modes: **hot-seat** (2-4 players, one device), **bots** (1 human + 1-3 bot players — bot decision-making isn't implemented yet, see below), and **online** (a lobby: create or join by code). Players are 2-4 total, including bots/remote players. The UI is localized into 7 languages (uk/en/ru/es/fr/pl/de) via i18next; Ukrainian is the master/reference locale.

## Current scope

Two things are architecture-only, with no behavior yet:

- **Bots don't act.** A bot player is otherwise played exactly like a human — someone still has to click for it. Real bot decision-making is a future stage.
- **Online play isn't synced move-by-move.** The lobby (create/join/see players/host starts) is fully functional and works across browser tabs. But once the host starts, every client independently boots its own local game engine from the same starting config — moves made in one tab aren't pushed to others. Real-time sync needs a real backend.

## Stack

React 19 + Vite + Tailwind v4 + daisyUI v5 + i18next/react-i18next + react-icons + country-flag-icons.

## Commands

```sh
npm install       # install dependencies
npm run dev       # start the Vite dev server
npm test          # run the test suite (vitest)
npm run lint      # lint with oxlint
npm run build     # production build (outputs to dist/, not committed)
```

## Project structure

- `src/game/` — pure, framework-agnostic game logic (rules, shapes, rotation, flood-fill/scoring). No React; this is where most of the tests live.
- `src/api/` — the lobby API used by online mode, backed today by an in-memory/localStorage mock adapter.
- `src/components/` — rendering: boards, setup/lobby screens, shared UI.
- `src/i18n/` — i18next setup and the 7 locale files.
- `src/hooks/` — small stateful hooks (theme, nickname, lobby subscription).
- `src/App.jsx` — the top-level state machine tying screens and game state together.

See `CLAUDE.md` for a detailed architecture walkthrough.
