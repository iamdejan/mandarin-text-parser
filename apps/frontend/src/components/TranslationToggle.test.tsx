import { render, screen, fireEvent, cleanup } from "@solidjs/testing-library";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createSignal } from "solid-js";
import TranslationToggle from "./TranslationToggle";

describe("TranslationToggle", () => {
  let onChange: (value: boolean) => void;

  beforeEach(() => {
    onChange = vi.fn();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders as a switch with aria-checked false by default", () => {
    const [checked] = createSignal(false);
    render(() => <TranslationToggle checked={checked} onChange={onChange} />);
    const toggle = screen.getByRole("switch", {
      name: "Show English translation",
    });
    expect(toggle).toBeInTheDocument();
    expect(toggle).toHaveAttribute("aria-checked", "false");
  });

  it("reflects the checked state via aria-checked", () => {
    const [checked] = createSignal(true);
    render(() => <TranslationToggle checked={checked} onChange={onChange} />);
    expect(
      screen.getByRole("switch", { name: "Show English translation" }),
    ).toHaveAttribute("aria-checked", "true");
  });

  it("calls onChange with true when clicked while off", () => {
    const [checked] = createSignal(false);
    render(() => <TranslationToggle checked={checked} onChange={onChange} />);
    fireEvent.click(
      screen.getByRole("switch", { name: "Show English translation" }),
    );
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("calls onChange with false when clicked while on", () => {
    const [checked] = createSignal(true);
    render(() => <TranslationToggle checked={checked} onChange={onChange} />);
    fireEvent.click(
      screen.getByRole("switch", { name: "Show English translation" }),
    );
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("slides the knob to the right when checked", () => {
    const [checked, setChecked] = createSignal(false);
    render(() => <TranslationToggle checked={checked} onChange={setChecked} />);
    const knob = screen
      .getByRole("switch", { name: "Show English translation" })
      .querySelector("span");
    expect(knob).not.toHaveClass("translate-x-5");

    setChecked(true);
    expect(knob).toHaveClass("translate-x-5");
  });
});
