import { describe, it, expect } from "vitest";
import { makeHumanPlayer, makeBotPlayer, pickBotColors, BOT_DIFFICULTIES } from "./players";
import { COLOR_PALETTE } from "./constants";

describe("makeHumanPlayer", () => {
  it("builds a human player with an index-derived id and palette color", () => {
    const player = makeHumanPlayer(0, "Alice");
    expect(player).toEqual({ id: "p1", name: "Alice", color: COLOR_PALETTE[0], type: "human" });
  });

  it("accepts a color override", () => {
    const player = makeHumanPlayer(2, "Alice", "#custom");
    expect(player.id).toBe("p3");
    expect(player.color).toBe("#custom");
  });
});

describe("makeBotPlayer", () => {
  it("builds a bot player with a difficulty and a name from the injected nameFn", () => {
    const nameFn = (n) => `Bot ${n}`;
    const player = makeBotPlayer(1, "medium", nameFn);
    expect(player).toEqual({ id: "p2", name: "Bot 2", color: COLOR_PALETTE[1], type: "bot", difficulty: "medium" });
  });

  it("accepts a color override", () => {
    const player = makeBotPlayer(0, "easy", (n) => `Bot ${n}`, "#custom");
    expect(player.color).toBe("#custom");
  });

  it("exposes exactly the 3 expected difficulty levels", () => {
    expect(BOT_DIFFICULTIES).toEqual(["easy", "medium", "hard"]);
  });
});

describe("pickBotColors", () => {
  it("never picks an excluded color", () => {
    for (let i = 0; i < 20; i++) {
      const colors = pickBotColors([COLOR_PALETTE[0]], 3);
      expect(colors).not.toContain(COLOR_PALETTE[0]);
    }
  });

  it("never repeats a color across the picked set (no bot-vs-bot collisions either)", () => {
    for (let i = 0; i < 20; i++) {
      const colors = pickBotColors([COLOR_PALETTE[0]], 3);
      expect(new Set(colors).size).toBe(colors.length);
    }
  });

  it("returns exactly `count` colors when the palette has enough room", () => {
    expect(pickBotColors([COLOR_PALETTE[0]], 3)).toHaveLength(3);
  });

  it("varies across calls (not a fixed order)", () => {
    const seen = new Set();
    for (let i = 0; i < 20; i++) {
      seen.add(pickBotColors([COLOR_PALETTE[0]], 1)[0]);
    }
    expect(seen.size).toBeGreaterThan(1);
  });
});
