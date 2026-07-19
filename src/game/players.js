// Player factories shared by hot-seat, bots, and online setup flows. Every
// player object carries a `type` ("human" | "bot") plus, for bots, a
// `difficulty` that src/game/bots.js reads to decide their moves.
import { COLOR_PALETTE } from "./constants";

export const BOT_DIFFICULTIES = ["easy", "medium", "hard"];

export function makeHumanPlayer(index, name, color) {
  return {
    id: `p${index + 1}`,
    name,
    color: color ?? COLOR_PALETTE[index % COLOR_PALETTE.length],
    type: "human",
  };
}

export function makeBotPlayer(index, difficulty, nameFn, color) {
  return {
    id: `p${index + 1}`,
    name: nameFn(index + 1),
    color: color ?? COLOR_PALETTE[index % COLOR_PALETTE.length],
    type: "bot",
    difficulty,
  };
}

/**
 * `count` distinct random colors from COLOR_PALETTE, excluding `excludeColors`
 * (e.g. the human's chosen color) — so a bot never ends up sharing a color with
 * another player, which would make per-player area/turn UI ambiguous. The
 * palette has 8 colors and games cap out at 4 players, so there's always
 * enough room; callers control `count` (bounded by MAX_BOTS) and shouldn't
 * exceed what's available.
 */
export function pickBotColors(excludeColors, count) {
  const available = COLOR_PALETTE.filter((c) => !excludeColors.includes(c));
  const shuffled = [...available];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}
