import { useEffect, useState } from "react";
import { formatDuration } from "../game/time";

/** Ticks once a second while the game is running; freezes once `endedAt` is set. */
export default function GameTimer({ startedAt, endedAt }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (endedAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [endedAt]);

  return <span className="font-mono tabular-nums">{formatDuration((endedAt ?? now) - startedAt)}</span>;
}
