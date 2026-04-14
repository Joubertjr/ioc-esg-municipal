import { render, screen } from "@testing-library/react";
import { KpiCards, KpiCardsSkeleton } from "../KpiCards";
import type { MunicipalOdsReport, OdsSummary } from "../../../types/api";
import type { StateBenchmarkData } from "../../../hooks/useStateBenchmark";
import type { TrendData } from "../../../hooks/useTrend";

// ---------------------------------------------------------------------------
// AnimatedNumber renders via requestAnimationFrame and starts at 0.
// Mock it to render the final value synchronously so assertions don't need
// to flush the animation loop.
// ---------------------------------------------------------------------------
vi.mock("../../ui/AnimatedNumber", () => ({
  AnimatedNumber: ({ value, className }: { value: number; className?: string }) => (
    <span className={className}>{value}</span>
  ),
}));

// ---------------------------------------------------------------------------
// Recharts uses ResizeObserver internally; jsdom does not implement it.
// Provide a no-op stub so LineChart renders without throwing.
// ---------------------------------------------------------------------------
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// ---------------------------------------------------------------------------
// Suppress Recharts "width(0) and height(0)" warnings in jsdom.
// jsdom has no layout engine, so containers always report 0x0 — expected.
// ---------------------------------------------------------------------------
const originalWarn = console.warn;
const originalError = console.error;
beforeAll(() => {
  console.warn = (...args: unknown[]) => {
    if (typeof args[0] === "string" && args[0].includes("width(0) and height(0)")) return;
    originalWarn(...args);
  };
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === "string" && args[0].includes("width(0) and height(0)")) return;
    originalError(...args);
  };
});
afterAll(() => {
  console.warn = originalWarn;
  console.error = originalError;
});

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeReport(overrides: Partial<MunicipalOdsReport> = {}): MunicipalOdsReport {
  return {
    ibgeCode: "4204202",
    municipalityName: "Blumenau",
    referenceYear: 2023,
    globalScore: 72,
    globalStatus: "verde",
    geometricScore: 68,
    geometricStatus: "amarelo",
    odsCount: { total: 17, withData: 15, verde: 10, amarelo: 4, vermelho: 1 },
    ods: [],
    ...overrides,
  };
}

function makeBenchmark(overrides: Partial<StateBenchmarkData> = {}): StateBenchmarkData {
  return {
    globalScore: 72,
    stateAverage: 65,
    deltaVsState: 7,
    rankingPosition: 5,
    totalInBenchmark: 20,
    aboveStateAverage: true,
    ...overrides,
  };
}

function makeTrend(overrides: Partial<TrendData> = {}): TrendData {
  return {
    delta: 5,
    direction: "up",
    sparklineData: [
      { year: 2021, score: 60 },
      { year: 2022, score: 65 },
      { year: 2023, score: 70 },
    ],
    latestYear: 2023,
    previousYear: 2022,
    comparable: true,
    comparabilityReason: "ok",
    currentCoverage: 17,
    previousCoverage: 17,
    ...overrides,
  };
}

function makeWorstOds(overrides: Partial<OdsSummary> = {}): OdsSummary {
  return {
    odsNumber: 6,
    name: "Água Potável e Saneamento",
    shortName: "Saneamento",
    color: "#26BDE2",
    weight: 1,
    score: 35,
    status: "vermelho",
    indicators: [],
    sources: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// KpiCardsSkeleton
// ---------------------------------------------------------------------------

describe("KpiCardsSkeleton", () => {
  it("renders 4 skeleton cards", () => {
    const { container } = render(<KpiCardsSkeleton />);
    // Each card has a border-l-border class and 3 skeleton elements
    const cards = container.querySelectorAll(".border-l-4");
    expect(cards).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// KpiCards — loading state
// ---------------------------------------------------------------------------

describe("KpiCards (loading)", () => {
  it("renders the skeleton when isLoading is true", () => {
    const { container } = render(<KpiCards report={undefined} isLoading={true} />);
    const cards = container.querySelectorAll(".border-l-4");
    expect(cards).toHaveLength(4);
  });

  it("renders the skeleton when report is undefined even if isLoading is false", () => {
    const { container } = render(<KpiCards report={undefined} isLoading={false} />);
    const cards = container.querySelectorAll(".border-l-4");
    expect(cards).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// KpiCards — card labels always present
// ---------------------------------------------------------------------------

describe("KpiCards (data)", () => {
  it("renders the Score Global card label", () => {
    render(<KpiCards report={makeReport()} isLoading={false} />);
    expect(screen.getByText(/score global/i)).toBeInTheDocument();
  });

  it("renders the Ranking SC card label", () => {
    render(<KpiCards report={makeReport()} isLoading={false} />);
    expect(screen.getByText(/ranking sc/i)).toBeInTheDocument();
  });

  it("renders the Tendência card label", () => {
    render(<KpiCards report={makeReport()} isLoading={false} />);
    expect(screen.getByText(/tendência/i)).toBeInTheDocument();
  });

  it("renders the Pior ODS card label", () => {
    render(<KpiCards report={makeReport()} isLoading={false} />);
    expect(screen.getByText(/pior ods/i)).toBeInTheDocument();
  });

  // --- Score global ---

  it("displays the rounded global score value", () => {
    render(
      <KpiCards
        report={makeReport({ globalScore: 72.6, geometricScore: 72.6 })}
        isLoading={false}
      />,
    );
    expect(screen.getByText("73")).toBeInTheDocument();
  });

  it("displays — when globalScore is null", () => {
    render(<KpiCards report={makeReport({ globalScore: null })} isLoading={false} />);
    // Multiple dashes may appear; at least one should be present
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("shows status label when benchmark is absent and globalStatus is verde", () => {
    render(
      <KpiCards
        report={makeReport({ globalStatus: "verde" })}
        isLoading={false}
        benchmark={undefined}
      />,
    );
    expect(screen.getByText("Situação Verde")).toBeInTheDocument();
  });

  it("shows status label when benchmark is absent and globalStatus is vermelho", () => {
    render(
      <KpiCards
        report={makeReport({ globalStatus: "vermelho" })}
        isLoading={false}
        benchmark={undefined}
      />,
    );
    expect(screen.getByText("Situação crítica")).toBeInTheDocument();
  });

  // --- Benchmark context ---

  it("shows above-average context when benchmark delta is positive", () => {
    render(
      <KpiCards
        report={makeReport()}
        isLoading={false}
        benchmark={makeBenchmark({ deltaVsState: 7, stateAverage: 65, aboveStateAverage: true })}
      />,
    );
    expect(screen.getByText(/acima da média SC/i)).toBeInTheDocument();
  });

  it("shows below-average context when benchmark delta is negative", () => {
    render(
      <KpiCards
        report={makeReport()}
        isLoading={false}
        benchmark={makeBenchmark({ deltaVsState: -4, stateAverage: 65, aboveStateAverage: false })}
      />,
    );
    expect(screen.getByText(/abaixo da média SC/i)).toBeInTheDocument();
  });

  it("shows na-media context when benchmark delta is zero", () => {
    render(
      <KpiCards
        report={makeReport()}
        isLoading={false}
        benchmark={makeBenchmark({ deltaVsState: 0, stateAverage: 65, aboveStateAverage: false })}
      />,
    );
    expect(screen.getByText(/na média sc/i)).toBeInTheDocument();
  });

  // --- Ranking ---

  it("displays the ranking position from benchmark", () => {
    render(
      <KpiCards
        report={makeReport()}
        isLoading={false}
        benchmark={makeBenchmark({ rankingPosition: 5, totalInBenchmark: 20 })}
      />,
    );
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("/ 20")).toBeInTheDocument();
  });

  it("shows fallback message for ranking when benchmark is absent", () => {
    render(<KpiCards report={makeReport()} isLoading={false} />);
    expect(screen.getByText(/ranking disponível após benchmark/i)).toBeInTheDocument();
  });

  // --- Trend ---

  it("renders the up arrow prefix when trend direction is up", () => {
    render(
      <KpiCards
        report={makeReport()}
        isLoading={false}
        trend={makeTrend({ direction: "up", delta: 5 })}
      />,
    );
    expect(screen.getByText("↑")).toBeInTheDocument();
  });

  it("renders the down arrow prefix when trend direction is down", () => {
    render(
      <KpiCards
        report={makeReport()}
        isLoading={false}
        trend={makeTrend({ direction: "down", delta: -3 })}
      />,
    );
    expect(screen.getByText("↓")).toBeInTheDocument();
  });

  it("renders the year range in trend context", () => {
    render(
      <KpiCards
        report={makeReport()}
        isLoading={false}
        trend={makeTrend({ previousYear: 2022, latestYear: 2023 })}
      />,
    );
    expect(screen.getByText(/2022.*2023/)).toBeInTheDocument();
  });

  it("shows Sem histórico when trend sparklineData has fewer than 2 points", () => {
    render(
      <KpiCards
        report={makeReport()}
        isLoading={false}
        trend={makeTrend({ sparklineData: [{ year: 2023, score: 70 }], delta: null })}
      />,
    );
    expect(screen.getByText("Sem histórico")).toBeInTheDocument();
  });

  // --- Worst ODS ---

  it("displays the worst ODS score rounded", () => {
    render(
      <KpiCards report={makeReport()} isLoading={false} worstOds={makeWorstOds({ score: 35.7 })} />,
    );
    expect(screen.getByText("36")).toBeInTheDocument();
  });

  it("displays the worst ODS name in context when no worstOdsContext string is provided", () => {
    render(
      <KpiCards
        report={makeReport()}
        isLoading={false}
        worstOds={makeWorstOds({ name: "Água Potável e Saneamento" })}
      />,
    );
    expect(screen.getByText("Água Potável e Saneamento")).toBeInTheDocument();
  });

  it("displays the worstOdsContext string when provided", () => {
    render(
      <KpiCards
        report={makeReport()}
        isLoading={false}
        worstOds={makeWorstOds()}
        worstOdsContext="Abaixo da meta estadual"
      />,
    );
    expect(screen.getByText("Abaixo da meta estadual")).toBeInTheDocument();
  });

  it("shows Sem dados when worstOds is absent", () => {
    render(<KpiCards report={makeReport()} isLoading={false} worstOds={undefined} />);
    expect(screen.getByText("Sem dados")).toBeInTheDocument();
  });
});
