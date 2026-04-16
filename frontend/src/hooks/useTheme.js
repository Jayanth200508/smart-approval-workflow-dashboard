import { useEffect, useState } from "react";

const THEME_KEY = "flowpilot_theme";
const AUTH_STORAGE_KEY = "smart_approval_auth";

const resolveThemeKey = () => {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return THEME_KEY;
    const parsed = JSON.parse(raw);
    const userId = parsed?.user?.id;
    if (!userId) return THEME_KEY;
    return `${THEME_KEY}_${userId}`;
  } catch {
    return THEME_KEY;
  }
};

export const useTheme = () => {
  const [themeKey, setThemeKey] = useState(resolveThemeKey());
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem(resolveThemeKey());
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });

  useEffect(() => {
    const syncThemeKey = () => setThemeKey(resolveThemeKey());
    window.addEventListener("storage", syncThemeKey);
    return () => window.removeEventListener("storage", syncThemeKey);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(themeKey);
    if (saved === "light" || saved === "dark") {
      setTheme(saved);
    }
  }, [themeKey]);

  useEffect(() => {
    localStorage.setItem(themeKey, theme);
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme, themeKey]);

  const toggleTheme = () =>
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));

  const setLight = () => setTheme("light");
  const setDark = () => setTheme("dark");

  return { theme, toggleTheme, setLight, setDark, isDark: theme === "dark" };
};
