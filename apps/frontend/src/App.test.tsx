import { describe, it, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@solidjs/testing-library";
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
  });
});
