import { useTranslation } from "react-i18next";
import { FaTrophy, FaHandshake } from "react-icons/fa";
import { FiClock, FiRepeat } from "react-icons/fi";
import Board from "./Board";
import HexBoard from "./HexBoard";
import { formatDuration } from "../game/time";
import { playerArea } from "../game/rules";
import { terrainLayersForRender } from "../game/route";

export default function GameOverScreen({ board, players, gameType, startedAt, endedAt, moveCount, reason, onRestart }) {
  const { t } = useTranslation();
  const scored = players
    .map((p) => ({ ...p, area: playerArea(board, p.id) }))
    .sort((a, b) => b.area - a.area);
  const topArea = scored[0].area;
  const winners = scored.filter((p) => p.area === topArea);
  const isDraw = winners.length > 1;

  return (
    <div className="flex min-h-screen flex-col items-center gap-6 bg-base-200 p-6">
      <div className="text-center">
        <div className="flex justify-center text-5xl text-primary">
          {isDraw ? <FaHandshake /> : <FaTrophy />}
        </div>
        <h1 className="mt-2 text-3xl font-bold">
          {isDraw ? t("gameOver.drawTitle") : t("gameOver.winnerTitle", { name: winners[0].name })}
        </h1>
        <p className="mt-1 text-base-content/60">
          {isDraw
            ? t("gameOver.drawSubtitle", { count: topArea })
            : t("gameOver.winnerSubtitle", { count: winners[0].area })}
        </p>
        {reason === "decided" && (
          <p className="mt-1 text-xs text-base-content/40">{t("gameOver.reasonDecided")}</p>
        )}
        {reason === "majority" && (
          <p className="mt-1 text-xs text-base-content/40">{t("gameOver.reasonMajority")}</p>
        )}
        {startedAt != null && (
          <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-base-content/50">
            <FiClock className="h-3.5 w-3.5" /> {formatDuration((endedAt ?? Date.now()) - startedAt)}
            <span className="mx-0.5">·</span>
            <FiRepeat className="h-3.5 w-3.5" /> {t("gameOver.movesCount", { count: moveCount })}
          </p>
        )}
      </div>

      <div className="flex flex-wrap justify-center gap-4">
        {scored.map((p) => (
          <div
            key={p.id}
            className={
              "card w-40 bg-base-100 shadow " + (winners.some((w) => w.id === p.id) ? "ring-2 ring-primary" : "")
            }
          >
            <div className="card-body items-center gap-1 p-4">
              <span className="h-4 w-4 rounded-full" style={{ background: p.color }} />
              <span className="font-semibold">{p.name}</span>
              <span className="font-mono text-sm text-base-content/70">{t("gameOver.cellsCount", { count: p.area })}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="max-w-full overflow-x-auto rounded-lg border border-base-300 bg-base-100 p-2">
        {gameType === "hex" ? (
          <HexBoard board={board} players={players} previewPlacement={null} interactive={false} />
        ) : (
          <Board
            board={board}
            players={players}
            previewPlacement={null}
            interactive={false}
            terrain={gameType === "route" ? terrainLayersForRender(board) : undefined}
          />
        )}
      </div>

      <button className="btn btn-primary" onClick={onRestart}>
        {t("gameOver.restartButton")}
      </button>
    </div>
  );
}
