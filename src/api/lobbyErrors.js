export const LOBBY_ERROR_CODES = {
  NOT_FOUND: "NOT_FOUND",
  FULL: "FULL",
  ALREADY_STARTED: "ALREADY_STARTED",
  NOT_HOST: "NOT_HOST",
  NOT_ENOUGH_PLAYERS: "NOT_ENOUGH_PLAYERS",
};

export class LobbyError extends Error {
  constructor(code, message) {
    super(message ?? code);
    this.name = "LobbyError";
    this.code = code;
  }
}
