import { useEffect, useState } from "react";

const THEME_STORAGE_KEY = "territorygames-theme";
export const LIGHT_THEME = "emerald";
export const DARK_THEME = "dim";

function detectInitialTheme() {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === LIGHT_THEME || stored === DARK_THEME) return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? DARK_THEME : LIGHT_THEME;
}

/** Manual theme toggle, persisted to localStorage and applied via `data-theme` on <html>. */
export default function useTheme() {
  const [theme, setTheme] = useState(detectInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((prev) => (prev === LIGHT_THEME ? DARK_THEME : LIGHT_THEME));
  }

  return [theme, toggleTheme];
}
