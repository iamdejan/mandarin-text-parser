import { createSignal, type JSX } from "solid-js";
import ThemeToggle from "./components/ThemeToggle";
import { createTheme } from "./lib/use-theme";

export default function App(): JSX.Element {
  const { theme, toggleTheme } = createTheme();

  const [text, setText] = createSignal("");
  const [charCount, setCharCount] = createSignal(0);
  const maxChars = 2000;

  /**
   * Updates the text signal and the character count whenever the user
   * types in the textarea. Truncation beyond `maxChars` is prevented
   * via the `maxLength` attribute on the element itself.
   */
  function handleTextInput(
    event: Event & { currentTarget: HTMLTextAreaElement },
  ): void {
    const value = event.currentTarget.value;
    setText(value);
    setCharCount(value.length);
  }

  /**
   * Handles the Analyse button click. Currently a placeholder — the
   * backend integration will be done separately.
   */
  function handleAnalyze(event: Event): void {
    event.preventDefault();
  }

  return (
    <div class="relative flex min-h-screen flex-col items-center justify-center bg-background text-foreground">
      {/* Theme toggle in the top-right corner */}
      <div class="absolute right-4 top-4">
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
      </div>

      <main class="w-full max-w-lg rounded-lg border border-border bg-background p-6 shadow-sm sm:p-8">
        <h1 class="mb-1 text-3xl font-bold tracking-tight text-foreground">
          Mandarin Text Parser
        </h1>
        <p class="mb-6 text-md text-muted-foreground">
          Paste or type Mandarin Chinese text below and we'll break it down into
          words with pinyin and English translations.
        </p>

        <form onSubmit={handleAnalyze} class="flex flex-col gap-5">
          <div>
            <label
              for="mandarin-text"
              class="mb-1.5 block text-md font-medium text-foreground"
            >
              Mandarin text
            </label>
            <textarea
              id="mandarin-text"
              rows={8}
              maxLength={maxChars}
              value={text()}
              onInput={handleTextInput}
              placeholder="e.g. 我爱你"
              class="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder-muted-foreground ring-offset-background transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
            <p
              class="mt-1 text-right text-xs text-muted-foreground"
              aria-live="polite"
            >
              {charCount()} / {maxChars}
            </p>
          </div>

          <button
            type="submit"
            class="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
          >
            Analyse
          </button>
        </form>
      </main>
    </div>
  );
}
