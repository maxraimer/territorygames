import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  DEFAULT_COLS,
  DEFAULT_ROWS,
  DEFAULT_PLAYER_COUNT,
  DEFAULT_AUTO_WIN,
  DEFAULT_ALLOW_ROTATION,
  DEFAULT_DOUBLES_EXTRA_TURN,
  DEFAULT_SMART_ASSIST,
  DEFAULT_AUTO_FILL_ENCLOSED,
} from "../../game/constants";
import { createLobby } from "../../api/lobbyApi";

/**
 * The lobby is created immediately with sensible defaults — there's nothing
 * to configure up front anymore, since all of it (board size, rule toggles,
 * max players) is now editable by the host from inside LobbyScreen once
 * created, with guests seeing it live. This screen is just the brief
 * in-flight moment while that create call is out.
 */
export default function CreateLobbyScreen({ gameType, firstPlayerName, onCreated }) {
  const { t } = useTranslation();
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    const supportsAutoFillEnclosed = gameType === "tetromino" || gameType === "hex" || gameType === "route";
    createLobby({
      gameType,
      config: {
        cols: DEFAULT_COLS,
        rows: DEFAULT_ROWS,
        maxPlayers: DEFAULT_PLAYER_COUNT,
        autoWin: DEFAULT_AUTO_WIN,
        allowRotation: DEFAULT_ALLOW_ROTATION,
        doublesExtraTurn: gameType === "dice" ? DEFAULT_DOUBLES_EXTRA_TURN : false,
        smartAssist: DEFAULT_SMART_ASSIST,
        autoFillEnclosed: supportsAutoFillEnclosed && DEFAULT_AUTO_FILL_ENCLOSED,
      },
      hostName: firstPlayerName,
    }).then(({ lobby, playerId }) => onCreated({ code: lobby.code, playerId }));
  }, [gameType, firstPlayerName, onCreated]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-base-200 p-6">
      <p className="text-base-content/60">{t("mode.online.create.creating")}</p>
    </div>
  );
}
