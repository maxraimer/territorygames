import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiInfo } from "react-icons/fi";
import {
  COLOR_PALETTE,
  DEFAULT_COLS,
  DEFAULT_ROWS,
  DEFAULT_AUTO_WIN,
  DEFAULT_ALLOW_ROTATION,
  DEFAULT_DOUBLES_EXTRA_TURN,
  DEFAULT_SMART_ASSIST,
  DEFAULT_AUTO_FILL_ENCLOSED,
  MIN_BOTS,
  MAX_BOTS,
  DEFAULT_BOT_COUNT,
  GAME_LOGOS,
  GAME_TITLE_PARTS,
  gridMinForPlayerCount,
} from "../game/constants";
import { makeHumanPlayer, makeBotPlayer, pickBotColors, BOT_DIFFICULTIES } from "../game/players";
import HeaderControls from "./HeaderControls";
import RulesModal from "./RulesModal";
import GameConfigFields from "./GameConfigFields";

const BOT_COUNT_OPTIONS = Array.from({ length: MAX_BOTS - MIN_BOTS + 1 }, (_, i) => MIN_BOTS + i);

export default function BotSetupScreen({ gameType, firstPlayerName, onStart, onBack }) {
  const { t } = useTranslation();
  const [botCount, setBotCount] = useState(DEFAULT_BOT_COUNT);
  const [difficulty, setDifficulty] = useState("medium");
  const [humanColor, setHumanColor] = useState(COLOR_PALETTE[0]);
  const [cols, setCols] = useState(() => Math.max(DEFAULT_COLS, gridMinForPlayerCount(1 + DEFAULT_BOT_COUNT, gameType)));
  const [rows, setRows] = useState(() => Math.max(DEFAULT_ROWS, gridMinForPlayerCount(1 + DEFAULT_BOT_COUNT, gameType)));
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

  const totalPlayers = 1 + botCount;
  const gridMin = gridMinForPlayerCount(totalPlayers, gameType);

  function handleBotCountChange(count) {
    setBotCount(count);
    const newMin = gridMinForPlayerCount(count + 1, gameType);
    setCols((c) => Math.max(c, newMin));
    setRows((r) => Math.max(r, newMin));
  }

  function handleSubmit(event) {
    event.preventDefault();
    const botNameFn = (n) => t("mode.bots.botName", { n });
    const botColors = pickBotColors([humanColor], botCount);
    const players = [
      makeHumanPlayer(0, firstPlayerName, humanColor),
      ...Array.from({ length: botCount }, (_, i) => makeBotPlayer(i + 1, difficulty, botNameFn, botColors[i])),
    ];
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

          <div className="flex items-center gap-3">
            <span className="w-24 shrink-0 truncate font-medium">{firstPlayerName}</span>
            <div className="flex flex-wrap gap-3">
              {COLOR_PALETTE.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setHumanColor(color)}
                  className={
                    "h-7 w-7 rounded-full transition ring-offset-2 ring-offset-base-100 cursor-pointer" +
                    (humanColor === color ? " ring-2 ring-base-content" : " hover:scale-110")
                  }
                  style={{ background: color }}
                  aria-label={color}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <span className="text-sm font-medium">{t("mode.bots.count")}</span>
            <div className="flex gap-2">
              {BOT_COUNT_OPTIONS.map((count) => (
                <button
                  key={count}
                  type="button"
                  className={
                    "flex h-12 w-12 items-center justify-center rounded-lg border-2 text-base font-semibold transition cursor-pointer " +
                    (botCount === count
                      ? "border-primary bg-primary text-primary-content"
                      : "border-base-300 text-base-content hover:border-primary hover:bg-primary/10")
                  }
                  onClick={() => handleBotCountChange(count)}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <span className="text-sm font-medium">{t("mode.bots.difficulty.label")}</span>
            <div className="flex gap-2">
              {BOT_DIFFICULTIES.map((level) => (
                <button
                  key={level}
                  type="button"
                  className={"btn btn-sm flex-1 " + (difficulty === level ? "btn-primary" : "btn-outline")}
                  onClick={() => setDifficulty(level)}
                >
                  {t(`mode.bots.difficulty.${level}`)}
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
            playerCount={totalPlayers}
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

          <button type="submit" className="btn btn-primary">
            {t("setup.startButton")}
          </button>
        </div>
      </form>

      <RulesModal gameType={gameType} dialogRef={rulesDialogRef} />
    </div>
  );
}
