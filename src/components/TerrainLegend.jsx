import { useTranslation } from "react-i18next";
import { FaBridge, FaWater, FaMountain } from "react-icons/fa6";

// Colors mirror Board.jsx's terrain rendering exactly (river/mountain/bridge
// rects and their icon colors).
const SWATCHES = [
  { key: "river", color: "#1e40af", Icon: FaWater, iconColor: "#38bdf8" },
  { key: "mountain", color: "#78716c", Icon: FaMountain, iconColor: "#d6d3d1" },
  { key: "bridge", color: "#d6b88a", Icon: FaBridge, iconColor: "#92400e" },
];

/** Small color-swatch key for Routeritory's river/mountain/bridge terrain, shown during and after play. */
export default function TerrainLegend() {
  const { t } = useTranslation();
  return (
    <div className="card bg-base-100 shadow-sm">
      <div className="card-body gap-2 p-4">
        <h2 className="card-title text-sm">{t("playing.terrainLegend.title")}</h2>
        <div className="flex flex-col gap-1.5 text-xs text-base-content/70">
          {SWATCHES.map(({ key, color, Icon, iconColor }) => (
            <div key={key} className="flex items-center gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded" style={{ background: color }}>
                <Icon size={12} color={iconColor} />
              </span>
              {t(`playing.terrainLegend.${key}`)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
