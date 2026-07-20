// Routeritory's board: a plain square grid (same { cols, rows, pieces } model
// as rules.js) with procedurally generated terrain layered on top. River and
// mountain cells are ordinary `pieces` owned by a sentinel playerId — that
// alone gives them correct "impassable, unowned" behavior in every rules.js
// primitive (buildOccupiedSet/buildOwnSet/enumerateValidPlacements/
// reachableEmptyCellCount) with no changes to that file. Bridges are *not*
// separate pieces (a bridge cell is already part of the river piece); they're
// tracked as plain data on the board (`board.bridges`) so they can relocate
// without mutating piece lists.
import { squareNeighbors, buildOccupiedSet, buildOwnSet, validPlacement, enumerateValidPlacements } from "./rules";

export const RIVER_OWNER = "__river__";
export const MOUNTAIN_OWNER = "__mountain__";

const EDGES = ["top", "right", "bottom", "left"];
const RIVER_WOBBLE = 0.3;
// Island-size validation: exactly 1 small (neutral, nobody starts there) island
// and 2 large islands players are seeded on, 2-per-island when there are 4.
const SMALL_ISLAND_MIN_FRACTION = 0.06;
const SMALL_ISLAND_MAX_FRACTION = 0.25;
const LARGE_ISLAND_MIN_FRACTION = 0.3;
const MOUNTAIN_CORNER_BUFFER = 2;
const MOUNTAIN_PLACEMENT_ATTEMPTS = 10;
const MAX_GENERATION_ATTEMPTS = 60;
// For each edge, which end (t=0 or t=1 in edgePoint's parametrization) sits at
// the corner it shares with a given adjacent edge — used to bias the river's
// entry point and its short pocket-branch exit toward the same corner, so
// together they wall off a small island near it.
const EDGE_NEAR_T = {
  top: { left: 0, right: 1 },
  right: { top: 0, bottom: 1 },
  bottom: { left: 0, right: 1 },
  left: { top: 0, bottom: 1 },
};
const OPPOSITE_EDGE = { top: "bottom", bottom: "top", left: "right", right: "left" };

function cellKey(x, y) {
  return `${x},${y}`;
}

function cornersOf(cols, rows) {
  return [
    { x: 0, y: 0 },
    { x: cols - 1, y: 0 },
    { x: cols - 1, y: rows - 1 },
    { x: 0, y: rows - 1 },
  ];
}

function isNearCorner(cell, corners, buffer) {
  return corners.some((c) => Math.max(Math.abs(cell.x - c.x), Math.abs(cell.y - c.y)) <= buffer);
}

// ---------------------------------------------------------------------------
// River generation — a random walk that can step diagonally (for a more
// natural, meandering shape) but never as a bare 1-cell diagonal hop: a
// diagonal step also drops an orthogonal "elbow" cell between the two
// diagonal cells, so every consecutive pair in the path shares a full edge.
// Without the elbow, two diagonal river cells would only touch at a corner,
// and land cells on opposite sides could still slip past through that corner
// gap during the (edge-only) flood fill below — the barrier has to be
// edge-connected, not just visually contiguous.
// ---------------------------------------------------------------------------

function edgePoint(cols, rows, edge, t) {
  if (edge === "top") return { x: Math.round(t * (cols - 1)), y: 0 };
  if (edge === "bottom") return { x: Math.round(t * (cols - 1)), y: rows - 1 };
  if (edge === "left") return { x: 0, y: Math.round(t * (rows - 1)) };
  return { x: cols - 1, y: Math.round(t * (rows - 1)) };
}

function isOnEdge(cell, edge, cols, rows) {
  if (edge === "top") return cell.y === 0;
  if (edge === "bottom") return cell.y === rows - 1;
  if (edge === "left") return cell.x === 0;
  return cell.x === cols - 1;
}

function pickEdgePoint(cols, rows, edge) {
  const margin = 0.15; // keeps the entry/exit away from corners
  const t = margin + Math.random() * (1 - 2 * margin);
  return edgePoint(cols, rows, edge, t);
}

/** Like pickEdgePoint, but hugs the end of `edge` nearest the corner it shares with `nearEdge`. */
function pickEdgePointBiased(cols, rows, edge, towardTEnd) {
  const margin = 0.06;
  const span = 0.3 + Math.random() * 0.15;
  const t = towardTEnd === 0 ? margin + Math.random() * span : 1 - margin - Math.random() * span;
  return edgePoint(cols, rows, edge, t);
}

function manhattan(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

const STEP_DIRS = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
  { x: 1, y: 1 },
  { x: 1, y: -1 },
  { x: -1, y: 1 },
  { x: -1, y: -1 },
];

function chooseStep(current, target, wobble, cols, rows) {
  const valid = STEP_DIRS.map((d) => ({ dx: d.x, dy: d.y, x: current.x + d.x, y: current.y + d.y })).filter(
    (p) => p.x >= 0 && p.x < cols && p.y >= 0 && p.y < rows
  );
  if (Math.random() < wobble) return valid[Math.floor(Math.random() * valid.length)];
  valid.sort((a, b) => manhattan(a, target) - manhattan(b, target));
  return valid[0];
}

function walkUntil(start, target, isDone, cols, rows, maxSteps) {
  const path = [start];
  let current = start;
  let steps = 0;
  while (!isDone(current) && steps < maxSteps) {
    const step = chooseStep(current, target, RIVER_WOBBLE, cols, rows);
    if (step.dx !== 0 && step.dy !== 0) {
      const elbow =
        Math.random() < 0.5 ? { x: current.x + step.dx, y: current.y } : { x: current.x, y: current.y + step.dy };
      path.push(elbow);
    }
    current = { x: step.x, y: step.y };
    path.push(current);
    steps++;
  }
  return path;
}

/**
 * Trunk forks near the entry (not at the board's center) into a short branch
 * that hugs the entry's shared corner with an adjacent edge — walling off a
 * small pocket island there — and a long branch that crosses to the opposite
 * edge, splitting the rest of the board into 2 large islands.
 */
function generateRiver(cols, rows) {
  const entryEdge = EDGES[Math.floor(Math.random() * EDGES.length)];
  const farEdge = OPPOSITE_EDGE[entryEdge];
  const nearEdge = EDGES.filter((e) => e !== entryEdge && e !== farEdge)[Math.floor(Math.random() * 2)];

  const entry = pickEdgePointBiased(cols, rows, entryEdge, EDGE_NEAR_T[entryEdge][nearEdge]);
  const pocketExit = pickEdgePointBiased(cols, rows, nearEdge, EDGE_NEAR_T[nearEdge][entryEdge]);
  const farExit = pickEdgePoint(cols, rows, farEdge);

  const maxSteps = cols + rows;
  const center = { x: Math.floor(cols / 2), y: Math.floor(rows / 2) };
  const forkFraction = 0.5 + Math.random() * 0.2; // roughly halfway to the center, enough depth for a real pocket
  const forkTarget = {
    x: Math.round(entry.x + (center.x - entry.x) * forkFraction),
    y: Math.round(entry.y + (center.y - entry.y) * forkFraction),
  };

  const trunk = walkUntil(entry, forkTarget, (c) => manhattan(c, forkTarget) <= 1, cols, rows, maxSteps);
  const forkPoint = trunk[trunk.length - 1];

  const branchBFull = walkUntil(forkPoint, pocketExit, (c) => isOnEdge(c, nearEdge, cols, rows), cols, rows, maxSteps);
  const branchAFull = walkUntil(forkPoint, farExit, (c) => isOnEdge(c, farEdge, cols, rows), cols, rows, maxSteps);

  return { trunk, branchA: branchAFull.slice(1), branchB: branchBFull.slice(1) };
}

/** Guaranteed-valid deterministic layout (1 small pocket + 2 large islands), used only if random generation can't find a good split in time. */
function fallbackRiver(cols, rows) {
  const cx = Math.floor(cols / 2);
  const pocketH = Math.max(2, Math.round(rows * 0.18));
  const trunk = Array.from({ length: pocketH + 1 }, (_, y) => ({ x: cx, y }));
  const branchA = Array.from({ length: rows - pocketH - 1 }, (_, i) => ({ x: cx, y: pocketH + 1 + i }));
  const branchB = Array.from({ length: cx }, (_, i) => ({ x: cx - 1 - i, y: pocketH }));
  return { trunk, branchA, branchB };
}

function riverCellList(river) {
  return [...river.trunk, ...river.branchA, ...river.branchB];
}

// ---------------------------------------------------------------------------
// Islands — connected components of non-terrain land, via the same
// squareNeighbors adjacency the rest of the square-grid games use.
// ---------------------------------------------------------------------------

/** Flood-fills every land cell not in `blockedSet` into connected islands. */
export function computeIslands(cols, rows, blockedSet) {
  const islandOf = new Map();
  const sizes = [];
  let nextId = 0;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const key = cellKey(x, y);
      if (blockedSet.has(key) || islandOf.has(key)) continue;
      const id = nextId++;
      const queue = [{ x, y }];
      islandOf.set(key, id);
      let size = 0;
      while (queue.length) {
        const cell = queue.pop();
        size++;
        for (const n of squareNeighbors(cell.x, cell.y)) {
          if (n.x < 0 || n.y < 0 || n.x >= cols || n.y >= rows) continue;
          const nKey = cellKey(n.x, n.y);
          if (blockedSet.has(nKey) || islandOf.has(nKey)) continue;
          islandOf.set(nKey, id);
          queue.push(n);
        }
      }
      sizes.push(size);
    }
  }
  return { islandOf, sizes };
}

function isValidIslandSplit(sizes, totalLand) {
  if (sizes.length !== 3) return false;
  const [small, largeA, largeB] = [...sizes].sort((a, b) => a - b);
  if (small < totalLand * SMALL_ISLAND_MIN_FRACTION) return false;
  if (small > totalLand * SMALL_ISLAND_MAX_FRACTION) return false;
  if (largeA < totalLand * LARGE_ISLAND_MIN_FRACTION) return false;
  if (largeB < totalLand * LARGE_ISLAND_MIN_FRACTION) return false;
  return true;
}

/** Groups islandOf's flat cell->id map back into per-island cell lists. */
function cellsByIslandFromMap(islandOf) {
  const map = new Map();
  for (const [key, id] of islandOf) {
    const [x, y] = key.split(",").map(Number);
    if (!map.has(id)) map.set(id, []);
    map.get(id).push({ x, y });
  }
  return map;
}

/**
 * Splits the 3 islands into the 1 small neutral one (nobody starts there,
 * though it's still claimable during play) and the 2 large ones players seed
 * onto.
 */
export function classifyIslands(islandOf, sizes) {
  const cellsByIsland = cellsByIslandFromMap(islandOf);
  const idsBySize = [...cellsByIsland.keys()].sort((a, b) => sizes[a] - sizes[b]);
  const [smallIslandId, ...largeIslandIds] = idsBySize;
  return { smallIslandId, largeIslandIds, cellsByIsland };
}

/** Up to 2 well-separated starting cells within one island (opposite-ish corners of its bounding box). */
function pickIslandStartCells(islandCells, count) {
  if (count <= 0) return [];
  const xs = islandCells.map((c) => c.x);
  const ys = islandCells.map((c) => c.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const bboxCorners = [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ];
  const closestToEach = bboxCorners.map((bc) =>
    islandCells.reduce((best, c) => (manhattan(c, bc) < manhattan(best, bc) ? c : best), islandCells[0])
  );
  const uniq = [];
  const seen = new Set();
  for (const c of closestToEach) {
    const key = cellKey(c.x, c.y);
    if (seen.has(key)) continue;
    seen.add(key);
    uniq.push(c);
  }
  if (count === 1) return [uniq[0]];

  const pool = uniq.length >= 2 ? uniq : islandCells;
  let bestPair = [pool[0], pool[pool.length - 1]];
  let bestDist = -1;
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      const d = manhattan(pool[i], pool[j]);
      if (d > bestDist) {
        bestDist = d;
        bestPair = [pool[i], pool[j]];
      }
    }
  }
  return bestPair;
}

/**
 * Seeds players onto the 2 large islands, alternating by turn order so a
 * 4-player game puts 2 players on each large island (2 vs. 1 for 3 players, 1
 * vs. 1 for 2) — the small island stays unseeded/neutral.
 */
export function seedRoutePlayers(players, islands) {
  const { largeIslandIds, cellsByIsland } = islands;
  const groupA = players.filter((_, i) => i % 2 === 0);
  const groupB = players.filter((_, i) => i % 2 === 1);
  const cellsA = pickIslandStartCells(cellsByIsland.get(largeIslandIds[0]), groupA.length);
  const cellsB = pickIslandStartCells(cellsByIsland.get(largeIslandIds[1]), groupB.length);
  const pieces = [];
  groupA.forEach((player, i) => pieces.push({ id: `seed-${player.id}`, playerId: player.id, cells: [cellsA[i]] }));
  groupB.forEach((player, i) => pieces.push({ id: `seed-${player.id}`, playerId: player.id, cells: [cellsB[i]] }));
  return pieces;
}

// ---------------------------------------------------------------------------
// Mountains — a handful of small clusters, grown by random walk, kept off
// the river and away from every starting corner.
// ---------------------------------------------------------------------------

function growMountainCluster(cols, rows, occupied, corners) {
  const targetSize = 3 + Math.floor(Math.random() * 2); // 3 or 4
  for (let seedAttempt = 0; seedAttempt < 20; seedAttempt++) {
    const seed = { x: Math.floor(Math.random() * cols), y: Math.floor(Math.random() * rows) };
    const key = cellKey(seed.x, seed.y);
    if (occupied.has(key) || isNearCorner(seed, corners, MOUNTAIN_CORNER_BUFFER)) continue;

    const cluster = [seed];
    const clusterSet = new Set([key]);
    while (cluster.length < targetSize) {
      const frontier = cluster
        .flatMap((c) => squareNeighbors(c.x, c.y))
        .filter(
          (n) =>
            n.x >= 0 &&
            n.x < cols &&
            n.y >= 0 &&
            n.y < rows &&
            !occupied.has(cellKey(n.x, n.y)) &&
            !clusterSet.has(cellKey(n.x, n.y)) &&
            !isNearCorner(n, corners, MOUNTAIN_CORNER_BUFFER)
        );
      if (frontier.length === 0) break;
      const next = frontier[Math.floor(Math.random() * frontier.length)];
      cluster.push(next);
      clusterSet.add(cellKey(next.x, next.y));
    }
    return cluster;
  }
  return [];
}

/**
 * Grows each cluster and validates it against the island split immediately,
 * skipping just that one cluster (not the whole batch) if it would sever an
 * island or shrink one below the size thresholds — validating only after
 * placing all clusters at once (the previous approach) meant a single bad
 * cluster discarded every other valid one too, which is why mountains were
 * regularly generating empty under the stricter 2-large/1-small split.
 */
function generateMountainClusters(cols, rows, riverBlocked, corners) {
  const clusterCount = Math.max(3, Math.min(8, Math.round((cols * rows) / 150)));
  const occupied = new Set(riverBlocked);
  const clusters = [];
  for (let i = 0; i < clusterCount; i++) {
    for (let attempt = 0; attempt < MOUNTAIN_PLACEMENT_ATTEMPTS; attempt++) {
      const cluster = growMountainCluster(cols, rows, occupied, corners);
      if (cluster.length < 2) continue;
      const candidateBlocked = new Set(occupied);
      for (const c of cluster) candidateBlocked.add(cellKey(c.x, c.y));
      const { sizes } = computeIslands(cols, rows, candidateBlocked);
      if (!isValidIslandSplit(sizes, cols * rows - candidateBlocked.size)) continue;
      clusters.push(cluster);
      for (const c of cluster) occupied.add(cellKey(c.x, c.y));
      break;
    }
  }
  return clusters;
}

// ---------------------------------------------------------------------------
// Bridges — one per river arm, valid on any river cell that has at least 2
// land neighbors on 2 different islands (a genuine bank-to-bank crossing).
// Not restricted to cells with *exactly* 2 land neighbors: the diagonal
// "elbow" cells the river walk drops can leave a crossing with 3 land
// neighbors (e.g. at a corner where the river briefly widens to 2 cells),
// and that's just as valid a bridge site as a plain 1-cell-wide stretch.
// ---------------------------------------------------------------------------

export function computeBridgeCandidates(river, islandOf) {
  const arms = { trunk: river.trunk, branchA: river.branchA, branchB: river.branchB };
  const result = {};
  for (const [arm, cells] of Object.entries(arms)) {
    const candidates = [];
    for (const cell of cells) {
      const landNeighbors = squareNeighbors(cell.x, cell.y).filter((n) => islandOf.has(cellKey(n.x, n.y)));
      let bridgeBanks = null;
      for (let i = 0; i < landNeighbors.length && !bridgeBanks; i++) {
        for (let j = i + 1; j < landNeighbors.length && !bridgeBanks; j++) {
          const idA = islandOf.get(cellKey(landNeighbors[i].x, landNeighbors[i].y));
          const idB = islandOf.get(cellKey(landNeighbors[j].x, landNeighbors[j].y));
          if (idA !== idB) bridgeBanks = [landNeighbors[i], landNeighbors[j]];
        }
      }
      if (!bridgeBanks) continue;
      candidates.push({ cell, bankA: bridgeBanks[0], bankB: bridgeBanks[1], arm });
    }
    result[arm] = candidates;
  }
  return result;
}

function pickInitialBridges(candidatesByArm) {
  return ["trunk", "branchA", "branchB"].map((arm) => {
    const pool = candidatesByArm[arm];
    return pool[Math.floor(Math.random() * pool.length)];
  });
}

/** A new position for `bridge` within its own arm, distinct from its current cell when possible. */
export function relocateBridge(bridge, candidatesByArm) {
  const candidates = candidatesByArm[bridge.arm];
  const others = candidates.filter((c) => !(c.cell.x === bridge.cell.x && c.cell.y === bridge.cell.y));
  const pool = others.length > 0 ? others : candidates;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Every 3 rounds (each active player having taken ~3 turns) since the last relocation. */
export function shouldRelocateBridges(turnsSinceBridgeMove, activePlayerCount) {
  return turnsSinceBridgeMove >= 3 * Math.max(1, activePlayerCount);
}

// ---------------------------------------------------------------------------
// Top-level generation
// ---------------------------------------------------------------------------

function tryGenerateTerrain(cols, rows, corners) {
  const river = generateRiver(cols, rows);
  const riverCells = riverCellList(river);
  if (riverCells.some((c) => corners.some((k) => k.x === c.x && k.y === c.y))) return null;

  const riverBlocked = new Set(riverCells.map((c) => cellKey(c.x, c.y)));
  const withoutMountains = computeIslands(cols, rows, riverBlocked);
  if (!isValidIslandSplit(withoutMountains.sizes, cols * rows - riverBlocked.size)) return null;

  const mountainClusters = generateMountainClusters(cols, rows, riverBlocked, corners);
  const blocked = new Set([...riverBlocked, ...mountainClusters.flat().map((c) => cellKey(c.x, c.y))]);
  const islands = computeIslands(cols, rows, blocked);

  const candidatesByArm = computeBridgeCandidates(river, islands.islandOf);
  if (["trunk", "branchA", "branchB"].some((arm) => candidatesByArm[arm].length === 0)) return null;

  return {
    riverCells,
    mountainClusters,
    bridges: pickInitialBridges(candidatesByArm),
    bridgeCandidatesByArm: candidatesByArm,
    claimableTotal: cols * rows - blocked.size,
    islands: classifyIslands(islands.islandOf, islands.sizes),
  };
}

/** River + mountains + bridges for a fresh board, retrying until a valid 3-island split is found. */
export function generateRouteTerrain(cols, rows) {
  const corners = cornersOf(cols, rows);
  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
    const result = tryGenerateTerrain(cols, rows, corners);
    if (result) return result;
  }
  // Every random attempt failed the 3-island/bridge-candidate checks (should be
  // exceedingly rare) — fall back to a deterministic layout that always splits
  // the board cleanly into 3 regions.
  const river = fallbackRiver(cols, rows);
  const riverCells = riverCellList(river);
  const riverBlocked = new Set(riverCells.map((c) => cellKey(c.x, c.y)));
  const { islandOf, sizes } = computeIslands(cols, rows, riverBlocked);
  const candidatesByArm = computeBridgeCandidates(river, islandOf);
  return {
    riverCells,
    mountainClusters: [],
    bridges: pickInitialBridges(candidatesByArm),
    bridgeCandidatesByArm: candidatesByArm,
    claimableTotal: cols * rows - riverBlocked.size,
    islands: classifyIslands(islandOf, sizes),
  };
}

/** Player seed pieces (2 players per large island, split by turn order) plus generated terrain, merged into one board. */
export function createInitialRouteBoard(cols, rows, players) {
  const terrain = generateRouteTerrain(cols, rows);
  const riverPiece = { id: "terrain-river", playerId: RIVER_OWNER, cells: terrain.riverCells };
  const mountainPieces = terrain.mountainClusters.map((cells, i) => ({
    id: `terrain-mountain-${i}`,
    playerId: MOUNTAIN_OWNER,
    cells,
  }));
  const playerPieces = seedRoutePlayers(players, terrain.islands);
  return {
    cols,
    rows,
    pieces: [...playerPieces, riverPiece, ...mountainPieces],
    bridges: terrain.bridges,
    bridgeCandidatesByArm: terrain.bridgeCandidatesByArm,
    claimableTotal: terrain.claimableTotal,
  };
}

// ---------------------------------------------------------------------------
// Claim validity — ordinary adjacency (via rules.js) plus the bridge-jump
// rule: owning one bank of a currently-positioned bridge makes the empty
// far bank claimable, without the bridge cell itself ever being claimed.
// ---------------------------------------------------------------------------

/** The bridge `cell` would cross, or null if this isn't a valid bridge-jump claim. */
export function isBridgeJumpClaim(board, playerId, cell) {
  const own = buildOwnSet(board, playerId);
  const occupied = buildOccupiedSet(board);
  const key = cellKey(cell.x, cell.y);
  if (occupied.has(key)) return null;
  for (const bridge of board.bridges ?? []) {
    if (cellKey(bridge.bankB.x, bridge.bankB.y) === key && own.has(cellKey(bridge.bankA.x, bridge.bankA.y))) return bridge;
    if (cellKey(bridge.bankA.x, bridge.bankA.y) === key && own.has(cellKey(bridge.bankB.x, bridge.bankB.y))) return bridge;
  }
  return null;
}

/** Authoritative single-cell claim check: ordinary adjacency or a bridge jump. */
export function isValidRouteClaim(board, playerId, cell) {
  return validPlacement(board, playerId, [cell]) || isBridgeJumpClaim(board, playerId, cell) !== null;
}

/** Every cell `playerId` could claim right now: ordinary adjacency plus bridge jumps. */
export function enumerateValidRouteCells(board, playerId) {
  const ordinary = enumerateValidPlacements(board, playerId, [{ x: 0, y: 0 }]).map((cells) => cells[0]);
  const own = buildOwnSet(board, playerId);
  const occupied = buildOccupiedSet(board);
  const jumps = [];
  for (const bridge of board.bridges ?? []) {
    const aKey = cellKey(bridge.bankA.x, bridge.bankA.y);
    const bKey = cellKey(bridge.bankB.x, bridge.bankB.y);
    if (own.has(aKey) && !occupied.has(bKey)) jumps.push(bridge.bankB);
    if (own.has(bKey) && !occupied.has(aKey)) jumps.push(bridge.bankA);
  }
  const seen = new Set();
  const results = [];
  for (const cell of [...ordinary, ...jumps]) {
    const key = cellKey(cell.x, cell.y);
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(cell);
  }
  return results;
}

/** Whether the player has any legal claim at all — used for elimination/game-over. */
export function hasAnyPossibleRouteMove(board, playerId) {
  return enumerateValidRouteCells(board, playerId).length > 0;
}

/**
 * Re-checks every eliminated player against the current board and un-
 * eliminates anyone who now has a legal move. Elimination isn't permanent
 * here the way it is in every other game (where the board only ever fills
 * up, so "no moves" can never become "moves" again): Routeritory's bridges
 * relocate periodically, and a player who was genuinely boxed in a moment
 * ago can suddenly gain access to a fresh crossing. Call this whenever
 * bridges move.
 */
export function reviveEligiblePlayers(eliminatedPlayerIds, board) {
  const revived = eliminatedPlayerIds.filter((id) => hasAnyPossibleRouteMove(board, id));
  if (revived.length === 0) return { eliminatedPlayerIds, revived };
  return {
    eliminatedPlayerIds: eliminatedPlayerIds.filter((id) => !revived.includes(id)),
    revived,
  };
}

/**
 * squareNeighbors plus a one-hop wormhole at each currently-positioned
 * bridge's banks — lets reachableEmptyCellCount/isOutcomeDecided correctly
 * "see across" the river at a bridge without ever stepping onto the
 * (permanently occupied) bridge cell itself. Must be rebuilt whenever
 * bridges relocate, since it closes over their current positions.
 */
export function makeRouteNeighborsFn(bridges) {
  return function routeNeighbors(x, y) {
    const base = squareNeighbors(x, y);
    const extra = [];
    for (const bridge of bridges ?? []) {
      if (bridge.bankA.x === x && bridge.bankA.y === y) extra.push(bridge.bankB);
      else if (bridge.bankB.x === x && bridge.bankB.y === y) extra.push(bridge.bankA);
    }
    return extra.length ? [...base, ...extra] : base;
  };
}

// ---------------------------------------------------------------------------
// Rendering helper
// ---------------------------------------------------------------------------

/** Splits board terrain into render-ready cell lists (river cells currently under a bridge render as bridges instead). */
export function terrainLayersForRender(board) {
  const bridgeCells = (board.bridges ?? []).map((b) => b.cell);
  const bridgeKeys = new Set(bridgeCells.map((c) => cellKey(c.x, c.y)));
  const riverPiece = board.pieces.find((p) => p.playerId === RIVER_OWNER);
  const mountainCells = board.pieces.filter((p) => p.playerId === MOUNTAIN_OWNER).flatMap((p) => p.cells);
  const river = (riverPiece?.cells ?? []).filter((c) => !bridgeKeys.has(cellKey(c.x, c.y)));
  return { river, mountain: mountainCells, bridges: bridgeCells };
}

// ---------------------------------------------------------------------------
// Streak-bonus turn tracking
// ---------------------------------------------------------------------------

/**
 * Advances a player's personal roll streak. 3-in-a-row grants a bonus turn;
 * if the bonus roll also matches (4-in-a-row), no further bonus is granted
 * and the streak resets, counting fresh from that roll — a plain "are the
 * last 3 rolls equal" check would incorrectly re-fire every roll during a
 * longer run, so this is a small counter state machine instead of a
 * rolling-window array.
 */
export function nextRollStreak(streak, roll) {
  const prevValue = streak?.streakValue ?? null;
  const prevLength = streak?.streakLength ?? 0;
  if (prevValue !== roll) return { streakValue: roll, streakLength: 1, bonus: false };
  const streakLength = prevLength + 1;
  if (streakLength >= 4) return { streakValue: roll, streakLength: 1, bonus: false };
  return { streakValue: roll, streakLength, bonus: streakLength === 3 };
}
