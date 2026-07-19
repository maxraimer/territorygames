import { useState } from "react";
import OnlineChoiceScreen from "./OnlineChoiceScreen";
import CreateLobbyScreen from "./CreateLobbyScreen";
import JoinLobbyScreen from "./JoinLobbyScreen";
import LobbyScreen from "./LobbyScreen";

/**
 * Owns the online sub-flow: choice -> create|join -> lobby. Kept as its own
 * screen (not folded into App.jsx) so the lobby state/API usage stays out of
 * the main state machine — App.jsx only ever sees `onGameStart`.
 */
export default function OnlineModeScreen({ gameType, firstPlayerName, onBack, onGameStart }) {
  const [view, setView] = useState("choice"); // 'choice' | 'create' | 'join' | 'lobby'
  const [session, setSession] = useState(null); // { code, playerId }

  function handleJoined(nextSession) {
    setSession(nextSession);
    setView("lobby");
  }

  function handleLeftLobby() {
    setSession(null);
    setView("choice");
  }

  if (view === "create") {
    return (
      <CreateLobbyScreen
        gameType={gameType}
        firstPlayerName={firstPlayerName}
        onCreated={handleJoined}
        onBack={() => setView("choice")}
      />
    );
  }

  if (view === "join") {
    return (
      <JoinLobbyScreen
        firstPlayerName={firstPlayerName}
        onJoined={handleJoined}
        onBack={() => setView("choice")}
      />
    );
  }

  if (view === "lobby" && session) {
    return (
      <LobbyScreen
        gameType={gameType}
        code={session.code}
        playerId={session.playerId}
        onLeave={handleLeftLobby}
        onGameStart={onGameStart}
      />
    );
  }

  return <OnlineChoiceScreen gameType={gameType} onSelect={setView} onBack={onBack} />;
}
