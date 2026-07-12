import { Show, type JSX } from "solid-js";
import type { Accessor } from "solid-js";
import type { Theme } from "../lib/use-theme";

/**
 * Props accepted by the {@link ThemeToggle} component.
 */
export type ThemeToggleProps = {
  /** Reactive signal holding the current theme. */
  theme: Accessor<Theme>;
  /** Callback fired when the user clicks the toggle button. */
  onToggle: () => void;
};

/**
 * A button that toggles between light and dark themes.
 *
 * Displays a sun icon when the theme is light (indicating "switch to
 * dark") and a moon icon when the theme is dark (indicating "switch to
 * light"). Rendered icons are inline SVGs so no external dependency is
 * required.
 *
 * @param props - See {@link ThemeToggleProps}.
 * @returns A JSX button element.
 */
export default function ThemeToggle(props: ThemeToggleProps): JSX.Element {
  return (
    <button
      type="button"
      aria-label={`Switch to ${props.theme() === "light" ? "dark" : "light"} mode`}
      onClick={() => props.onToggle()}
      class="inline-flex size-9 items-center justify-center rounded-md border border-input bg-background text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <Show when={props.theme() === "light"} fallback={MoonIcon()}>
        {SunIcon()}
      </Show>
    </button>
  );
}

/**
 * Inline SVG for the sun icon (light mode indicator).
 */
function SunIcon(): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="size-5"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </svg>
  );
}

/**
 * Inline SVG for the moon icon (dark mode indicator).
 */
function MoonIcon(): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="size-5"
      aria-hidden="true"
    >
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}
