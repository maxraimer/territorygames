import { useTranslation } from "react-i18next";
import { PIECE_TYPES, pieceCells } from "../game/tetromino";
import { HEX_SHAPE_TYPES, hexShapeCells } from "../game/hex";
import TerrainLegend from "./TerrainLegend";

const SHAPE_COLOR = "#3b82f6";
const TETROMINO_CELL = 9;

function TetrominoChip({ type }) {
  const cells = pieceCells(type, 0);
  const cols = Math.max(...cells.map((c) => c.x)) + 1;
  const rows = Math.max(...cells.map((c) => c.y)) + 1;
  const occupied = new Set(cells.map((c) => `${c.x},${c.y}`));
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="grid gap-0.5"
        style={{ gridTemplateColumns: `repeat(${cols}, ${TETROMINO_CELL}px)`, gridTemplateRows: `repeat(${rows}, ${TETROMINO_CELL}px)` }}
      >
        {Array.from({ length: cols * rows }, (_, i) => {
          const x = i % cols;
          const y = Math.floor(i / cols);
          const filled = occupied.has(`${x},${y}`);
          return <div key={i} className="rounded-xs" style={{ background: filled ? SHAPE_COLOR : "transparent" }} />;
        })}
      </div>
      <span className="font-mono text-[10px] text-base-content/50">{type}</span>
    </div>
  );
}

const HEX_SQRT3 = Math.sqrt(3);
const HEX_SIZE = 8;

function hexPoints(cx, cy, size) {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = ((-90 + 60 * i) * Math.PI) / 180;
    return `${cx + size * Math.cos(angle)},${cy + size * Math.sin(angle)}`;
  }).join(" ");
}

function HexChip({ shapeIndex, label }) {
  const cells = hexShapeCells(shapeIndex, 0);
  const points = cells.map((c) => ({
    cx: HEX_SIZE * (HEX_SQRT3 * c.q + (HEX_SQRT3 / 2) * c.r),
    cy: HEX_SIZE * 1.5 * c.r,
  }));
  const minX = Math.min(...points.map((p) => p.cx)) - HEX_SIZE;
  const minY = Math.min(...points.map((p) => p.cy)) - HEX_SIZE;
  const maxX = Math.max(...points.map((p) => p.cx)) + HEX_SIZE;
  const maxY = Math.max(...points.map((p) => p.cy)) + HEX_SIZE;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={38} height={38} viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`}>
        {points.map((p, i) => (
          <polygon key={i} points={hexPoints(p.cx, p.cy, HEX_SIZE)} fill={SHAPE_COLOR} className="stroke-black/25" strokeWidth={1} />
        ))}
      </svg>
      <span className="text-center text-[10px] leading-tight text-base-content/50">{label}</span>
    </div>
  );
}

function DominoExample() {
  const cellClass = "flex h-8 w-8 items-center justify-center rounded-md text-sm font-bold text-white";
  return (
    <div className="flex items-center gap-0.5" aria-hidden="true">
      <div className={cellClass} style={{ background: "#a855f7" }}>2</div>
      <div className={cellClass + " ring-2 ring-warning"} style={{ background: "#a855f7" }}>4</div>
      <div className="w-1.5" />
      <div className={cellClass + " ring-2 ring-warning"} style={{ background: "#3b82f6" }}>4</div>
      <div className={cellClass} style={{ background: "#3b82f6" }}>5</div>
    </div>
  );
}

export default function RulesModal({ gameType, dialogRef }) {
  const { t } = useTranslation();
  const toggles = t(`rules.${gameType}.toggles`, { returnObjects: true, defaultValue: [] });

  return (
    <dialog ref={dialogRef} className="modal">
      <div className="modal-box max-w-lg max-h-[85vh] overflow-y-auto">
        <h3 className="text-lg font-bold">{t(`rules.${gameType}.title`)}</h3>

        <div className="mt-3 flex flex-col gap-3 text-sm">
          <p>{t(`rules.${gameType}.objective`)}</p>
          <p>{t(`rules.${gameType}.turn`)}</p>
          <p>{t(`rules.${gameType}.placement`)}</p>

          {gameType === "tetromino" && (
            <div className="flex flex-wrap items-end gap-3 rounded-lg bg-base-200 p-3" aria-hidden="true">
              {PIECE_TYPES.map((type) => (
                <TetrominoChip key={type} type={type} />
              ))}
            </div>
          )}

          {gameType === "hex" && (
            <div className="flex flex-wrap items-end gap-3 rounded-lg bg-base-200 p-3" aria-hidden="true">
              {HEX_SHAPE_TYPES.map((shapeIndex) => (
                <HexChip key={shapeIndex} shapeIndex={shapeIndex} label={t(`playing.hexShapeLabels.${shapeIndex}`)} />
              ))}
            </div>
          )}

          {gameType === "domino" && (
            <div className="flex flex-col items-start gap-1.5 rounded-lg bg-base-200 p-3">
              <DominoExample />
              <span className="text-xs text-base-content/50">{t("rules.domino.exampleCaption")}</span>
            </div>
          )}

          {gameType === "route" && <TerrainLegend />}

          {/* Route's starting positions (2 players per large island) are already
              covered by its objective text above — the generic corner-seeding
              line isn't literally true there (no board corners involved). */}
          {gameType !== "route" && <p className="text-base-content/70">{t("rules.common.cornerSeeding")}</p>}
          <p className="text-base-content/70">{t("rules.common.scoring")}</p>

          {toggles.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-base-300 pt-3">
              {toggles.map((toggle, i) => (
                <p key={i}>
                  <span className="font-semibold">{toggle.title}:</span> {toggle.body}
                </p>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2 border-t border-base-300 pt-3 text-base-content/70">
            {gameType !== "route" && <p>{t("rules.common.rotationToggle")}</p>}
            {gameType !== "route" && <p>{t("rules.common.smartAssistToggle")}</p>}
            <p>{t("rules.common.autoWinToggle")}</p>
            <p>{t("rules.common.eliminationNote")}</p>
          </div>
        </div>

        <div className="modal-action">
          <form method="dialog">
            <button className="btn btn-primary btn-sm">{t("common.close")}</button>
          </form>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>
  );
}
