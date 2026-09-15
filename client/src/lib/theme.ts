export type ThemePreference = "light" | "dark" | "system";

const STORAGE_KEY = "evenementenradar-theme";

export function getThemePreference(): ThemePreference {
  if (typeof window === "undefined") return "system";
  const saved = window.localStorage.getItem(STORAGE_KEY);
  return saved === "light" || saved === "dark" ? saved : "system";
}

export function applyTheme(preference: ThemePreference): boolean {
  const dark = preference === "dark" ||
    (preference === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  return dark;
}

export function setThemePreference(preference: Exclude<ThemePreference, "system">) {
  window.localStorage.setItem(STORAGE_KEY, preference);
  applyTheme(preference);
}