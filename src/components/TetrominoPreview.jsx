import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { PIECE_TYPES, pieceCells, rotationCount } from "../game/tetromino";

const PREVIEW_GRID = 4;

function ShapeGrid({ type, rotationIndex, color }) {
  const cells = pieceCells(type, rotationIndex);
  const occupied = new Set(cells.map((c) => `${c.x},${c.y}`));
  return (
    <div className="grid h-full w-full grid-cols-4 grid-rows-4 gap-0.5 p-1.5">
      {Array.from({ length: PREVIEW_GRID * PREVIEW_GRID }, (_, i) => {
        const x = i % PREVIEW_GRID;
        const y = Math.floor(i / PREVIEW_GRID);
        const filled = occupied.has(`${x},${y}`);
        return <div key={i} className="rounded-sm" style={{ background: filled ? color : "transparent" }} />;
      })}
    </div>
  );
}

/**
 * Shows the drawn tetromino piece + rotation as a mini grid in the
 * player's color. While `rolling`, cycles a random piece/rotation on its
 * own clock (purely cosmetic, mirrors Dice's roll animation) and shakes;
 * when `rolling` turns false it snaps to the real piece with a landing
 * bounce.
 */
export default function TetrominoPreview({ type, rotationIndex, rolling, color }) {
  const { t } = useTranslation();
  const [display, setDisplay] = useState({ type: type ?? "I", rotationIndex: rotationIndex ?? 0 });

  useEffect(() => {
    if (!rolling) {
      if (type != null) setDisplay({ type, rotationIndex });
      return;
    }
    const interval = setInterval(() => {
      const randomType = PIECE_TYPES[Math.floor(Math.random() * PIECE_TYPES.length)];
      const randomRotation = Math.floor(Math.random() * rotationCount(randomType));
      setDisplay({ type: randomType, rotationIndex: randomRotation });
    }, 90);
    return () => clearInterval(interval);
  }, [rolling, type, rotationIndex]);

  return (
    <div
      key={rolling ? "rolling" : `landed-${type}-${rotationIndex}`}
      className={
        "h-24 w-24 rounded-xl border border-base-300 bg-white shadow-md " +
        (rolling ? "animate-dice-roll" : "animate-dice-land")
      }
      role="img"
      aria-label={t("common.shapeAriaLabel", { value: display.type })}
    >
      <ShapeGrid type={display.type} rotationIndex={display.rotationIndex} color={color ?? "#888888"} />
    </div>
  );
}
