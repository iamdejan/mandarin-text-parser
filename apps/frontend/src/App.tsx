import { createSignal, For, Show, Switch, Match, type JSX } from "solid-js";
import ThemeToggle from "./components/ThemeToggle";
import { createTheme } from "./lib/use-theme";
import type { Word, ParseResponse } from "./lib/types";

/**
 * View states for the single-page application.
 * - `"form"` — the text input and Analyse button are visible.
 * - `"results"` — the parsed word display is shown.
 */
type View = "form" | "results";

/**
 * Checks whether a string consists entirely of CJK Unified Ideographs
 * (U+4E00–U+9FFF). Punctuation and English/ASCII words return `false`,
 * which suppresses the underbrace and pinyin display for those tokens.
 */
function isHanziWord(word: Word): boolean {
  return [...word.hanzi].every(function isCJK(char: string): boolean {
    const code = char.codePointAt(0);
    return code !== undefined && code >= 0x4e00 && code <= 0x9fff;
  });
}

export default function App(): JSX.Element {
  const { theme, toggleTheme } = createTheme();

  const [text, setText] = createSignal("");
  const [charCount, setCharCount] = createSignal(0);
  const maxChars = 2000;

  const [words, setWords] = createSignal<Word[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [activeWordIndex, setActiveWordIndex] = createSignal<number | null>(
    null,
  );
  const [view, setView] = createSignal<View>("form");

  const minFontScale = 0.5;
  const maxFontScale = 3;
  const [fontScale, setFontScale] = createSignal(1);

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
   * Sends the input text to the backend `/text/parse` endpoint, then
   * switches to the results view on success. Manages loading and error
   * states during the request lifecycle.
   *
   * The base URL is read from the `VITE_BACKEND_BASE_URL` environment
   * variable injected by Vite at build time.
   *
   * @throws Does not throw — errors are captured in the `error` signal.
   */
  async function handleAnalyze(event: Event): Promise<void> {
    event.preventDefault();

    const input = text().trim();
    if (input.length === 0) {
      return;
    }

    const baseUrl = import.meta.env["VITE_BACKEND_BASE_URL"];
    if (!baseUrl) {
      setError(
        "Backend URL is not configured. Please set VITE_BACKEND_BASE_URL.",
      );
      return;
    }

    setLoading(true);
    setError(null);
    setWords([]);
    setActiveWordIndex(null);

    try {
      const response = await fetch(`${baseUrl}/text/parse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input }),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(
          `Server responded with ${response.status}${body ? `: ${body}` : ""}`,
        );
      }

      const data: ParseResponse = (await response.json()) as ParseResponse;
      setWords(data.words);
      setView("results");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "An unknown error occurred.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Returns the user to the form view and dismisses the active word
   * popup. The parsed words are preserved so the user can return to
   * the results view later. They are only cleared when a new request
   * is triggered. The previously entered text is also preserved.
   */
  function handleCloseResults(): void {
    setView("form");
    setActiveWordIndex(null);
  }

  /**
   * Switches the view to the results page, restoring the previously
   * parsed words. This is used when the user wants to return to the
   * results after closing them.
   */
  function handleViewResults(): void {
    setView("results");
  }

  /**
   * Toggles the popup for the word at the given index. If the same
   * index is already active, the popup is dismissed.
   */
  function handleWordClick(index: number): void {
    setActiveWordIndex((prev) => (prev === index ? null : index));
  }

  /**
   * Increments the font scale by `delta`, clamped to [minFontScale,
   * maxFontScale]. This adjusts the --font-scale CSS custom property
   * applied on the results container so both hanzi and pinyin resize.
   */
  function adjustFontScale(delta: number): void {
    setFontScale((prev) => {
      const next = prev + delta;
      if (next < minFontScale) return minFontScale;
      if (next > maxFontScale) return maxFontScale;
      return Math.round(next * 100) / 100;
    });
  }

  /**
   * Formats the current font scale as a percentage string for display
   * in the zoom indicator (e.g. "100%").
   */
  function fontScalePercent(): string {
    return `${Math.round(fontScale() * 100)}%`;
  }

  return (
    <div class="relative flex min-h-screen flex-col items-center justify-center bg-background text-foreground">
      {/* Theme toggle in the top-right corner */}
      <div class="absolute right-4 top-4 z-40">
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
      </div>

      {/* Full-screen spinner overlay — shown during the API call so
          the user knows work is in progress and cannot interact. */}
      <Show when={loading()}>
        <div
          class="absolute inset-0 z-50 flex items-center justify-center bg-background/50"
          aria-label="Loading"
          role="status"
        >
          <div class="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </Show>

      <Switch>
        {/* ---------- Results view ---------- */}
        <Match when={view() === "results"}>
          <main class="w-[80%] max-w-5xl rounded-lg border border-border bg-background p-6 shadow-sm sm:p-8">
            <div class="mb-4 flex items-center justify-between">
              <h2 class="text-xl font-semibold text-foreground">
                Parsed Result
              </h2>
              <div class="flex items-center gap-2">
                {/* Zoom controls — increase/decrease font size for the
                    parsed hanzi + pinyin display. */}
                <div class="flex items-center rounded-md border border-input">
                  <button
                    type="button"
                    onClick={() => adjustFontScale(-0.25)}
                    disabled={fontScale() <= minFontScale}
                    aria-label="Zoom out"
                    class="inline-flex items-center justify-center rounded-l-md px-2 py-1 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    −
                  </button>
                  <span
                    class="px-2 py-1 text-xs tabular-nums text-muted-foreground select-none"
                    aria-live="polite"
                  >
                    {fontScalePercent()}
                  </span>
                  <button
                    type="button"
                    onClick={() => adjustFontScale(0.25)}
                    disabled={fontScale() >= maxFontScale}
                    aria-label="Zoom in"
                    class="inline-flex items-center justify-center rounded-r-md px-2 py-1 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleCloseResults}
                  class="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  Close
                </button>
              </div>
            </div>
            <div
              class="rounded-md border border-border p-4"
              style={{ "--font-scale": fontScale() } as JSX.CSSProperties}
            >
              <p class="parsed-text leading-relaxed">
                <For each={words()}>
                  {(word, index) => (
                    <Show
                      when={word.hanzi === "\n"}
                      fallback={
                        <span
                          class="parsed-word relative inline-flex cursor-pointer flex-col items-center"
                          classList={{
                            "has-pinyin": isHanziWord(word),
                          }}
                          title={word.english}
                          onClick={() => handleWordClick(index())}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              handleWordClick(index());
                            }
                          }}
                          role="button"
                          tabIndex={0}
                          aria-label={`${word.hanzi}: ${word.english}`}
                        >
                          <span class="hanzi">{word.hanzi}</span>
                          <Show when={isHanziWord(word)}>
                            <span class="pinyin">{word.pinyin}</span>
                          </Show>
                          {/* Mobile popup */}
                          <Show when={activeWordIndex() === index()}>
                            <span class="word-popup" role="tooltip">
                              {word.english}
                            </span>
                          </Show>
                        </span>
                      }
                    >
                      <br />
                    </Show>
                  )}
                </For>
              </p>
            </div>
          </main>
        </Match>

        {/* ---------- Form view ---------- */}
        <Match when={view() === "form"}>
          <main class="w-full max-w-lg rounded-lg border border-border bg-background p-6 shadow-sm sm:p-8">
            <h1 class="mb-1 text-3xl font-bold tracking-tight text-foreground">
              Mandarin Text Parser
            </h1>
            <p class="mb-6 text-md text-muted-foreground">
              Paste or type Mandarin Chinese text below and we'll break it down
              into words with pinyin and English translations.
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
                  disabled={loading()}
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
                disabled={loading()}
                class="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
              >
                {loading() ? "Analyzing..." : "Analyze"}
              </button>
            </form>

            {/* Button to return to the last result if available */}
            <Show when={words().length > 0}>
              <button
                type="button"
                onClick={handleViewResults}
                class="mt-4 inline-flex w-full items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                View last result
              </button>
            </Show>

            {/* Error banner */}
            <Show when={error()}>
              <div
                role="alert"
                class="mt-5 rounded-md border border-red-400 bg-red-50 p-3 text-sm text-red-800 dark:border-red-500 dark:bg-red-950 dark:text-red-300"
              >
                {error()}
              </div>
            </Show>
          </main>
        </Match>
      </Switch>
    </div>
  );
}
