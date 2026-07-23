import { describe, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@solidjs/testing-library";
import userEvent from "@testing-library/user-event";
import App from "./App";

const mockWords = [
  { hanzi: "你好", pinyin: "nǐhǎo", english: "hello" },
  { hanzi: "，", pinyin: "，", english: "," },
  { hanzi: "最近", pinyin: "zuìjìn", english: "recently" },
  { hanzi: "好", pinyin: "hǎo", english: "good; well" },
];

describe("App", function appDescribe() {
  beforeEach(function beforeEachHook() {
    vi.clearAllMocks();
    // Stub localStorage so theme persistence works in JSDOM.
    const store: Record<string, string> = {};
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(
      (key: string) => store[key] ?? null,
    );
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(
      (key: string, value: string) => {
        store[key] = value;
      },
    );
    // Reset fetch mock to a default null (no call) state between tests.
    vi.stubGlobal("fetch", undefined);
  });

  afterEach(function afterEachHook() {
    cleanup();
  });

  it("renders the page heading", function rendersHeading() {
    render(() => <App />);
    expect(
      screen.getByRole("heading", { name: "Mandarin Text Parser" }),
    ).toBeInTheDocument();
  });

  it("renders the Mandarin text textarea", function rendersTextarea() {
    render(() => <App />);
    expect(screen.getByLabelText("Mandarin text")).toBeInTheDocument();
  });

  it("renders the Analyze button", function rendersAnalyzeButton() {
    render(() => <App />);
    expect(screen.getByRole("button", { name: "Analyze" })).toBeInTheDocument();
  });

  it("renders the character count", function rendersCharCount() {
    render(() => <App />);
    expect(screen.getByText("0 / 2000")).toBeInTheDocument();
  });

  it("updates character count when user types", async function updatesCharCount() {
    const user = userEvent.setup();
    render(() => <App />);
    const textarea = screen.getByLabelText("Mandarin text");
    await user.type(textarea, "你好");
    expect(screen.getByText("2 / 2000")).toBeInTheDocument();
  });

  it("does not call fetch when the input is empty", async function noFetchOnEmpty() {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(() => <App />);
    const button = screen.getByRole("button", { name: "Analyze" });
    await user.click(button);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows spinner and loading button text while fetching", async function spinnerWhileLoading() {
    let resolveFetch!: (value: Response) => void;
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(() => <App />);
    const textarea = screen.getByLabelText("Mandarin text");
    await user.type(textarea, "你好");
    await user.click(screen.getByRole("button", { name: "Analyze" }));

    // The button should show "Analyzing..." while the request is in flight.
    expect(
      screen.getByRole("button", { name: "Analyzing..." }),
    ).toBeInTheDocument();

    // The full-screen spinner overlay should be visible.
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();

    // The textarea should be disabled while loading.
    expect(textarea).toBeDisabled();

    // Verify the fetch call was made with the correct body.
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/text/parse");
    expect(options.method).toBe("POST");
    expect(options.headers).toEqual({ "Content-Type": "application/json" });
    const body = JSON.parse(options.body as string);
    expect(body.text).toBe("你好");

    // Clean up — resolve the pending fetch.
    resolveFetch(
      new Response(JSON.stringify({ words: mockWords }), { status: 200 }),
    );
  });

  it("navigates to results view on successful response", async function navigatesToResults() {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ words: mockWords }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(() => <App />);
    const textarea = screen.getByLabelText("Mandarin text");
    await user.type(textarea, "你好");
    await user.click(screen.getByRole("button", { name: "Analyze" }));

    // Results page heading should be visible.
    const heading = await screen.findByRole("heading", {
      name: "Parsed Result",
    });
    expect(heading).toBeInTheDocument();

    // Close button should be visible.
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();

    // The form elements should no longer be in the DOM.
    expect(screen.queryByLabelText("Mandarin text")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Analyze" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Mandarin Text Parser" }),
    ).not.toBeInTheDocument();

    // Parsed words should be displayed on the results page.
    expect(screen.getByText("nǐhǎo")).toBeInTheDocument();
  });

  it("returns to form view when Close button is clicked", async function closeReturnsToForm() {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ words: mockWords }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(() => <App />);
    const textarea = screen.getByLabelText("Mandarin text");
    await user.type(textarea, "你好");
    await user.click(screen.getByRole("button", { name: "Analyze" }));

    // Wait for the results page.
    await screen.findByRole("heading", { name: "Parsed Result" });

    // Click the Close button.
    await user.click(screen.getByRole("button", { name: "Close" }));

    // Form elements should be visible again.
    expect(screen.getByLabelText("Mandarin text")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Analyze" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Mandarin Text Parser" }),
    ).toBeInTheDocument();

    // Previously entered text should be preserved.
    expect(textarea).toHaveValue("你好");

    // Results should be gone.
    expect(screen.queryByText("nǐhǎo")).not.toBeInTheDocument();
  });

  it("shows the English translation on hover via the title attribute", async function hoverShowsEnglish() {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ words: mockWords }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(() => <App />);
    const textarea = screen.getByLabelText("Mandarin text");
    await user.type(textarea, "你好");
    await user.click(screen.getByRole("button", { name: "Analyze" }));

    // Each word span should have a title attribute with the English
    // translation.
    const helloElement = await screen.findByTitle("hello");
    expect(helloElement).toBeInTheDocument();
  });

  it("shows popup with English translation on click", async function clickShowsPopup() {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ words: mockWords }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(() => <App />);
    const textarea = screen.getByLabelText("Mandarin text");
    await user.type(textarea, "你好");
    await user.click(screen.getByRole("button", { name: "Analyze" }));

    // Find the word element (which has the title "hello") and click it.
    const helloWord = await screen.findByTitle("hello");
    await user.click(helloWord);

    // A tooltip with the English translation should appear.
    const tooltips = screen.getAllByRole("tooltip");
    const tooltip = tooltips.find((t) => t.textContent === "hello");
    expect(tooltip).toBeInTheDocument();
  });

  it("dismisses the popup when clicking the same word again", async function dismissesPopup() {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ words: mockWords }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(() => <App />);
    const textarea = screen.getByLabelText("Mandarin text");
    await user.type(textarea, "你好");
    await user.click(screen.getByRole("button", { name: "Analyze" }));

    const helloWord = await screen.findByTitle("hello");
    await user.click(helloWord);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    // Click again to dismiss.
    await user.click(helloWord);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("displays error message when fetch fails", async function displaysFetchError() {
    const fetchMock = vi.fn().mockRejectedValue(new Error("Network error"));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(() => <App />);
    const textarea = screen.getByLabelText("Mandarin text");
    await user.type(textarea, "你好");
    await user.click(screen.getByRole("button", { name: "Analyze" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Network error");
  });

  it("displays error message on non-OK HTTP status", async function displaysHttpError() {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("Bad request", { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(() => <App />);
    const textarea = screen.getByLabelText("Mandarin text");
    await user.type(textarea, "你好");
    await user.click(screen.getByRole("button", { name: "Analyze" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("400");
  });

  it("does not display pinyin for punctuation marks", async function noPinyinForPunctuation() {
    // The comma has hanzi=，pinyin=，english=, — it is not a hanzi word.
    const commaWord = { hanzi: "，", pinyin: "，", english: "," };
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ words: [commaWord] }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(() => <App />);
    const textarea = screen.getByLabelText("Mandarin text");
    await user.type(textarea, "，");
    await user.click(screen.getByRole("button", { name: "Analyze" }));

    // The comma character should be visible.
    await screen.findByText("，");

    // But there should be no pinyin text node that is a separate element
    // with the pinyin class. We check that the parsed-word for this
    // token does NOT have the "has-pinyin" class.
    const commaContainer = (await screen.findByTitle(",")).closest(
      ".parsed-word",
    );
    expect(commaContainer).not.toHaveClass("has-pinyin");
  });

  it("disables analyze button while loading", async function disabledWhileLoading() {
    let resolveFetch!: (value: Response) => void;
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(() => <App />);
    const textarea = screen.getByLabelText("Mandarin text");
    await user.type(textarea, "你好");
    await user.click(screen.getByRole("button", { name: "Analyze" }));

    const button = screen.getByRole("button", { name: "Analyzing..." });
    expect(button).toBeDisabled();

    // Resolve the pending fetch so the test can clean up.
    resolveFetch(
      new Response(JSON.stringify({ words: mockWords }), { status: 200 }),
    );
  });

  it("clears previous error on a new analysis attempt", async function clearsError() {
    // First, produce an error.
    let failFetch = true;
    const fetchMock = vi.fn().mockImplementation(() => {
      if (failFetch) {
        return Promise.reject(new Error("First error"));
      }
      return Promise.resolve(
        new Response(JSON.stringify({ words: mockWords }), { status: 200 }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(() => <App />);
    const textarea = screen.getByLabelText("Mandarin text");
    await user.type(textarea, "你好");

    // First attempt — fails.
    await user.click(screen.getByRole("button", { name: "Analyze" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("First error");

    // Second attempt — succeeds, view switches to results page.
    failFetch = false;
    await user.type(textarea, "你好");
    await user.click(screen.getByRole("button", { name: "Analyze" }));

    // Pinyin should appear on the results page and error alert should
    // be gone from the DOM since the form view is unmounted.
    await screen.findByText("nǐhǎo");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("handles keyboard interaction on word click (Enter)", async function keyboardEnter() {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ words: mockWords }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(() => <App />);
    const textarea = screen.getByLabelText("Mandarin text");
    await user.type(textarea, "你好");
    await user.click(screen.getByRole("button", { name: "Analyze" }));

    const helloWord = await screen.findByTitle("hello");
    fireEvent.keyDown(helloWord, { key: "Enter" });

    const tooltips = screen.getAllByRole("tooltip");
    const tooltip = tooltips.find((t) => t.textContent === "hello");
    expect(tooltip).toBeInTheDocument();
  });

  it("renders a line break for \\n word entries", async function rendersLineBreaks() {
    // Words spanning two lines with a \n separator.
    const multiLineWords = [
      { hanzi: "你好", pinyin: "nǐhǎo", english: "hello" },
      { hanzi: "\n", pinyin: "\n", english: "\n" },
      { hanzi: "世界", pinyin: "shìjiè", english: "world" },
    ];
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ words: multiLineWords }), {
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(() => <App />);
    const textarea = screen.getByLabelText(
      "Mandarin text",
    ) as HTMLTextAreaElement;
    // Set the value directly and fire an input event since JSDOM's
    // userEvent.type does not reliably insert \n via {enter}.
    textarea.value = "你好\n世界";
    fireEvent.input(textarea);
    await user.click(screen.getByRole("button", { name: "Analyze" }));

    // Wait for the results page to appear.
    await screen.findByRole("heading", { name: "Parsed Result" });

    // The \n word should be rendered as a <br> element, not as a
    // .parsed-word span.
    const brElements = document.querySelectorAll("br");
    expect(brElements.length).toBe(1);

    // The hanzi words on either side should still be visible.
    expect(screen.getByText("你好")).toBeInTheDocument();
    expect(screen.getByText("世界")).toBeInTheDocument();
  });

  // ---------- Zoom tests ----------

  async function navigateToResults(
    user: ReturnType<typeof userEvent.setup>,
  ): Promise<void> {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ words: mockWords }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);
    render(() => <App />);
    const textarea = screen.getByLabelText("Mandarin text");
    await user.type(textarea, "你好");
    await user.click(screen.getByRole("button", { name: "Analyze" }));
    await screen.findByRole("heading", { name: "Parsed Result" });
  }

  it("shows zoom controls on the results page", async function showsZoomControls() {
    const user = userEvent.setup();
    await navigateToResults(user);

    expect(screen.getByRole("button", { name: "Zoom in" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Zoom out" }),
    ).toBeInTheDocument();
    // Default scale indicator should be 100%.
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("increases font scale when zoom in is clicked", async function increasesFontScale() {
    const user = userEvent.setup();
    await navigateToResults(user);

    await user.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(screen.getByText("125%")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(screen.getByText("150%")).toBeInTheDocument();
  });

  it("decreases font scale when zoom out is clicked", async function decreasesFontScale() {
    const user = userEvent.setup();
    await navigateToResults(user);

    // Zoom in to 150% first.
    await user.click(screen.getByRole("button", { name: "Zoom in" }));
    await user.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(screen.getByText("150%")).toBeInTheDocument();

    // Then zoom out.
    await user.click(screen.getByRole("button", { name: "Zoom out" }));
    expect(screen.getByText("125%")).toBeInTheDocument();
  });

  it("disables zoom out button at minimum scale", async function disablesZoomOutAtMin() {
    const user = userEvent.setup();
    await navigateToResults(user);

    // Zoom out twice from 100% to reach min (50%).
    await user.click(screen.getByRole("button", { name: "Zoom out" }));
    expect(screen.getByText("75%")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Zoom out" }));
    expect(screen.getByText("50%")).toBeInTheDocument();

    const zoomOutButton = screen.getByRole("button", { name: "Zoom out" });
    expect(zoomOutButton).toBeDisabled();
  });

  it("disables zoom in button at maximum scale", async function disablesZoomInAtMax() {
    const user = userEvent.setup();
    await navigateToResults(user);

    const zoomInButton = screen.getByRole("button", { name: "Zoom in" });
    // Click 8 times to go from 100% → 300% (0.25 × 8 = 2.0).
    for (let i = 0; i < 8; i++) {
      await user.click(zoomInButton);
    }
    expect(screen.getByText("300%")).toBeInTheDocument();
    expect(zoomInButton).toBeDisabled();
  });

  it("applies --font-scale CSS custom property to the parsed text container", async function appliesFontScaleCSS() {
    const user = userEvent.setup();
    await navigateToResults(user);

    // Find the container with the parsed text (the element that has
    // the rounded border inside the main results card).
    const parsedContainer = document.querySelector(
      "main .rounded-md.border.border-border.p-4",
    );
    expect(parsedContainer).not.toBeNull();
    if (!parsedContainer) return;

    expect(
      getComputedStyle(parsedContainer).getPropertyValue("--font-scale"),
    ).toBe("1");

    // Zoom in once — scale should update. getComputedStyle returns a
    // snapshot, so we must re-read it after the reactive update.
    await user.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(
      getComputedStyle(parsedContainer).getPropertyValue("--font-scale"),
    ).toBe("1.25");
  });

  // ---------- Clipboard tests ----------

  async function navigateToResultsForClipboard(
    user: ReturnType<typeof userEvent.setup>,
  ): Promise<void> {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ words: mockWords }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);
    render(() => <App />);
    const textarea = screen.getByLabelText("Mandarin text");
    await user.type(textarea, "你好");
    await user.click(screen.getByRole("button", { name: "Analyze" }));
    await screen.findByRole("heading", { name: "Parsed Result" });
  }

  it("copies hanzi and pinyin to clipboard when a word is clicked", async function copiesToClipboard() {
    const writeTextSpy = vi.spyOn(navigator.clipboard, "writeText");

    const user = userEvent.setup();
    await navigateToResultsForClipboard(user);

    const helloWord = await screen.findByTitle("hello");
    await user.click(helloWord);

    // Verify clipboard.writeText was called with the full format.
    expect(writeTextSpy).toHaveBeenCalledOnce();
    expect(writeTextSpy).toHaveBeenCalledWith("你好 (nǐhǎo): hello");
  });

  it("does not copy to clipboard when the same word is clicked again to dismiss", async function doesNotCopyOnDismiss() {
    const writeTextSpy = vi.spyOn(navigator.clipboard, "writeText");

    const user = userEvent.setup();
    await navigateToResultsForClipboard(user);

    const helloWord = await screen.findByTitle("hello");

    // First click — should copy.
    await user.click(helloWord);
    expect(writeTextSpy).toHaveBeenCalledTimes(1);

    // Second click — dismisses the popup, should NOT copy again.
    await user.click(helloWord);
    expect(writeTextSpy).toHaveBeenCalledTimes(1);
  });

  it("does not copy punctuation words to clipboard", async function doesNotCopyPunctuation() {
    const writeTextSpy = vi.spyOn(navigator.clipboard, "writeText");

    const user = userEvent.setup();
    // The comma word has hanzi=，pinyin=，english=, — it is not a hanzi word.
    const commaWord = { hanzi: "，", pinyin: "，", english: "," };
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ words: [commaWord] }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);
    render(() => <App />);
    const textarea = screen.getByLabelText("Mandarin text");
    await user.type(textarea, "，");
    await user.click(screen.getByRole("button", { name: "Analyze" }));
    await screen.findByTitle(",");

    const commaElement = screen.getByTitle(",");
    await user.click(commaElement);

    // Clipboard should not have been called for punctuation.
    expect(writeTextSpy).not.toHaveBeenCalled();
  });

  // ---------- History list tests ----------

  /**
   * Helper that navigates through the full analyze → close → form
   * cycle so the history list is populated and visible on the form
   * view. Returns the user instance for further interactions.
   */
  async function analyzeAndReturnToForm(
    user: ReturnType<typeof userEvent.setup>,
  ): Promise<void> {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ words: mockWords }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);
    render(() => <App />);
    const textarea = screen.getByLabelText("Mandarin text");
    await user.type(textarea, "你好");
    await user.click(screen.getByRole("button", { name: "Analyze" }));
    await screen.findByRole("heading", { name: "Parsed Result" });
    await user.click(screen.getByRole("button", { name: "Close" }));
  }

  it("shows history list after analyzing and returning to the form view", async function showsHistoryList() {
    const user = userEvent.setup();
    await analyzeAndReturnToForm(user);

    // The "History" heading should be visible.
    expect(
      screen.getByRole("heading", { name: "History" }),
    ).toBeInTheDocument();

    // The history list should contain the preview of the analyzed text.
    expect(screen.getByText("你好")).toBeInTheDocument();
  });

  it("navigates to results view when a history item is clicked", async function historyNavigatesToResults() {
    const user = userEvent.setup();
    await analyzeAndReturnToForm(user);

    // Click on the history item (its preview text is "你好").
    await user.click(screen.getByText("你好"));

    // The results page should appear with the parsed words.
    expect(
      screen.getByRole("heading", { name: "Parsed Result" }),
    ).toBeInTheDocument();
    expect(screen.getByText("nǐhǎo")).toBeInTheDocument();
  });

  it("displays history items sorted with the most recent result first", async function historySortedMostRecentFirst() {
    const user = userEvent.setup();

    // First analysis: "你好" (2 hanzi chars)
    let fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ words: mockWords }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);
    render(() => <App />);
    const textarea = screen.getByLabelText(
      "Mandarin text",
    ) as HTMLTextAreaElement;
    await user.type(textarea, "你好");
    await user.click(screen.getByRole("button", { name: "Analyze" }));
    await screen.findByRole("heading", { name: "Parsed Result" });
    await user.click(screen.getByRole("button", { name: "Close" }));

    // Second analysis: "世界你好" (4 hanzi chars). Reset fetch mock to
    // return a fresh response.
    const worldWords = [
      { hanzi: "世界", pinyin: "shìjiè", english: "world" },
      { hanzi: "你好", pinyin: "nǐhǎo", english: "hello" },
    ];
    fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ words: worldWords }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);
    // Reset the textarea value by setting it directly and dispatching
    // an input event (user.clear() is not supported in JSDOM).
    const textarea2 = screen.getByLabelText(
      "Mandarin text",
    ) as HTMLTextAreaElement;
    textarea2.value = "";
    fireEvent.input(textarea2);
    await user.type(textarea2, "世界你好");
    await user.click(screen.getByRole("button", { name: "Analyze" }));
    await screen.findByRole("heading", { name: "Parsed Result" });
    await user.click(screen.getByRole("button", { name: "Close" }));

    // The history list should now have two items.
    const listItems = document.querySelectorAll("ol > li");
    expect(listItems.length).toBe(2);

    // The first (most recent) item should show "世界你好" (the 4-char
    // preview), and the second should show "你好".
    expect(listItems[0]?.textContent).toContain("世界你好");
    expect(listItems[1]?.textContent).toContain("你好");
  });

  it("shows ellipsis when the preview text exceeds 10 hanzi characters", async function previewShowsEllipsis() {
    const user = userEvent.setup();

    // Build a string of 15 hanzi characters — the preview should show
    // the first 10 followed by "...".
    const longText = "我你他她它我们你们他们大家朋友同学老师学校";
    // "我你他她它我们你们他们大" = first 10 chars (roughly), rest truncated.
    const longWords = [{ hanzi: longText, pinyin: "", english: "" }];
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ words: longWords }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);
    render(() => <App />);
    const textarea = screen.getByLabelText(
      "Mandarin text",
    ) as HTMLTextAreaElement;
    // Set the value directly since typing 15 chars one by one is slow.
    textarea.value = longText;
    fireEvent.input(textarea);
    await user.click(screen.getByRole("button", { name: "Analyze" }));
    await screen.findByRole("heading", { name: "Parsed Result" });
    await user.click(screen.getByRole("button", { name: "Close" }));

    // The preview should end with "..." since the text has >10 hanzi
    // characters.
    const previewEl = screen.getByText(/\.\.\.$/);
    expect(previewEl).toBeInTheDocument();
  });

  // ---------- Delete result tests ----------

  it("shows a trash icon button on each history item", async function showsTrashIcon() {
    const user = userEvent.setup();
    await analyzeAndReturnToForm(user);

    const deleteButtons = screen.getAllByRole("button", {
      name: "Delete result",
    });
    expect(deleteButtons.length).toBe(1);
  });

  it("shows confirmation popup when the trash icon is clicked", async function showsConfirmationPopup() {
    const user = userEvent.setup();
    await analyzeAndReturnToForm(user);

    // No confirmation dialog should be visible initially.
    expect(
      screen.queryByRole("dialog", { name: "Delete confirmation" }),
    ).not.toBeInTheDocument();

    // Click the trash icon.
    await user.click(screen.getByRole("button", { name: "Delete result" }));

    // The confirmation dialog should appear.
    expect(
      screen.getByRole("dialog", { name: "Delete confirmation" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("hides the confirmation popup when Cancel is clicked without deleting", async function cancelHidesPopup() {
    const user = userEvent.setup();
    await analyzeAndReturnToForm(user);

    await user.click(screen.getByRole("button", { name: "Delete result" }));
    expect(
      screen.getByRole("dialog", { name: "Delete confirmation" }),
    ).toBeInTheDocument();

    // Click Cancel.
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    // The dialog should be gone.
    expect(
      screen.queryByRole("dialog", { name: "Delete confirmation" }),
    ).not.toBeInTheDocument();

    // The history item should still be present.
    expect(screen.getByText("你好")).toBeInTheDocument();
  });

  it("hides the confirmation popup when the backdrop is clicked without deleting", async function backdropHidesPopup() {
    const user = userEvent.setup();
    await analyzeAndReturnToForm(user);

    await user.click(screen.getByRole("button", { name: "Delete result" }));
    const dialog = screen.getByRole("dialog", {
      name: "Delete confirmation",
    });
    expect(dialog).toBeInTheDocument();

    // Click the backdrop — the outermost div with onClick handler.
    // The dialog's outermost div has the onClick={handleCancelDelete}
    // handler and role="dialog".
    await user.click(dialog);

    // The dialog should be gone.
    expect(
      screen.queryByRole("dialog", { name: "Delete confirmation" }),
    ).not.toBeInTheDocument();

    // The history item should still be present.
    expect(screen.getByText("你好")).toBeInTheDocument();
  });

  it("removes the history item when Delete is confirmed", async function deleteRemovesItem() {
    const user = userEvent.setup();
    await analyzeAndReturnToForm(user);

    // The history item should be present.
    expect(screen.getByText("你好")).toBeInTheDocument();

    // Click the trash icon.
    await user.click(screen.getByRole("button", { name: "Delete result" }));

    // Confirm deletion.
    await user.click(screen.getByRole("button", { name: "Delete" }));

    // The dialog should be gone.
    expect(
      screen.queryByRole("dialog", { name: "Delete confirmation" }),
    ).not.toBeInTheDocument();

    // The history item should be removed — preview text "你好" should
    // no longer be in the DOM.
    expect(screen.queryByText("你好")).not.toBeInTheDocument();

    // The history heading should also be gone since the list is now empty.
    expect(
      screen.queryByRole("heading", { name: "History" }),
    ).not.toBeInTheDocument();
  });

  it("persists deletion to localStorage", async function deletePersistsToStorage() {
    const user = userEvent.setup();
    await analyzeAndReturnToForm(user);

    // Verify the result is in localStorage before deletion.
    const beforeRaw = localStorage.getItem("parsed-results");
    expect(beforeRaw).not.toBeNull();
    const before: unknown = JSON.parse(beforeRaw!);
    expect(Array.isArray(before) && (before as unknown[]).length).toBe(1);

    // Click the trash icon and confirm deletion.
    await user.click(screen.getByRole("button", { name: "Delete result" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    // Verify the result is removed from localStorage.
    const afterRaw = localStorage.getItem("parsed-results");
    expect(afterRaw).not.toBeNull();
    const after: unknown = JSON.parse(afterRaw!);
    expect(Array.isArray(after) && (after as unknown[]).length).toBe(0);
  });

  it("deletes only the selected result when multiple items exist", async function deletesOnlySelected() {
    const user = userEvent.setup();

    // First result: "你好"
    let fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ words: mockWords }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);
    render(() => <App />);
    const textarea = screen.getByLabelText(
      "Mandarin text",
    ) as HTMLTextAreaElement;
    await user.type(textarea, "你好");
    await user.click(screen.getByRole("button", { name: "Analyze" }));
    await screen.findByRole("heading", { name: "Parsed Result" });
    await user.click(screen.getByRole("button", { name: "Close" }));

    // Second result: "世界"
    const worldWords = [{ hanzi: "世界", pinyin: "shìjiè", english: "world" }];
    fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ words: worldWords }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const textarea2 = screen.getByLabelText(
      "Mandarin text",
    ) as HTMLTextAreaElement;
    textarea2.value = "";
    fireEvent.input(textarea2);
    await user.type(textarea2, "世界");
    await user.click(screen.getByRole("button", { name: "Analyze" }));
    await screen.findByRole("heading", { name: "Parsed Result" });
    await user.click(screen.getByRole("button", { name: "Close" }));

    // Both items should be present.
    expect(screen.getByText("你好")).toBeInTheDocument();
    expect(screen.getByText("世界")).toBeInTheDocument();

    // Get all delete buttons — index 0 is the most recent (世界), index
    // 1 is the older entry (你好).
    const deleteButtons = screen.getAllByRole("button", {
      name: "Delete result",
    });
    expect(deleteButtons.length).toBe(2);

    // Delete the first item (世界 — the most recent).
    await user.click(deleteButtons[0]!);
    await user.click(screen.getByRole("button", { name: "Delete" }));

    // 世界 should be gone, 你好 should still be present.
    expect(screen.queryByText("世界")).not.toBeInTheDocument();
    expect(screen.getByText("你好")).toBeInTheDocument();

    // Verify localStorage has only one entry.
    const raw = localStorage.getItem("parsed-results");
    const parsed: unknown = JSON.parse(raw!);
    expect(Array.isArray(parsed) && (parsed as unknown[]).length).toBe(1);
  });
});
