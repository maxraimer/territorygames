import { useState } from "react";

const NICKNAME_STORAGE_KEY = "territorygames-nickname";

/** The player's persisted display name, used as player 1 in every game mode. */
export default function useNickname() {
  const [nickname, setNicknameState] = useState(() => localStorage.getItem(NICKNAME_STORAGE_KEY) ?? "");

  function setNickname(value) {
    setNicknameState(value);
    localStorage.setItem(NICKNAME_STORAGE_KEY, value);
  }

  return [nickname, setNickname];
}
