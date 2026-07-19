import { useTranslation } from "react-i18next";
import { FiUsers, FiCpu, FiGlobe } from "react-icons/fi";
import { GAME_LOGOS, GAME_TITLE_PARTS } from "../game/constants";
import HeaderControls from "./HeaderControls";

const MODES = [
  { id: "hotseat", icon: FiUsers, disabled: false },
  { id: "bots", icon: FiCpu, disabled: false },
  { id: "online", icon: FiGlobe, disabled: true },
];

export default function ModeSelectScreen({ gameType, onSelect, onBack }) {
  const { t } = useTranslation();
  const titleParts = GAME_TITLE_PARTS[gameType] ?? GAME_TITLE_PARTS.dice;
  const logo = GAME_LOGOS[gameType] ?? GAME_LOGOS.dice;

  return (
    <div className="flex min-h-screen items-center justify-center bg-base-200 p-6">
      <div className="flex w-full max-w-2xl flex-col gap-6">
        <div>
          <div className="flex items-center justify-between">
            <button type="button" className="btn btn-ghost btn-sm -ml-2" onClick={onBack}>
              ← {t("common.back")}
            </button>
            <HeaderControls />
          </div>
          <div className="mt-2 flex items-center gap-3">
            <img src={logo} alt="" className="h-10 w-10 rounded-lg" />
            <h1 className="text-3xl font-bold">
              <span className="text-primary">{titleParts[0]}</span>
              {titleParts[1]}
            </h1>
          </div>
          <p className="mt-1 text-sm text-base-content/60">{t("mode.subtitle")}</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {MODES.map(({ id, icon: Icon, disabled }) => (
            <button
              key={id}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(id)}
              title={disabled ? t("mode.online.comingSoon") : undefined}
              className={
                "card bg-base-100 text-left shadow-xl transition " +
                (disabled
                  ? "cursor-not-allowed opacity-50"
                  : "hover:-translate-y-0.5 hover:shadow-2xl cursor-pointer")
              }
            >
              <div className="card-body items-center gap-2 text-center">
                <Icon className="h-8 w-8 text-primary" />
                <h2 className="card-title">{t(`mode.${id}.title`)}</h2>
                <p className="text-sm text-base-content/60">{t(`mode.${id}.description`)}</p>
                {disabled && <span className="badge badge-ghost badge-sm">{t("mode.online.comingSoon")}</span>}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
