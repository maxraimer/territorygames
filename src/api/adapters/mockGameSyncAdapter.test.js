import { describe, it, expect, vi } from "vitest";
import { pushGameState, getGameState, subscribeToGameState } from "./mockGameSyncAdapter";

describe("pushGameState / getGameState", () => {
  it("round-trips the pushed state, seq, and an updatedAt timestamp", async () => {
    const code = `T${Math.random().toString(36).slice(2, 8)}`.toUpperCase();
    await pushGameState(code, { turnPhase: "idle" }, 1);
    const entry = await getGameState(code);
    expect(entry).toMatchObject({ seq: 1, state: { turnPhase: "idle" } });
    expect(typeof entry.updatedAt).toBe("number");
  });

  it("accepts a lowercase code (auto-uppercases)", async () => {
    const code = `T${Math.random().toString(36).slice(2, 8)}`.toUpperCase();
    await pushGameState(code, { a: 1 }, 1);
    const entry = await getGameState(code.toLowerCase());
    expect(entry.state).toEqual({ a: 1 });
  });

  it("getGameState returns null when nobody has pushed yet", async () => {
    const code = `T${Math.random().toString(36).slice(2, 8)}`.toUpperCase();
    expect(await getGameState(code)).toBeNull();
  });

  it("a later push overwrites the earlier one", async () => {
    const code = `T${Math.random().toString(36).slice(2, 8)}`.toUpperCase();
    await pushGameState(code, { turnPhase: "idle" }, 1);
    await pushGameState(code, { turnPhase: "placing" }, 2);
    const entry = await getGameState(code);
    expect(entry).toMatchObject({ seq: 2, state: { turnPhase: "placing" } });
  });
});

describe("subscribeToGameState", () => {
  it("notifies subscribers of every subsequent push, with the full entry", async () => {
    const code = `T${Math.random().toString(36).slice(2, 8)}`.toUpperCase();
    const onUpdate = vi.fn();
    const unsubscribe = subscribeToGameState(code, onUpdate);

    await pushGameState(code, { turnPhase: "rolling" }, 1);
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate.mock.calls[0][0]).toMatchObject({ seq: 1, state: { turnPhase: "rolling" } });

    unsubscribe();
  });

  it("stops notifying after unsubscribe", async () => {
    const code = `T${Math.random().toString(36).slice(2, 8)}`.toUpperCase();
    const onUpdate = vi.fn();
    const unsubscribe = subscribeToGameState(code, onUpdate);
    unsubscribe();

    await pushGameState(code, { turnPhase: "rolling" }, 1);
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("keeps separate subscribers for different codes independent", async () => {
    const codeA = `T${Math.random().toString(36).slice(2, 8)}`.toUpperCase();
    const codeB = `T${Math.random().toString(36).slice(2, 8)}`.toUpperCase();
    const onUpdateA = vi.fn();
    const onUpdateB = vi.fn();
    subscribeToGameState(codeA, onUpdateA);
    subscribeToGameState(codeB, onUpdateB);

    await pushGameState(codeA, { turnPhase: "placing" }, 1);
    expect(onUpdateA).toHaveBeenCalledTimes(1);
    expect(onUpdateB).not.toHaveBeenCalled();
  });
});
