import { getHexSize } from "../game/constants";
import { offsetToAxial, axialToOffset } from "../game/hex";

const SQRT3 = Math.sqrt(3);

function colorForPlayer(players, playerId) {
  return players.find((p) => p.id === playerId)?.color ?? "#888888";
}

function hexCenter(col, row, size, padX, padY) {
  const { q, r } = offsetToAxial(col, row);
  return {
    cx: size * (SQRT3 * q + (SQRT3 / 2) * r) + padX,
    cy: size * 1.5 * r + padY,
  };
}

function hexPoints(cx, cy, size) {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = ((-90 + 60 * i) * Math.PI) / 180;
    return `${cx + size * Math.cos(angle)},${cy + size * Math.sin(angle)}`;
  }).join(" ");
}

/** Rounds fractional axial coordinates to the nearest actual hex (cube-coordinate rounding). */
function roundAxial(q, r) {
  let x = q;
  let z = r;
  let y = -x - z;
  let rx = Math.round(x);
  let ry = Math.round(y);
  let rz = Math.round(z);
  const dx = Math.abs(rx - x);
  const dy = Math.abs(ry - y);
  const dz = Math.abs(rz - z);
  if (dx > dy && dx > dz) rx = -ry - rz;
  else if (dy > dz) ry = -rx - rz;
  else rz = -rx - ry;
  return { q: rx, r: rz };
}

function pixelToOffset(px, py, size) {
  const q = ((SQRT3 / 3) * px - (1 / 3) * py) / size;
  const r = ((2 / 3) * py) / size;
  const rounded = roundAxial(q, r);
  return axialToOffset(rounded.q, rounded.r);
}

export default function HexBoard({
  board,
  players,
  previewPlacement, // { cells: Cell[], valid: boolean } | null
  previewColor,
  onHoverCell,
  onLeaveBoard,
  onPlaceClick,
  interactive = true,
}) {
  const size = getHexSize(board.rows);
  const padX = size * (SQRT3 / 2);
  const padY = size;
  const width = size * SQRT3 * board.cols + padX;
  const height = size * 1.5 * board.rows + padY;

  const cellOwner = new Map();
  for (const piece of board.pieces) {
    for (const c of piece.cells) cellOwner.set(`${c.x},${c.y}`, piece.playerId);
  }

  function handleMouseMove(event) {
    if (!interactive) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const px = event.clientX - bounds.left - padX;
    const py = event.clientY - bounds.top - padY;
    const { x, y } = pixelToOffset(px, py, size);
    onHoverCell?.(x, y);
  }

  const cells = [];
  for (let row = 0; row < board.rows; row++) {
    for (let col = 0; col < board.cols; col++) cells.push({ col, row });
  }

  return (
    <svg
      className={"block " + (interactive ? "cursor-crosshair" : "")}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={interactive ? onLeaveBoard : undefined}
      onClick={interactive ? onPlaceClick : undefined}
    >
      <g>
        {cells.map(({ col, row }) => {
          const { cx, cy } = hexCenter(col, row, size, padX, padY);
          const owner = cellOwner.get(`${col},${row}`);
          return (
            <polygon
              key={`${col},${row}`}
              points={hexPoints(cx, cy, size)}
              fill={owner ? colorForPlayer(players, owner) : undefined}
              className={owner ? "stroke-black/25 animate-place-pop" : "fill-base-200 stroke-black/10"}
              strokeWidth={1}
              style={owner ? { transformBox: "fill-box", transformOrigin: "center" } : undefined}
            />
          );
        })}
      </g>

      {previewPlacement?.cells.map((c, i) => {
        const { cx, cy } = hexCenter(c.x, c.y, size, padX, padY);
        return (
          <polygon
            key={`preview-${i}`}
            points={hexPoints(cx, cy, size)}
            fill={previewColor ?? "#888888"}
            fillOpacity={0.4}
            stroke={previewPlacement.valid ? "#22c55e" : "#ef4444"}
            strokeWidth={2}
            className="pointer-events-none"
          />
        );
      })}
    </svg>
  );
}
