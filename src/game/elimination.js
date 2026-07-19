// Player elimination, shared by every game with 3+ players: once a player
// has nowhere left to ever place anything, they're skipped in turn order
// from then on — but their pieces and score stay on the board exactly as
// they were. Not used at all for 2-player games, which already end via
// isGameOver as soon as either side is stuck.

/**
 * Finds any not-yet-eliminated player who now has zero possible future
 * moves and marks them eliminated.
 */
export function detectNewEliminations(board, players, hasMoveFn, prevEliminated) {
  if (players.length <= 2) return { eliminatedPlayerIds: prevEliminated, newlyEliminated: [] };
  const newlyEliminated = players.filter((p) => !prevEliminated.includes(p.id) && !hasMoveFn(board, p.id));
  if (newlyEliminated.length === 0) return { eliminatedPlayerIds: prevEliminated, newlyEliminated: [] };
  return {
    eliminatedPlayerIds: [...prevEliminated, ...newlyEliminated.map((p) => p.id)],
    newlyEliminated,
  };
}

/** The next player index in turn order, skipping anyone already eliminated. */
export function nextActivePlayerIndex(players, currentPlayerIndex, eliminatedPlayerIds) {
  const n = players.length;
  for (let step = 1; step <= n; step++) {
    const candidate = (currentPlayerIndex + step) % n;
    if (!eliminatedPlayerIds.includes(players[candidate].id)) return candidate;
  }
  return currentPlayerIndex; // everyone eliminated — shouldn't happen, game should already be over
}
