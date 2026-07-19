// Dice rolling. In stage 1 this runs on the client, but it's isolated here
// so the same call can be swapped for a server round-trip once networking
// is introduced — the client must never be trusted to roll its own dice.

export function rollDie() {
  return 1 + Math.floor(Math.random() * 6);
}

export function rollDice() {
  return [rollDie(), rollDie()];
}
