import { describe, it, expect } from "vitest";
import {
  PIECE_TYPES,
  pieceRotations,
  rotationCount,
  pieceCells,
  ALL_TETROMINO_SHAPES,
  isPiecePlayable,
  hasAnyPossibleTetrominoMove,
  createBag,
  drawFromBag,
  drawSmartPiece,
  packTetrominoesGreedy,
} from "./tetromino";
import { rectCells, createInitialBoard } from "./rules";

const EXPECTED_ROTATION_COUNTS = { I: 2, O: 1, T: 4, S: 2, Z: 2, J: 4, L: 4 };

function isConnectedTetromino(cells) {
  if (cells.length !== 4) return false;
  const keys = new Set(cells.map((c) => `${c.x},${c.y}`));
  if (keys.size !== 4) return false; // no duplicate cells

  const visited = new Set([`${cells[0].x},${cells[0].y}`]);
  const queue = [cells[0]];
  while (queue.length > 0) {
    const { x, y } = queue.pop();
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const key = `${x + dx},${y + dy}`;
      if (keys.has(key) && !visited.has(key)) {
        visited.add(key);
        queue.push({ x: x + dx, y: y + dy });
      }
    }
  }
  return visited.size === 4;
}

describe("tetromino shapes", () => {
  it("defines all 7 standard piece types", () => {
    expect(PIECE_TYPES).toEqual(["I", "O", "T", "S", "Z", "J", "L"]);
  });

  it("has the expected number of distinct rotation states per type", () => {
    for (const type of PIECE_TYPES) {
      expect(rotationCount(type)).toBe(EXPECTED_ROTATION_COUNTS[type]);
      expect(pieceRotations(type).length).toBe(EXPECTED_ROTATION_COUNTS[type]);
    }
  });

  it("every rotation state is exactly 4 connected cells normalized to a 0,0 bounding box", () => {
    for (const type of PIECE_TYPES) {
      for (const cells of pieceRotations(type)) {
        expect(isConnectedTetromino(cells)).toBe(true);
        expect(Math.min(...cells.map((c) => c.x))).toBe(0);
        expect(Math.min(...cells.map((c) => c.y))).toBe(0);
      }
    }
  });

  it("pieceCells wraps the rotation index around the state count", () => {
    const states = pieceRotations("T");
    expect(pieceCells("T", 0)).toEqual(states[0]);
    expect(pieceCells("T", 4)).toEqual(states[0]); // wraps: 4 % 4 = 0
    expect(pieceCells("T", 5)).toEqual(states[1]);
    expect(pieceCells("T", -1)).toEqual(states[3]); // negative wraps to the last state
  });

  it("ALL_TETROMINO_SHAPES concatenates every rotation of every type", () => {
    const total = PIECE_TYPES.reduce((sum, t) => sum + rotationCount(t), 0);
    expect(ALL_TETROMINO_SHAPES.length).toBe(total);
  });
});

describe("isPiecePlayable / hasAnyPossibleTetrominoMove", () => {
  it("finds a placement for an unrotated I-piece adjacent to the seed when there's room", () => {
    const board = createInitialBoard(10, 10, [{ id: "p1" }, { id: "p2" }]);
    expect(isPiecePlayable(board, "p1", "I", true)).toBe(true);
  });

  it("respects allowRotation=false by only checking the piece's default orientation", () => {
    // Wall off everything except a vertical 1-wide corridor next to the seed,
    // so only the *vertical* I orientation (rotation 1) fits.
    const board = {
      cols: 4,
      rows: 6,
      pieces: [
        { id: "seed", playerId: "p1", cells: [{ x: 1, y: 0 }] },
        { id: "block-w", playerId: "p2", cells: rectCells(0, 0, 1, 6) },
        { id: "block-e", playerId: "p2", cells: rectCells(2, 0, 2, 6) },
      ],
    };
    // Default I rotation (index 0) is horizontal 4x1 — cannot fit in a 1-wide gap.
    expect(isPiecePlayable(board, "p1", "I", false)).toBe(false);
    // With rotation allowed, the vertical orientation fits.
    expect(isPiecePlayable(board, "p1", "I", true)).toBe(true);
  });

  it("hasAnyPossibleTetrominoMove is false once a player is fully boxed in", () => {
    const board = {
      cols: 3,
      rows: 3,
      pieces: [
        { id: "seed", playerId: "p1", cells: [{ x: 1, y: 1 }] },
        { id: "n", playerId: "p2", cells: [{ x: 1, y: 0 }] },
        { id: "s", playerId: "p2", cells: [{ x: 1, y: 2 }] },
        { id: "e", playerId: "p2", cells: [{ x: 2, y: 1 }] },
        { id: "w", playerId: "p2", cells: [{ x: 0, y: 1 }] },
      ],
    };
    expect(hasAnyPossibleTetrominoMove(board, "p1")).toBe(false);
  });
});

describe("7-bag randomizer", () => {
  it("draws each of the 7 types exactly once before repeating", () => {
    let bag = createBag();
    const drawn = [];
    for (let i = 0; i < 7; i++) {
      const [type, next] = drawFromBag(bag);
      drawn.push(type);
      bag = next;
    }
    expect(new Set(drawn).size).toBe(7);
    expect([...drawn].sort()).toEqual([...PIECE_TYPES].sort());
    expect(bag).toEqual([]); // fully drained after exactly 7 draws
  });

  it("refills with a fresh shuffled bag once empty", () => {
    let bag = createBag();
    for (let i = 0; i < 7; i++) {
      const [, next] = drawFromBag(bag);
      bag = next;
    }
    expect(bag).toEqual([]);
    const [type, next] = drawFromBag(bag);
    expect(PIECE_TYPES).toContain(type);
    expect(next.length).toBe(6);
  });

  it("drawSmartPiece pulls forward the first placeable type without changing the bag's composition", () => {
    const bag = ["I", "O", "T", "S", "Z", "J", "L"];
    const isPlaceable = (type) => type === "T"; // pretend only T fits right now
    const [chosen, rest] = drawSmartPiece(bag, isPlaceable);
    expect(chosen).toBe("T");
    expect([chosen, ...rest].sort()).toEqual([...bag].sort()); // same multiset, just reordered
    expect(rest).not.toContain("T");
  });

  it("drawSmartPiece falls back to the head piece if nothing in the bag is placeable", () => {
    const bag = ["I", "O", "T"];
    const [chosen, rest] = drawSmartPiece(bag, () => false);
    expect(chosen).toBe("I");
    expect(rest).toEqual(["O", "T"]);
  });

  it("drawSmartPiece keeps the head as-is when it's already placeable", () => {
    const bag = ["I", "O", "T"];
    const [chosen, rest] = drawSmartPiece(bag, () => true);
    expect(chosen).toBe("I");
    expect(rest).toEqual(["O", "T"]);
  });
});

describe("packTetrominoesGreedy", () => {
  it("tiles a region that's exactly one tetromino with a single connected piece", () => {
    // A 2x2 block — exactly the O piece.
    const region = rectCells(0, 0, 2, 2);
    const placements = packTetrominoesGreedy(region);
    expect(placements).toHaveLength(1);
    expect(isConnectedTetromino(placements[0])).toBe(true);
  });

  it("places nothing in a region too small for any tetromino", () => {
    const region = rectCells(0, 0, 3, 1); // only 3 cells
    expect(packTetrominoesGreedy(region)).toEqual([]);
  });

  it("tiles a region made of two separate 2x2 blocks with two pieces, covering every cell", () => {
    const region = [...rectCells(0, 0, 2, 2), ...rectCells(5, 5, 2, 2)];
    const placements = packTetrominoesGreedy(region);
    expect(placements).toHaveLength(2);
    const coveredKeys = placements.flat().map((c) => `${c.x},${c.y}`);
    expect(new Set(coveredKeys).size).toBe(8); // no overlaps
    expect(coveredKeys.sort()).toEqual(region.map((c) => `${c.x},${c.y}`).sort());
  });

  it("leaves an untileable remainder uncovered instead of forcing an invalid shape", () => {
    // A 2x2 block plus one disconnected extra cell far away — the extra
    // cell can never join a 4-cell shape on its own.
    const region = [...rectCells(0, 0, 2, 2), { x: 9, y: 9 }];
    const placements = packTetrominoesGreedy(region);
    expect(placements).toHaveLength(1);
    expect(placements[0].some((c) => c.x === 9 && c.y === 9)).toBe(false);
  });

  it("never places overlapping cells or cells outside the given region", () => {
    // An irregular 3x4 rectangle (12 cells = exactly 3 tetrominoes' worth).
    const region = rectCells(0, 0, 3, 4);
    const regionKeys = new Set(region.map((c) => `${c.x},${c.y}`));
    const placements = packTetrominoesGreedy(region);
    const seen = new Set();
    for (const piece of placements) {
      expect(piece).toHaveLength(4);
      for (const c of piece) {
        const key = `${c.x},${c.y}`;
        expect(regionKeys.has(key)).toBe(true);
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
    }
  });
});
