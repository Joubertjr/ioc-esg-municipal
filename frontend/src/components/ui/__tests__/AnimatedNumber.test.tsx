import { render, screen, act } from "@testing-library/react";
import { AnimatedNumber } from "../AnimatedNumber";

// ---------------------------------------------------------------------------
// AnimatedNumber relies on requestAnimationFrame which jsdom does not run
// automatically. We stub it so the animation runs synchronously and the
// component immediately reaches its final value.
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.useFakeTimers();

  // Drive rAF synchronously: call the callback once, advancing to the end
  // of the animation so `progress` reaches 1 and the final value is set.
  let rafCallback: FrameRequestCallback | null = null;

  vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((cb) => {
    rafCallback = cb;
    return 1;
  });

  vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});

  // Expose a helper on globalThis so tests can advance the animation
  (globalThis as Record<string, unknown>).__flushRaf = (timestamp = 10_000) => {
    if (rafCallback) {
      act(() => {
        rafCallback!(timestamp);
      });
      rafCallback = null;
    }
  };
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete (globalThis as Record<string, unknown>).__flushRaf;
});

function flushRaf(timestamp = 10_000) {
  (globalThis as Record<string, unknown>).__flushRaf(timestamp);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AnimatedNumber", () => {
  it("renders a span element", () => {
    render(<AnimatedNumber value={50} />);
    // The span starts at 0 then animates to 50
    const span = document.querySelector("span");
    expect(span).toBeInTheDocument();
  });

  it("displays the final value after the animation completes", () => {
    render(<AnimatedNumber value={42} />);
    // Flush rAF with a timestamp far past the default 600ms duration
    flushRaf(10_000);
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("displays 0 as the final value when value prop is 0", () => {
    render(<AnimatedNumber value={0} />);
    flushRaf(10_000);
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("displays a large value correctly", () => {
    render(<AnimatedNumber value={100} />);
    flushRaf(10_000);
    expect(screen.getByText("100")).toBeInTheDocument();
  });

  it("applies the className prop to the span", () => {
    render(<AnimatedNumber value={10} className="text-3xl font-bold" />);
    const span = document.querySelector("span");
    expect(span).toHaveClass("text-3xl");
    expect(span).toHaveClass("font-bold");
  });

  it("does not apply any className when the prop is omitted", () => {
    render(<AnimatedNumber value={10} />);
    const span = document.querySelector("span");
    // className attribute should be absent or empty
    expect(span?.className ?? "").toBe("");
  });

  it("re-animates when the value prop changes", () => {
    const { rerender } = render(<AnimatedNumber value={10} />);
    flushRaf(10_000);
    expect(screen.getByText("10")).toBeInTheDocument();

    rerender(<AnimatedNumber value={99} />);
    flushRaf(10_000);
    expect(screen.getByText("99")).toBeInTheDocument();
  });

  it("starts animating from 0 on initial mount (display begins at 0)", () => {
    render(<AnimatedNumber value={80} duration={600} />);
    // Before any rAF fires the state is still 0
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("uses a custom duration without throwing", () => {
    // Ensure a non-default duration doesn't cause errors
    expect(() => {
      render(<AnimatedNumber value={50} duration={200} />);
      flushRaf(10_000);
    }).not.toThrow();
    expect(screen.getByText("50")).toBeInTheDocument();
  });
});
