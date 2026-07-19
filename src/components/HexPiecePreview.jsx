import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { HEX_SHAPE_TYPES, hexShapeCells, hexRotationCount } from "../game/hex";

const SQRT3 = Math.sqrt(3);
const SIZE = 14;

function hexPoints(cx, cy, size) {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = ((-90 + 60 * i) * Math.PI) / 180;
    return `${cx + size * Math.cos(angle)},${cy + size * Math.sin(angle)}`;
  }).join(" ");
}

function ShapeGrid({ shapeIndex, rotationIndex, color }) {
  const cells = hexShapeCells(shapeIndex, rotationIndex);
  const points = cells.map((c) => ({
    cx: SIZE * (SQRT3 * c.q + (SQRT3 / 2) * c.r),
    cy: SIZE * 1.5 * c.r,
  }));
  const minX = Math.min(...points.map((p) => p.cx)) - SIZE;
  const minY = Math.min(...points.map((p) => p.cy)) - SIZE;
  const maxX = Math.max(...points.map((p) => p.cx)) + SIZE;
  const maxY = Math.max(...points.map((p) => p.cy)) + SIZE;

  return (
    <svg width="100%" height="100%" viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`}>
      {points.map((p, i) => (
        <polygon key={i} points={hexPoints(p.cx, p.cy, SIZE)} fill={color} className="stroke-black/25" strokeWidth={1} />
      ))}
    </svg>
  );
}

/**
 * Shows the drawn hex figure + rotation as a mini shape in the player's
 * color. While `rolling`, cycles a random shape/rotation on its own clock
 * (purely cosmetic, mirrors Dice/TetrominoPreview's roll animation) and
 * shakes; when `rolling` turns false it snaps to the real shape with a
 * landing bounce.
 */
export default function HexPiecePreview({ shapeIndex, rotationIndex, rolling, color }) {
  const { t } = useTranslation();
  const [display, setDisplay] = useState({ shapeIndex: shapeIndex ?? 1, rotationIndex: rotationIndex ?? 0 });

  useEffect(() => {
    if (!rolling) {
      if (shapeIndex != null) setDisplay({ shapeIndex, rotationIndex });
      return;
    }
    const interval = setInterval(() => {
      const randomType = HEX_SHAPE_TYPES[Math.floor(Math.random() * HEX_SHAPE_TYPES.length)];
      const randomRotation = Math.floor(Math.random() * hexRotationCount(randomType));
      setDisplay({ shapeIndex: randomType, rotationIndex: randomRotation });
    }, 90);
    return () => clearInterval(interval);
  }, [rolling, shapeIndex, rotationIndex]);

  return (
    <div
      key={rolling ? "rolling" : `landed-${shapeIndex}-${rotationIndex}`}
      className={
        "h-24 w-24 rounded-xl border border-base-300 bg-white shadow-md p-2 " +
        (rolling ? "animate-dice-roll" : "animate-dice-land")
      }
      role="img"
      aria-label={t("common.shapeAriaLabel", { value: display.shapeIndex })}
    >
      <ShapeGrid shapeIndex={display.shapeIndex} rotationIndex={display.rotationIndex} color={color ?? "#888888"} />
    </div>
  );
}
