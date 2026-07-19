// The 7 standard Tetris pieces for Tetritory, plus a classic "7-bag"
// randomizer (each type appears exactly once per shuffled bag, so no
// long droughts or floods of any one piece — the standard modern Tetris
// approach, as opposed to fully independent random draws).
import { hasAnyValidPlacementForShapes } from "./rules";

export const PIECE_TYPES = ["I", "O", "T", "S", "Z", "J", "L"];

// Each piece's distinct rotation states, cells normalized to a 0,0-based
// bounding box. O has 1 unique state; I/S/Z have 2; T/J/L have 4.
const SHAPES = {
  I: [
    [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ],
    [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: 2 },
      { x: 0, y: 3 },
    ],
  ],
  O: [
    [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ],
  ],
  T: [
    [
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ],
    [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 0, y: 2 },
    ],
    [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 1, y: 1 },
    ],
    [
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 1, y: 2 },
    ],
  ],
  S: [
    [
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ],
    [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 1, y: 2 },
    ],
  ],
  Z: [
    [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ],
    [
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 0, y: 2 },
    ],
  ],
  J: [
    [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ],
    [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: 2 },
    ],
    [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 1 },
    ],
    [
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 2 },
      { x: 1, y: 2 },
    ],
  ],
  L: [
    [
      { x: 2, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ],
    [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: 2 },
      { x: 1, y: 2 },
    ],
    [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 0, y: 1 },
    ],
    [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 1, y: 2 },
    ],
  ],
};

/** All distinct rotation states (as cell arrays) for a piece type. */
export function pieceRotations(type) {
  return SHAPES[type];
}

/** How many distinct rotation states a piece type has (1 for O, up to 4). */
export function rotationCount(type) {
  return SHAPES[type].length;
}

/** Cells (normalized to a 0,0 bounding box) for a piece type + rotation index. */
export function pieceCells(type, rotationIndex) {
  const states = SHAPES[type];
  return states[((rotationIndex % states.length) + states.length) % states.length];
}

/** Every rotation state of every piece type — the full "shape universe" for move analysis. */
export const ALL_TETROMINO_SHAPES = PIECE_TYPES.flatMap((type) => SHAPES[type]);

/** Whether the player could place this piece type in any of its rotations right now. */
export function isPiecePlayable(board, playerId, type, allowRotation) {
  const shapes = allowRotation ? pieceRotations(type) : [pieceCells(type, 0)];
  return hasAnyValidPlacementForShapes(board, playerId, shapes);
}

function cellKey(x, y) {
  return `${x},${y}`;
}

/**
 * Greedily tiles a set of cells with as many complete tetrominoes (any of
 * the 19 rotation states) as fit, without needing them adjacent to any
 * territory — the whole region is already exclusively reachable by one
 * player, so there's nothing left to validate against. Repeatedly places
 * the first shape it finds that fits entirely within what's left, until
 * nothing more fits; any leftover cells (the region's shape doesn't always
 * tile losslessly) stay unclaimed. Returns an array of 4-cell placements.
 */
export function packTetrominoesGreedy(cells) {
  const remaining = new Set(cells.map((c) => cellKey(c.x, c.y)));
  const placements = [];

  let placedThisPass = true;
  while (placedThisPass) {
    placedThisPass = false;
    const candidates = Array.from(remaining)
      .map((key) => {
        const [x, y] = key.split(",").map(Number);
        return { x, y };
      })
      .sort((a, b) => a.y - b.y || a.x - b.x);

    findPlacement: for (const anchor of candidates) {
      for (const shape of ALL_TETROMINO_SHAPES) {
        for (const ref of shape) {
          const dx = anchor.x - ref.x;
          const dy = anchor.y - ref.y;
          const translated = shape.map((c) => ({ x: c.x + dx, y: c.y + dy }));
          if (translated.every((c) => remaining.has(cellKey(c.x, c.y)))) {
            for (const c of translated) remaining.delete(cellKey(c.x, c.y));
            placements.push(translated);
            placedThisPass = true;
            break findPlacement;
          }
        }
      }
    }
  }
  return placements;
}

/** Whether the player has any legal placement at all, for any piece type in any rotation. */
export function hasAnyPossibleTetrominoMove(board, playerId) {
  return hasAnyValidPlacementForShapes(board, playerId, ALL_TETROMINO_SHAPES);
}

function shuffledBag() {
  const bag = [...PIECE_TYPES];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

/** A fresh randomizer queue — empty, so the first draw fills it with a shuffled bag. */
export function createBag() {
  return [];
}

/** Draws the next piece type, refilling with a freshly shuffled bag when empty. Returns [type, nextBag]. */
export function drawFromBag(bag) {
  const queue = bag.length > 0 ? bag : shuffledBag();
  const [type, ...rest] = queue;
  return [type, rest];
}

/**
 * Draws the next piece, but if it isn't currently placeable and a later
 * piece already queued in this same bag *is*, pulls that one forward
 * instead. The draw order shifts, but the bag's fair composition (each
 * type exactly once per cycle) is untouched — nothing is added or
 * skipped, just reordered toward something playable.
 */
export function drawSmartPiece(bag, isPlaceable) {
  const queue = bag.length > 0 ? bag : shuffledBag();
  if (isPlaceable(queue[0])) return [queue[0], queue.slice(1)];

  const altIndex = queue.findIndex((type) => isPlaceable(type));
  if (altIndex <= 0) return [queue[0], queue.slice(1)];

  const chosen = queue[altIndex];
  const rest = [...queue.slice(0, altIndex), ...queue.slice(altIndex + 1)];
  return [chosen, rest];
}
