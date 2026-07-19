// Hexoritory's board and piece system: a pointy-top hex grid stored using
// "odd-r" offset coordinates (col, row) — odd rows are shifted half a cell
// right — so it still fits the app's generic { cols, rows, cells:[{x,y}] }
// board/piece model and reuses rules.js's occupancy/ownership primitives.
// Rotation math is done in axial coordinates (cube-coordinate 60° steps),
// which offset coordinates can't do cleanly, then converted back.

import { isInsideBoard, buildOccupiedSet, buildOwnSet } from "./rules";

export const HEX_SHAPE_TYPES = [1, 2, 3, 4];

export const HEX_SHAPE_LABELS = {
  1: "1 гексагон",
  2: "2 гексагони",
  3: "пряма з 3",
  4: "трикутник з 3",
};

// The 6 axial neighbor directions, in a consistent 60°-step rotational order.
const AXIAL_DIRS = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

/** Converts board-offset (col, row) to axial (q, r) — needed for rotation math and pixel layout. */
export function offsetToAxial(col, row) {
  return { q: col - (row - (row & 1)) / 2, r: row };
}

/** Converts axial (q, r) back to board-offset { x: col, y: row }. */
export function axialToOffset(q, r) {
  return { x: q + (r - (r & 1)) / 2, y: r };
}

/** The 6 board-offset neighbors of a hex cell (side-adjacent, not diagonal). */
export function hexNeighbors(col, row) {
  const { q, r } = offsetToAxial(col, row);
  return AXIAL_DIRS.map((d) => axialToOffset(q + d.q, r + d.r));
}

function cubeFromAxial(q, r) {
  return { x: q, y: -q - r, z: r };
}

function axialFromCube(c) {
  return { q: c.x, r: c.z };
}

/** Rotates a cube vector 60° clockwise around the origin. */
function rotateCube60(c) {
  return { x: -c.z, y: -c.x, z: -c.y };
}

function rotateAxial60(cell) {
  return axialFromCube(rotateCube60(cubeFromAxial(cell.q, cell.r)));
}

function rotateAxialShape(cells, steps) {
  let result = cells;
  for (let i = 0; i < steps; i++) {
    result = result.map(rotateAxial60);
  }
  return result;
}

/** Translates a shape so its (r, then q) - smallest cell sits at axial (0,0). */
function normalizeAxialShape(cells) {
  const anchor = [...cells].sort((a, b) => a.r - b.r || a.q - b.q)[0];
  return cells.map((c) => ({ q: c.q - anchor.q, r: c.r - anchor.r }));
}

function shapeKey(cells) {
  return [...cells]
    .map((c) => `${c.q},${c.r}`)
    .sort()
    .join("|");
}

// The 4 base figures, defined in axial coordinates relative to an origin hex.
const BASE_SHAPES = {
  1: [{ q: 0, r: 0 }],
  2: [
    { q: 0, r: 0 },
    { q: 1, r: 0 },
  ],
  3: [
    { q: 0, r: 0 },
    { q: 1, r: 0 },
    { q: 2, r: 0 },
  ],
  4: [
    { q: 0, r: 0 },
    { q: 1, r: 0 },
    { q: 1, r: -1 },
  ],
};

/** Every distinct rotation state of a shape, found by rotating 60° six times and deduping. */
function generateRotations(baseCells) {
  const seen = new Map();
  for (let steps = 0; steps < 6; steps++) {
    const normalized = normalizeAxialShape(rotateAxialShape(baseCells, steps));
    const key = shapeKey(normalized);
    if (!seen.has(key)) seen.set(key, normalized);
  }
  return Array.from(seen.values());
}

const HEX_SHAPES = Object.fromEntries(
  Object.entries(BASE_SHAPES).map(([type, cells]) => [Number(type), generateRotations(cells)])
);

/** All distinct rotation states (axial cells) for a hex shape type. */
export function hexShapeRotations(shapeIndex) {
  return HEX_SHAPES[shapeIndex];
}

/** How many distinct rotation states a hex shape type has. */
export function hexRotationCount(shapeIndex) {
  return HEX_SHAPES[shapeIndex].length;
}

/** Axial cells (relative) for a shape type + rotation index, wrapping the index. */
export function hexShapeCells(shapeIndex, rotationIndex) {
  const states = HEX_SHAPES[shapeIndex];
  return states[((rotationIndex % states.length) + states.length) % states.length];
}

/** Converts a shape's relative axial cells into absolute board-offset cells, anchored at (col, row). */
export function hexShapeToOffsetCells(shapeAxialCells, anchorCol, anchorRow) {
  const { q: aq, r: ar } = offsetToAxial(anchorCol, anchorRow);
  return shapeAxialCells.map((c) => axialToOffset(aq + c.q, ar + c.r));
}

function cellKey(x, y) {
  return `${x},${y}`;
}

function isValidHexCells(cells, board, occupied, own) {
  if (!cells || cells.length === 0) return false;
  if (!isInsideBoard(board, cells)) return false;
  if (cells.some(({ x, y }) => occupied.has(cellKey(x, y)))) return false;
  if (own.size === 0) return true;
  return cells.some(({ x, y }) => hexNeighbors(x, y).some((n) => own.has(cellKey(n.x, n.y))));
}

/** Authoritative hex placement check: in bounds, no overlap, side-adjacent to the player's own territory. */
export function validHexPlacement(board, playerId, cells) {
  return isValidHexCells(cells, board, buildOccupiedSet(board), buildOwnSet(board, playerId));
}

/** Every valid anchor placement (as absolute offset cells) for a hex shape (one rotation) on the board. */
export function enumerateValidHexPlacements(board, playerId, shapeAxialCells) {
  const results = [];
  if (!shapeAxialCells || shapeAxialCells.length === 0) return results;

  const occupied = buildOccupiedSet(board);
  const own = buildOwnSet(board, playerId);

  for (let row = 0; row < board.rows; row++) {
    for (let col = 0; col < board.cols; col++) {
      const cells = hexShapeToOffsetCells(shapeAxialCells, col, row);
      if (isValidHexCells(cells, board, occupied, own)) results.push(cells);
    }
  }
  return results;
}

/** Whether a hex shape type has at least one legal placement right now, in some rotation. */
export function isHexShapePlayable(board, playerId, shapeIndex, allowRotation) {
  const rotations = allowRotation ? hexShapeRotations(shapeIndex) : [hexShapeCells(shapeIndex, 0)];
  return rotations.some((cells) => enumerateValidHexPlacements(board, playerId, cells).length > 0);
}

/**
 * Whether the player could still place *some* hex shape on a future turn,
 * for any of the 4 shape types — mirrors hasAnyPossibleMove/
 * hasAnyPossibleTetrominoMove, always assuming full orientation freedom
 * regardless of the allowRotation setting.
 */
export function hasAnyPossibleHexMove(board, playerId) {
  return HEX_SHAPE_TYPES.some((shapeIndex) => isHexShapePlayable(board, playerId, shapeIndex, true));
}

/** Every shape type that currently has at least one legal placement, respecting allowRotation. */
export function findPlayableHexShapes(board, playerId, allowRotation) {
  return HEX_SHAPE_TYPES.filter((shapeIndex) => isHexShapePlayable(board, playerId, shapeIndex, allowRotation));
}

// Largest-first so the greedy packer actually uses the multi-hex figures —
// type 1 is a single cell that trivially "fits" anywhere, so if it were
// tried first it would win every time and shapes 2-4 would never get used.
const ALL_HEX_SHAPE_ROTATIONS = [...HEX_SHAPE_TYPES].sort((a, b) => b - a).flatMap((type) => hexShapeRotations(type));

/**
 * Greedily tiles a set of offset cells with as many complete hex figures
 * (any of the 4 shape types, in any rotation, largest first) as fit —
 * mirrors tetromino.js's packTetrominoesGreedy, but offset coordinates
 * aren't uniformly translatable (row parity shifts columns), so each
 * candidate anchor is converted to axial first: for every rotation of every
 * shape type, every one of the shape's own cells is tried as the one that
 * lands on the anchor, the rest of the shape is translated along in axial
 * space, then converted back to offset to check membership. Any leftover cells
 * the region doesn't tile losslessly into stay unclaimed.
 */
export function packHexShapesGreedy(cells) {
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
      const { q: aq, r: ar } = offsetToAxial(anchor.x, anchor.y);
      for (const shape of ALL_HEX_SHAPE_ROTATIONS) {
        for (const ref of shape) {
          const originQ = aq - ref.q;
          const originR = ar - ref.r;
          const translated = shape.map((c) => axialToOffset(originQ + c.q, originR + c.r));
          if (translated.every(({ x, y }) => remaining.has(cellKey(x, y)))) {
            for (const { x, y } of translated) remaining.delete(cellKey(x, y));
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
