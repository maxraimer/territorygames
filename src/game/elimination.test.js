import { describe, it, expect } from "vitest";
import { detectNewEliminations, nextActivePlayerIndex } from "./elimination";

const players = [{ id: "p1" }, { id: "p2" }, { id: "p3" }, { id: "p4" }];

describe("detectNewEliminations", () => {
  it("never eliminates anyone in a 2-player game", () => {
    const twoPlayers = players.slice(0, 2);
    const hasMoveFn = () => false; // everyone stuck
    const result = detectNewEliminations({}, twoPlayers, hasMoveFn, []);
    expect(result.newlyEliminated).toEqual([]);
    expect(result.eliminatedPlayerIds).toEqual([]);
  });

  it("marks players with no possible move as newly eliminated, in a 3+ player game", () => {
    const stuck = new Set(["p2"]);
    const hasMoveFn = (board, playerId) => !stuck.has(playerId);
    const result = detectNewEliminations({}, players.slice(0, 3), hasMoveFn, []);
    expect(result.newlyEliminated.map((p) => p.id)).toEqual(["p2"]);
    expect(result.eliminatedPlayerIds).toEqual(["p2"]);
  });

  it("does not re-report an already-eliminated player", () => {
    const hasMoveFn = () => false; // everyone stuck, but p1 is already recorded
    const result = detectNewEliminations({}, players.slice(0, 3), hasMoveFn, ["p1"]);
    expect(result.newlyEliminated.map((p) => p.id).sort()).toEqual(["p2", "p3"]);
    expect(result.eliminatedPlayerIds.sort()).toEqual(["p1", "p2", "p3"]);
  });

  it("returns the same array reference when nothing changed (no unnecessary re-render)", () => {
    const hasMoveFn = () => true; // everyone can still move
    const prev = ["p1"];
    const result = detectNewEliminations({}, players.slice(0, 3), hasMoveFn, prev);
    expect(result.eliminatedPlayerIds).toBe(prev);
    expect(result.newlyEliminated).toEqual([]);
  });
});

describe("nextActivePlayerIndex", () => {
  it("advances to the very next player when nobody is eliminated", () => {
    expect(nextActivePlayerIndex(players, 0, [])).toBe(1);
    expect(nextActivePlayerIndex(players, 3, [])).toBe(0); // wraps around
  });

  it("skips over eliminated players", () => {
    expect(nextActivePlayerIndex(players, 0, ["p2"])).toBe(2);
    expect(nextActivePlayerIndex(players, 0, ["p2", "p3"])).toBe(3);
  });

  it("wraps around past the end while skipping eliminated players", () => {
    expect(nextActivePlayerIndex(players, 2, ["p4", "p1"])).toBe(1);
  });

  it("falls back to the current index if everyone is eliminated", () => {
    expect(nextActivePlayerIndex(players, 1, ["p1", "p2", "p3", "p4"])).toBe(1);
  });
});
