import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiCopy, FiCheck, FiLogOut, FiInfo } from "react-icons/fi";
import {
  GAME_LOGOS,
  GAME_TITLE_PARTS,
  COLOR_PALETTE,
  MIN_PLAYERS,
  MAX_PLAYERS,
  gridMinForPlayerCount,
} from "../../game/constants";
import useLobby from "../../hooks/useLobby";
import HeaderControls from "../HeaderControls";
import RulesModal from "../RulesModal";
import GameConfigFields from "../GameConfigFields";

const MAX_PLAYERS_OPTIONS = Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, i) => MIN_PLAYERS + i);

export default function LobbyScreen({ gameType, code, playerId, onLeave, onGameStart }) {
  const { t } = useTranslation();
  const { lobby, loading, error, start, leave, updateConfig, updateColor } = useLobby(code);
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);
  const rulesDialogRef = useRef(null);

  const titleParts = GAME_TITLE_PARTS[gameType] ?? GAME_TITLE_PARTS.dice;
  const logo = GAME_LOGOS[gameType] ?? GAME_LOGOS.dice;
  const isHost = lobby?.hostId === playerId;
  const me = lobby?.players.find((p) => p.id === playerId);

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
      // Lets App.jsx tell "my turn" from "someone else's turn" and pick
      // which client seeds the shared match (see gameSyncApi.js) — the
      // lobby's own code doubles as the game-sync session id.
      online: { code: lobby.code, myPlayerId: playerId, isHost },
    });
  }, [lobby, onGameStart, playerId, isHost]);

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

  function handleConfigPatch(patch) {
    if (!isHost) return;
    updateConfig(playerId, patch).catch(() => {});
  }

  function handleMaxPlayersChange(count) {
    if (!isHost || !lobby) return;
    const newMin = gridMinForPlayerCount(count, gameType);
    handleConfigPatch({
      maxPlayers: count,
      cols: Math.max(lobby.config.cols, newMin),
      rows: Math.max(lobby.config.rows, newMin),
    });
  }

  function handleColorPick(color) {
    updateColor(playerId, color).catch(() => {});
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

  const gridMin = gridMinForPlayerCount(lobby.config.maxPlayers, gameType);

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

          <div className="flex flex-col gap-3 rounded-lg border border-base-300 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="text-sm font-medium">{t("mode.online.lobby.settingsTitle")}</span>
                <p className="text-xs text-base-content/50">
                  {t(isHost ? "mode.online.lobby.hostSettingsHint" : "mode.online.lobby.guestSettingsHint")}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-outline btn-xs shrink-0 gap-1"
                onClick={() => rulesDialogRef.current?.showModal()}
              >
                <FiInfo className="h-3.5 w-3.5" />
                {t("setup.rulesButton")}
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">{t("mode.online.lobby.maxPlayersLabel")}</span>
              {isHost ? (
                <div className="flex gap-2">
                  {MAX_PLAYERS_OPTIONS.map((count) => (
                    <button
                      key={count}
                      type="button"
                      disabled={count < lobby.players.length}
                      onClick={() => handleMaxPlayersChange(count)}
                      className={
                        "flex h-10 w-10 items-center justify-center rounded-lg border-2 text-sm font-semibold transition " +
                        (lobby.config.maxPlayers === count
                          ? "border-primary bg-primary text-primary-content cursor-pointer"
                          : count < lobby.players.length
                            ? "cursor-not-allowed border-base-300 text-base-content/30"
                            : "cursor-pointer border-base-300 text-base-content hover:border-primary hover:bg-primary/10")
                      }
                    >
                      {count}
                    </button>
                  ))}
                </div>
              ) : (
                <span className="text-sm text-base-content/70">{lobby.config.maxPlayers}</span>
              )}
            </div>

            <GameConfigFields
              gameType={gameType}
              cols={lobby.config.cols}
              rows={lobby.config.rows}
              onColsChange={(cols) => handleConfigPatch({ cols })}
              onRowsChange={(rows) => handleConfigPatch({ rows })}
              gridMin={gridMin}
              playerCount={lobby.config.maxPlayers}
              autoWin={lobby.config.autoWin}
              onAutoWinChange={(autoWin) => handleConfigPatch({ autoWin })}
              allowRotation={lobby.config.allowRotation}
              onAllowRotationChange={(allowRotation) => handleConfigPatch({ allowRotation })}
              doublesExtraTurn={lobby.config.doublesExtraTurn}
              onDoublesExtraTurnChange={(doublesExtraTurn) => handleConfigPatch({ doublesExtraTurn })}
              smartAssist={lobby.config.smartAssist}
              onSmartAssistChange={(smartAssist) => handleConfigPatch({ smartAssist })}
              autoFillEnclosed={lobby.config.autoFillEnclosed}
              onAutoFillEnclosedChange={(autoFillEnclosed) => handleConfigPatch({ autoFillEnclosed })}
              readOnly={!isHost}
            />
          </div>

          {me && (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">{t("mode.online.lobby.yourColorLabel")}</span>
              <div className="flex flex-wrap gap-3">
                {COLOR_PALETTE.map((color) => {
                  const takenByOther = lobby.players.some((p) => p.id !== playerId && p.color === color);
                  return (
                    <button
                      key={color}
                      type="button"
                      disabled={takenByOther}
                      onClick={() => handleColorPick(color)}
                      className={
                        "h-7 w-7 rounded-full transition ring-offset-2 ring-offset-base-100 cursor-pointer" +
                        (me.color === color
                          ? " ring-2 ring-base-content"
                          : takenByOther
                            ? " cursor-not-allowed opacity-25"
                            : " hover:scale-110")
                      }
                      style={{ background: color }}
                      aria-label={color}
                    />
                  );
                })}
              </div>
            </div>
          )}

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

      <RulesModal gameType={gameType} dialogRef={rulesDialogRef} />
    </div>
  );
}
