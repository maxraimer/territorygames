// Player factories shared by hot-seat, bots, and online setup flows. Every
// player object carries a `type` ("human" | "bot") — this is only the data
// shape bot mode needs for now; actual bot decision-making is a later stage,
// so a "bot" player is otherwise played exactly like a human (manual clicks).
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
