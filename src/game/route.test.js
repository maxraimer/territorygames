import { describe, it, expect } from "vitest";
import { squareNeighbors, reachableEmptyCellCount } from "./rules";
import {
  RIVER_OWNER,
  MOUNTAIN_OWNER,
  computeIslands,
  computeBridgeCandidates,
  generateRouteTerrain,
  createInitialRouteBoard,
  classifyIslands,
  seedRoutePlayers,
  isValidRouteClaim,
  enumerateValidRouteCells,
  hasAnyPossibleRouteMove,
  isBridgeJumpClaim,
  makeRouteNeighborsFn,
  relocateBridge,
  shouldRelocateBridges,
  reviveEligiblePlayers,
  nextRollStreak,
} from "./route";

function cellKey(c) {
  return `${c.x},${c.y}`;
}

function seed(playerId, x, y) {
  return { id: `seed-${playerId}`, playerId, cells: [{ x, y }] };
}

describe("computeIslands", () => {
  it("splits a board into 2 components across a single vertical wall", () => {
    const blocked = new Set([0, 1, 2, 3, 4].map((y) => cellKey({ x: 2, y })));
    const { sizes } = computeIslands(5, 5, blocked);
    expect(sizes.sort()).toEqual([10, 10]);
  });

  it("splits a board into exactly 3 components across two vertical walls", () => {
    const blocked = new Set();
    for (let y = 0; y < 3; y++) {
      blocked.add(cellKey({ x: 2, y }));
      blocked.add(cellKey({ x: 4, y }));
    }
    const { islandOf, sizes } = computeIslands(7, 3, blocked);
    expect(sizes.sort()).toEqual([3, 6, 6]);
    // cells on opposite sides of a wall must never share an island id
    expect(islandOf.get(cellKey({ x: 1, y: 1 }))).not.toBe(islandOf.get(cellKey({ x: 3, y: 1 })));
    expect(islandOf.get(cellKey({ x: 3, y: 1 }))).not.toBe(islandOf.get(cellKey({ x: 5, y: 1 })));
  });
});

describe("computeBridgeCandidates", () => {
  it("includes a river cell whose 2 land neighbors are on different islands", () => {
    const islandOf = new Map([
      [cellKey({ x: 1, y: 1 }), 0],
      [cellKey({ x: 3, y: 1 }), 1],
    ]);
    const river = { trunk: [{ x: 2, y: 1 }], branchA: [], branchB: [] };
    const result = computeBridgeCandidates(river, islandOf);
    expect(result.trunk).toHaveLength(1);
    expect(result.branchA).toHaveLength(0);
    expect(result.branchB).toHaveLength(0);
    const [candidate] = result.trunk;
    expect(new Set(candidate.banks.map(cellKey))).toEqual(
      new Set([cellKey({ x: 1, y: 1 }), cellKey({ x: 3, y: 1 })])
    );
  });

  it("excludes a river cell whose 2 land neighbors are on the SAME island", () => {
    const islandOf = new Map([
      [cellKey({ x: 1, y: 1 }), 0],
      [cellKey({ x: 3, y: 1 }), 0],
    ]);
    const river = { trunk: [{ x: 2, y: 1 }], branchA: [], branchB: [] };
    expect(computeBridgeCandidates(river, islandOf).trunk).toHaveLength(0);
  });

  it("finds a 2-cell (diagonal elbow) bridge span when neither cell alone touches 2 different islands", () => {
    // (2,0)'s land neighbors are all island 0; (2,1)'s land neighbors are all
    // island 1 — neither cell alone is a valid 1-cell crossing, but the pair
    // together spans both islands (the diagonal "elbow" case: the river is
    // 2 cells wide here, so a single-cell bridge can't reach across it).
    const islandOf = new Map([
      [cellKey({ x: 1, y: 0 }), 0],
      [cellKey({ x: 3, y: 0 }), 0],
      [cellKey({ x: 1, y: 1 }), 1],
      [cellKey({ x: 3, y: 1 }), 1],
      [cellKey({ x: 2, y: 2 }), 1],
    ]);
    const river = { trunk: [{ x: 2, y: 0 }, { x: 2, y: 1 }], branchA: [], branchB: [] };
    const result = computeBridgeCandidates(river, islandOf);
    const twoCellCandidates = result.trunk.filter((c) => c.cells.length === 2);
    expect(twoCellCandidates).toHaveLength(1);
    const [candidate] = twoCellCandidates;
    const spanKeys = new Set(candidate.cells.map(cellKey));
    expect(spanKeys).toEqual(new Set([cellKey({ x: 2, y: 0 }), cellKey({ x: 2, y: 1 })]));
    const bankIslands = new Set(candidate.banks.map((b) => b.islandId));
    expect(bankIslands).toEqual(new Set([0, 1]));
  });

  it("collects every land neighbor as a bank, not just one pair, on a river cell with 3+ land neighbors", () => {
    // (2,1) has 3 land neighbors: (1,1) and (2,0) on island 0, (3,1) on island 1.
    const islandOf = new Map([
      [cellKey({ x: 1, y: 1 }), 0],
      [cellKey({ x: 2, y: 0 }), 0],
      [cellKey({ x: 3, y: 1 }), 1],
    ]);
    const river = { trunk: [{ x: 2, y: 1 }], branchA: [], branchB: [] };
    const result = computeBridgeCandidates(river, islandOf);
    expect(result.trunk).toHaveLength(1);
    const [candidate] = result.trunk;
    const bankKeys = new Set(candidate.banks.map(cellKey));
    expect(bankKeys).toEqual(
      new Set([cellKey({ x: 3, y: 1 }), cellKey({ x: 1, y: 1 }), cellKey({ x: 2, y: 0 })])
    );
  });
});

describe("generateRouteTerrain", () => {
  it("always produces exactly 1 small + 2 large islands, terrain never on a corner, and one bridge per arm", () => {
    const cols = 20;
    const rows = 20;
    const corners = [
      { x: 0, y: 0 },
      { x: cols - 1, y: 0 },
      { x: cols - 1, y: rows - 1 },
      { x: 0, y: rows - 1 },
    ];
    let runsWithMountains = 0;
    for (let i = 0; i < 20; i++) {
      const terrain = generateRouteTerrain(cols, rows);
      const allTerrainCells = [...terrain.riverCells, ...terrain.mountainClusters.flat()];
      if (terrain.mountainClusters.length > 0) runsWithMountains++;

      for (const c of terrain.riverCells) {
        expect(corners.some((k) => k.x === c.x && k.y === c.y)).toBe(false);
      }

      const blocked = new Set(allTerrainCells.map(cellKey));
      const { sizes } = computeIslands(cols, rows, blocked);
      expect(sizes).toHaveLength(3);
      const totalLand = cols * rows - blocked.size;
      const [small, largeA, largeB] = [...sizes].sort((a, b) => a - b);
      expect(small).toBeGreaterThanOrEqual(totalLand * 0.06);
      expect(small).toBeLessThanOrEqual(totalLand * 0.25);
      expect(largeA).toBeGreaterThanOrEqual(totalLand * 0.3);
      expect(largeB).toBeGreaterThanOrEqual(totalLand * 0.3);

      expect(terrain.bridges).toHaveLength(3);
      expect(new Set(terrain.bridges.map((b) => b.arm))).toEqual(new Set(["trunk", "branchA", "branchB"]));

      expect(terrain.claimableTotal).toBe(cols * rows - blocked.size);

      expect(terrain.islands.largeIslandIds).toHaveLength(2);
      expect(terrain.islands.smallIslandId).not.toBe(terrain.islands.largeIslandIds[0]);
      expect(terrain.islands.smallIslandId).not.toBe(terrain.islands.largeIslandIds[1]);
    }
    // Mountains should reliably appear now that a bad cluster only forfeits
    // itself instead of the whole batch (see generateMountainClusters).
    expect(runsWithMountains).toBeGreaterThan(15);
  });

  it("the river cell set is always a single edge-connected blob, even with diagonal steps", () => {
    // A diagonal-only touch between two river cells would leave the river as
    // 2+ disconnected components under edge-only (squareNeighbors) adjacency
    // — this is exactly the "leak" the elbow-fill guard in walkUntil exists
    // to prevent (see the river generation comment in route.js).
    for (let i = 0; i < 20; i++) {
      const terrain = generateRouteTerrain(20, 20);
      const riverSet = new Set(terrain.riverCells.map(cellKey));
      const start = terrain.riverCells[0];
      const visited = new Set([cellKey(start)]);
      const queue = [start];
      while (queue.length) {
        const cell = queue.pop();
        for (const n of squareNeighbors(cell.x, cell.y)) {
          const key = cellKey(n);
          if (riverSet.has(key) && !visited.has(key)) {
            visited.add(key);
            queue.push(n);
          }
        }
      }
      expect(visited.size).toBe(riverSet.size);
    }
  });
});

describe("classifyIslands / seedRoutePlayers", () => {
  it("identifies the smallest island as neutral and the other two as the seedable large islands", () => {
    const islandOf = new Map();
    // island 0: 1 cell (small); island 1: 4 cells; island 2: 9 cells
    islandOf.set(cellKey({ x: 0, y: 0 }), 0);
    for (let i = 0; i < 4; i++) islandOf.set(cellKey({ x: i, y: 1 }), 1);
    for (let i = 0; i < 9; i++) islandOf.set(cellKey({ x: i, y: 2 }), 2);
    const sizes = [1, 4, 9];
    const classification = classifyIslands(islandOf, sizes);
    expect(classification.smallIslandId).toBe(0);
    expect(new Set(classification.largeIslandIds)).toEqual(new Set([1, 2]));
  });

  it("seeds 4 players 2-vs-2 across the two large islands, none on the small one", () => {
    const cols = 20;
    const rows = 20;
    const terrain = generateRouteTerrain(cols, rows);
    const players = [{ id: "p1" }, { id: "p2" }, { id: "p3" }, { id: "p4" }];
    const pieces = seedRoutePlayers(players, terrain.islands);
    expect(pieces).toHaveLength(4);

    const { islandOf } = computeIslands(
      cols,
      rows,
      new Set([...terrain.riverCells, ...terrain.mountainClusters.flat()].map(cellKey))
    );
    const islandOfPlayer = Object.fromEntries(
      pieces.map((p) => [p.playerId, islandOf.get(cellKey(p.cells[0]))])
    );
    expect(islandOfPlayer.p1).not.toBe(terrain.islands.smallIslandId);
    expect(islandOfPlayer.p1).toBe(islandOfPlayer.p3);
    expect(islandOfPlayer.p2).toBe(islandOfPlayer.p4);
    expect(islandOfPlayer.p1).not.toBe(islandOfPlayer.p2);
    // every seed cell must be distinct
    expect(new Set(pieces.map((p) => cellKey(p.cells[0]))).size).toBe(4);
  });

  it("createInitialRouteBoard produces a fully-seeded board with terrain merged in", () => {
    const players = [{ id: "p1" }, { id: "p2" }];
    const board = createInitialRouteBoard(20, 20, players);
    expect(board.pieces.filter((p) => p.playerId === "p1")).toHaveLength(1);
    expect(board.pieces.filter((p) => p.playerId === "p2")).toHaveLength(1);
    expect(board.pieces.some((p) => p.playerId === RIVER_OWNER)).toBe(true);
    expect(board.bridges).toHaveLength(3);
    expect(board.claimableTotal).toBeGreaterThan(0);
  });
});

describe("route claim validity", () => {
  function boardWithBridge({
    bridges = [
      {
        cells: [{ x: 2, y: 0 }],
        banks: [{ x: 1, y: 0, islandId: 0 }, { x: 3, y: 0, islandId: 1 }],
        arm: "trunk",
      },
    ],
    extraPieces = [],
  } = {}) {
    return {
      cols: 5,
      rows: 1,
      pieces: [
        seed("p1", 1, 0),
        { id: "river", playerId: RIVER_OWNER, cells: [{ x: 2, y: 0 }] },
        ...extraPieces,
      ],
      bridges,
    };
  }

  it("isBridgeJumpClaim finds the crossed bridge when the near bank is owned and the far bank is empty", () => {
    const board = boardWithBridge();
    expect(isBridgeJumpClaim(board, "p1", { x: 3, y: 0 })).not.toBeNull();
    expect(isBridgeJumpClaim(board, "p1", { x: 3, y: 0 }).arm).toBe("trunk");
  });

  it("isValidRouteClaim accepts an ordinary adjacent claim and a bridge-jump claim", () => {
    const board = boardWithBridge();
    expect(isValidRouteClaim(board, "p1", { x: 0, y: 0 })).toBe(true); // ordinary
    expect(isValidRouteClaim(board, "p1", { x: 3, y: 0 })).toBe(true); // bridge jump
    expect(isValidRouteClaim(board, "p1", { x: 4, y: 0 })).toBe(false); // unreachable
  });

  it("enumerateValidRouteCells unions ordinary and bridge-jump candidates", () => {
    const board = boardWithBridge();
    const cells = enumerateValidRouteCells(board, "p1");
    const keys = new Set(cells.map(cellKey));
    expect(keys).toEqual(new Set([cellKey({ x: 0, y: 0 }), cellKey({ x: 3, y: 0 })]));
  });

  it("hasAnyPossibleRouteMove is true via bridge access even when ordinary adjacency is fully blocked", () => {
    const board = boardWithBridge({ extraPieces: [{ id: "wall", playerId: MOUNTAIN_OWNER, cells: [{ x: 0, y: 0 }] }] });
    expect(hasAnyPossibleRouteMove(board, "p1")).toBe(true);
  });

  it("hasAnyPossibleRouteMove is false when truly boxed in with no bridge", () => {
    const board = { cols: 1, rows: 1, pieces: [seed("p1", 0, 0)], bridges: [] };
    expect(hasAnyPossibleRouteMove(board, "p1")).toBe(false);
  });

  it("a bridge never grants access to a bank cell someone already claimed", () => {
    const board = boardWithBridge({ extraPieces: [seed("p2", 3, 0)] });
    expect(isValidRouteClaim(board, "p1", { x: 3, y: 0 })).toBe(false);
  });

  it("any owned bank on one side can jump to any empty bank on the other side, not just one fixed pair", () => {
    // A river cell with 2 banks on island 0 ((1,0) and (2,1)) and 2 banks on
    // island 1 ((3,0) and (2,-1) — kept off-board-safe by using a taller
    // board). p1 owns only (2,1), a "side" bank that was never anyone's
    // designated bankA/bankB in the old 1-pair model.
    const board = {
      cols: 5,
      rows: 3,
      pieces: [
        seed("p1", 2, 2),
        { id: "river", playerId: RIVER_OWNER, cells: [{ x: 2, y: 1 }] },
      ],
      bridges: [
        {
          cells: [{ x: 2, y: 1 }],
          banks: [
            { x: 1, y: 1, islandId: 0 },
            { x: 2, y: 2, islandId: 0 },
            { x: 3, y: 1, islandId: 1 },
            { x: 2, y: 0, islandId: 1 },
          ],
          arm: "trunk",
        },
      ],
    };
    // Owning the (2,2) side-bank (not a "designated" entry point) still
    // lets p1 jump to EITHER empty bank on the other island.
    expect(isValidRouteClaim(board, "p1", { x: 3, y: 1 })).toBe(true);
    expect(isValidRouteClaim(board, "p1", { x: 2, y: 0 })).toBe(true);
    const keys = new Set(enumerateValidRouteCells(board, "p1").map(cellKey));
    expect(keys.has(cellKey({ x: 3, y: 1 }))).toBe(true);
    expect(keys.has(cellKey({ x: 2, y: 0 }))).toBe(true);
    // Never claimable: the river cell itself (can't "exit into the water").
    expect(isValidRouteClaim(board, "p1", { x: 2, y: 1 })).toBe(false);
  });
});

describe("makeRouteNeighborsFn", () => {
  const bridges = [
    {
      cells: [{ x: 2, y: 0 }],
      banks: [{ x: 1, y: 0, islandId: 0 }, { x: 3, y: 0, islandId: 1 }],
      arm: "trunk",
    },
  ];

  it("adds a symmetric wormhole edge between the two banks", () => {
    const neighborsFn = makeRouteNeighborsFn(bridges);
    expect(neighborsFn(1, 0).some((n) => n.x === 3 && n.y === 0)).toBe(true);
    expect(neighborsFn(3, 0).some((n) => n.x === 1 && n.y === 0)).toBe(true);
  });

  it("lets reachableEmptyCellCount cross the river only when routed through the bridge", () => {
    const board = {
      cols: 5,
      rows: 1,
      pieces: [seed("p1", 1, 0), { id: "river", playerId: RIVER_OWNER, cells: [{ x: 2, y: 0 }] }],
    };
    expect(reachableEmptyCellCount(board, "p1", squareNeighbors)).toBe(1); // only cell (0,0)
    expect(reachableEmptyCellCount(board, "p1", makeRouteNeighborsFn(bridges))).toBe(3); // (0,0),(3,0),(4,0)
  });
});

describe("relocateBridge / shouldRelocateBridges", () => {
  it("relocates to the other candidate in its arm when exactly 2 exist", () => {
    const candA = { cells: [{ x: 2, y: 0 }], banks: [{ x: 1, y: 0, islandId: 0 }, { x: 3, y: 0, islandId: 1 }], arm: "trunk" };
    const candB = { cells: [{ x: 2, y: 5 }], banks: [{ x: 1, y: 5, islandId: 0 }, { x: 3, y: 5, islandId: 1 }], arm: "trunk" };
    const candidatesByArm = { trunk: [candA, candB], branchA: [], branchB: [] };
    for (let i = 0; i < 10; i++) {
      expect(relocateBridge(candA, candidatesByArm)).toEqual(candB);
    }
  });

  it("treats a 2-cell (diagonal elbow) bridge span as distinct from a 1-cell one when relocating", () => {
    const candA = {
      cells: [{ x: 2, y: 0 }, { x: 3, y: 0 }],
      banks: [{ x: 1, y: 0, islandId: 0 }, { x: 3, y: 1, islandId: 1 }],
      arm: "trunk",
    };
    const candB = { cells: [{ x: 2, y: 5 }], banks: [{ x: 1, y: 5, islandId: 0 }, { x: 3, y: 5, islandId: 1 }], arm: "trunk" };
    const candidatesByArm = { trunk: [candA, candB], branchA: [], branchB: [] };
    for (let i = 0; i < 10; i++) {
      expect(relocateBridge(candA, candidatesByArm)).toEqual(candB);
    }
  });

  it("triggers once every 3 turns per active player", () => {
    expect(shouldRelocateBridges(5, 2)).toBe(false);
    expect(shouldRelocateBridges(6, 2)).toBe(true);
    expect(shouldRelocateBridges(2, 1)).toBe(false);
    expect(shouldRelocateBridges(3, 1)).toBe(true);
  });
});

describe("reviveEligiblePlayers", () => {
  it("un-eliminates a player who regains a move once a bridge relocates next to them", () => {
    // p1 is boxed in on a 1-cell island with no bridge — genuinely eliminated.
    const boardNoBridge = { cols: 5, rows: 1, pieces: [seed("p1", 0, 0), seed("__mountain__", 1, 0)], bridges: [] };
    expect(hasAnyPossibleRouteMove(boardNoBridge, "p1")).toBe(false);

    // A bridge relocates to sit right at p1's border, with a free far bank.
    const boardWithBridge = {
      ...boardNoBridge,
      pieces: [seed("p1", 0, 0), { id: "river", playerId: RIVER_OWNER, cells: [{ x: 1, y: 0 }] }],
      bridges: [
        {
          cells: [{ x: 1, y: 0 }],
          banks: [{ x: 0, y: 0, islandId: 0 }, { x: 2, y: 0, islandId: 1 }],
          arm: "trunk",
        },
      ],
    };
    const { eliminatedPlayerIds, revived } = reviveEligiblePlayers(["p1"], boardWithBridge);
    expect(revived).toEqual(["p1"]);
    expect(eliminatedPlayerIds).toEqual([]);
  });

  it("leaves a still-boxed-in player eliminated, and is a no-op with nobody eliminated", () => {
    const board = { cols: 5, rows: 1, pieces: [seed("p1", 0, 0), seed("__mountain__", 1, 0)], bridges: [] };
    const result = reviveEligiblePlayers(["p1"], board);
    expect(result).toEqual({ eliminatedPlayerIds: ["p1"], revived: [] });
    expect(reviveEligiblePlayers([], board)).toEqual({ eliminatedPlayerIds: [], revived: [] });
  });
});

describe("nextRollStreak", () => {
  it("only grants a bonus on the 3rd consecutive match, and resets (no bonus) on a 4th", () => {
    let streak = { streakValue: null, streakLength: 0 };
    streak = nextRollStreak(streak, 4);
    expect(streak.bonus).toBe(false); // 1st
    streak = nextRollStreak(streak, 4);
    expect(streak.bonus).toBe(false); // 2nd
    streak = nextRollStreak(streak, 4);
    expect(streak.bonus).toBe(true); // 3rd -- bonus!
    streak = nextRollStreak(streak, 4);
    expect(streak.bonus).toBe(false); // 4th -- no further bonus
    expect(streak.streakLength).toBe(1); // streak reset, counting fresh from this roll
    streak = nextRollStreak(streak, 4);
    expect(streak.bonus).toBe(false); // 2nd since reset
    expect(streak.streakLength).toBe(2);
  });

  it("resets the streak on a different roll", () => {
    let streak = nextRollStreak({ streakValue: 4, streakLength: 2 }, 5);
    expect(streak).toEqual({ streakValue: 5, streakLength: 1, bonus: false });
  });
});
