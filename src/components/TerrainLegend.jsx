import { useTranslation } from "react-i18next";

// Colors mirror Board.jsx's terrain rendering exactly (river/mountain/bridge rects).
const SWATCHES = [
  { key: "river", color: "#1e40af" },
  { key: "mountain", color: "#78716c" },
  { key: "bridge", color: "#d6b88a" },
];

/** Small color-swatch key for Routeritory's river/mountain/bridge terrain, shown during and after play. */
export default function TerrainLegend() {
  const { t } = useTranslation();
  return (
    <div className="card bg-base-100 shadow-sm">
      <div className="card-body gap-2 p-4">
        <h2 className="card-title text-sm">{t("playing.terrainLegend.title")}</h2>
        <div className="flex flex-col gap-1.5 text-xs text-base-content/70">
          {SWATCHES.map(({ key, color }) => (
            <div key={key} className="flex items-center gap-2">
              <span className="h-4 w-4 shrink-0 rounded" style={{ background: color }} />
              {t(`playing.terrainLegend.${key}`)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
