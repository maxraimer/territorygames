import { describe, it, expect } from "vitest";
import {
  hexNeighbors,
  hexRotationCount,
  hexShapeCells,
  hexShapeToOffsetCells,
  validHexPlacement,
  enumerateValidHexPlacements,
  isHexShapePlayable,
  hasAnyPossibleHexMove,
  findPlayableHexShapes,
  packHexShapesGreedy,
} from "./hex";

function cellKey(c) {
  return `${c.x},${c.y}`;
}

function makeBoard(cols, rows, pieces = []) {
  return { cols, rows, pieces };
}

function seed(playerId, x, y) {
  return { id: `seed-${playerId}`, playerId, cells: [{ x, y }] };
}

function areAdjacent(a, b) {
  return hexNeighbors(a.x, a.y).some((n) => n.x === b.x && n.y === b.y);
}

describe("hexNeighbors", () => {
  it("gives 6 neighbors, symmetric (if B neighbors A, A neighbors B)", () => {
    for (const [col, row] of [
      [4, 4],
      [4, 5],
      [0, 0],
      [3, 7],
    ]) {
      const neighbors = hexNeighbors(col, row);
      expect(neighbors).toHaveLength(6);
      for (const n of neighbors) {
        expect(hexNeighbors(n.x, n.y).some((back) => back.x === col && back.y === row)).toBe(true);
      }
    }
  });

  it("gives 6 distinct neighbor cells", () => {
    const neighbors = hexNeighbors(5, 5);
    const keys = new Set(neighbors.map((n) => `${n.x},${n.y}`));
    expect(keys.size).toBe(6);
  });
});

describe("hex shape rotation counts", () => {
  it("single hex has only 1 orientation", () => {
    expect(hexRotationCount(1)).toBe(1);
  });
  it("2-hex pair has 3 distinct orientations", () => {
    expect(hexRotationCount(2)).toBe(3);
  });
  it("3-hex line has 3 distinct orientations", () => {
    expect(hexRotationCount(3)).toBe(3);
  });
  it("3-hex triangle has 2 distinct (chiral) orientations", () => {
    expect(hexRotationCount(4)).toBe(2);
  });
});

describe("hex shape connectivity", () => {
  it("shape 1 is a single cell", () => {
    const cells = hexShapeToOffsetCells(hexShapeCells(1, 0), 5, 5);
    expect(cells).toHaveLength(1);
  });

  it("shape 2 (pair) has its two cells mutually adjacent, in every rotation", () => {
    for (let r = 0; r < hexRotationCount(2); r++) {
      const [a, b] = hexShapeToOffsetCells(hexShapeCells(2, r), 5, 5);
      expect(areAdjacent(a, b)).toBe(true);
    }
  });

  it("shape 3 (line) has endpoints touching only the middle cell, not each other, in every rotation", () => {
    for (let r = 0; r < hexRotationCount(3); r++) {
      const [a, b, c] = hexShapeToOffsetCells(hexShapeCells(3, r), 5, 5);
      expect(areAdjacent(a, b)).toBe(true);
      expect(areAdjacent(b, c)).toBe(true);
      expect(areAdjacent(a, c)).toBe(false);
    }
  });

  it("shape 4 (triangle) has every cell mutually adjacent, in every rotation", () => {
    for (let r = 0; r < hexRotationCount(4); r++) {
      const [a, b, c] = hexShapeToOffsetCells(hexShapeCells(4, r), 5, 5);
      expect(areAdjacent(a, b)).toBe(true);
      expect(areAdjacent(b, c)).toBe(true);
      expect(areAdjacent(a, c)).toBe(true);
    }
  });
});

describe("hexShapeToOffsetCells", () => {
  it("anchors the shape's origin cell exactly at the given offset position", () => {
    const cells = hexShapeToOffsetCells(hexShapeCells(1, 0), 7, 3);
    expect(cells).toEqual([{ x: 7, y: 3 }]);
  });
});

describe("validHexPlacement — first move exception", () => {
  it("allows a player's first shape to touch only their seed", () => {
    const board = makeBoard(10, 10, [seed("p1", 5, 5)]);
    const [neighbor] = hexNeighbors(5, 5);
    expect(validHexPlacement(board, "p1", [neighbor])).toBe(true);
  });

  it("rejects a first shape that doesn't touch the player's seed", () => {
    const board = makeBoard(10, 10, [seed("p1", 0, 0)]);
    expect(validHexPlacement(board, "p1", [{ x: 8, y: 8 }])).toBe(false);
  });
});

describe("validHexPlacement — after the first shape", () => {
  it("requires touching own territory (hex-adjacency, not the 4-directional square one)", () => {
    const board = makeBoard(10, 10, [
      seed("p1", 5, 5),
      { id: "d1", playerId: "p1", cells: [hexNeighbors(5, 5)[0]] },
    ]);
    const ownCell = hexNeighbors(5, 5)[0];
    const trueHexNeighbor = hexNeighbors(ownCell.x, ownCell.y).find(
      (n) => !(n.x === 5 && n.y === 5)
    );
    expect(validHexPlacement(board, "p1", [trueHexNeighbor])).toBe(true);
  });

  it("rejects a cell that isn't hex-adjacent to any own cell", () => {
    const board = makeBoard(10, 10, [seed("p1", 0, 0)]);
    expect(validHexPlacement(board, "p1", [{ x: 9, y: 9 }])).toBe(false);
  });
});

describe("enumerateValidHexPlacements / isHexShapePlayable", () => {
  it("finds placements respecting board bounds and existing pieces", () => {
    const board = makeBoard(4, 4, [seed("p1", 0, 0)]);
    const results = enumerateValidHexPlacements(board, "p1", hexShapeCells(1, 0));
    expect(results.length).toBeGreaterThan(0);
    for (const cells of results) {
      expect(cells.every((c) => c.x >= 0 && c.x < 4 && c.y >= 0 && c.y < 4)).toBe(true);
    }
  });

  it("isHexShapePlayable respects allowRotation", () => {
    // A 1-row-tall board: shape 2 (pair) only fits in whichever rotation stays within row 0.
    const board = makeBoard(6, 1, [seed("p1", 0, 0)]);
    expect(isHexShapePlayable(board, "p1", 2, true)).toBe(true);
    // Rotation 0 of shape 2 happens to be the horizontal, same-row pair — still fits row 0,
    // so instead verify a shape that truly needs rotation freedom: none needed here since a
    // 1-row board only ever offers same-row placements. Use a 1-column-wide board instead.
    const narrowBoard = makeBoard(1, 6, [seed("p1", 0, 0)]);
    const rotation0Fits = enumerateValidHexPlacements(narrowBoard, "p1", hexShapeCells(2, 0)).length > 0;
    expect(isHexShapePlayable(narrowBoard, "p1", 2, false)).toBe(rotation0Fits);
    expect(isHexShapePlayable(narrowBoard, "p1", 2, true)).toBe(true);
  });
});

describe("hasAnyPossibleHexMove / findPlayableHexShapes", () => {
  it("is true on an open board", () => {
    const board = makeBoard(8, 8, [seed("p1", 0, 0)]);
    expect(hasAnyPossibleHexMove(board, "p1")).toBe(true);
    expect(findPlayableHexShapes(board, "p1", true).length).toBeGreaterThan(0);
  });

  it("is false once the player is fully boxed in", () => {
    const board = makeBoard(1, 1, [seed("p1", 0, 0)]);
    expect(hasAnyPossibleHexMove(board, "p1")).toBe(false);
    expect(findPlayableHexShapes(board, "p1", true)).toEqual([]);
  });
});

describe("packHexShapesGreedy", () => {
  it("tiles a single cell with one 1-hex figure", () => {
    const region = [{ x: 5, y: 5 }];
    const placements = packHexShapesGreedy(region);
    expect(placements).toHaveLength(1);
    expect(placements[0]).toEqual([{ x: 5, y: 5 }]);
  });

  it("tiles an exact 3-hex triangle region with a single figure, not three singles", () => {
    const region = hexShapeToOffsetCells(hexShapeCells(4, 0), 5, 5);
    const placements = packHexShapesGreedy(region);
    expect(placements).toHaveLength(1);
    expect(placements[0]).toHaveLength(3);
    expect(new Set(placements[0].map(cellKey))).toEqual(new Set(region.map(cellKey)));
  });

  it("tiles an exact 3-hex line region with a single figure", () => {
    const region = hexShapeToOffsetCells(hexShapeCells(3, 0), 8, 8);
    const placements = packHexShapesGreedy(region);
    expect(placements).toHaveLength(1);
    expect(placements[0]).toHaveLength(3);
    expect(new Set(placements[0].map(cellKey))).toEqual(new Set(region.map(cellKey)));
  });

  it("covers a 7-cell flower (center + all 6 neighbors) completely, with no overlaps", () => {
    const center = { x: 6, y: 6 };
    const region = [center, ...hexNeighbors(center.x, center.y)];
    const placements = packHexShapesGreedy(region);
    const coveredKeys = placements.flat().map(cellKey);
    expect(new Set(coveredKeys).size).toBe(7);
    expect(coveredKeys.sort()).toEqual(region.map(cellKey).sort());
  });

  it("never places overlapping cells or cells outside the given region", () => {
    const center = { x: 3, y: 3 };
    const region = [center, ...hexNeighbors(center.x, center.y)];
    const regionKeys = new Set(region.map(cellKey));
    const placements = packHexShapesGreedy(region);
    const seen = new Set();
    for (const piece of placements) {
      for (const c of piece) {
        const key = cellKey(c);
        expect(regionKeys.has(key)).toBe(true);
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
    }
  });
});
