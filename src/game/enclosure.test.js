import { describe, it, expect } from "vitest";
import { findEnclosedRegions } from "./enclosure";
import { rectCells } from "./rules";
import { hexNeighbors } from "./hex";

function makeBoard(cols, rows, rectPieces = []) {
  return {
    cols,
    rows,
    pieces: rectPieces.map((p) => ({ id: p.id, playerId: p.playerId, cells: rectCells(p.x, p.y, p.w, p.h) })),
  };
}

describe("findEnclosedRegions", () => {
  it("finds no regions on an empty board", () => {
    expect(findEnclosedRegions(makeBoard(6, 6))).toEqual([]);
  });

  it("finds a 1-cell hole fully surrounded by one player's ring", () => {
    // A 3x3 ring of p1 around the single empty center cell (1,1).
    const board = makeBoard(3, 3, [
      { id: "a", playerId: "p1", x: 0, y: 0, w: 3, h: 1 },
      { id: "b", playerId: "p1", x: 0, y: 1, w: 1, h: 1 },
      { id: "c", playerId: "p1", x: 2, y: 1, w: 1, h: 1 },
      { id: "d", playerId: "p1", x: 0, y: 2, w: 3, h: 1 },
    ]);
    const regions = findEnclosedRegions(board);
    expect(regions).toHaveLength(1);
    expect(regions[0].playerId).toBe("p1");
    expect(regions[0].cells).toEqual([{ x: 1, y: 1 }]);
  });

  it("does not count a region touching two different players' territory", () => {
    const board = makeBoard(3, 3, [
      { id: "a", playerId: "p1", x: 0, y: 0, w: 3, h: 1 },
      { id: "b", playerId: "p1", x: 0, y: 1, w: 1, h: 1 },
      { id: "c", playerId: "p2", x: 2, y: 1, w: 1, h: 1 }, // different owner on this side
      { id: "d", playerId: "p1", x: 0, y: 2, w: 3, h: 1 },
    ]);
    expect(findEnclosedRegions(board)).toEqual([]);
  });

  it("does not count a wide-open board even if only one player has placed anything yet", () => {
    // p1 occupies only the top row; the rest of the board is one big open
    // region — every real game already seeds every player's corner, so
    // this stays multi-owner (and thus unclaimed) from turn one in
    // practice. A lone p2 seed here reproduces that.
    const board = makeBoard(5, 5, [
      { id: "a", playerId: "p1", x: 0, y: 0, w: 5, h: 1 },
      { id: "seed2", playerId: "p2", x: 4, y: 4, w: 1, h: 1 },
    ]);
    expect(findEnclosedRegions(board)).toEqual([]);
  });

  it("finds a multi-cell pocket and includes every cell in it", () => {
    // A 2x2 empty pocket at (2,2)-(3,3), walled off on all 4 orthogonal
    // sides by p1. A lone p2 cell elsewhere disqualifies the (otherwise
    // edge-touching, p1-only-bordered) outer region from also counting.
    const board = makeBoard(6, 6, [
      { id: "top", playerId: "p1", x: 2, y: 1, w: 2, h: 1 }, // (2,1) (3,1)
      { id: "bottom", playerId: "p1", x: 2, y: 4, w: 2, h: 1 }, // (2,4) (3,4)
      { id: "left", playerId: "p1", x: 1, y: 2, w: 1, h: 2 }, // (1,2) (1,3)
      { id: "right", playerId: "p1", x: 4, y: 2, w: 1, h: 2 }, // (4,2) (4,3)
      { id: "marker", playerId: "p2", x: 0, y: 0, w: 1, h: 1 },
    ]);
    const regions = findEnclosedRegions(board);
    expect(regions).toHaveLength(1);
    expect(regions[0].playerId).toBe("p1");
    const keys = regions[0].cells.map((c) => `${c.x},${c.y}`).sort();
    expect(keys).toEqual(["2,2", "2,3", "3,2", "3,3"]);
  });

  it("treats an ignored owner (e.g. Routeritory's terrain sentinels) as a neutral border, not a second owner", () => {
    // Same 3x3 ring as the first test, but one ring cell (directly bordering
    // the empty center) belongs to a sentinel "terrain" owner instead of p1.
    // Without ignoredOwnerIds this disqualifies the region (2 distinct
    // border owners); with it listed, the terrain cell doesn't count
    // against the single real owner.
    const board = makeBoard(3, 3, [
      { id: "a", playerId: "p1", x: 0, y: 0, w: 3, h: 1 },
      { id: "b", playerId: "p1", x: 0, y: 1, w: 1, h: 1 },
      { id: "c", playerId: "__mountain__", x: 2, y: 1, w: 1, h: 1 },
      { id: "d", playerId: "p1", x: 0, y: 2, w: 3, h: 1 },
    ]);
    expect(findEnclosedRegions(board, undefined, new Set(["__mountain__"]))).toEqual([
      { playerId: "p1", cells: [{ x: 1, y: 1 }] },
    ]);
    // Without the ignore set, the mountain cell counts as a second "owner".
    expect(findEnclosedRegions(board)).toEqual([]);
  });

  it("accepts a neighborsFn override — a hex ring encloses its center under hexNeighbors", () => {
    const center = { x: 4, y: 4 };
    const ring = hexNeighbors(center.x, center.y);
    const board = {
      cols: 10,
      rows: 10,
      pieces: [
        ...ring.map((c, i) => ({ id: `ring-${i}`, playerId: "p1", cells: [c] })),
        // Disqualifies the rest of the board (also only p1-bordered so far)
        // from counting as "enclosed" too — every real game already seeds
        // every player's corner, so a lone open region can never be
        // single-owner in practice.
        { id: "marker", playerId: "p2", cells: [{ x: 0, y: 0 }] },
      ],
    };
    const regions = findEnclosedRegions(board, hexNeighbors);
    expect(regions).toHaveLength(1);
    expect(regions[0].playerId).toBe("p1");
    expect(regions[0].cells).toEqual([center]);
  });
});
