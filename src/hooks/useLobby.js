import { useCallback, useEffect, useState } from "react";
import { getLobby, subscribeToLobby, startLobby, leaveLobby } from "../api/lobbyApi";

/** Live view of one lobby: fetches it once, then stays in sync via subscribeToLobby. */
export default function useLobby(code) {
  const [lobby, setLobby] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!code) return undefined;
    let cancelled = false;
    setLoading(true);
    setError(null);

    getLobby(code)
      .then((initial) => {
        if (!cancelled) setLobby(initial);
      })
      .catch((err) => {
        if (!cancelled) setError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const unsubscribe = subscribeToLobby(code, (updated) => {
      if (!cancelled) setLobby(updated);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [code]);

  const start = useCallback(
    async (playerId) => {
      try {
        await startLobby(code, playerId);
      } catch (err) {
        setError(err);
        throw err;
      }
    },
    [code]
  );

  const leave = useCallback((playerId) => leaveLobby(code, playerId), [code]);

  return { lobby, loading, error, start, leave };
}
