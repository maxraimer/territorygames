import { describe, it, expect } from "vitest";
import {
  rectCells,
  isInsideBoard,
  overlapsBoard,
  isAdjacentToOwn,
  validPlacement,
  enumerateValidPlacements,
  hasAnyValidPlacementForShapes,
  findPlayableShapes,
  hasAnyValidPlacement,
  hasAnyPossibleMove,
  isGameOver,
  findPlayableDiceSizes,
  cornerSeedPosition,
  playerArea,
  reachableEmptyCellCount,
  maxPossibleArea,
  isOutcomeDecided,
  hasMajorityShare,
} from "./rules";

function makeBoard(cols, rows, rectPieces = []) {
  return {
    cols,
    rows,
    pieces: rectPieces.map((p) => ({ id: p.id, playerId: p.playerId, cells: rectCells(p.x, p.y, p.w, p.h) })),
  };
}

describe("isInsideBoard", () => {
  it("accepts a shape fully within bounds", () => {
    expect(isInsideBoard(makeBoard(10, 8), rectCells(0, 0, 3, 2))).toBe(true);
  });

  it("rejects a shape that overflows the right/bottom edge", () => {
    expect(isInsideBoard(makeBoard(10, 8), rectCells(8, 0, 3, 2))).toBe(false);
    expect(isInsideBoard(makeBoard(10, 8), rectCells(0, 7, 2, 3))).toBe(false);
  });

  it("rejects negative coordinates", () => {
    expect(isInsideBoard(makeBoard(10, 8), rectCells(-1, 0, 2, 2))).toBe(false);
  });
});

describe("overlapsBoard", () => {
  it("detects true overlap", () => {
    const board = makeBoard(10, 10, [{ id: "a", playerId: "p1", x: 0, y: 0, w: 3, h: 3 }]);
    expect(overlapsBoard(board, rectCells(2, 2, 3, 3))).toBe(true);
  });

  it("treats edge-touching shapes as non-overlapping", () => {
    const board = makeBoard(10, 10, [{ id: "a", playerId: "p1", x: 0, y: 0, w: 3, h: 3 }]);
    expect(overlapsBoard(board, rectCells(3, 0, 3, 3))).toBe(false);
  });

  it("treats corner-touching shapes as non-overlapping", () => {
    const board = makeBoard(10, 10, [{ id: "a", playerId: "p1", x: 0, y: 0, w: 3, h: 3 }]);
    expect(overlapsBoard(board, rectCells(3, 3, 3, 3))).toBe(false);
  });
});

describe("isAdjacentToOwn", () => {
  it("recognizes a shared vertical edge with overlap", () => {
    const board = makeBoard(10, 10, [{ id: "a", playerId: "p1", x: 0, y: 0, w: 3, h: 3 }]);
    expect(isAdjacentToOwn(board, "p1", rectCells(3, 1, 2, 2))).toBe(true);
  });

  it("recognizes a shared horizontal edge with overlap", () => {
    const board = makeBoard(10, 10, [{ id: "a", playerId: "p1", x: 0, y: 0, w: 3, h: 3 }]);
    expect(isAdjacentToOwn(board, "p1", rectCells(1, 3, 2, 2))).toBe(true);
  });

  it("rejects corner-only contact (diagonal touch)", () => {
    const board = makeBoard(10, 10, [{ id: "a", playerId: "p1", x: 0, y: 0, w: 3, h: 3 }]);
    expect(isAdjacentToOwn(board, "p1", rectCells(3, 3, 2, 2))).toBe(false);
  });

  it("rejects shapes that are not touching at all", () => {
    const board = makeBoard(10, 10, [{ id: "a", playerId: "p1", x: 0, y: 0, w: 2, h: 2 }]);
    expect(isAdjacentToOwn(board, "p1", rectCells(5, 5, 2, 2))).toBe(false);
  });

  it("is true when the player owns nothing yet (no anchor to require)", () => {
    const board = makeBoard(10, 10, []);
    expect(isAdjacentToOwn(board, "p1", rectCells(5, 5, 2, 2))).toBe(true);
  });
});

describe("validPlacement", () => {
  it("accepts a shape adjacent to the player's own piece, inside bounds, no overlap", () => {
    const board = makeBoard(10, 10, [{ id: "seed", playerId: "p1", x: 0, y: 0, w: 1, h: 1 }]);
    expect(validPlacement(board, "p1", rectCells(1, 0, 2, 3))).toBe(true);
  });

  it("rejects a shape that goes out of bounds", () => {
    const board = makeBoard(10, 10, [{ id: "seed", playerId: "p1", x: 0, y: 0, w: 1, h: 1 }]);
    expect(validPlacement(board, "p1", rectCells(8, 0, 5, 2))).toBe(false);
  });

  it("rejects a shape overlapping another player's piece", () => {
    const board = makeBoard(10, 10, [
      { id: "seed1", playerId: "p1", x: 0, y: 0, w: 1, h: 1 },
      { id: "seed2", playerId: "p2", x: 2, y: 0, w: 2, h: 2 },
    ]);
    expect(validPlacement(board, "p1", rectCells(1, 0, 2, 2))).toBe(false);
  });

  it("rejects a shape overlapping the player's own piece", () => {
    const board = makeBoard(10, 10, [{ id: "seed", playerId: "p1", x: 0, y: 0, w: 3, h: 3 }]);
    expect(validPlacement(board, "p1", rectCells(1, 1, 2, 2))).toBe(false);
  });

  it("rejects a shape not touching any of the player's own pieces", () => {
    const board = makeBoard(10, 10, [{ id: "seed", playerId: "p1", x: 0, y: 0, w: 1, h: 1 }]);
    expect(validPlacement(board, "p1", rectCells(5, 5, 2, 2))).toBe(false);
  });

  it("rejects a shape that only touches the player's own piece at a corner", () => {
    const board = makeBoard(10, 10, [{ id: "seed", playerId: "p1", x: 0, y: 0, w: 2, h: 2 }]);
    expect(validPlacement(board, "p1", rectCells(2, 2, 2, 2))).toBe(false);
  });

  it("accepts touching an opponent's piece as long as it's adjacent to own territory and does not overlap", () => {
    const board = makeBoard(10, 10, [
      { id: "seed1", playerId: "p1", x: 0, y: 0, w: 2, h: 2 },
      { id: "seed2", playerId: "p2", x: 4, y: 0, w: 2, h: 2 },
    ]);
    // p1 grows toward p2 but stops short of overlapping
    expect(validPlacement(board, "p1", rectCells(2, 0, 2, 2))).toBe(true);
  });

  it("rejects a non-rectangular shape (e.g. a tetromino) the same way as any other", () => {
    const board = makeBoard(4, 4, [{ id: "seed", playerId: "p1", x: 0, y: 0, w: 1, h: 1 }]);
    // An L-tromino-ish shape adjacent to the seed, no overlap.
    const shape = [
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ];
    expect(validPlacement(board, "p1", shape)).toBe(true);
  });
});

describe("enumerateValidPlacements / hasAnyValidPlacementForShapes / findPlayableShapes", () => {
  it("finds every legal top-left anchor for a given shape", () => {
    const board = makeBoard(4, 4, [{ id: "seed", playerId: "p1", x: 0, y: 0, w: 1, h: 1 }]);
    const placements = enumerateValidPlacements(board, "p1", rectCells(0, 0, 1, 2));
    // Adjacent to the 1x1 seed at (0,0): (1,0) horizontally, or (0,1) vertically.
    expect(placements).toEqual(
      expect.arrayContaining([
        [
          { x: 1, y: 0 },
          { x: 1, y: 1 },
        ],
        [
          { x: 0, y: 1 },
          { x: 0, y: 2 },
        ],
      ])
    );
    expect(placements.every((cells) => isInsideBoard(board, cells))).toBe(true);
  });

  it("reports no valid placement when the player is boxed in", () => {
    // p1's 1x1 seed at (1,1) is fully surrounded by other pieces.
    const board = makeBoard(3, 3, [
      { id: "seed", playerId: "p1", x: 1, y: 1, w: 1, h: 1 },
      { id: "n", playerId: "p2", x: 1, y: 0, w: 1, h: 1 },
      { id: "s", playerId: "p2", x: 1, y: 2, w: 1, h: 1 },
      { id: "e", playerId: "p2", x: 2, y: 1, w: 1, h: 1 },
      { id: "w", playerId: "p2", x: 0, y: 1, w: 1, h: 1 },
    ]);
    expect(hasAnyValidPlacementForShapes(board, "p1", [rectCells(0, 0, 1, 1)])).toBe(false);
    expect(hasAnyValidPlacementForShapes(board, "p1", [rectCells(0, 0, 2, 3), rectCells(0, 0, 3, 2)])).toBe(false);
  });

  it("considers multiple candidate shapes (e.g. both dice orientations)", () => {
    // Only a 1-wide gap is open next to the seed; the 3x1 (horizontal)
    // orientation can never fit but the 1x3 (vertical) orientation should.
    const board = makeBoard(3, 6, [
      { id: "seed", playerId: "p1", x: 1, y: 2, w: 1, h: 1 },
      { id: "block-w", playerId: "p2", x: 0, y: 0, w: 1, h: 6 },
      { id: "block-e", playerId: "p2", x: 2, y: 0, w: 1, h: 6 },
    ]);
    const horizontal = rectCells(0, 0, 3, 1);
    const vertical = rectCells(0, 0, 1, 3);
    expect(hasAnyValidPlacementForShapes(board, "p1", [horizontal, vertical])).toBe(true);
    expect(enumerateValidPlacements(board, "p1", horizontal)).toEqual([]);
    expect(enumerateValidPlacements(board, "p1", vertical).length).toBeGreaterThan(0);
    expect(findPlayableShapes(board, "p1", [horizontal, vertical])).toEqual([vertical]);
  });
});

describe("hasAnyValidPlacement (dice convenience wrapper)", () => {
  it("reports no valid placement when the player is boxed in", () => {
    const board = makeBoard(3, 3, [
      { id: "seed", playerId: "p1", x: 1, y: 1, w: 1, h: 1 },
      { id: "n", playerId: "p2", x: 1, y: 0, w: 1, h: 1 },
      { id: "s", playerId: "p2", x: 1, y: 2, w: 1, h: 1 },
      { id: "e", playerId: "p2", x: 2, y: 1, w: 1, h: 1 },
      { id: "w", playerId: "p2", x: 0, y: 1, w: 1, h: 1 },
    ]);
    expect(hasAnyValidPlacement(board, "p1", 1, 1)).toBe(false);
    expect(hasAnyValidPlacement(board, "p1", 2, 3)).toBe(false);
  });

  it("considers both dice orientations", () => {
    const board = makeBoard(3, 6, [
      { id: "seed", playerId: "p1", x: 1, y: 2, w: 1, h: 1 },
      { id: "block-w", playerId: "p2", x: 0, y: 0, w: 1, h: 6 },
      { id: "block-e", playerId: "p2", x: 2, y: 0, w: 1, h: 6 },
    ]);
    expect(hasAnyValidPlacement(board, "p1", 3, 1)).toBe(true);
  });
});

describe("cornerSeedPosition", () => {
  it("places 2 players on opposite corners", () => {
    expect(cornerSeedPosition(10, 8, 0, 2)).toEqual({ x: 0, y: 0 });
    expect(cornerSeedPosition(10, 8, 1, 2)).toEqual({ x: 9, y: 7 });
  });

  it("places 3 players on three distinct corners", () => {
    const positions = [0, 1, 2].map((i) => cornerSeedPosition(10, 8, i, 3));
    const unique = new Set(positions.map((p) => `${p.x},${p.y}`));
    expect(unique.size).toBe(3);
    for (const p of positions) {
      expect(p.x === 0 || p.x === 9).toBe(true);
      expect(p.y === 0 || p.y === 7).toBe(true);
    }
  });

  it("places 4 players on all four corners", () => {
    expect(cornerSeedPosition(10, 8, 0, 4)).toEqual({ x: 0, y: 0 });
    expect(cornerSeedPosition(10, 8, 1, 4)).toEqual({ x: 9, y: 0 });
    expect(cornerSeedPosition(10, 8, 2, 4)).toEqual({ x: 9, y: 7 });
    expect(cornerSeedPosition(10, 8, 3, 4)).toEqual({ x: 0, y: 7 });
  });
});

describe("hasAnyPossibleMove / isGameOver", () => {
  it("is true whenever a small enough rect could still fit", () => {
    const board = makeBoard(3, 3, [
      { id: "seed", playerId: "p1", x: 1, y: 1, w: 1, h: 1 },
      { id: "n", playerId: "p2", x: 1, y: 0, w: 1, h: 1 },
      { id: "s", playerId: "p2", x: 1, y: 2, w: 1, h: 1 },
      { id: "e", playerId: "p2", x: 2, y: 1, w: 1, h: 1 },
      // (0,1) left open — a 1x1 there would be adjacent to the seed.
    ]);
    expect(hasAnyPossibleMove(board, "p1")).toBe(true);
  });

  it("is false once a player is fully boxed in, regardless of roll size", () => {
    const board = makeBoard(3, 3, [
      { id: "seed", playerId: "p1", x: 1, y: 1, w: 1, h: 1 },
      { id: "n", playerId: "p2", x: 1, y: 0, w: 1, h: 1 },
      { id: "s", playerId: "p2", x: 1, y: 2, w: 1, h: 1 },
      { id: "e", playerId: "p2", x: 2, y: 1, w: 1, h: 1 },
      { id: "w", playerId: "p2", x: 0, y: 1, w: 1, h: 1 },
    ]);
    expect(hasAnyPossibleMove(board, "p1")).toBe(false);
  });

  it("isGameOver is false while at least one player can still move", () => {
    const board = makeBoard(3, 3, [
      { id: "seed1", playerId: "p1", x: 1, y: 1, w: 1, h: 1 },
      { id: "n", playerId: "p2", x: 1, y: 0, w: 1, h: 1 },
      { id: "s", playerId: "p2", x: 1, y: 2, w: 1, h: 1 },
      { id: "e", playerId: "p2", x: 2, y: 1, w: 1, h: 1 },
      { id: "w", playerId: "p2", x: 0, y: 1, w: 1, h: 1 },
    ]);
    const players = [{ id: "p1" }, { id: "p2" }];
    // p1 is boxed in, but p2 still has the rest of the board open.
    expect(isGameOver(board, players)).toBe(false);
  });

  it("isGameOver is true once every player is boxed in", () => {
    // A tightly packed 2x2 board: both players fully surrounded.
    const board = makeBoard(2, 2, [
      { id: "seed1", playerId: "p1", x: 0, y: 0, w: 1, h: 1 },
      { id: "seed2", playerId: "p2", x: 1, y: 1, w: 1, h: 1 },
      { id: "fill1", playerId: "p1", x: 1, y: 0, w: 1, h: 1 },
      { id: "fill2", playerId: "p2", x: 0, y: 1, w: 1, h: 1 },
    ]);
    const players = [{ id: "p1" }, { id: "p2" }];
    expect(isGameOver(board, players)).toBe(true);
  });

  it("isGameOver accepts a custom hasMoveFn for other games (e.g. tetromino shapes)", () => {
    const board = makeBoard(3, 3, [
      { id: "seed", playerId: "p1", x: 1, y: 1, w: 1, h: 1 },
      { id: "n", playerId: "p2", x: 1, y: 0, w: 1, h: 1 },
      { id: "s", playerId: "p2", x: 1, y: 2, w: 1, h: 1 },
      { id: "e", playerId: "p2", x: 2, y: 1, w: 1, h: 1 },
      { id: "w", playerId: "p2", x: 0, y: 1, w: 1, h: 1 },
    ]);
    const players = [{ id: "p1" }, { id: "p2" }];
    // Force everyone to look "unable to move" via a stub, regardless of the real board.
    expect(isGameOver(board, players, () => false)).toBe(true);
    expect(isGameOver(board, players, () => true)).toBe(false);
  });
});

describe("findPlayableDiceSizes", () => {
  it("lists every w×h pair the player could currently place", () => {
    const board = makeBoard(3, 3, [{ id: "seed", playerId: "p1", x: 1, y: 1, w: 1, h: 1 }]);
    const sizes = findPlayableDiceSizes(board, "p1");
    expect(sizes.length).toBeGreaterThan(0);
    expect(sizes).toEqual(expect.arrayContaining([[1, 1]]));
    // Every returned size must actually validate as placeable somewhere.
    for (const [w, h] of sizes) {
      expect(enumerateValidPlacements(board, "p1", rectCells(0, 0, w, h)).length).toBeGreaterThan(0);
    }
  });

  it("is empty once the player is fully boxed in", () => {
    const board = makeBoard(3, 3, [
      { id: "seed", playerId: "p1", x: 1, y: 1, w: 1, h: 1 },
      { id: "n", playerId: "p2", x: 1, y: 0, w: 1, h: 1 },
      { id: "s", playerId: "p2", x: 1, y: 2, w: 1, h: 1 },
      { id: "e", playerId: "p2", x: 2, y: 1, w: 1, h: 1 },
      { id: "w", playerId: "p2", x: 0, y: 1, w: 1, h: 1 },
    ]);
    expect(findPlayableDiceSizes(board, "p1")).toEqual([]);
  });
});

describe("playerArea", () => {
  it("sums the area of only that player's pieces", () => {
    const board = makeBoard(10, 10, [
      { id: "a1", playerId: "p1", x: 0, y: 0, w: 2, h: 3 },
      { id: "a2", playerId: "p1", x: 2, y: 0, w: 1, h: 1 },
      { id: "b1", playerId: "p2", x: 5, y: 5, w: 4, h: 4 },
    ]);
    expect(playerArea(board, "p1")).toBe(7);
    expect(playerArea(board, "p2")).toBe(16);
  });
});

describe("reachableEmptyCellCount / maxPossibleArea / isOutcomeDecided", () => {
  it("is not decided on a fresh, wide-open board", () => {
    const board = makeBoard(6, 6, [
      { id: "seed1", playerId: "p1", x: 0, y: 0, w: 1, h: 1 },
      { id: "seed2", playerId: "p2", x: 5, y: 5, w: 1, h: 1 },
    ]);
    const players = [{ id: "p1" }, { id: "p2" }];
    expect(isOutcomeDecided(board, players)).toBe(false);
  });

  it("decides the outcome once a trailing player can no longer catch up even with every reachable cell", () => {
    // 4x4 board. p1 holds the top two rows plus one extra cell (9 total).
    // p2 holds a single cornered cell; the only empty region left (6 cells)
    // is reachable by both, so p2's ceiling is 1+6=7 < p1's current 9.
    const board = makeBoard(4, 4, [
      { id: "a-top", playerId: "p1", x: 0, y: 0, w: 4, h: 2 },
      { id: "a-extra", playerId: "p1", x: 0, y: 2, w: 1, h: 1 },
      { id: "b-seed", playerId: "p2", x: 3, y: 3, w: 1, h: 1 },
    ]);
    const players = [{ id: "p1" }, { id: "p2" }];

    expect(playerArea(board, "p1")).toBe(9);
    expect(reachableEmptyCellCount(board, "p2")).toBe(6);
    expect(maxPossibleArea(board, "p2")).toBe(7);
    expect(isOutcomeDecided(board, players)).toBe(true);
  });

  it("stays undecided while a tie for the lead is still reachable", () => {
    // Both players could still end up with the same total, so nobody is
    // mathematically eliminated yet.
    const board = makeBoard(4, 4, [
      { id: "a-top", playerId: "p1", x: 0, y: 0, w: 4, h: 2 },
      { id: "b-bottom", playerId: "p2", x: 0, y: 3, w: 4, h: 1 },
    ]);
    const players = [{ id: "p1" }, { id: "p2" }];
    // p2 (area 4) can still reach row 2 (4 empty cells) to tie p1's 8.
    expect(maxPossibleArea(board, "p2")).toBe(8);
    expect(isOutcomeDecided(board, players)).toBe(false);
  });
});

describe("hasMajorityShare", () => {
  it("is false when nobody exceeds an equal T/P share", () => {
    // 4x4 = 16 cells, 2 players -> threshold 8. 7 each, nobody over.
    const board2 = makeBoard(4, 4, [
      { id: "a", playerId: "p1", x: 0, y: 0, w: 4, h: 1 },
      { id: "a2", playerId: "p1", x: 0, y: 1, w: 3, h: 1 },
      { id: "b", playerId: "p2", x: 0, y: 2, w: 4, h: 1 },
      { id: "b2", playerId: "p2", x: 0, y: 3, w: 3, h: 1 },
    ]);
    const players = [{ id: "p1" }, { id: "p2" }];
    expect(playerArea(board2, "p1")).toBe(7);
    expect(playerArea(board2, "p2")).toBe(7);
    expect(hasMajorityShare(board2, players)).toBe(false);
  });

  it("is true once a player strictly exceeds T/P", () => {
    // 4x4 = 16 cells, 2 players -> threshold 8. p1 has 9.
    const board = makeBoard(4, 4, [
      { id: "a", playerId: "p1", x: 0, y: 0, w: 4, h: 2 },
      { id: "a2", playerId: "p1", x: 0, y: 2, w: 1, h: 1 },
      { id: "b", playerId: "p2", x: 3, y: 3, w: 1, h: 1 },
    ]);
    const players = [{ id: "p1" }, { id: "p2" }];
    expect(playerArea(board, "p1")).toBe(9);
    expect(hasMajorityShare(board, players)).toBe(true);
  });

  it("scales the threshold down as player count grows", () => {
    // 4x4 = 16 cells, 4 players -> threshold 4. p1 has exactly 5, over it.
    const board2 = makeBoard(4, 4, [
      { id: "a", playerId: "p1", x: 0, y: 0, w: 4, h: 1 },
      { id: "a2", playerId: "p1", x: 0, y: 1, w: 1, h: 1 },
    ]);
    const players = [{ id: "p1" }, { id: "p2" }, { id: "p3" }, { id: "p4" }];
    expect(playerArea(board2, "p1")).toBe(5);
    expect(hasMajorityShare(board2, players)).toBe(true);
  });

  it("computes the threshold against an explicit claimableTotal instead of cols*rows", () => {
    // 4x4 board but only 10 cells are actually claimable (e.g. terrain takes
    // the rest) -> threshold 5 for 2 players. p1 has 6, over the real
    // threshold, even though 6 wouldn't clear the full-board threshold of 8.
    const board = makeBoard(4, 4, [
      { id: "a", playerId: "p1", x: 0, y: 0, w: 3, h: 2 },
    ]);
    const players = [{ id: "p1" }, { id: "p2" }];
    expect(playerArea(board, "p1")).toBe(6);
    expect(hasMajorityShare(board, players)).toBe(false); // default 16-cell denominator
    expect(hasMajorityShare(board, players, 10)).toBe(true); // explicit claimable-land denominator
  });
});
