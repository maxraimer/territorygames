import { useState } from "react";
import { useTranslation } from "react-i18next";
import { joinLobby } from "../../api/lobbyApi";
import { LOBBY_ERROR_CODES } from "../../api/lobbyErrors";
import HeaderControls from "../HeaderControls";

const ERROR_KEY_BY_CODE = {
  [LOBBY_ERROR_CODES.NOT_FOUND]: "mode.online.join.errors.notFound",
  [LOBBY_ERROR_CODES.FULL]: "mode.online.join.errors.full",
  [LOBBY_ERROR_CODES.ALREADY_STARTED]: "mode.online.join.errors.alreadyStarted",
};

export default function JoinLobbyScreen({ firstPlayerName, onJoined, onBack }) {
  const { t } = useTranslation();
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorKey, setErrorKey] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!code.trim()) return;
    setSubmitting(true);
    setErrorKey(null);
    try {
      const { lobby, playerId } = await joinLobby(code, { name: firstPlayerName });
      onJoined({ code: lobby.code, playerId });
    } catch (err) {
      setErrorKey(ERROR_KEY_BY_CODE[err.code] ?? "mode.online.join.errors.generic");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-base-200 p-6">
      <form onSubmit={handleSubmit} className="card w-full max-w-sm bg-base-100 shadow-xl">
        <div className="card-body gap-6">
          <div className="flex items-center justify-between">
            <button type="button" className="btn btn-ghost btn-sm -ml-2" onClick={onBack}>
              ← {t("common.back")}
            </button>
            <HeaderControls />
          </div>

          <div>
            <h1 className="text-2xl font-bold">{t("mode.online.join.title")}</h1>
            <p className="mt-1 text-sm text-base-content/60">{t("mode.online.join.subtitle")}</p>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">{t("mode.online.join.codeLabel")}</span>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder={t("mode.online.join.codePlaceholder")}
              maxLength={6}
              autoCapitalize="characters"
              className="input input-bordered w-full font-mono tracking-widest uppercase"
            />
          </label>

          {errorKey && <p className="text-sm text-error">{t(errorKey)}</p>}

          <button type="submit" className="btn btn-primary" disabled={submitting || !code.trim()}>
            {submitting ? t("mode.online.join.joining") : t("mode.online.join.submit")}
          </button>
        </div>
      </form>
    </div>
  );
}
