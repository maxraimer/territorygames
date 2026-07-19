import { describe, it, expect, vi } from "vitest";
import { createLobby, joinLobby, getLobby, leaveLobby, startLobby, subscribeToLobby } from "./mockLobbyAdapter";
import { LobbyError, LOBBY_ERROR_CODES } from "../lobbyErrors";

describe("createLobby / getLobby", () => {
  it("creates a lobby with the host as its sole, host-flagged player", async () => {
    const { lobby, playerId } = await createLobby({ gameType: "dice", config: { maxPlayers: 4 }, hostName: "Alice" });
    expect(lobby.code).toMatch(/^[A-Z0-9]{6}$/);
    expect(lobby.status).toBe("waiting");
    expect(lobby.hostId).toBe(playerId);
    expect(lobby.players).toEqual([{ id: playerId, name: "Alice", color: expect.any(String), isHost: true }]);
  });

  it("round-trips through getLobby using either case for the code", async () => {
    const { lobby } = await createLobby({ gameType: "hex", config: {}, hostName: "Bob" });
    const fetched = await getLobby(lobby.code.toLowerCase());
    expect(fetched).toEqual(lobby);
  });

  it("getLobby throws NOT_FOUND for an unknown code", async () => {
    await expect(getLobby("ZZZZ99")).rejects.toMatchObject({ code: LOBBY_ERROR_CODES.NOT_FOUND });
    await expect(getLobby("ZZZZ99")).rejects.toBeInstanceOf(LobbyError);
  });
});

describe("joinLobby", () => {
  it("adds a new player with a distinct color and returns the updated lobby", async () => {
    const { lobby } = await createLobby({ gameType: "dice", config: { maxPlayers: 4 }, hostName: "Alice" });
    const { lobby: joined, playerId } = await joinLobby(lobby.code, { name: "Bob" });
    expect(joined.players).toHaveLength(2);
    const joinedPlayer = joined.players.find((p) => p.id === playerId);
    expect(joinedPlayer).toMatchObject({ name: "Bob", isHost: false });
    expect(joinedPlayer.color).not.toBe(joined.players[0].color);
  });

  it("accepts a lowercase code (auto-uppercases)", async () => {
    const { lobby } = await createLobby({ gameType: "dice", config: {}, hostName: "Alice" });
    const { lobby: joined } = await joinLobby(lobby.code.toLowerCase(), { name: "Bob" });
    expect(joined.players).toHaveLength(2);
  });

  it("throws NOT_FOUND for an unknown code", async () => {
    await expect(joinLobby("NOPE42", { name: "Bob" })).rejects.toMatchObject({ code: LOBBY_ERROR_CODES.NOT_FOUND });
  });

  it("throws FULL once the lobby reaches config.maxPlayers", async () => {
    const { lobby } = await createLobby({ gameType: "dice", config: { maxPlayers: 2 }, hostName: "Alice" });
    await joinLobby(lobby.code, { name: "Bob" });
    await expect(joinLobby(lobby.code, { name: "Carol" })).rejects.toMatchObject({ code: LOBBY_ERROR_CODES.FULL });
  });

  it("throws ALREADY_STARTED once the host has started the game", async () => {
    const { lobby, playerId } = await createLobby({ gameType: "dice", config: { maxPlayers: 4 }, hostName: "Alice" });
    await joinLobby(lobby.code, { name: "Bob" });
    await startLobby(lobby.code, playerId);
    await expect(joinLobby(lobby.code, { name: "Carol" })).rejects.toMatchObject({
      code: LOBBY_ERROR_CODES.ALREADY_STARTED,
    });
  });
});

describe("startLobby", () => {
  it("throws NOT_HOST when a non-host player tries to start", async () => {
    const { lobby } = await createLobby({ gameType: "dice", config: { maxPlayers: 4 }, hostName: "Alice" });
    const { playerId: guestId } = await joinLobby(lobby.code, { name: "Bob" });
    await expect(startLobby(lobby.code, guestId)).rejects.toMatchObject({ code: LOBBY_ERROR_CODES.NOT_HOST });
  });

  it("throws NOT_ENOUGH_PLAYERS with only the host present", async () => {
    const { lobby, playerId } = await createLobby({ gameType: "dice", config: { maxPlayers: 4 }, hostName: "Alice" });
    await expect(startLobby(lobby.code, playerId)).rejects.toMatchObject({ code: LOBBY_ERROR_CODES.NOT_ENOUGH_PLAYERS });
  });

  it("sets status to started once the host starts with enough players", async () => {
    const { lobby, playerId } = await createLobby({ gameType: "dice", config: { maxPlayers: 4 }, hostName: "Alice" });
    await joinLobby(lobby.code, { name: "Bob" });
    const started = await startLobby(lobby.code, playerId);
    expect(started.status).toBe("started");
  });
});

describe("leaveLobby", () => {
  it("removes the player from the roster", async () => {
    const { lobby, playerId: hostId } = await createLobby({ gameType: "dice", config: { maxPlayers: 4 }, hostName: "Alice" });
    const { playerId: guestId } = await joinLobby(lobby.code, { name: "Bob" });
    await leaveLobby(lobby.code, guestId);
    const after = await getLobby(lobby.code);
    expect(after.players.map((p) => p.id)).toEqual([hostId]);
  });

  it("promotes the next player to host when the host leaves", async () => {
    const { lobby, playerId: hostId } = await createLobby({ gameType: "dice", config: { maxPlayers: 4 }, hostName: "Alice" });
    const { playerId: guestId } = await joinLobby(lobby.code, { name: "Bob" });
    await leaveLobby(lobby.code, hostId);
    const after = await getLobby(lobby.code);
    expect(after.hostId).toBe(guestId);
    expect(after.players.find((p) => p.id === guestId).isHost).toBe(true);
  });

  it("deletes the lobby once the last player leaves", async () => {
    const { lobby, playerId: hostId } = await createLobby({ gameType: "dice", config: { maxPlayers: 4 }, hostName: "Alice" });
    await leaveLobby(lobby.code, hostId);
    await expect(getLobby(lobby.code)).rejects.toMatchObject({ code: LOBBY_ERROR_CODES.NOT_FOUND });
  });
});

describe("subscribeToLobby", () => {
  it("notifies subscribers on every subsequent change", async () => {
    const { lobby } = await createLobby({ gameType: "dice", config: { maxPlayers: 4 }, hostName: "Alice" });
    const onUpdate = vi.fn();
    const unsubscribe = subscribeToLobby(lobby.code, onUpdate);

    await joinLobby(lobby.code, { name: "Bob" });
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate.mock.calls[0][0].players).toHaveLength(2);

    unsubscribe();
  });

  it("stops notifying after unsubscribe", async () => {
    const { lobby } = await createLobby({ gameType: "dice", config: { maxPlayers: 4 }, hostName: "Alice" });
    const onUpdate = vi.fn();
    const unsubscribe = subscribeToLobby(lobby.code, onUpdate);
    unsubscribe();

    await joinLobby(lobby.code, { name: "Bob" });
    expect(onUpdate).not.toHaveBeenCalled();
  });
});
