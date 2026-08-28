import { createSignal, For, Show, Switch, Match, type JSX } from "solid-js";
import { useClipboard } from "solidjs-use";
import ThemeToggle from "./components/ThemeToggle";
import TranslationToggle from "./components/TranslationToggle";
import { createTheme } from "./lib/use-theme";
import type { Word, ParseResponse, SavedResult } from "./lib/types";
import { createResultStore } from "./lib/result-store";
import { convertHanzi, type HanziVariant } from "./lib/hanzi-variant";

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
  const { copy } = useClipboard();

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

  // The character-script variant in which the parsed hanzi are
  // displayed in the results view. Defaults to the original input and
  // can be changed via the dropdown in the results view.
  const [hanziVariant, setHanziVariant] =
    createSignal<HanziVariant>("original");

  // Whether English translations are shown below the pinyin in the
  // parsed-text display. Defaults to off so the display stays clean;
  // the switch in the results view header controls it.
  const [showEnglish, setShowEnglish] = createSignal(false);

  const [deletePendingId, setDeletePendingId] = createSignal<string | null>(
    null,
  );

  const minFontScale = 0.5;
  const maxFontScale = 3;
  const [fontScale, setFontScale] = createSignal(1);

  const [currentInputText, setCurrentInputText] = createSignal("");

  // The ID of the result currently displayed in the results view. It is
  // needed so the "Edit title" pencil button in that view knows which
  // history item to rename.
  const [currentResultId, setCurrentResultId] = createSignal<string | null>(
    null,
  );

  // The ID of the history item whose title is being edited, plus the
  // current value of the title input inside the edit-title popup.
  const [editTitleId, setEditTitleId] = createSignal<string | null>(null);
  const [editTitleValue, setEditTitleValue] = createSignal("");

  const { results, addResult, getResult, deleteResult, updateResultTitle } =
    createResultStore();

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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120_000);

    try {
      const response = await fetch(`${baseUrl}/text/parse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(
          `Server responded with ${response.status}${body ? `: ${body}` : ""}`,
        );
      }

      const data: ParseResponse = (await response.json()) as ParseResponse;
      const saved = addResult(text(), data.words);
      setWords(saved.words);
      setCurrentInputText(text());
      setCurrentResultId(saved.id);
      // Each newly opened result starts with the original characters,
      // so a previous session's script choice does not leak into it.
      setHanziVariant("original");
      // The English-translation switch also resets to its default off
      // state for each newly parsed result.
      setShowEnglish(false);
      setView("results");
      setText("");
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setError(
          "Request timed out after 2 minutes. Please try again with shorter text.",
        );
      } else {
        const message =
          err instanceof Error ? err.message : "An unknown error occurred.";
        setError(message);
      }
    } finally {
      clearTimeout(timeoutId);
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
   * Handler for clicking the trash icon on a history item. Sets the
   * `deletePendingId` signal to the result's ID so the confirmation
   * popup is displayed for that specific item.
   */
  function handleDeleteClick(id: string): void {
    setDeletePendingId(id);
  }

  /**
   * Confirms deletion: removes the result from the store via
   * `deleteResult`, then dismisses the confirmation popup by setting
   * `deletePendingId` back to `null`.
   */
  function handleConfirmDelete(): void {
    const id = deletePendingId();
    if (id !== null) {
      deleteResult(id);
      setDeletePendingId(null);
    }
  }

  /**
   * Cancels the pending deletion by resetting `deletePendingId` to
   * `null`, which hides the confirmation popup without modifying the
   * results array.
   */
  function handleCancelDelete(): void {
    setDeletePendingId(null);
  }

  /**
   * Get the first 10 characters for the preview in the history list.
   * Used for the preview label in the history list.
   */
  function getPreviewText(input: string): string {
    const preview = input.slice(0, 10);
    return input.length > 10 ? `${preview}...` : preview;
  }

  /**
   * Loads a previously saved result by its ID and switches to the
   * results view. The words signal is populated from the saved result
   * so the parsed-word display renders the selected analysis.
   */
  function handleSelectResult(id: string): void {
    const result = getResult(id);
    if (result) {
      setWords(result.words);
      setCurrentInputText(result.text);
      setCurrentResultId(result.id);
      setActiveWordIndex(null);
      // Each newly opened result starts with the original characters,
      // so a previous session's script choice does not leak into it.
      setHanziVariant("original");
      // The English-translation switch also resets to its default off
      // state for each newly opened history item.
      setShowEnglish(false);
      setView("results");
    }
  }

  /**
   * Returns the hanzi of a word converted to the currently selected
   * character variant. The `"original"` variant returns the word's
   * hanzi untouched; the other variants run it through OpenCC.
   */
  function displayHanzi(word: Word): string {
    return convertHanzi(word.hanzi, hanziVariant());
  }

  /**
   * Handler for changing the character-variant dropdown in the results
   * view. Updates the `hanziVariant` signal so every displayed hanzi
   * re-renders in the selected script.
   */
  function handleVariantChange(
    event: Event & { currentTarget: HTMLSelectElement },
  ): void {
    setHanziVariant(event.currentTarget.value as HanziVariant);
  }

  /**
   * Returns the display title of a saved result: the user-defined
   * title when one has been set, otherwise a preview of the original
   * input text.
   */
  function getResultTitle(result: SavedResult): string {
    return result.title ?? getPreviewText(result.text);
  }

  /**
   * Opens the edit-title popup for the given history item. The input
   * is pre-filled with the result's current display title (the custom
   * title if set, otherwise the preview text).
   */
  function handleEditTitleClick(id: string | null): void {
    if (id === null) {
      return;
    }

    const result = getResult(id);
    // Guard against stale IDs (e.g. the result was deleted while the
    // results view was open).
    if (!result) {
      return;
    }

    setEditTitleId(id);
    setEditTitleValue(getResultTitle(result));
  }

  /**
   * Confirms the title edit: persists the new title via
   * `updateResultTitle`, then dismisses the popup. An empty input
   * resets the title back to the default text preview.
   */
  function handleConfirmEditTitle(): void {
    const id = editTitleId();
    if (id !== null) {
      updateResultTitle(id, editTitleValue());
      setEditTitleId(null);
    }
  }

  /**
   * Cancels the title edit by closing the popup without applying any
   * change to the stored title.
   */
  function handleCancelEditTitle(): void {
    setEditTitleId(null);
  }

  /**
   * Toggles the popup for the word at the given index and copies the
   * word to the clipboard in the format "hanzi (pinyin)". If the same
   * index is already active, the popup is dismissed (without copying).
   */
  function handleWordClick(index: number): void {
    const newIndex = activeWordIndex() === index ? null : index;
    setActiveWordIndex(newIndex);
    if (newIndex !== null) {
      const word = words()[index];
      if (word !== undefined && isHanziWord(word)) {
        // Copy the hanzi in the currently displayed variant so what the
        // user sees is what gets copied.
        copy(`${displayHanzi(word)} (${word.pinyin}): ${word.english}`).catch(
          () => {
            /* clipboard write is best-effort — ignore failures */
          },
        );
      }
    }
  }

  /**
   * Increments the font scale by `delta`, clamped to [minFontScale,
   * maxFontScale]. This adjusts the --font-scale CSS custom property
   * applied on the results container so both hanzi and pinyin resize.
   */
  function adjustFontScale(delta: number): void {
    setFontScale((prev) => {
      const next = prev + delta;
      if (next < minFontScale) {
        return minFontScale;
      }

      if (next > maxFontScale) {
        return maxFontScale;
      }

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

      {/* Confirmation popup — overlays the entire page when the user
          clicks the trash icon on a history item. Clicking outside the
          dialog (on the backdrop) cancels the deletion. */}
      <Show when={deletePendingId() !== null}>
        <div
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={handleCancelDelete}
          role="dialog"
          aria-label="Delete confirmation"
        >
          <div
            class="mx-4 w-full max-w-sm rounded-lg border border-border bg-background p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <p class="text-sm text-foreground">
              Are you sure you want to delete this result? This action cannot be
              undone.
            </p>
            <div class="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={handleCancelDelete}
                class="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                class="inline-flex items-center justify-center rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* Edit-title popup — overlays the entire page when the user
          clicks the pencil icon on a history item (or in the results
          view). Clicking outside the dialog (on the backdrop) cancels
          the edit without applying changes. */}
      <Show when={editTitleId() !== null}>
        <div
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={handleCancelEditTitle}
          role="dialog"
          aria-label="Edit Title"
        >
          <div
            class="mx-4 w-full max-w-sm rounded-lg border border-border bg-background p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 class="text-lg font-semibold text-foreground">Edit Title</h3>
            {/* The input is pre-filled with the current title (or the
                preview text when no custom title exists). */}
            <input
              type="text"
              value={editTitleValue()}
              onInput={(e) => setEditTitleValue(e.currentTarget.value)}
              aria-label="Title"
              class="mt-3 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder-muted-foreground transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <div class="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={handleCancelEditTitle}
                class="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmEditTitle}
                class="inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Edit
              </button>
            </div>
          </div>
        </div>
      </Show>

      <Switch>
        {/* ---------- Results view ---------- */}
        <Match when={view() === "results"}>
          <main class="w-[90%] max-w-5xl rounded-lg border border-border bg-background p-4 shadow-sm sm:p-8">
            {/* The header stacks vertically on small screens so the
                controls never overflow the card horizontally; from `sm`
                upwards it falls back to the title-left/controls-right
                row layout. */}
            <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 class="text-xl font-semibold text-foreground">
                Parsed Result
              </h2>
              <div class="flex flex-wrap items-center gap-2">
                {/* Character-variant dropdown — switches every displayed
                    hanzi between the original input, Simplified, and
                    Traditional Chinese. */}
                <div class="flex items-center gap-1.5">
                  {/* English-translation switch — when on, the English
                      translation of each word is shown below its pinyin. */}
                  <TranslationToggle
                    checked={showEnglish}
                    onChange={setShowEnglish}
                  />
                  <span
                    class="text-sm text-muted-foreground select-none"
                    aria-hidden="true"
                  >
                    English
                  </span>
                </div>
                <select
                  value={hanziVariant()}
                  onChange={handleVariantChange}
                  aria-label="Character variant"
                  class="rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="original">Original Input</option>
                  <option value="simplified">Simplified (简体字)</option>
                  <option value="traditional">Traditional (繁體字)</option>
                </select>
                <button
                  type="button"
                  onClick={() => {
                    // Copy the input text converted to the currently
                    // selected character variant, so what the user sees
                    // in the results view is what gets copied.
                    copy(
                      convertHanzi(currentInputText(), hanziVariant()),
                    ).catch(() => {
                      /* clipboard write is best-effort — ignore failures */
                    });
                  }}
                  aria-label="Copy input text"
                  title="Copy input text"
                  class="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="h-4 w-4"
                    aria-hidden="true"
                  >
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                </button>
                {/* Edit-title pencil — opens the edit-title popup for
                    the result currently shown in this view. */}
                <button
                  type="button"
                  onClick={() => handleEditTitleClick(currentResultId())}
                  aria-label="Edit title"
                  title="Edit title"
                  class="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="h-4 w-4"
                    aria-hidden="true"
                  >
                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                    <path d="m15 5 4 4" />
                  </svg>
                </button>
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
                    -
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
                          aria-label={`${displayHanzi(word)}: ${word.english}`}
                        >
                          <span class="hanzi">{displayHanzi(word)}</span>
                          <Show when={isHanziWord(word)}>
                            <span class="pinyin">{word.pinyin}</span>
                          </Show>
                          {/* English translation — only rendered when
                              the switch in the header is toggled on. */}
                          <Show when={showEnglish() && isHanziWord(word)}>
                            <span class="english">{word.english}</span>
                          </Show>

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
                  spellcheck={false}
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

            {/* History list — shows all previously saved parsing results
                sorted by timestamp (most recent first). Each item displays
                the numeric order and its title (the custom title when set,
                otherwise a preview of the first 10 characters from the
                original input text). */}
            <Show when={results().length > 0}>
              <div class="mt-6">
                <h2 class="mb-2 text-lg font-semibold text-foreground">
                  History
                </h2>
                <ol class="space-y-1">
                  <For each={results()}>
                    {(result, index) => (
                      <li class="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleSelectResult(result.id)}
                          class="flex-1 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <span class="font-medium tabular-nums text-muted-foreground">
                            {index() + 1}.
                          </span>{" "}
                          {getResultTitle(result)}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            copy(result.text).catch(() => {});
                          }}
                          aria-label="Copy input text"
                          title="Copy input text"
                          class="shrink-0 rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            class="h-4 w-4"
                            aria-hidden="true"
                          >
                            <rect
                              x="9"
                              y="9"
                              width="13"
                              height="13"
                              rx="2"
                              ry="2"
                            />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                          </svg>
                        </button>
                        {/* Edit-title pencil — opens the edit-title
                            popup for this history item. */}
                        <button
                          type="button"
                          onClick={() => handleEditTitleClick(result.id)}
                          aria-label="Edit title"
                          title="Edit title"
                          class="shrink-0 rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            class="h-4 w-4"
                            aria-hidden="true"
                          >
                            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                            <path d="m15 5 4 4" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteClick(result.id)}
                          aria-label="Delete result"
                          class="shrink-0 rounded-md p-2 text-muted-foreground transition-colors hover:bg-red-100 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-red-950 dark:hover:text-red-400"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            class="h-4 w-4"
                            aria-hidden="true"
                          >
                            <path d="M3 6h18" />
                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                            <line x1="10" y1="11" x2="10" y2="17" />
                            <line x1="14" y1="11" x2="14" y2="17" />
                          </svg>
                        </button>
                      </li>
                    )}
                  </For>
                </ol>
              </div>
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
