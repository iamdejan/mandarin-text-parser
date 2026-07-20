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

    // Verify clipboard.writeText was called with "你好 (nǐhǎo)" format.
    expect(writeTextSpy).toHaveBeenCalledOnce();
    expect(writeTextSpy).toHaveBeenCalledWith("你好 (nǐhǎo)");
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
});
