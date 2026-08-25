import type { Accessor, JSX } from "solid-js";

/**
 * Props accepted by the {@link TranslationToggle} component.
 */
export type TranslationToggleProps = {
  /** Reactive signal holding the current on/off state of the switch. */
  checked: Accessor<boolean>;
  /** Callback fired with the new value when the user clicks the switch. */
  onChange: (value: boolean) => void;
};

/**
 * A switch that toggles whether English translations are shown below
 * the pinyin in the parsed-text display.
 *
 * The markup follows the Tailwind CSS Plus "Simple toggle" component:
 * a pill-shaped button with `role="switch"` whose knob slides from the
 * left (off) to the right (on). Colors reuse the project theme tokens
 * (`primary` when on, `input`/border gray when off) so it works in
 * both light and dark mode.
 *
 * @param props - See {@link TranslationToggleProps}.
 * @returns A JSX switch button element.
 */
export default function TranslationToggle(
  props: TranslationToggleProps,
): JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={props.checked()}
      aria-label="Show English translation"
      // Clicking flips the state; the parent owns the source of truth.
      onClick={() => props.onChange(!props.checked())}
      class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      classList={{
        // Tailwind UI uses bg-gray-200 for off and an accent color for
        // on; here the project's theme tokens are used instead so the
        // switch adapts to light/dark themes automatically.
        "bg-primary": props.checked(),
        "bg-input": !props.checked(),
      }}
    >
      <span
        aria-hidden="true"
        class="pointer-events-none inline-block h-5 w-5 translate-x-0 rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
        classList={{
          // Slide the knob right by 1.25rem when switched on.
          "translate-x-5": props.checked(),
        }}
      />
    </button>
  );
}
