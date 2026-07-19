// Traces the outer boundary of a polyomino (a rectangle, a tetromino,
// anything holeless and simply-connected) and turns it into a single
// rounded SVG path — so a whole placed piece reads as one smooth shape
// instead of a mosaic of individually-rounded unit cells.

function cellKey(x, y) {
  return `${x},${y}`;
}

/**
 * Walks the outside edge of the cells and returns it as a simplified
 * list of corner points (collinear points removed), in clockwise order.
 * Assumes `cells` form a single simply-connected region with no holes —
 * true for every shape this app places (rectangles, tetrominoes).
 */
export function traceOutline(cells) {
  const occupied = new Set(cells.map((c) => cellKey(c.x, c.y)));
  const hasCell = (x, y) => occupied.has(cellKey(x, y));

  // Emit one boundary edge per side of each cell that isn't shared with
  // another cell of the same piece. Shared internal edges are never
  // emitted at all, so they can't appear in the traced outline.
  const edges = [];
  for (const { x, y } of cells) {
    if (!hasCell(x, y - 1)) edges.push([{ x, y }, { x: x + 1, y }]);
    if (!hasCell(x + 1, y)) edges.push([{ x: x + 1, y }, { x: x + 1, y: y + 1 }]);
    if (!hasCell(x, y + 1)) edges.push([{ x: x + 1, y: y + 1 }, { x, y: y + 1 }]);
    if (!hasCell(x - 1, y)) edges.push([{ x, y: y + 1 }, { x, y }]);
  }
  if (edges.length === 0) return [];

  const byStart = new Map();
  for (const e of edges) byStart.set(cellKey(e[0].x, e[0].y), e);

  const startEdge = edges[0];
  const rawLoop = [startEdge[0]];
  let current = startEdge;
  for (let guard = 0; guard < edges.length; guard++) {
    const nextKey = cellKey(current[1].x, current[1].y);
    if (nextKey === cellKey(startEdge[0].x, startEdge[0].y)) break;
    rawLoop.push(current[1]);
    current = byStart.get(nextKey);
  }

  const n = rawLoop.length;
  const corners = [];
  for (let i = 0; i < n; i++) {
    const prev = rawLoop[(i - 1 + n) % n];
    const curr = rawLoop[i];
    const next = rawLoop[(i + 1) % n];
    const d1x = Math.sign(curr.x - prev.x);
    const d1y = Math.sign(curr.y - prev.y);
    const d2x = Math.sign(next.x - curr.x);
    const d2y = Math.sign(next.y - curr.y);
    if (d1x !== d2x || d1y !== d2y) corners.push(curr);
  }
  return corners;
}

/**
 * True if the corner at index `i` of a traced (clockwise) outline is
 * convex — a normal outward-bulging corner, like a rectangle's corner —
 * as opposed to concave (a reflex, inward notch, e.g. the inside bend of
 * an L or T piece).
 */
export function isConvexCorner(corners, i) {
  const n = corners.length;
  const prev = corners[(i - 1 + n) % n];
  const curr = corners[i];
  const next = corners[(i + 1) % n];
  const d1x = Math.sign(curr.x - prev.x);
  const d1y = Math.sign(curr.y - prev.y);
  const d2x = Math.sign(next.x - curr.x);
  const d2y = Math.sign(next.y - curr.y);
  return d1x * d2y - d1y * d2x > 0;
}

/**
 * Builds an SVG path `d` string for the piece's outline, in pixels
 * (cells are in grid units, scaled by `cellSize`). Convex corners round
 * outward like a normal rounded rect; concave corners round the other
 * way, so the whole polyomino reads as one smooth shape.
 */
export function roundedPolyominoPath(cells, cellSize, radius) {
  const corners = traceOutline(cells);
  const n = corners.length;
  if (n < 3) return "";

  const pts = corners.map((p) => ({ x: p.x * cellSize, y: p.y * cellSize }));

  let d = "";
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n];
    const curr = pts[i];
    const next = pts[(i + 1) % n];
    const dinX = Math.sign(curr.x - prev.x);
    const dinY = Math.sign(curr.y - prev.y);
    const doutX = Math.sign(next.x - curr.x);
    const doutY = Math.sign(next.y - curr.y);

    const from = { x: curr.x - dinX * radius, y: curr.y - dinY * radius };
    const to = { x: curr.x + doutX * radius, y: curr.y + doutY * radius };

    d += i === 0 ? `M ${from.x} ${from.y} ` : `L ${from.x} ${from.y} `;
    const sweep = isConvexCorner(corners, i) ? 1 : 0;
    d += `A ${radius} ${radius} 0 0 ${sweep} ${to.x} ${to.y} `;
  }
  return d + "Z";
}
