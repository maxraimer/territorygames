// Dominotory's piece system: a domino tile is two adjacent cells, each
// carrying its own numeric half (1-6, same range as a die face). Reuses
// the shared board/occupancy/own-territory primitives from rules.js and
// layers two domino-specific rules on top: which cell holds which value,
// and the "matching numbers must touch" placement rule.

import { isInsideBoard, buildOccupiedSet, buildOwnSet } from "./rules";
import { rollDice } from "./dice";

function cellKey(x, y) {
  return `${x},${y}`;
}

function neighborsOf(x, y) {
  return [
    { x: x - 1, y },
    { x: x + 1, y },
    { x, y: y - 1 },
    { x, y: y + 1 },
  ];
}

/** A fresh random domino: two independent 1-6 halves, same source as Diceritory's dice. */
export function rollDomino() {
  return rollDice();
}

/**
 * Cells (normalized to a 0,0 bounding box) for a domino's two values in a
 * given orientation. Doubles (a === b) only have 2 meaningfully distinct
 * orientations — swapping which half sits where doesn't change anything
 * when both halves are the same number.
 */
export function dominoCells([a, b], orientationIndex) {
  const isDouble = a === b;
  const states = isDouble
    ? [
        [
          { x: 0, y: 0, value: a },
          { x: 1, y: 0, value: b },
        ],
        [
          { x: 0, y: 0, value: a },
          { x: 0, y: 1, value: b },
        ],
      ]
    : [
        [
          { x: 0, y: 0, value: a },
          { x: 1, y: 0, value: b },
        ],
        [
          { x: 0, y: 0, value: b },
          { x: 1, y: 0, value: a },
        ],
        [
          { x: 0, y: 0, value: a },
          { x: 0, y: 1, value: b },
        ],
        [
          { x: 0, y: 0, value: b },
          { x: 0, y: 1, value: a },
        ],
      ];
  const n = states.length;
  return states[((orientationIndex % n) + n) % n];
}

/** How many distinct orientation states a domino's values have (2 for doubles, 4 otherwise). */
export function dominoOrientationCount([a, b]) {
  return a === b ? 2 : 4;
}

/** True once the player has placed at least one real domino (as opposed to just their starting seed cell). */
function hasPlacedDomino(board, playerId) {
  return board.pieces.some((p) => p.playerId === playerId && p.cells.length === 2);
}

function buildValueMap(board) {
  const map = new Map();
  for (const piece of board.pieces) {
    for (const cell of piece.cells) {
      if (cell.value !== undefined) map.set(cellKey(cell.x, cell.y), cell.value);
    }
  }
  return map;
}

function hasMatchingNumberContact(cells, valueMap) {
  return cells.some(({ x, y, value }) => neighborsOf(x, y).some((n) => valueMap.get(cellKey(n.x, n.y)) === value));
}

function isValidDominoCells(cells, board, occupied, own, requireNumberMatch, valueMap) {
  if (!isInsideBoard(board, cells)) return false;
  if (cells.some(({ x, y }) => occupied.has(cellKey(x, y)))) return false;
  const ownOk =
    own.size === 0 ||
    cells.some(
      ({ x, y }) =>
        own.has(cellKey(x - 1, y)) || own.has(cellKey(x + 1, y)) || own.has(cellKey(x, y - 1)) || own.has(cellKey(x, y + 1))
    );
  if (!ownOk) return false;
  if (requireNumberMatch && !hasMatchingNumberContact(cells, valueMap)) return false;
  return true;
}

/**
 * Authoritative domino placement check: in bounds, no overlap, touches the
 * player's own territory, and — unless this is the player's very first
 * domino — at least one half touches a same-numbered half already on the
 * board (any player's). The first-domino exception is carried entirely by
 * this function so it can't leak into the generic rules.js validator.
 */
export function validDominoPlacement(board, playerId, cells) {
  const occupied = buildOccupiedSet(board);
  const own = buildOwnSet(board, playerId);
  const requireNumberMatch = hasPlacedDomino(board, playerId);
  const valueMap = buildValueMap(board);
  return isValidDominoCells(cells, board, occupied, own, requireNumberMatch, valueMap);
}

/** Every valid top-left anchor placement (as absolute cells) for a domino shape (one orientation). */
export function enumerateValidDominoPlacements(board, playerId, shapeCells) {
  const results = [];
  if (!shapeCells || shapeCells.length === 0) return results;

  const shapeWidth = Math.max(...shapeCells.map((c) => c.x)) + 1;
  const shapeHeight = Math.max(...shapeCells.map((c) => c.y)) + 1;
  const maxX = board.cols - shapeWidth;
  const maxY = board.rows - shapeHeight;

  const occupied = buildOccupiedSet(board);
  const own = buildOwnSet(board, playerId);
  const requireNumberMatch = hasPlacedDomino(board, playerId);
  const valueMap = buildValueMap(board);

  for (let oy = 0; oy <= maxY; oy++) {
    for (let ox = 0; ox <= maxX; ox++) {
      const cells = shapeCells.map((c) => ({ ...c, x: c.x + ox, y: c.y + oy }));
      if (isValidDominoCells(cells, board, occupied, own, requireNumberMatch, valueMap)) results.push(cells);
    }
  }
  return results;
}

/** Whether this domino's values have at least one legal placement right now, in some orientation. */
export function isDominoPlayable(board, playerId, values, allowRotation) {
  const count = allowRotation ? dominoOrientationCount(values) : 1;
  for (let o = 0; o < count; o++) {
    if (enumerateValidDominoPlacements(board, playerId, dominoCells(values, o)).length > 0) return true;
  }
  return false;
}

/**
 * Whether the player could still place *some* domino on a future turn, for
 * any conceivable pair of values (1-6 each), in any orientation — mirrors
 * hasAnyPossibleMove/hasAnyPossibleTetrominoMove, always assuming full
 * orientation freedom regardless of the allowRotation setting (a
 * deliberately generous bound, so the game doesn't end early just because
 * rotation happens to be off for the current tile).
 */
export function hasAnyPossibleDominoMove(board, playerId) {
  for (let a = 1; a <= 6; a++) {
    for (let b = a; b <= 6; b++) {
      if (isDominoPlayable(board, playerId, [a, b], true)) return true;
    }
  }
  return false;
}

/** Every [a, b] value pair (a <= b) that currently has at least one legal placement, in any orientation. */
export function findPlayableDominoValues(board, playerId) {
  const playable = [];
  for (let a = 1; a <= 6; a++) {
    for (let b = a; b <= 6; b++) {
      if (isDominoPlayable(board, playerId, [a, b], true)) playable.push([a, b]);
    }
  }
  return playable;
}

/**
 * For a hovered/candidate placement, finds which of its halves satisfy the
 * two contact rules and which already-placed half each one is touching —
 * used to draw the "why this is (in)valid" highlight on the board: the
 * matching-number pair and the own-territory contact pair.
 */
export function dominoContactInfo(board, playerId, cells) {
  const own = buildOwnSet(board, playerId);
  const valueMap = buildValueMap(board);
  const numberMatches = [];
  const ownContacts = [];

  for (const cell of cells) {
    for (const n of neighborsOf(cell.x, cell.y)) {
      const key = cellKey(n.x, n.y);
      if (valueMap.get(key) === cell.value) numberMatches.push({ from: cell, to: n });
      if (own.has(key)) ownContacts.push({ from: cell, to: n });
    }
  }
  return { numberMatches, ownContacts };
}
