import { enumerateValidPlacements, reachableEmptyCellCount, buildOwnSet, rectCells, squareNeighbors } from "./rules";
import { pieceRotations, pieceCells } from "./tetromino";
import { dominoCells, dominoOrientationCount, enumerateValidDominoPlacements } from "./domino";
import { hexShapeCells, hexRotationCount, enumerateValidHexPlacements, hexNeighbors } from "./hex";
import { enumerateValidRouteCells, makeRouteNeighborsFn } from "./route";

// Bounds per-move cost independent of board size/candidate count (boards go up to 32x32,
// and medium/hard score every candidate with a flood fill) — a random subsample is "good
// enough" for bot play without needing to evaluate every last placement.
const MAX_CANDIDATES_TO_EVALUATE = 60;
const HARD_OPPONENT_WEIGHT = 1;
const HARD_BLOCK_BONUS = 0.5;

function cellKey(x, y) {
  return `${x},${y}`;
}

function withPiece(board, playerId, cells) {
  return { ...board, pieces: [...board.pieces, { id: "bot-preview", playerId, cells }] };
}

function sample(candidates, max) {
  if (candidates.length <= max) return candidates;
  const pool = [...candidates];
  const picked = [];
  for (let i = 0; i < max; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    picked.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return picked;
}

function blockingCellCount(board, cells, opponents, neighborsFn) {
  if (opponents.length === 0) return 0;
  const opponentOwnSets = opponents.map((o) => buildOwnSet(board, o.id));
  return cells.filter((cell) =>
    neighborsFn(cell.x, cell.y).some((n) => opponentOwnSets.some((set) => set.has(cellKey(n.x, n.y))))
  ).length;
}

/**
 * Scores a candidate placement for `medium`/`hard` bots. `easy` doesn't call this — it
 * picks uniformly at random. `medium` rewards keeping the bot's own frontier open into
 * empty space (raw resulting area is useless as a differentiator: it's identical across
 * every candidate of the same roll, since the piece size is fixed). `hard` layers in a
 * cheap, single-ply opponent-awareness term (evaluate the position right after this move,
 * plus a same-move "crowds an opponent's border" bonus) — not real multi-ply search, which
 * would need to simulate unknown future rolls and is out of scope.
 */
export function scorePlacement(board, playerId, cells, opponents, difficulty, neighborsFn = squareNeighbors) {
  const placedBoard = withPiece(board, playerId, cells);
  const ownReachable = reachableEmptyCellCount(placedBoard, playerId, neighborsFn);
  if (difficulty !== "hard") return ownReachable;

  const bestOpponentReachable = opponents.length
    ? Math.max(...opponents.map((o) => reachableEmptyCellCount(placedBoard, o.id, neighborsFn)))
    : 0;

  return (
    ownReachable -
    HARD_OPPONENT_WEIGHT * bestOpponentReachable +
    HARD_BLOCK_BONUS * blockingCellCount(board, cells, opponents, neighborsFn)
  );
}

function pickPlacement(board, playerId, candidates, opponents, difficulty, neighborsFn = squareNeighbors) {
  if (!candidates || candidates.length === 0) return null;
  const pool = sample(candidates, MAX_CANDIDATES_TO_EVALUATE);

  if (difficulty === "easy") {
    return pool[Math.floor(Math.random() * pool.length)];
  }

  const scored = pool.map((cells) => ({
    cells,
    score: scorePlacement(board, playerId, cells, opponents, difficulty, neighborsFn),
  }));
  const maxScore = Math.max(...scored.map((s) => s.score));
  const best = scored.filter((s) => Math.abs(s.score - maxScore) < 1e-9);
  return best[Math.floor(Math.random() * best.length)].cells;
}

export function chooseDiceBotMove(board, playerId, dice, allowRotation, difficulty, opponents) {
  const [d1, d2] = dice;
  const shapes =
    allowRotation && d1 !== d2 ? [rectCells(0, 0, d1, d2), rectCells(0, 0, d2, d1)] : [rectCells(0, 0, d1, d2)];
  const candidates = shapes.flatMap((shape) => enumerateValidPlacements(board, playerId, shape));
  return pickPlacement(board, playerId, candidates, opponents, difficulty);
}

export function chooseTetrominoBotMove(board, playerId, pieceType, allowRotation, difficulty, opponents) {
  const shapes = allowRotation ? pieceRotations(pieceType) : [pieceCells(pieceType, 0)];
  const candidates = shapes.flatMap((shape) => enumerateValidPlacements(board, playerId, shape));
  return pickPlacement(board, playerId, candidates, opponents, difficulty);
}

export function chooseDominoBotMove(board, playerId, values, allowRotation, difficulty, opponents) {
  const orientationCount = allowRotation ? dominoOrientationCount(values) : 1;
  const candidates = [];
  for (let o = 0; o < orientationCount; o++) {
    candidates.push(...enumerateValidDominoPlacements(board, playerId, dominoCells(values, o)));
  }
  return pickPlacement(board, playerId, candidates, opponents, difficulty);
}

export function chooseHexBotMove(board, playerId, shapeIndex, allowRotation, difficulty, opponents) {
  const rotationCountForShape = allowRotation ? hexRotationCount(shapeIndex) : 1;
  const candidates = [];
  for (let r = 0; r < rotationCountForShape; r++) {
    candidates.push(...enumerateValidHexPlacements(board, playerId, hexShapeCells(shapeIndex, r)));
  }
  return pickPlacement(board, playerId, candidates, opponents, difficulty, hexNeighbors);
}

export function chooseRouteBotMove(board, playerId, difficulty, opponents) {
  const candidates = enumerateValidRouteCells(board, playerId).map((cell) => [cell]);
  return pickPlacement(board, playerId, candidates, opponents, difficulty, makeRouteNeighborsFn(board.bridges));
}

// Only `hard` bots bank, and only when the turn is forfeit either way (a placeable roll is
// always placed immediately, at every difficulty — banking a placeable piece to "save it for
// something better" is a real strategic trade-off that's out of scope here).
export function shouldBankDominoOnSkip(difficulty, storageCount, storageLimit) {
  return difficulty === "hard" && storageCount < storageLimit;
}
