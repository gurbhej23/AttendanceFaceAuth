export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "app_theme";

export function getStoredTheme(): Theme {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme);
  root.style.colorScheme = theme === "dark" ? "dark" : "light";

  const meta = document.querySelector('meta[name="theme-color"]');
  meta?.setAttribute("content", theme === "dark" ? "#0f172a" : "#ffffff");
}

export function initThemeFromStorage() {
  applyTheme(getStoredTheme());
}
