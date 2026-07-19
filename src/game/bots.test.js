import { describe, it, expect } from "vitest";
import {
  scorePlacement,
  chooseDiceBotMove,
  chooseTetrominoBotMove,
  chooseDominoBotMove,
  chooseHexBotMove,
  shouldBankDominoOnSkip,
} from "./bots";
import { enumerateValidPlacements, rectCells } from "./rules";
import { hexShapeCells } from "./hex";

function makeBoard(cols, rows, pieces = []) {
  return { cols, rows, pieces };
}

function seed(playerId, x, y) {
  return { id: `seed-${playerId}`, playerId, cells: [{ x, y }] };
}

function key(cells) {
  return cells
    .map((c) => `${c.x},${c.y}`)
    .sort()
    .join("|");
}

describe("scorePlacement", () => {
  it("medium: rewards placements that keep more empty space reachable", () => {
    // 5-cell corridor with a wall (p2) at x=1: placing at x=0 is a dead end,
    // placing at x=2 opens into x=3,x=4.
    const board = makeBoard(5, 1, [{ id: "wall", playerId: "p2", cells: [{ x: 1, y: 0 }] }]);
    const deadEnd = [{ x: 0, y: 0 }];
    const open = [{ x: 2, y: 0 }];
    expect(scorePlacement(board, "p1", open, [], "medium")).toBeGreaterThan(
      scorePlacement(board, "p1", deadEnd, [], "medium")
    );
    expect(scorePlacement(board, "p1", deadEnd, [], "medium")).toBe(0);
    expect(scorePlacement(board, "p1", open, [], "medium")).toBe(2);
  });

  it("hard: matches the hand-computed own/opponent/blocking formula", () => {
    // 4-cell corridor, p2 seeded at x=3. Candidate A (x=0) never touches p2's
    // frontier; candidate B (x=2) sits right next to it.
    const board = makeBoard(4, 1, [seed("p2", 3, 0)]);
    const opponents = [{ id: "p2" }];
    const farFromOpponent = [{ x: 0, y: 0 }];
    const nextToOpponent = [{ x: 2, y: 0 }];

    // A: ownReachable=2 (x1,x2), bestOpponentReachable=2 (x1,x2 still open from x3), blocking=0
    expect(scorePlacement(board, "p1", farFromOpponent, opponents, "hard")).toBeCloseTo(2 - 2);
    // B: ownReachable=2 (x0,x1), bestOpponentReachable=0 (p2 now boxed in by p1 at x2), blocking=1 (adjacent to p2's x3)
    expect(scorePlacement(board, "p1", nextToOpponent, opponents, "hard")).toBeCloseTo(2 + 0.5);

    // medium doesn't see the difference (both candidates leave 2 reachable own cells)...
    expect(scorePlacement(board, "p1", farFromOpponent, opponents, "medium")).toBe(
      scorePlacement(board, "p1", nextToOpponent, opponents, "medium")
    );
    // ...but hard clearly prefers the blocking placement.
    expect(scorePlacement(board, "p1", nextToOpponent, opponents, "hard")).toBeGreaterThan(
      scorePlacement(board, "p1", farFromOpponent, opponents, "hard")
    );
  });
});

describe("chooseDiceBotMove", () => {
  it("easy always returns a member of the enumerated candidate set, and varies across runs", () => {
    const board = makeBoard(9, 9, [seed("p1", 4, 4)]);
    const shape = rectCells(0, 0, 1, 1);
    const validKeys = new Set(enumerateValidPlacements(board, "p1", shape).map(key));

    const seen = new Set();
    for (let i = 0; i < 40; i++) {
      const move = chooseDiceBotMove(board, "p1", [1, 1], true, "easy", []);
      expect(move).not.toBeNull();
      expect(validKeys.has(key(move))).toBe(true);
      seen.add(key(move));
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it("medium deterministically avoids the dead-end placement", () => {
    // 5-cell corridor with a wall at x=1: x=0 is a dead end (0 reachable
    // cells after placing there), x=2/3/4 all keep the corridor open (2
    // reachable cells each) — medium must never pick the dead end.
    const board = makeBoard(5, 1, [{ id: "wall", playerId: "p2", cells: [{ x: 1, y: 0 }] }]);
    for (let i = 0; i < 20; i++) {
      const move = chooseDiceBotMove(board, "p1", [1, 1], true, "medium", []);
      expect(move).not.toEqual([{ x: 0, y: 0 }]);
    }
  });

  it("respects allowRotation: a 1x3 rectangle only fits vertically in a 1-wide corridor", () => {
    const board = makeBoard(1, 4, [seed("p1", 0, 0)]);
    expect(chooseDiceBotMove(board, "p1", [1, 3], true, "easy", [])).not.toBeNull();
    expect(chooseDiceBotMove(board, "p1", [3, 1], false, "easy", [])).toBeNull();
  });

  it("returns null when nothing is placeable", () => {
    const board = makeBoard(1, 1, [seed("p1", 0, 0)]);
    expect(chooseDiceBotMove(board, "p1", [2, 2], true, "hard", [])).toBeNull();
  });
});

describe("chooseTetrominoBotMove", () => {
  it("returns a valid placement for an O piece and null when boxed in", () => {
    const board = makeBoard(8, 8, [seed("p1", 4, 4)]);
    const move = chooseTetrominoBotMove(board, "p1", "O", true, "medium", []);
    expect(move).not.toBeNull();
    expect(move).toHaveLength(4);

    const tinyBoard = makeBoard(1, 1, [seed("p1", 0, 0)]);
    expect(chooseTetrominoBotMove(tinyBoard, "p1", "O", true, "easy", [])).toBeNull();
  });
});

describe("chooseDominoBotMove", () => {
  it("returns a valid 2-cell placement, and null when boxed in", () => {
    const board = makeBoard(8, 8, [seed("p1", 4, 4)]);
    const move = chooseDominoBotMove(board, "p1", [3, 5], true, "hard", []);
    expect(move).not.toBeNull();
    expect(move).toHaveLength(2);

    const tinyBoard = makeBoard(1, 1, [seed("p1", 0, 0)]);
    expect(chooseDominoBotMove(tinyBoard, "p1", [3, 5], true, "easy", [])).toBeNull();
  });
});

describe("chooseHexBotMove", () => {
  it("returns a valid placement matching the shape's cell count, and null when boxed in", () => {
    const board = makeBoard(8, 8, [seed("p1", 4, 4)]);
    const move = chooseHexBotMove(board, "p1", 3, true, "medium", []);
    expect(move).not.toBeNull();
    expect(move).toHaveLength(hexShapeCells(3, 0).length);

    const tinyBoard = makeBoard(1, 1, [seed("p1", 0, 0)]);
    expect(chooseHexBotMove(tinyBoard, "p1", 3, true, "easy", [])).toBeNull();
  });
});

describe("shouldBankDominoOnSkip", () => {
  it.each([
    ["easy", 0, 4, false],
    ["medium", 0, 4, false],
    ["hard", 0, 4, true],
    ["hard", 4, 4, false],
    ["hard", 3, 4, true],
  ])("difficulty=%s storageCount=%i storageLimit=%i -> %s", (difficulty, storageCount, storageLimit, expected) => {
    expect(shouldBankDominoOnSkip(difficulty, storageCount, storageLimit)).toBe(expected);
  });
});
