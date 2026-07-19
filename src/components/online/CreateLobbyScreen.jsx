import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiInfo } from "react-icons/fi";
import {
  DEFAULT_COLS,
  DEFAULT_ROWS,
  DEFAULT_PLAYER_COUNT,
  MIN_PLAYERS,
  MAX_PLAYERS,
  DEFAULT_AUTO_WIN,
  DEFAULT_ALLOW_ROTATION,
  DEFAULT_DOUBLES_EXTRA_TURN,
  DEFAULT_SMART_ASSIST,
  DEFAULT_AUTO_FILL_ENCLOSED,
  GAME_LOGOS,
  GAME_TITLE_PARTS,
  gridMinForPlayerCount,
} from "../../game/constants";
import { createLobby } from "../../api/lobbyApi";
import HeaderControls from "../HeaderControls";
import RulesModal from "../RulesModal";
import GameConfigFields from "../GameConfigFields";

const MAX_PLAYERS_OPTIONS = Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, i) => MIN_PLAYERS + i);

export default function CreateLobbyScreen({ gameType, firstPlayerName, onCreated, onBack }) {
  const { t } = useTranslation();
  const [maxPlayers, setMaxPlayers] = useState(DEFAULT_PLAYER_COUNT);
  const [cols, setCols] = useState(DEFAULT_COLS);
  const [rows, setRows] = useState(DEFAULT_ROWS);
  const [autoWin, setAutoWin] = useState(DEFAULT_AUTO_WIN);
  const [allowRotation, setAllowRotation] = useState(DEFAULT_ALLOW_ROTATION);
  const [doublesExtraTurn, setDoublesExtraTurn] = useState(DEFAULT_DOUBLES_EXTRA_TURN);
  const [smartAssist, setSmartAssist] = useState(DEFAULT_SMART_ASSIST);
  const [autoFillEnclosed, setAutoFillEnclosed] = useState(DEFAULT_AUTO_FILL_ENCLOSED);
  const [submitting, setSubmitting] = useState(false);
  const rulesDialogRef = useRef(null);

  const titleParts = GAME_TITLE_PARTS[gameType] ?? GAME_TITLE_PARTS.dice;
  const logo = GAME_LOGOS[gameType] ?? GAME_LOGOS.dice;
  const gameName = t(`home.games.${gameType}.name`);
  const supportsAutoFillEnclosed = gameType === "tetromino" || gameType === "hex";
  const gridMin = gridMinForPlayerCount(maxPlayers);

  function handleMaxPlayersChange(count) {
    setMaxPlayers(count);
    const newMin = gridMinForPlayerCount(count);
    setCols((c) => Math.max(c, newMin));
    setRows((r) => Math.max(r, newMin));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const { lobby, playerId } = await createLobby({
        gameType,
        config: {
          cols,
          rows,
          maxPlayers,
          autoWin,
          allowRotation,
          doublesExtraTurn: gameType === "dice" ? doublesExtraTurn : false,
          smartAssist,
          autoFillEnclosed: supportsAutoFillEnclosed && autoFillEnclosed,
        },
        hostName: firstPlayerName,
      });
      onCreated({ code: lobby.code, playerId });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-base-200 p-6">
      <form onSubmit={handleSubmit} className="card w-full max-w-lg bg-base-100 shadow-xl">
        <div className="card-body gap-6">
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
            <div className="mt-1 flex items-center justify-between gap-3">
              <p className="text-sm text-base-content/60">{t("setup.subtitle", { game: gameName })}</p>
              <button
                type="button"
                className="btn btn-outline btn-xs shrink-0 gap-1"
                onClick={() => rulesDialogRef.current?.showModal()}
              >
                <FiInfo className="h-3.5 w-3.5" />
                {t("setup.rulesButton")}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <span className="text-sm font-medium">{t("mode.online.create.maxPlayers")}</span>
            <div className="flex gap-2">
              {MAX_PLAYERS_OPTIONS.map((count) => (
                <button
                  key={count}
                  type="button"
                  className={
                    "flex h-12 w-12 items-center justify-center rounded-lg border-2 text-base font-semibold transition cursor-pointer " +
                    (maxPlayers === count
                      ? "border-primary bg-primary text-primary-content"
                      : "border-base-300 text-base-content hover:border-primary hover:bg-primary/10")
                  }
                  onClick={() => handleMaxPlayersChange(count)}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>

          <GameConfigFields
            gameType={gameType}
            cols={cols}
            rows={rows}
            onColsChange={setCols}
            onRowsChange={setRows}
            gridMin={gridMin}
            playerCount={maxPlayers}
            autoWin={autoWin}
            onAutoWinChange={setAutoWin}
            allowRotation={allowRotation}
            onAllowRotationChange={setAllowRotation}
            doublesExtraTurn={doublesExtraTurn}
            onDoublesExtraTurnChange={setDoublesExtraTurn}
            smartAssist={smartAssist}
            onSmartAssistChange={setSmartAssist}
            autoFillEnclosed={autoFillEnclosed}
            onAutoFillEnclosedChange={setAutoFillEnclosed}
          />

          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? t("mode.online.create.creating") : t("mode.online.create.submit")}
          </button>
        </div>
      </form>

      <RulesModal gameType={gameType} dialogRef={rulesDialogRef} />
    </div>
  );
}
