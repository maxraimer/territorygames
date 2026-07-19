import { useTranslation } from "react-i18next";
import { GAME_TYPES, GAME_LOGOS } from "../game/constants";
import HeaderControls from "./HeaderControls";

export default function HomeScreen({ nickname, onNicknameChange, onSelect }) {
  const { t } = useTranslation();
  const hasNickname = nickname.trim().length > 0;

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-base-200 p-6">
      <div className="absolute top-4 right-4">
        <HeaderControls />
      </div>
      <div className="flex w-full max-w-2xl flex-col gap-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold">
            <span className="text-primary">Territory</span> Games
          </h1>
          <p className="mt-1 text-base-content/60">{t("home.subtitle")}</p>
        </div>

        <div className="mx-auto w-full max-w-sm">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">{t("home.nickname.label")}</span>
            <input
              type="text"
              value={nickname}
              onChange={(e) => onNicknameChange(e.target.value)}
              placeholder={t("home.nickname.placeholder")}
              maxLength={24}
              className="input input-bordered w-full"
            />
            {!hasNickname && <span className="text-xs text-error">{t("home.nickname.required")}</span>}
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {GAME_TYPES.map((game) => (
            <button
              key={game.id}
              type="button"
              disabled={!hasNickname}
              onClick={() => onSelect(game.id)}
              className={
                "card bg-base-100 text-left shadow-xl transition " +
                (hasNickname
                  ? "hover:-translate-y-0.5 hover:shadow-2xl cursor-pointer"
                  : "cursor-not-allowed opacity-50")
              }
            >
              <div className="card-body gap-2">
                <img src={GAME_LOGOS[game.id]} alt="" className="h-16 w-16 rounded-xl" />
                <h2 className="card-title">{t(`home.games.${game.id}.name`)}</h2>
                <p className="text-sm text-base-content/60">{t(`home.games.${game.id}.tagline`)}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
