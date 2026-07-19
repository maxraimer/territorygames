// Detects empty board regions that a single player has fully surrounded
// with their own pieces — the game already prevents anyone else from ever
// reaching such a pocket (placement requires touching your own territory,
// and only the surrounding player's cells border it), so this just finds
// them for the optional auto-fill feature to claim immediately instead of
// waiting for the player to slowly roll their way through it.

import { buildOccupiedSet, squareNeighbors } from "./rules";

function cellKey(x, y) {
  return `${x},${y}`;
}

/**
 * Every connected region of empty cells whose only bordering occupied
 * cells all belong to a single player. Returns [{ playerId, cells }, ...].
 * A region touching no pieces yet, or bordering more than one player, is
 * left out — it isn't exclusively anyone's. `neighborsFn` defaults to
 * 4-directional square adjacency; Hexoritory passes `hexNeighbors` for its
 * 6-directional board instead.
 */
export function findEnclosedRegions(board, neighborsFn = squareNeighbors) {
  const occupied = buildOccupiedSet(board);
  const ownerOf = new Map();
  for (const piece of board.pieces) {
    for (const c of piece.cells) ownerOf.set(cellKey(c.x, c.y), piece.playerId);
  }

  const visited = new Set();
  const regions = [];

  for (let y = 0; y < board.rows; y++) {
    for (let x = 0; x < board.cols; x++) {
      const key = cellKey(x, y);
      if (occupied.has(key) || visited.has(key)) continue;

      const componentCells = [];
      const borderOwners = new Set();
      const queue = [{ x, y }];
      visited.add(key);

      while (queue.length > 0) {
        const cur = queue.shift();
        componentCells.push(cur);
        for (const n of neighborsFn(cur.x, cur.y)) {
          if (n.x < 0 || n.y < 0 || n.x >= board.cols || n.y >= board.rows) continue;
          const nKey = cellKey(n.x, n.y);
          if (occupied.has(nKey)) {
            borderOwners.add(ownerOf.get(nKey));
          } else if (!visited.has(nKey)) {
            visited.add(nKey);
            queue.push(n);
          }
        }
      }

      if (borderOwners.size === 1) {
        const [playerId] = borderOwners;
        regions.push({ playerId, cells: componentCells });
      }
    }
  }
  return regions;
}
