import { createSignal, onMount, createEffect, Accessor } from "solid-js";

export type Theme = "light" | "dark";

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
 * Composable hook that manages light / dark theme toggling for a SolidJS
 * application.
 *
 * ## Behaviour
 * - Applies / removes the `"dark"` class on `<html>` and sets
 *   `data-kb-theme`.
 * - Listens for OS-level theme changes and auto-switches.
 *
 * @returns An object with:
 *  - `theme` – a reactive signal holding the current theme.
 *  - `toggleTheme` – a function that switches between "light" and "dark".
 */
export function createTheme(): {
  theme: Accessor<Theme>;
  toggleTheme: () => void;
} {
  const [theme, setTheme] = createSignal<Theme>(getSystemTheme());

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
  // when the OS preference changes.
  onMount(() => {
    applyTheme(theme());

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    // Apply the change whenever mediaQuery fires 'change' event.
    function handleChange(event: MediaQueryListEvent): void {
      setTheme(event.matches ? "dark" : "light");
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
   * Toggles between "light" and "dark" themes.
   */
  function toggleTheme(): void {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  }

  return {
    theme,
    toggleTheme,
  };
}
