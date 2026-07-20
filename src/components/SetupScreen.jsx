import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiInfo } from "react-icons/fi";
import {
  COLOR_PALETTE,
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
  makeDefaultPlayers,
  gridMinForPlayerCount,
} from "../game/constants";
import HeaderControls from "./HeaderControls";
import RulesModal from "./RulesModal";
import GameConfigFields from "./GameConfigFields";

const PLAYER_COUNT_OPTIONS = Array.from(
  { length: MAX_PLAYERS - MIN_PLAYERS + 1 },
  (_, i) => MIN_PLAYERS + i
);

export default function SetupScreen({ gameType, firstPlayerName, onStart, onBack }) {
  const { t } = useTranslation();
  const defaultNameFn = (n) => t("setup.defaultPlayerName", { n });
  const [players, setPlayers] = useState(() => {
    const initial = makeDefaultPlayers(DEFAULT_PLAYER_COUNT, defaultNameFn);
    if (firstPlayerName) initial[0] = { ...initial[0], name: firstPlayerName };
    return initial;
  });
  const [cols, setCols] = useState(() => Math.max(DEFAULT_COLS, gridMinForPlayerCount(DEFAULT_PLAYER_COUNT, gameType)));
  const [rows, setRows] = useState(() => Math.max(DEFAULT_ROWS, gridMinForPlayerCount(DEFAULT_PLAYER_COUNT, gameType)));
  const [autoWin, setAutoWin] = useState(DEFAULT_AUTO_WIN);
  const [allowRotation, setAllowRotation] = useState(DEFAULT_ALLOW_ROTATION);
  const [doublesExtraTurn, setDoublesExtraTurn] = useState(DEFAULT_DOUBLES_EXTRA_TURN);
  const [smartAssist, setSmartAssist] = useState(DEFAULT_SMART_ASSIST);
  const [autoFillEnclosed, setAutoFillEnclosed] = useState(DEFAULT_AUTO_FILL_ENCLOSED);
  const rulesDialogRef = useRef(null);

  const titleParts = GAME_TITLE_PARTS[gameType] ?? GAME_TITLE_PARTS.dice;
  const logo = GAME_LOGOS[gameType] ?? GAME_LOGOS.dice;
  const gameName = t(`home.games.${gameType}.name`);
  const supportsAutoFillEnclosed = gameType === "tetromino" || gameType === "hex";

  const colorClash = new Set(players.map((p) => p.color)).size !== players.length;
  const gridMin = gridMinForPlayerCount(players.length, gameType);

  function setPlayerCount(count) {
    setPlayers((prev) => {
      if (count === prev.length) return prev;
      if (count < prev.length) return prev.slice(0, count);
      const next = [...prev];
      for (let i = prev.length; i < count; i++) {
        next.push({ id: `p${i + 1}`, name: defaultNameFn(i + 1), color: COLOR_PALETTE[i % COLOR_PALETTE.length] });
      }
      return next;
    });
    const newMin = gridMinForPlayerCount(count, gameType);
    setCols((c) => Math.max(c, newMin));
    setRows((r) => Math.max(r, newMin));
  }

  function setPlayerColor(index, color) {
    setPlayers((prev) => prev.map((p, i) => (i === index ? { ...p, color } : p)));
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (colorClash) return;
    onStart({
      cols,
      rows,
      players,
      autoWin,
      allowRotation,
      doublesExtraTurn: gameType === "dice" ? doublesExtraTurn : false,
      smartAssist,
      autoFillEnclosed: supportsAutoFillEnclosed && autoFillEnclosed,
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-base-200 p-6">
      <form onSubmit={handleSubmit} className="card w-full max-w-lg bg-base-100 shadow-xl">
        <div className="card-body gap-6">
          <div>
            <div className="flex items-center justify-between">
              {onBack ? (
                <button type="button" className="btn btn-ghost btn-sm -ml-2" onClick={onBack}>
                  ← {t("common.back")}
                </button>
              ) : (
                <span />
              )}
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
            <span className="text-sm font-medium">{t("setup.playerCount")}</span>
            <div className="flex gap-2">
              {PLAYER_COUNT_OPTIONS.map((count) => (
                <button
                  key={count}
                  type="button"
                  className={
                    "flex h-12 w-12 items-center justify-center rounded-lg border-2 text-base font-semibold transition cursor-pointer " +
                    (players.length === count
                      ? "border-primary bg-primary text-primary-content"
                      : "border-base-300 text-base-content hover:border-primary hover:bg-primary/10")
                  }
                  onClick={() => setPlayerCount(count)}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {players.map((player, index) => (
              <div key={player.id} className="flex items-center gap-3">
                <span className="w-24 shrink-0 truncate font-medium">{player.name}</span>
                <div className="flex flex-wrap gap-3">
                  {COLOR_PALETTE.map((color) => {
                    const takenByOther = players.some((p, i) => i !== index && p.color === color);
                    return (
                      <button
                        key={color}
                        type="button"
                        disabled={takenByOther}
                        onClick={() => setPlayerColor(index, color)}
                        className={
                          "h-7 w-7 rounded-full transition ring-offset-2 ring-offset-base-100 cursor-pointer" +
                          (player.color === color
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
            ))}
            {colorClash && <p className="text-sm text-error">{t("setup.colorClash")}</p>}
          </div>

          <GameConfigFields
            gameType={gameType}
            cols={cols}
            rows={rows}
            onColsChange={setCols}
            onRowsChange={setRows}
            gridMin={gridMin}
            playerCount={players.length}
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

          <button type="submit" className="btn btn-primary" disabled={colorClash}>
            {t("setup.startButton")}
          </button>
        </div>
      </form>

      <RulesModal gameType={gameType} dialogRef={rulesDialogRef} />
    </div>
  );
}
