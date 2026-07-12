import { describe, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@solidjs/testing-library";
import App from "./App";

describe("App", () => {
  beforeEach(() => {
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
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the page heading", () => {
    render(() => <App />);
    expect(
      screen.getByRole("heading", { name: "Mandarin Text Parser" }),
    ).toBeInTheDocument();
  });

  it("renders the Mandarin text textarea", () => {
    render(() => <App />);
    expect(screen.getByLabelText("Mandarin text")).toBeInTheDocument();
  });

  it("renders the Analyse button", () => {
    render(() => <App />);
    expect(screen.getByRole("button", { name: "Analyse" })).toBeInTheDocument();
  });

  it("renders the character count", () => {
    render(() => <App />);
    expect(screen.getByText("0 / 2000")).toBeInTheDocument();
  });

  it("updates character count when user types", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    render(() => <App />);
    const textarea = screen.getByLabelText("Mandarin text");
    await user.type(textarea, "你好");
    expect(screen.getByText("2 / 2000")).toBeInTheDocument();
  });
});
