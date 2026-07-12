import { createSignal, onMount, createEffect, Accessor } from "solid-js";

export type Theme = "light" | "dark";

const THEME_KEY = "theme-preference";

/**
 * Retrieves the user's system-level theme preference by querying the
 * `prefers-color-scheme` media query. Defaults to "light" when the
 * environment (e.g. SSR) does not support `matchMedia`.
 *
 * @returns The system theme ("light" or "dark").
 */
function getSystemTheme(): Theme {
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return "light";
}

/**
 * Reads a previously persisted theme from localStorage, if any.
 *
 * @returns The stored theme value, or `null` when not found / invalid.
 */
function getStoredTheme(): Theme | null {
  if (typeof localStorage === "undefined") {
    return null;
  }

  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark") {
    return stored;
  }

  return null;
}

/**
 * Returns the theme that should be applied on initial page load.
 *
 * Priority:
 * 1. User's persisted choice (localStorage).
 * 2. System-level OS preference (`prefers-color-scheme`).
 * 3. Default "light".
 *
 * @returns The initial theme.
 */
function getInitialTheme(): Theme {
  const stored = getStoredTheme();
  return stored ?? getSystemTheme();
}

/**
 * Composable hook that manages light / dark theme toggling for a SolidJS
 * application.
 *
 * ## Behaviour
 * - Reads the initial theme from `localStorage`, then falls back to the OS
 *   preference.
 * - Applies / removes the `"dark"` class on `<html>` and sets
 *   `data-kb-theme`.
 * - Listens for OS-level theme changes and auto-switches **only** when
 *   the user has not manually set a preference.
 * - Persists the user-chosen theme to `localStorage`.
 *
 * @returns An object with:
 *  - `theme` – a reactive signal holding the current theme.
 *  - `toggleTheme` – a function that switches between "light" and "dark".
 */
export function createTheme(): {
  theme: Accessor<Theme>;
  toggleTheme: () => void;
} {
  const [theme, setTheme] = createSignal<Theme>(getInitialTheme());

  /**
   * Applies the given theme to the DOM by setting the appropriate CSS
   * classes and data attributes on `<html>`.
   *
   * @param newTheme - The theme to apply.
   */
  function applyTheme(newTheme: Theme): void {
    if (typeof document === "undefined") {
      return;
    }

    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(newTheme);
    root.setAttribute("data-kb-theme", newTheme);
  }

  // Apply the initial theme once the component is mounted and set up a
  // listener for system-level theme changes so the UI stays in sync
  // when the OS preference changes (only when no user preference exists).
  onMount(() => {
    applyTheme(theme());

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    function handleChange(event: MediaQueryListEvent): void {
      const stored = getStoredTheme();
      if (!stored) {
        setTheme(event.matches ? "dark" : "light");
      }
    }

    mediaQuery.addEventListener("change", handleChange);
    return (): void => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  });

  // Keeps the DOM in sync whenever the theme signal changes.
  createEffect(() => {
    applyTheme(theme());
  });

  /**
   * Toggles between "light" and "dark" themes. The selected theme is
   * persisted in localStorage so it survives page reloads.
   */
  function toggleTheme(): void {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  }

  // Persist the current theme to localStorage whenever it changes.
  createEffect(() => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(THEME_KEY, theme());
    }
  });

  return {
    theme,
    toggleTheme,
  };
}
