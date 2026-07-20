export const BASE_CELL_SIZE = 44;

// Larger player counts need more room to seat everyone in their own
// corner with space to grow, so the minimum board size scales with them.
export const GRID_MIN_BY_PLAYER_COUNT = { 2: 8, 3: 12, 4: 16 };
export const GRID_MAX = 32;

export const DEFAULT_COLS = 12;
export const DEFAULT_ROWS = 10;

// Routeritory's river/mountain generation needs real room to work with
// regardless of player count, so it floors well above the other games'
// player-count-scaled minimums.
export const ROUTE_GRID_MIN = 20;
export const DEFAULT_ROUTE_COLS = 20;
export const DEFAULT_ROUTE_ROWS = 20;

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 4;
export const DEFAULT_PLAYER_COUNT = 2;
// Bots mode: always 1 human (the nickname) plus 1-3 bots, capped at MAX_PLAYERS total.
export const MIN_BOTS = 1;
export const MAX_BOTS = MAX_PLAYERS - 1;
export const DEFAULT_BOT_COUNT = 1;

export function gridMinForPlayerCount(count, gameType) {
  if (gameType === "route") return ROUTE_GRID_MIN;
  return GRID_MIN_BY_PLAYER_COUNT[count] ?? GRID_MIN_BY_PLAYER_COUNT[MIN_PLAYERS];
}

/**
 * Cells shrink as the board's height grows, so tall boards still fit on
 * screen: 0.75x past 18 rows, 0.5x past 24 rows.
 */
export function getCellSize(rows) {
  if (rows > 24) return BASE_CELL_SIZE * 0.5;
  if (rows > 18) return BASE_CELL_SIZE * 0.75;
  return BASE_CELL_SIZE;
}

// Hexoritory's hex "size" is a circumradius, not a cell width, so it uses a
// smaller base value than the square games' cell size — same shrink curve.
export const BASE_HEX_SIZE = 24;

export function getHexSize(rows) {
  if (rows > 24) return BASE_HEX_SIZE * 0.5;
  if (rows > 18) return BASE_HEX_SIZE * 0.75;
  return BASE_HEX_SIZE;
}

export const COLOR_PALETTE = [
  "#3b82f6", // blue
  "#ef4444", // red
  "#22c55e", // green
  "#eab308", // yellow
  "#a855f7", // purple
  "#f97316", // orange
  "#06b6d4", // cyan
  "#ec4899", // pink
];

export function makeDefaultPlayers(count, nameFn = (i) => `Гравець ${i}`) {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    name: nameFn(i + 1),
    color: COLOR_PALETTE[i % COLOR_PALETTE.length],
  }));
}

export const DEFAULT_PLAYERS = makeDefaultPlayers(DEFAULT_PLAYER_COUNT);

// Once the board is this full, unplayable rolls start getting "nudged"
// toward a playable pair so the endgame doesn't grind on pure luck.
export const LATE_GAME_FILL_THRESHOLD = 0.85;
// How many consecutive unplayable rolls (while late-game) are allowed
// before the next one is forced to be playable.
export const FORCE_PLAYABLE_ROLL_AFTER = 2;

// Default values for the optional-rule toggles in setup. Shared across
// both games except DEFAULT_DOUBLES_EXTRA_TURN, which is Diceritory-only
// (Tetritory draws a single piece per turn, so there's no dice pair to
// double up).
export const DEFAULT_AUTO_WIN = true;
export const DEFAULT_ALLOW_ROTATION = true;
export const DEFAULT_DOUBLES_EXTRA_TURN = false;
export const DEFAULT_SMART_ASSIST = true;
// Tetritory-only: auto-claim any pocket a player has fully walled off with
// their own pieces, tiling it with tetrominoes immediately instead of
// waiting for them to roll their way through it.
export const DEFAULT_AUTO_FILL_ENCLOSED = false;

// name/tagline for each game now live in i18n (home.games.<id>), since they're
// user-facing copy — this array only carries the stable id ordering.
export const GAME_TYPES = [{ id: "dice" }, { id: "tetromino" }, { id: "domino" }, { id: "hex" }, { id: "route" }];

export const GAME_LOGOS = {
  dice: `${import.meta.env.BASE_URL}logo_diceritory.png`,
  tetromino: `${import.meta.env.BASE_URL}logo_tetritory.png`,
  domino: `${import.meta.env.BASE_URL}logo_dominotory.png`,
  hex: `${import.meta.env.BASE_URL}logo_hexoritory.png`,
  route: `${import.meta.env.BASE_URL}logo_routeritory.png`,
};

// The two-part split used to color just the first chunk of each game's
// wordmark (e.g. the "Dice" in "Diceritory").
export const GAME_TITLE_PARTS = {
  dice: ["Dice", "ritory"],
  tetromino: ["Tetri", "tory"],
  domino: ["Domino", "tory"],
  hex: ["Hexo", "ritory"],
  route: ["Route", "ritory"],
};

// Dominotory: each player may hold up to this many drawn dominoes in
// reserve instead of placing them immediately.
export const DOMINO_STORAGE_LIMIT = 4;

// Hexoritory: each player may hold only a single figure in reserve.
export const HEX_STORAGE_LIMIT = 1;
