// Pure game-logic functions shared by every territory-claiming game in
// this app (Diceritory, Tetritory). No React, no I/O — safe to unit test
// in isolation and later reuse as the authoritative validator on a
// server.
//
// A placed piece is stored as the explicit list of absolute cells it
// occupies. A rectangle (Diceritory) is just the special case where
// those cells exactly fill a w×h box; a tetromino (Tetritory) is any
// other four-cell polyomino. Every rule below only cares about which
// cells are occupied and by whom, so it works unmodified for both games.

/**
 * @typedef {{ x: number, y: number }} Cell
 * @typedef {{ id: string, playerId: string, cells: Cell[] }} Piece
 * @typedef {{ cols: number, rows: number, pieces: Piece[] }} Board
 */

function cellKey(x, y) {
  return `${x},${y}`;
}

/** The cells covered by an axis-aligned w×h rectangle anchored at (x,y). */
export function rectCells(x, y, w, h) {
  const cells = [];
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      cells.push({ x: x + dx, y: y + dy });
    }
  }
  return cells;
}

/** Every cell of the shape fits within the board bounds. */
export function isInsideBoard(board, cells) {
  return cells.every(({ x, y }) => x >= 0 && y >= 0 && x < board.cols && y < board.rows);
}

export function buildOccupiedSet(board) {
  const occupied = new Set();
  for (const piece of board.pieces) {
    for (const { x, y } of piece.cells) {
      occupied.add(cellKey(x, y));
    }
  }
  return occupied;
}

export function buildOwnSet(board, playerId) {
  const own = new Set();
  for (const piece of board.pieces) {
    if (piece.playerId !== playerId) continue;
    for (const { x, y } of piece.cells) {
      own.add(cellKey(x, y));
    }
  }
  return own;
}

/** None of the shape's cells already belong to any player. */
export function overlapsBoard(board, cells) {
  const occupied = buildOccupiedSet(board);
  return cells.some(({ x, y }) => occupied.has(cellKey(x, y)));
}

/**
 * True if at least one cell of the shape shares an edge (not just a
 * corner) with a cell the player already owns. Also true if the player
 * owns nothing yet (no anchor to require — shouldn't happen once seeded).
 */
export function isAdjacentToOwn(board, playerId, cells) {
  const own = buildOwnSet(board, playerId);
  if (own.size === 0) return true;
  return cells.some(
    ({ x, y }) =>
      own.has(cellKey(x - 1, y)) || own.has(cellKey(x + 1, y)) || own.has(cellKey(x, y - 1)) || own.has(cellKey(x, y + 1))
  );
}

function isValidPlacementCells(cells, board, occupied, own) {
  if (!cells || cells.length === 0) return false;
  if (!isInsideBoard(board, cells)) return false;
  if (cells.some(({ x, y }) => occupied.has(cellKey(x, y)))) return false;
  if (own.size === 0) return true;
  return cells.some(
    ({ x, y }) =>
      own.has(cellKey(x - 1, y)) || own.has(cellKey(x + 1, y)) || own.has(cellKey(x, y - 1)) || own.has(cellKey(x, y + 1))
  );
}

/**
 * Authoritative placement check: every cell in bounds, none overlapping
 * an already-occupied cell (any player), and at least one cell adjacent
 * to a cell the placing player already owns.
 */
export function validPlacement(board, playerId, cells) {
  return isValidPlacementCells(cells, board, buildOccupiedSet(board), buildOwnSet(board, playerId));
}

/**
 * Enumerates every valid top-left anchor position for a shape (cells
 * normalized to a 0,0-based bounding box) for the given player. Used to
 * (a) render legal-move hints and (b) detect "no moves" so the turn can
 * be skipped.
 */
export function enumerateValidPlacements(board, playerId, shapeCells) {
  const results = [];
  if (!shapeCells || shapeCells.length === 0) return results;

  const shapeWidth = Math.max(...shapeCells.map((c) => c.x)) + 1;
  const shapeHeight = Math.max(...shapeCells.map((c) => c.y)) + 1;
  const maxX = board.cols - shapeWidth;
  const maxY = board.rows - shapeHeight;

  const occupied = buildOccupiedSet(board);
  const own = buildOwnSet(board, playerId);

  for (let oy = 0; oy <= maxY; oy++) {
    for (let ox = 0; ox <= maxX; ox++) {
      const cells = shapeCells.map((c) => ({ x: c.x + ox, y: c.y + oy }));
      if (isValidPlacementCells(cells, board, occupied, own)) results.push(cells);
    }
  }
  return results;
}

/** Whether the player has at least one legal placement for any of the given candidate shapes. */
export function hasAnyValidPlacementForShapes(board, playerId, shapes) {
  return shapes.some((shape) => enumerateValidPlacements(board, playerId, shape).length > 0);
}

/** Every candidate shape that currently has at least one legal placement. */
export function findPlayableShapes(board, playerId, shapes) {
  return shapes.filter((shape) => enumerateValidPlacements(board, playerId, shape).length > 0);
}

/**
 * Whether the player has at least one legal placement for a die roll,
 * considering both orientations of the w×h rectangle.
 */
export function hasAnyValidPlacement(board, playerId, dieA, dieB) {
  const shapes = [rectCells(0, 0, dieA, dieB)];
  if (dieA !== dieB) shapes.push(rectCells(0, 0, dieB, dieA));
  return hasAnyValidPlacementForShapes(board, playerId, shapes);
}

/**
 * Starting corner cell for each player index, for 2-4 players. 2 players
 * sit on opposite corners (maximal distance); 3 use three of the four
 * corners; 4 take all of them.
 */
export function cornerSeedPosition(cols, rows, playerIndex, playerCount) {
  const topLeft = { x: 0, y: 0 };
  const topRight = { x: cols - 1, y: 0 };
  const bottomRight = { x: cols - 1, y: rows - 1 };
  const bottomLeft = { x: 0, y: rows - 1 };

  const layouts = {
    2: [topLeft, bottomRight],
    3: [topLeft, topRight, bottomRight],
    4: [topLeft, topRight, bottomRight, bottomLeft],
  };
  return (layouts[playerCount] ?? layouts[2])[playerIndex];
}

/**
 * Builds the starting board: empty grid with each player seeded by a
 * single cell in their own corner, which then anchors their first real
 * placement.
 */
export function createInitialBoard(cols, rows, players) {
  const pieces = players.map((player, index) => {
    const { x, y } = cornerSeedPosition(cols, rows, index, players.length);
    return { id: `seed-${player.id}`, playerId: player.id, cells: [{ x, y }] };
  });
  return { cols, rows, pieces };
}

/** Total cells currently claimed by the player. */
export function playerArea(board, playerId) {
  return board.pieces.filter((p) => p.playerId === playerId).reduce((sum, p) => sum + p.cells.length, 0);
}

function hasValidPlacementForSize(board, playerId, w, h) {
  return enumerateValidPlacements(board, playerId, rectCells(0, 0, w, h)).length > 0;
}

/**
 * Whether the player could still place *some* rect on a future turn, for
 * any conceivable roll (dice range 1-6). Used to detect that a player is
 * permanently boxed in, independent of the current roll.
 */
export function hasAnyPossibleMove(board, playerId) {
  for (let w = 1; w <= 6; w++) {
    for (let h = 1; h <= 6; h++) {
      if (hasValidPlacementForSize(board, playerId, w, h)) return true;
    }
  }
  return false;
}

/**
 * The game is over once every player is permanently boxed in — no future
 * placement is possible for any of them. `hasMoveFn(board, playerId)`
 * encapsulates the game-specific universe of future shapes (every dice
 * size for Diceritory by default; pass a tetromino-flavored check for
 * Tetritory).
 */
export function isGameOver(board, players, hasMoveFn = hasAnyPossibleMove) {
  return players.every((player) => !hasMoveFn(board, player.id));
}

/**
 * Every [w, h] die-face pair (1-6 each) that currently has at least one
 * legal placement for the player. Used to weight the dice late-game, so a
 * roll can be steered toward something actually playable without letting
 * the player pick their own numbers.
 */
export function findPlayableDiceSizes(board, playerId) {
  const sizes = [];
  for (let w = 1; w <= 6; w++) {
    for (let h = 1; h <= 6; h++) {
      if (hasValidPlacementForSize(board, playerId, w, h)) sizes.push([w, h]);
    }
  }
  return sizes;
}

/** The 4 side-adjacent neighbors of a square cell — the default geometry for every game but Hexoritory. */
export function squareNeighbors(x, y) {
  return [
    { x: x + 1, y },
    { x: x - 1, y },
    { x, y: y + 1 },
    { x, y: y - 1 },
  ];
}

/**
 * Count of empty cells reachable from the player's own territory by
 * stepping through adjacent empty cells (flood fill) — every cell they
 * could, in principle, eventually claim over enough future turns (a
 * single-cell step can always inch into any edge-adjacent empty cell).
 * This is an upper bound on future growth: it ignores that another
 * player might claim the same cell first. `neighborsFn` lets non-square
 * boards (Hexoritory) plug in their own adjacency without duplicating
 * this whole flood fill.
 */
export function reachableEmptyCellCount(board, playerId, neighborsFn = squareNeighbors) {
  const occupied = buildOccupiedSet(board);
  const ownCells = board.pieces.filter((p) => p.playerId === playerId).flatMap((p) => p.cells);
  const visited = new Set();
  const queue = [];

  function tryEnqueue(x, y) {
    if (x < 0 || y < 0 || x >= board.cols || y >= board.rows) return;
    const key = cellKey(x, y);
    if (occupied.has(key) || visited.has(key)) return;
    visited.add(key);
    queue.push([x, y]);
  }

  for (const { x, y } of ownCells) {
    for (const n of neighborsFn(x, y)) tryEnqueue(n.x, n.y);
  }

  for (let head = 0; head < queue.length; head++) {
    const [x, y] = queue[head];
    for (const n of neighborsFn(x, y)) tryEnqueue(n.x, n.y);
  }

  return visited.size;
}

/**
 * The most territory this player could conceivably end up with: what they
 * already hold plus every cell still reachable from it. An optimistic
 * ceiling, not a guarantee — other players may reach the same cells first.
 */
export function maxPossibleArea(board, playerId, neighborsFn = squareNeighbors) {
  return playerArea(board, playerId) + reachableEmptyCellCount(board, playerId, neighborsFn);
}

/**
 * True once the final ranking is locked in: every player but (at most)
 * one is mathematically unable to catch up to the current leader, even in
 * the best case of claiming everything they could ever reach while the
 * leader gains nothing more. Lets the game end early instead of grinding
 * out a foregone conclusion turn after turn.
 */
export function isOutcomeDecided(board, players, neighborsFn = squareNeighbors) {
  if (players.length < 2) return false;
  const stats = players.map((p) => ({
    id: p.id,
    area: playerArea(board, p.id),
    maxArea: maxPossibleArea(board, p.id, neighborsFn),
  }));
  const stillInContention = stats.filter((s) =>
    stats.every((other) => other.id === s.id || s.maxArea >= other.area)
  );
  return stillInContention.length <= 1;
}

/**
 * True once a player holds strictly more than an equal T/P share of the
 * board (T = total cells, P = player count). For 2 players this is a
 * rigorous majority — nobody else can possibly catch up. For 3+ players
 * it's a much cheaper heuristic than `isOutcomeDecided` (no flood fill)
 * that's usually right in practice, but isn't a strict proof since the
 * remaining share could still concentrate in a single trailing player.
 */
export function hasMajorityShare(board, players) {
  if (players.length < 2) return false;
  const total = board.cols * board.rows;
  const threshold = total / players.length;
  return players.some((p) => playerArea(board, p.id) > threshold);
}
