import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiCopy, FiCheck, FiLogOut } from "react-icons/fi";
import { GAME_LOGOS, GAME_TITLE_PARTS } from "../../game/constants";
import useLobby from "../../hooks/useLobby";
import HeaderControls from "../HeaderControls";

export default function LobbyScreen({ gameType, code, playerId, onLeave, onGameStart }) {
  const { t } = useTranslation();
  const { lobby, loading, error, start, leave } = useLobby(code);
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);

  const titleParts = GAME_TITLE_PARTS[gameType] ?? GAME_TITLE_PARTS.dice;
  const logo = GAME_LOGOS[gameType] ?? GAME_LOGOS.dice;
  const isHost = lobby?.hostId === playerId;

  useEffect(() => {
    if (lobby?.status !== "started") return;
    onGameStart({
      cols: lobby.config.cols,
      rows: lobby.config.rows,
      players: lobby.players.map((p) => ({ id: p.id, name: p.name, color: p.color, type: "human" })),
      autoWin: lobby.config.autoWin,
      allowRotation: lobby.config.allowRotation,
      doublesExtraTurn: lobby.config.doublesExtraTurn,
      smartAssist: lobby.config.smartAssist,
      autoFillEnclosed: lobby.config.autoFillEnclosed,
    });
  }, [lobby, onGameStart]);

  function handleCopy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function handleStart() {
    setStarting(true);
    try {
      await start(playerId);
    } finally {
      setStarting(false);
    }
  }

  function handleLeave() {
    leave(playerId);
    onLeave();
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base-200 p-6">
        <p className="text-base-content/60">{t("mode.online.lobby.loading")}</p>
      </div>
    );
  }

  if (error || !lobby) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-base-200 p-6">
        <p className="text-error">{t("mode.online.lobby.closed")}</p>
        <button type="button" className="btn btn-primary btn-sm" onClick={onLeave}>
          {t("common.back")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-base-200 p-6">
      <div className="card w-full max-w-lg bg-base-100 shadow-xl">
        <div className="card-body gap-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={logo} alt="" className="h-10 w-10 rounded-lg" />
              <h1 className="text-2xl font-bold">
                <span className="text-primary">{titleParts[0]}</span>
                {titleParts[1]}
              </h1>
            </div>
            <HeaderControls />
          </div>

          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-base-300 py-4">
            <span className="text-xs font-medium text-base-content/60">{t("mode.online.lobby.codeLabel")}</span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-3xl font-bold tracking-widest">{lobby.code}</span>
              <button type="button" className="btn btn-ghost btn-sm btn-square" onClick={handleCopy}>
                {copied ? <FiCheck className="h-4 w-4 text-success" /> : <FiCopy className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">
              {t("mode.online.lobby.playersTitle", { count: lobby.players.length, max: lobby.config.maxPlayers })}
            </span>
            <ul className="flex flex-col gap-1.5">
              {lobby.players.map((p) => (
                <li key={p.id} className="flex items-center gap-2 rounded-lg border border-base-300 px-3 py-2">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: p.color }} />
                  <span className="truncate text-sm font-medium">{p.name}</span>
                  {p.isHost && <span className="badge badge-primary badge-sm ml-auto">{t("mode.online.lobby.hostBadge")}</span>}
                  {p.id === playerId && <span className="text-xs text-base-content/50">{t("mode.online.lobby.youBadge")}</span>}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-2">
            {isHost ? (
              <>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={lobby.players.length < 2 || starting}
                  onClick={handleStart}
                >
                  {starting ? t("mode.online.lobby.starting") : t("mode.online.lobby.startButton")}
                </button>
                {lobby.players.length < 2 && (
                  <p className="text-center text-xs text-base-content/50">{t("mode.online.lobby.minPlayersHint")}</p>
                )}
              </>
            ) : (
              <p className="text-center text-sm text-base-content/60">{t("mode.online.lobby.waitingHint")}</p>
            )}
            <button type="button" className="btn btn-ghost btn-sm gap-1.5" onClick={handleLeave}>
              <FiLogOut className="h-4 w-4" />
              {t("mode.online.lobby.leaveButton")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
