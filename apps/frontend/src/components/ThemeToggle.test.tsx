import { render, screen, fireEvent, cleanup } from "@solidjs/testing-library";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createSignal } from "solid-js";
import ThemeToggle from "./ThemeToggle";

describe("ThemeToggle", () => {
  let onToggle: () => void;

  beforeEach(() => {
    onToggle = vi.fn();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders sun icon when theme is light", () => {
    const [theme] = createSignal<"light" | "dark">("light");
    render(() => <ThemeToggle theme={theme} onToggle={onToggle} />);
    expect(screen.getByLabelText("Switch to dark mode")).toBeInTheDocument();
  });

  it("renders moon icon when theme is dark", () => {
    const [theme] = createSignal<"light" | "dark">("dark");
    render(() => <ThemeToggle theme={theme} onToggle={onToggle} />);
    expect(screen.getByLabelText("Switch to light mode")).toBeInTheDocument();
  });

  it("calls onToggle when clicked", () => {
    const [theme] = createSignal<"light" | "dark">("light");
    render(() => <ThemeToggle theme={theme} onToggle={onToggle} />);
    fireEvent.click(screen.getByLabelText("Switch to dark mode"));
    expect(onToggle).toHaveBeenCalledOnce();
  });
});
