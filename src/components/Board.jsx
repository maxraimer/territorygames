import { FaBridge, FaWater, FaMountain } from "react-icons/fa6";
import { getCellSize } from "../game/constants";
import { roundedPolyominoPath } from "../game/outline";
import { contrastTextColor } from "../game/color";
import { dominoContactInfo } from "../game/domino";

// Icon colors are a more saturated shade of each terrain type's cell fill,
// so the icon reads clearly against its own background instead of blending in.
const TERRAIN_ICON_COLORS = {
  river: "#38bdf8",
  mountain: "#d6d3d1",
  bridge: "#92400e",
};

function colorForPlayer(players, playerId) {
  return players.find((p) => p.id === playerId)?.color ?? "#888888";
}

/** True for a domino tile: exactly 2 cells, each carrying its own numeric half. */
function isDominoPiece(cells) {
  return cells.length === 2 && cells[0].value !== undefined;
}

/** The seam line between a domino's two halves, in pixel coordinates. */
function dominoDivider(cells, cellSize) {
  const [c0, c1] = cells;
  if (c0.y === c1.y) {
    const x = Math.max(c0.x, c1.x) * cellSize;
    const y = Math.min(c0.y, c1.y) * cellSize;
    return { x1: x, y1: y, x2: x, y2: y + cellSize };
  }
  const y = Math.max(c0.y, c1.y) * cellSize;
  const x = Math.min(c0.x, c1.x) * cellSize;
  return { x1: x, y1: y, x2: x + cellSize, y2: y };
}

function DominoHalves({ cells, cellSize, textColor }) {
  const divider = dominoDivider(cells, cellSize);
  return (
    <g className="pointer-events-none">
      <line {...divider} className="stroke-black/25" strokeWidth={1} />
      {cells.map((c, i) => (
        <text
          key={i}
          x={(c.x + 0.5) * cellSize}
          y={(c.y + 0.5) * cellSize}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={cellSize * 0.45}
          fontWeight="700"
          fill={textColor}
        >
          {c.value}
        </text>
      ))}
    </g>
  );
}

function cellCenter(cell, cellSize) {
  return { cx: (cell.x + 0.5) * cellSize, cy: (cell.y + 0.5) * cellSize };
}

/** Position + size for a terrain icon (react-icons/fa6), centered within its cell. */
function terrainIconRect(cell, cellSize) {
  const size = cellSize * 0.55;
  return { x: cell.x * cellSize + (cellSize - size) / 2, y: cell.y * cellSize + (cellSize - size) / 2, size };
}

// Routeritory's river/mountain cells: ordinary pieces owned by a sentinel
// "__"-prefixed playerId (see game/route.js) so rules.js treats them as
// occupied-but-unowned for free. They render exclusively through the
// `terrain` prop below, not through the per-player pieces loop.
function isTerrainPiece(piece) {
  return piece.playerId.startsWith("__");
}

export default function Board({
  board,
  players,
  previewPlacement, // { cells: Cell[], valid: boolean } | null
  previewColor,
  previewPlayerId,
  onHoverCell,
  onLeaveBoard,
  onPlaceClick,
  interactive = true,
  terrain, // { river: Cell[], mountain: Cell[], bridges: Cell[] } | undefined
  cellSize: cellSizeProp, // optional override — see useFitCellSize
}) {
  const cellSize = cellSizeProp ?? getCellSize(board.rows);
  const width = board.cols * cellSize;
  const height = board.rows * cellSize;
  const cornerRadius = Math.max(2, Math.round(cellSize * 0.18));

  function handleMouseMove(event) {
    if (!interactive) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const px = event.clientX - bounds.left;
    const py = event.clientY - bounds.top;
    onHoverCell?.(Math.floor(px / cellSize), Math.floor(py / cellSize));
  }

  const previewPath = previewPlacement ? roundedPolyominoPath(previewPlacement.cells, cellSize, cornerRadius) : null;
  const previewIsDomino = previewPlacement && isDominoPiece(previewPlacement.cells);
  const contactInfo =
    previewIsDomino && previewPlayerId ? dominoContactInfo(board, previewPlayerId, previewPlacement.cells) : null;

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
      <rect x={0} y={0} width={width} height={height} className="fill-base-200" />

      {terrain && (
        <g className="pointer-events-none">
          {terrain.river.map((c, i) => (
            <rect key={`river${i}`} x={c.x * cellSize} y={c.y * cellSize} width={cellSize} height={cellSize} fill="#1e40af" />
          ))}
          {terrain.mountain.map((c, i) => (
            <rect key={`mountain${i}`} x={c.x * cellSize} y={c.y * cellSize} width={cellSize} height={cellSize} fill="#78716c" />
          ))}
          {terrain.bridges.map((c, i) => (
            <rect key={`bridge${i}`} x={c.x * cellSize} y={c.y * cellSize} width={cellSize} height={cellSize} fill="#d6b88a" />
          ))}
          {terrain.river.map((c, i) => (
            <FaWater key={`river-icon${i}`} {...terrainIconRect(c, cellSize)} color={TERRAIN_ICON_COLORS.river} />
          ))}
          {terrain.mountain.map((c, i) => (
            <FaMountain key={`mountain-icon${i}`} {...terrainIconRect(c, cellSize)} color={TERRAIN_ICON_COLORS.mountain} />
          ))}
          {terrain.bridges.map((c, i) => (
            <FaBridge key={`bridge-icon${i}`} {...terrainIconRect(c, cellSize)} color={TERRAIN_ICON_COLORS.bridge} />
          ))}
        </g>
      )}

      {board.pieces.filter((piece) => !isTerrainPiece(piece)).map((piece) => {
        const fill = colorForPlayer(players, piece.playerId);
        return (
          <g key={piece.id} className="animate-place-pop" style={{ transformBox: "fill-box", transformOrigin: "center" }}>
            <path d={roundedPolyominoPath(piece.cells, cellSize, cornerRadius)} fill={fill} className="stroke-black/25" strokeWidth={1} />
            {isDominoPiece(piece.cells) && (
              <DominoHalves cells={piece.cells} cellSize={cellSize} textColor={contrastTextColor(fill)} />
            )}
          </g>
        );
      })}

      {/* Drawn on top of the placed blocks too, so every block's cell
          dimensions stay countable regardless of fill color. */}
      <g className="pointer-events-none">
        {Array.from({ length: board.cols + 1 }, (_, i) => (
          <line key={`v${i}`} x1={i * cellSize} y1={0} x2={i * cellSize} y2={height} className="stroke-black/10" />
        ))}
        {Array.from({ length: board.rows + 1 }, (_, i) => (
          <line key={`h${i}`} x1={0} y1={i * cellSize} x2={width} y2={i * cellSize} className="stroke-black/10" />
        ))}
      </g>

      {previewPath && (
        <g className="pointer-events-none">
          <path
            d={previewPath}
            fill={previewColor ?? "#888888"}
            fillOpacity={0.4}
            stroke={previewPlacement.valid ? "#22c55e" : "#ef4444"}
            strokeWidth={2}
          />
          {previewIsDomino && (
            <DominoHalves
              cells={previewPlacement.cells}
              cellSize={cellSize}
              textColor={contrastTextColor(previewColor ?? "#888888")}
            />
          )}
          {contactInfo?.numberMatches.map(({ from, to }, i) => (
            <g key={`num${i}`}>
              <circle {...cellCenter(from, cellSize)} r={cellSize * 0.42} fill="none" stroke="#f59e0b" strokeWidth={3} />
              <circle {...cellCenter(to, cellSize)} r={cellSize * 0.42} fill="none" stroke="#f59e0b" strokeWidth={3} />
            </g>
          ))}
          {contactInfo?.ownContacts.map(({ from, to }, i) => (
            <g key={`own${i}`}>
              <circle {...cellCenter(from, cellSize)} r={cellSize * 0.3} fill="none" stroke="#ffffff" strokeWidth={2} strokeDasharray="3 2" />
              <circle {...cellCenter(to, cellSize)} r={cellSize * 0.3} fill="none" stroke="#ffffff" strokeWidth={2} strokeDasharray="3 2" />
            </g>
          ))}
        </g>
      )}
    </svg>
  );
}
