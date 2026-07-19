import { describe, it, expect } from "vitest";
import {
  dominoCells,
  dominoOrientationCount,
  validDominoPlacement,
  enumerateValidDominoPlacements,
  isDominoPlayable,
  hasAnyPossibleDominoMove,
  findPlayableDominoValues,
  dominoContactInfo,
} from "./domino";

function makeBoard(cols, rows, pieces = []) {
  return { cols, rows, pieces };
}

function seed(playerId, x, y) {
  return { id: `seed-${playerId}`, playerId, cells: [{ x, y }] };
}

function domino(id, playerId, cells) {
  return { id, playerId, cells };
}

describe("dominoCells", () => {
  it("gives a non-double 4 distinct orientation states", () => {
    expect(dominoOrientationCount([4, 6])).toBe(4);
    const states = [0, 1, 2, 3].map((i) => dominoCells([4, 6], i));
    expect(states[0]).toEqual([
      { x: 0, y: 0, value: 4 },
      { x: 1, y: 0, value: 6 },
    ]);
    expect(states[1]).toEqual([
      { x: 0, y: 0, value: 6 },
      { x: 1, y: 0, value: 4 },
    ]);
    expect(states[2]).toEqual([
      { x: 0, y: 0, value: 4 },
      { x: 0, y: 1, value: 6 },
    ]);
    expect(states[3]).toEqual([
      { x: 0, y: 0, value: 6 },
      { x: 0, y: 1, value: 4 },
    ]);
  });

  it("gives a double only 2 orientation states (horizontal / vertical)", () => {
    expect(dominoOrientationCount([5, 5])).toBe(2);
    expect(dominoCells([5, 5], 0)).toEqual([
      { x: 0, y: 0, value: 5 },
      { x: 1, y: 0, value: 5 },
    ]);
    expect(dominoCells([5, 5], 1)).toEqual([
      { x: 0, y: 0, value: 5 },
      { x: 0, y: 1, value: 5 },
    ]);
  });

  it("wraps orientation indices", () => {
    expect(dominoCells([4, 6], 4)).toEqual(dominoCells([4, 6], 0));
    expect(dominoCells([4, 6], -1)).toEqual(dominoCells([4, 6], 3));
  });
});

describe("validDominoPlacement — first move exception", () => {
  it("allows a player's first domino to touch only their seed, with no number to match yet", () => {
    const board = makeBoard(10, 10, [seed("p1", 0, 0), seed("p2", 9, 9)]);
    const cells = [
      { x: 1, y: 0, value: 3 },
      { x: 1, y: 1, value: 2 },
    ];
    expect(validDominoPlacement(board, "p1", cells)).toBe(true);
  });

  it("rejects a first domino that doesn't touch the player's seed", () => {
    const board = makeBoard(10, 10, [seed("p1", 0, 0), seed("p2", 9, 9)]);
    const cells = [
      { x: 5, y: 5, value: 3 },
      { x: 5, y: 6, value: 2 },
    ];
    expect(validDominoPlacement(board, "p1", cells)).toBe(false);
  });
});

describe("validDominoPlacement — after the first domino", () => {
  const board = makeBoard(10, 10, [
    seed("p1", 0, 0),
    seed("p2", 9, 9),
    domino("d1", "p1", [
      { x: 1, y: 0, value: 4 },
      { x: 2, y: 0, value: 5 },
    ]),
  ]);

  it("requires touching own territory AND a matching number", () => {
    // Touches own territory (adjacent to the p1 domino) and matches the "5" half.
    const cells = [
      { x: 3, y: 0, value: 5 },
      { x: 3, y: 1, value: 1 },
    ];
    expect(validDominoPlacement(board, "p1", cells)).toBe(true);
  });

  it("rejects touching own territory without any matching number", () => {
    const cells = [
      { x: 3, y: 0, value: 2 },
      { x: 3, y: 1, value: 6 },
    ];
    expect(validDominoPlacement(board, "p1", cells)).toBe(false);
  });

  it("allows matching a number via an opponent's domino, as long as it also touches own territory", () => {
    const boardWithOpponent = makeBoard(10, 10, [
      seed("p1", 0, 0),
      seed("p2", 9, 9),
      domino("d1", "p1", [
        { x: 1, y: 0, value: 4 },
        { x: 2, y: 0, value: 5 },
      ]),
      domino("d2", "p2", [
        { x: 3, y: 2, value: 6 },
        { x: 4, y: 2, value: 1 },
      ]),
    ]);
    // (2,1) touches p1's own (2,0) for own-territory; (3,1) touches p2's (3,2)=6 for the number match.
    const cells = [
      { x: 2, y: 1, value: 2 },
      { x: 3, y: 1, value: 6 },
    ];
    expect(validDominoPlacement(boardWithOpponent, "p1", cells)).toBe(true);
  });

  it("rejects touching a matching number on a cell that isn't adjacent to own territory", () => {
    const boardFar = makeBoard(10, 10, [
      seed("p1", 0, 0),
      seed("p2", 9, 9),
      domino("d1", "p1", [
        { x: 1, y: 0, value: 4 },
        { x: 2, y: 0, value: 5 },
      ]),
      domino("d2", "p2", [
        { x: 8, y: 8, value: 6 },
        { x: 8, y: 9, value: 1 },
      ]),
    ]);
    const cells = [
      { x: 7, y: 8, value: 6 },
      { x: 7, y: 7, value: 2 },
    ];
    expect(validDominoPlacement(boardFar, "p1", cells)).toBe(false);
  });
});

describe("enumerateValidDominoPlacements / isDominoPlayable", () => {
  it("finds placements respecting board bounds and existing pieces", () => {
    const board = makeBoard(3, 3, [seed("p1", 0, 0)]);
    const results = enumerateValidDominoPlacements(board, "p1", dominoCells([1, 2], 0));
    expect(results.length).toBeGreaterThan(0);
    for (const cells of results) {
      expect(cells.every((c) => c.x >= 0 && c.x < 3 && c.y >= 0 && c.y < 3)).toBe(true);
    }
  });

  it("isDominoPlayable respects allowRotation", () => {
    // A 1x3 corridor: only a vertical domino fits next to the seed at (0,0).
    const board = makeBoard(1, 3, [seed("p1", 0, 0)]);
    expect(isDominoPlayable(board, "p1", [3, 3], true)).toBe(true);
    // Orientation 0 (horizontal) doesn't fit in a 1-wide board.
    expect(isDominoPlayable(board, "p1", [3, 3], false)).toBe(false);
  });
});

describe("hasAnyPossibleDominoMove / findPlayableDominoValues", () => {
  it("is true on an empty board (first move never needs a number match)", () => {
    const board = makeBoard(6, 6, [seed("p1", 0, 0)]);
    expect(hasAnyPossibleDominoMove(board, "p1")).toBe(true);
    expect(findPlayableDominoValues(board, "p1").length).toBeGreaterThan(0);
  });

  it("is false once the player is fully boxed in", () => {
    // p1's seed at (0,0) on a 1x1 board — no room for any 2-cell domino.
    const board = makeBoard(1, 1, [seed("p1", 0, 0)]);
    expect(hasAnyPossibleDominoMove(board, "p1")).toBe(false);
    expect(findPlayableDominoValues(board, "p1")).toEqual([]);
  });
});

describe("dominoContactInfo", () => {
  it("reports the matching-number pair and the own-territory contact pair", () => {
    const board = makeBoard(10, 10, [
      seed("p1", 0, 0),
      domino("d1", "p1", [
        { x: 1, y: 0, value: 4 },
        { x: 2, y: 0, value: 5 },
      ]),
    ]);
    const candidate = [
      { x: 3, y: 0, value: 5 },
      { x: 3, y: 1, value: 1 },
    ];
    const { numberMatches, ownContacts } = dominoContactInfo(board, "p1", candidate);
    expect(numberMatches).toHaveLength(1);
    expect(numberMatches[0].from).toEqual(candidate[0]);
    expect(numberMatches[0].to).toEqual({ x: 2, y: 0 });
    expect(ownContacts).toHaveLength(1);
    expect(ownContacts[0].to).toEqual({ x: 2, y: 0 });
  });
});
