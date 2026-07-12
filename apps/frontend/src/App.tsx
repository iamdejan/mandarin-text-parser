import { createSignal, For, Show, type JSX } from "solid-js";
import ThemeToggle from "./components/ThemeToggle";
import { createTheme } from "./lib/use-theme";
import type { Word, ParseResponse } from "./lib/types";

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
   * stores the resulting word list in the `words` signal. Manages
   * loading and error states during the request lifecycle.
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
    // Guard against undefined / empty string to produce a clear error
    // message instead of a confusing "Failed to fetch" from the browser.
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
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "An unknown error occurred.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Toggles the popup for the word at the given index. If the same
   * index is already active, the popup is dismissed.
   */
  function handleWordClick(index: number): void {
    setActiveWordIndex((prev) => (prev === index ? null : index));
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

        {/* Error banner */}
        <Show when={error()}>
          <div
            role="alert"
            class="mt-5 rounded-md border border-red-400 bg-red-50 p-3 text-sm text-red-800 dark:border-red-500 dark:bg-red-950 dark:text-red-300"
          >
            {error()}
          </div>
        </Show>

        {/* Parsed result */}
        <Show when={words().length > 0}>
          <div class="mt-6 rounded-md border border-border p-4">
            <p class="parsed-text leading-relaxed">
              <For each={words()}>
                {(word, index) => (
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
                )}
              </For>
            </p>
          </div>
        </Show>
      </main>
    </div>
  );
}
