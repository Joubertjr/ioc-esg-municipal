import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RecommendationPanel } from "../RecommendationPanel";
import type { RecommendationReport, SmartRecommendation } from "../../../types/api";

// ---------------------------------------------------------------------------
// Mock hooks that make network requests
// ---------------------------------------------------------------------------

vi.mock("../../../hooks/useRecommendations");
vi.mock("../../../hooks/useRecommendedScenario");

import { useRecommendations } from "../../../hooks/useRecommendations";
import { useRecommendedScenario } from "../../../hooks/useRecommendedScenario";

const mockUseRecommendations = vi.mocked(useRecommendations);
const mockUseRecommendedScenario = vi.mocked(useRecommendedScenario);

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeRecommendation(overrides: Partial<SmartRecommendation> = {}): SmartRecommendation {
  return {
    odsNumber: 6,
    odsName: "Água Potável e Saneamento",
    priority: "critica",
    currentScore: 35,
    stateAverage: 65,
    gap: 30,
    ranking: "295º de 295 municípios SC",
    actions: ["Ampliar rede de esgoto", "Investir em saneamento rural"],
    investmentArea: "Saneamento",
    estimatedImpact: "Alto",
    ...overrides,
  };
}

function makeReport(overrides: Partial<RecommendationReport> = {}): RecommendationReport {
  return {
    ibgeCode: "4204202",
    municipalityName: "Blumenau",
    generatedAt: "2024-01-01T00:00:00.000Z",
    totalRecommendations: 3,
    criticalCount: 1,
    summary: "Município precisa focar em saneamento e saúde",
    recommendations: [
      makeRecommendation({ priority: "critica" }),
      makeRecommendation({
        odsNumber: 3,
        odsName: "Saúde e Bem-Estar",
        priority: "alta",
      }),
      makeRecommendation({
        odsNumber: 4,
        odsName: "Educação de Qualidade",
        priority: "media",
      }),
    ],
    strengths: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockScenarioHook({ isPending = false } = {}) {
  mockUseRecommendedScenario.mockReturnValue({
    fetchScenario: vi.fn().mockResolvedValue({
      ibgeCode: "4204202",
      municipalityName: "Blumenau",
      totalAmount: null,
      allocation: {
        education: 10,
        health: 20,
        sanitation: 30,
        environment: 10,
        security: 5,
        energy: 5,
        urbanization: 10,
        governance: 10,
      },
      reasoning: [],
      basedOnRecommendations: 3,
      allOdsGreen: false,
    }),
    isPending,
  });
}

function renderPanel(ibgeCode = "4204202", compact = false) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <RecommendationPanel ibgeCode={ibgeCode} compact={compact} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests — loading state
// ---------------------------------------------------------------------------

describe("RecommendationPanel (loading)", () => {
  beforeEach(() => {
    mockScenarioHook();
    mockUseRecommendations.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    } as ReturnType<typeof useRecommendations>);
  });

  it("renders the section heading", () => {
    renderPanel();
    expect(screen.getByText("Recomendações Priorizadas")).toBeInTheDocument();
  });

  it("renders skeleton cards while loading", () => {
    const { container } = renderPanel();
    // SkeletonCard renders divs with both "bg-card" and "animate-pulse".
    const skeletonCards = container.querySelectorAll(".bg-card.animate-pulse");
    expect(skeletonCards.length).toBeGreaterThanOrEqual(3);
  });

  it("renders a single skeleton card in compact mode while loading", () => {
    const { container } = renderPanel("4204202", true);
    // SkeletonCard renders a div with both "bg-card" and "animate-pulse".
    // The header also has an animate-pulse div, so we narrow to bg-card.
    const skeletonCards = container.querySelectorAll(".bg-card.animate-pulse");
    expect(skeletonCards).toHaveLength(1);
  });

  it("does not render the simulate button while loading", () => {
    renderPanel();
    expect(screen.queryByRole("button", { name: /simular cenário/i })).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tests — error state
// ---------------------------------------------------------------------------

describe("RecommendationPanel (error)", () => {
  beforeEach(() => {
    mockScenarioHook();
    mockUseRecommendations.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error("Servidor indisponível"),
    } as ReturnType<typeof useRecommendations>);
  });

  it("renders the error message", () => {
    renderPanel();
    expect(screen.getByText("Não foi possível carregar as recomendações")).toBeInTheDocument();
  });

  it("shows the error detail from the thrown Error object", () => {
    renderPanel();
    expect(screen.getByText("Servidor indisponível")).toBeInTheDocument();
  });

  it("does not render skeleton cards when in error state", () => {
    const { container } = renderPanel();
    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Tests — empty state (all ODS green)
// ---------------------------------------------------------------------------

describe("RecommendationPanel (empty — all ODS green)", () => {
  beforeEach(() => {
    mockScenarioHook();
    mockUseRecommendations.mockReturnValue({
      data: makeReport({ recommendations: [], criticalCount: 0, totalRecommendations: 0 }),
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useRecommendations>);
  });

  it("renders the all-green empty state message", () => {
    renderPanel();
    expect(
      screen.getByText(/nenhuma recomendação — todos os ods estão acima da meta/i),
    ).toBeInTheDocument();
  });

  it("does not render the simulate button when there are no recommendations", () => {
    renderPanel();
    expect(screen.queryByRole("button", { name: /simular cenário/i })).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tests — data state
// ---------------------------------------------------------------------------

describe("RecommendationPanel (data)", () => {
  const report = makeReport();

  beforeEach(() => {
    mockScenarioHook();
    mockUseRecommendations.mockReturnValue({
      data: report,
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useRecommendations>);
  });

  it("displays the report summary", () => {
    renderPanel();
    expect(screen.getByText("Município precisa focar em saneamento e saúde")).toBeInTheDocument();
  });

  it("displays the critical count badge", () => {
    renderPanel();
    expect(screen.getByText(/1 críticas/i)).toBeInTheDocument();
  });

  it("displays the total recommendations count", () => {
    renderPanel();
    expect(screen.getByText("3 total")).toBeInTheDocument();
  });

  it("renders one RecommendationCard per recommendation", () => {
    renderPanel();
    // Each card shows the ODS name
    expect(screen.getByText("Água Potável e Saneamento")).toBeInTheDocument();
    expect(screen.getByText("Saúde e Bem-Estar")).toBeInTheDocument();
    expect(screen.getByText("Educação de Qualidade")).toBeInTheDocument();
  });

  it("renders the simulate scenario button", () => {
    renderPanel();
    expect(
      screen.getByRole("button", { name: /simular cenário recomendado/i }),
    ).toBeInTheDocument();
  });

  it("calls fetchScenario when the simulate button is clicked", async () => {
    const user = userEvent.setup();
    const fetchScenario = vi.fn().mockResolvedValue({
      ibgeCode: "4204202",
      municipalityName: "Blumenau",
      totalAmount: null,
      allocation: {
        education: 10,
        health: 20,
        sanitation: 30,
        environment: 10,
        security: 5,
        energy: 5,
        urbanization: 10,
        governance: 10,
      },
      reasoning: [],
      basedOnRecommendations: 3,
      allOdsGreen: false,
    });
    mockUseRecommendedScenario.mockReturnValue({ fetchScenario, isPending: false });

    renderPanel();
    await user.click(screen.getByRole("button", { name: /simular cenário recomendado/i }));

    expect(fetchScenario).toHaveBeenCalledWith("4204202");
  });

  it("disables the simulate button while the scenario request is pending", () => {
    mockScenarioHook({ isPending: true });
    renderPanel();
    expect(screen.getByRole("button", { name: /calculando/i })).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// Tests — compact mode
// ---------------------------------------------------------------------------

describe("RecommendationPanel (compact mode)", () => {
  beforeEach(() => {
    mockScenarioHook();
    mockUseRecommendations.mockReturnValue({
      data: makeReport(),
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useRecommendations>);
  });

  it("renders only the first recommendation in compact mode", () => {
    renderPanel("4204202", true);
    // The first (highest priority) card should appear
    expect(screen.getByText("Água Potável e Saneamento")).toBeInTheDocument();
    // The other recommendations should not be shown
    expect(screen.queryByText("Saúde e Bem-Estar")).not.toBeInTheDocument();
    expect(screen.queryByText("Educação de Qualidade")).not.toBeInTheDocument();
  });

  it("shows the overflow count message in compact mode when more recommendations exist", () => {
    renderPanel("4204202", true);
    expect(screen.getByText(/\+ 2 outras recomendações/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tests — strengths section
// ---------------------------------------------------------------------------

describe("RecommendationPanel (strengths)", () => {
  it("renders the Pontos Fortes section when strengths are present", () => {
    mockScenarioHook();
    mockUseRecommendations.mockReturnValue({
      data: makeReport({
        strengths: [{ odsNumber: 1, odsName: "Erradicação da Pobreza", score: 85 }],
      }),
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useRecommendations>);

    renderPanel();
    expect(screen.getByText("Pontos Fortes")).toBeInTheDocument();
    expect(screen.getByText("Erradicação da Pobreza")).toBeInTheDocument();
  });

  it("does not render the Pontos Fortes section when strengths array is empty", () => {
    mockScenarioHook();
    mockUseRecommendations.mockReturnValue({
      data: makeReport({ strengths: [] }),
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useRecommendations>);

    renderPanel();
    expect(screen.queryByText("Pontos Fortes")).not.toBeInTheDocument();
  });
});
