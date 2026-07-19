import { describe, it, expect } from "vitest";
import { traceOutline, isConvexCorner, roundedPolyominoPath } from "./outline";
import { PIECE_TYPES, pieceRotations } from "./tetromino";
import { rectCells } from "./rules";

function countConvex(corners) {
  return corners.filter((_, i) => isConvexCorner(corners, i)).length;
}

describe("traceOutline", () => {
  it("traces a single cell as 4 corners", () => {
    const corners = traceOutline([{ x: 0, y: 0 }]);
    expect(corners).toHaveLength(4);
    expect(countConvex(corners)).toBe(4); // a square has no concave corners
  });

  it("collapses a straight run into just its 4 real corners (no redundant midpoints)", () => {
    // 4x1 rectangle (like a horizontal I-tetromino)
    const corners = traceOutline(rectCells(0, 0, 4, 1));
    expect(corners).toHaveLength(4);
    expect(countConvex(corners)).toBe(4);
  });

  it("traces a 3x2 rectangle as 4 corners", () => {
    const corners = traceOutline(rectCells(0, 0, 3, 2));
    expect(corners).toHaveLength(4);
    expect(countConvex(corners)).toBe(4);
  });

  it("finds exactly one concave corner in an L-tromino's inner notch", () => {
    // Cells: (0,0), (1,0), (0,1) — an L-shaped tromino with one inward notch.
    const corners = traceOutline([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ]);
    expect(corners).toHaveLength(6);
    expect(countConvex(corners)).toBe(5);
    expect(corners.length - countConvex(corners)).toBe(1);
  });

  it("finds exactly two concave corners in a T-tetromino", () => {
    // T pointing down: (1,0),(0,1),(1,1),(2,1)
    const corners = traceOutline([
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ]);
    expect(corners.length - countConvex(corners)).toBe(2);
  });

  it("returns an empty outline for no cells", () => {
    expect(traceOutline([])).toEqual([]);
  });
});

describe("roundedPolyominoPath", () => {
  it("produces a closed path (M...Z) for a simple rectangle", () => {
    const d = roundedPolyominoPath(rectCells(0, 0, 3, 2), 44, 8);
    expect(d.startsWith("M ")).toBe(true);
    expect(d.trim().endsWith("Z")).toBe(true);
    // 4 corners -> 4 arc commands
    expect((d.match(/A /g) ?? []).length).toBe(4);
  });

  it("produces one arc per outline corner for every tetromino rotation", () => {
    for (const type of PIECE_TYPES) {
      for (const cells of pieceRotations(type)) {
        const d = roundedPolyominoPath(cells, 44, 8);
        const corners = traceOutline(cells);
        expect((d.match(/A /g) ?? []).length).toBe(corners.length);
        expect(d.trim().endsWith("Z")).toBe(true);
      }
    }
  });

  it("returns an empty string when there's nothing to trace", () => {
    expect(roundedPolyominoPath([], 44, 8)).toBe("");
  });
});
