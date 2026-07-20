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
 * Plain greedy pass: repeatedly places the first shape found (scanning
 * cells in reading order, then shapes/rotations in a fixed order) that
 * fits entirely within what's left. Used as a cheap floor result — see
 * packTetrominoesGreedy below for why this alone isn't the whole story.
 */
function simpleGreedyPack(cells) {
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

// Recursive-search node budget for packTetrominoesGreedy — keeps
// pathologically large enclosed regions fast; see that function's comment.
const PACK_SEARCH_BUDGET = 150000;

/**
 * Tiles a set of cells with as many complete tetrominoes (any of the 19
 * rotation states) as fit, without needing them adjacent to any territory —
 * the whole region is already exclusively reachable by one player, so
 * there's nothing left to validate against. Returns an array of 4-cell
 * placements; any leftover cells (the region's shape doesn't always tile
 * losslessly) stay unclaimed.
 *
 * A pure greedy pass (simpleGreedyPack above) can walk itself into a dead
 * end — e.g. placing an O piece where only an L+J combination tiles the
 * whole region losslessly, leaving a gap the player could clearly see was
 * fillable. So this backtracks instead: at each step it resolves the fate
 * of the first (reading-order) still-uncovered cell — trying every
 * placement that could cover it, plus leaving it permanently uncovered —
 * and keeps whichever choice leads to the most total cells covered.
 * Bounded by a node-visit budget so pathologically large regions still
 * return quickly; simpleGreedyPack's result is used as a floor, so a
 * budget cutoff can never do worse than the old plain-greedy behavior,
 * only match or beat it.
 */
export function packTetrominoesGreedy(cells) {
  const greedyPlacements = simpleGreedyPack(cells);
  let best = { placements: greedyPlacements, coveredCount: greedyPlacements.length * 4 };
  if (best.coveredCount === cells.length) return best.placements; // already perfect, nothing to improve

  const remaining = new Set(cells.map((c) => cellKey(c.x, c.y)));
  let budget = PACK_SEARCH_BUDGET;

  function firstRemainingCell() {
    let found = null;
    for (const key of remaining) {
      const [x, y] = key.split(",").map(Number);
      if (!found || y < found.y || (y === found.y && x < found.x)) found = { x, y };
    }
    return found;
  }

  function search(placements, coveredCount) {
    if (budget-- <= 0) return;
    if (coveredCount > best.coveredCount) best = { placements: placements.slice(), coveredCount };
    if (remaining.size === 0) return;

    const anchor = firstRemainingCell();
    for (const shape of ALL_TETROMINO_SHAPES) {
      for (const ref of shape) {
        const dx = anchor.x - ref.x;
        const dy = anchor.y - ref.y;
        const translated = shape.map((c) => ({ x: c.x + dx, y: c.y + dy }));
        if (!translated.every((c) => remaining.has(cellKey(c.x, c.y)))) continue;
        for (const c of translated) remaining.delete(cellKey(c.x, c.y));
        placements.push(translated);
        search(placements, coveredCount + 4);
        placements.pop();
        for (const c of translated) remaining.add(cellKey(c.x, c.y));
        if (budget <= 0) return;
      }
    }

    remaining.delete(cellKey(anchor.x, anchor.y));
    search(placements, coveredCount);
    remaining.add(cellKey(anchor.x, anchor.y));
  }

  search([], 0);
  return best.placements;
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
