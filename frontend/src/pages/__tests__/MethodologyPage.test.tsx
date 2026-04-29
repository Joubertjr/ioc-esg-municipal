import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MethodologyPage } from "../MethodologyPage";
import type { MethodologyReport } from "../../hooks/useMethodology";

const MOCK_METHODOLOGY: MethodologyReport = {
  version: "1.0.0",
  lastUpdated: "2026-04-28",
  globalScoreMethod: {
    arithmetic: "score = sum(w*s) / sum(w)",
    geometric: "score = exp(sum(w*ln(max(s,1))) / sum(w))",
    preferred: "geometric — penaliza desequilíbrios",
  },
  statusThresholds: {
    verde: "score ≥ 70",
    amarelo: "40 ≤ score < 70",
    vermelho: "score < 40",
  },
  ods: [
    {
      odsNumber: 1,
      name: "Erradicação da Pobreza",
      shortName: "Pobreza",
      color: "#E5243B",
      weight: 1.0,
      description: "Acabar com a pobreza em todas as suas formas.",
      meta2030: "Até 2030, erradicar a pobreza extrema.",
      aggregation: "Média aritmética dos indicadores.",
      indicators: [
        {
          name: "pct_baixa_renda",
          label: "População em Baixa Renda",
          unit: "%",
          source: "IBGE Censo 2022",
          agent: "ibge",
          explanation: "Percentual da população com renda baixa.",
          goodDirection: "down" as const,
          formula: "score = ((70 - pct) / 50) * 100",
          benchmarks: {
            min: "70% = score 0",
            max: "20% = score 100",
            description: "Indicador invertido.",
          },
        },
      ],
    },
    {
      odsNumber: 3,
      name: "Saúde e Bem-Estar",
      shortName: "Saúde",
      color: "#4C9F38",
      weight: 1.2,
      description: "Assegurar uma vida saudável.",
      meta2030: "Até 2030, reduzir a mortalidade materna.",
      aggregation: "Média aritmética dos indicadores.",
      indicators: [
        {
          name: "pct_despesa_saude",
          label: "Despesa com Saúde",
          unit: "%",
          source: "SICONFI",
          agent: "siconfi",
          explanation: "Percentual da receita em saúde.",
          goodDirection: "up" as const,
          formula: "≥25% → 100",
          benchmarks: {
            min: "<10% = score 0",
            max: "≥25% = score 100",
            description: "Mínimo constitucional: 15%.",
          },
        },
      ],
    },
  ],
};

vi.mock("../../contexts/AuthContext", () => ({
  useAuthContext: () => ({
    currentUser: { ibgeCode: "4205407" },
    isAuthenticated: true,
    login: vi.fn(),
    logout: vi.fn(),
    setCurrentUser: vi.fn(),
  }),
}));

vi.mock("../../hooks/useTheme", () => ({
  useTheme: () => ({
    theme: "light",
    resolvedTheme: "light",
    setTheme: vi.fn(),
  }),
}));

vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({
    logout: vi.fn(),
  }),
}));

let fetchResolver: (value: MethodologyReport) => void;
let fetchRejecter: (reason: Error) => void;

vi.mock("../../lib/api", () => ({
  apiGet: vi.fn(
    () =>
      new Promise<MethodologyReport>((resolve, reject) => {
        fetchResolver = resolve;
        fetchRejecter = reject;
      }),
  ),
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter
        initialEntries={["/methodology"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <MethodologyPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("MethodologyPage", () => {
  it("mostra skeleton loading enquanto carrega", () => {
    renderPage();
    const pulses = document.querySelectorAll(".animate-pulse");
    expect(pulses.length).toBeGreaterThan(0);
  });

  it("mostra título da página", () => {
    renderPage();
    expect(screen.getByText("Metodologia de Cálculo ODS")).toBeInTheDocument();
  });

  it("mostra botão de imprimir", () => {
    renderPage();
    expect(screen.getByText("Imprimir / PDF")).toBeInTheDocument();
  });

  it("exibe dados da metodologia quando carregados", async () => {
    renderPage();
    fetchResolver(MOCK_METHODOLOGY);

    await waitFor(() => {
      expect(screen.getByText("Visão Geral da Metodologia")).toBeInTheDocument();
    });

    expect(screen.getByText("Verde")).toBeInTheDocument();
    expect(screen.getByText("Amarelo")).toBeInTheDocument();
    expect(screen.getByText("Vermelho")).toBeInTheDocument();
  });

  it("exibe seções de ODS com accordion", async () => {
    renderPage();
    fetchResolver(MOCK_METHODOLOGY);

    await waitFor(() => {
      expect(screen.getByText(/ODS 1 — Erradicação da Pobreza/)).toBeInTheDocument();
    });

    expect(screen.getByText(/ODS 3 — Saúde e Bem-Estar/)).toBeInTheDocument();
  });

  it("expande ODS ao clicar mostrando indicadores", async () => {
    const user = userEvent.setup();
    renderPage();
    fetchResolver(MOCK_METHODOLOGY);

    await waitFor(() => {
      expect(screen.getByText(/ODS 1 — Erradicação da Pobreza/)).toBeInTheDocument();
    });

    const odsButton = screen.getByText(/ODS 1 — Erradicação da Pobreza/).closest("button")!;
    await user.click(odsButton);

    await waitFor(() => {
      expect(screen.getByText("População em Baixa Renda")).toBeInTheDocument();
    });

    expect(screen.getByText("IBGE Censo 2022")).toBeInTheDocument();
    expect(screen.getByText("Indicador invertido.")).toBeInTheDocument();
  });

  it("mostra badge Menor = melhor para indicadores invertidos", async () => {
    const user = userEvent.setup();
    renderPage();
    fetchResolver(MOCK_METHODOLOGY);

    await waitFor(() => {
      expect(screen.getByText(/ODS 1 — Erradicação da Pobreza/)).toBeInTheDocument();
    });

    const odsButton = screen.getByText(/ODS 1 — Erradicação da Pobreza/).closest("button")!;
    await user.click(odsButton);

    await waitFor(() => {
      expect(screen.getByText("Menor = melhor")).toBeInTheDocument();
    });
  });

  it("mostra badge Maior = melhor para indicadores diretos", async () => {
    const user = userEvent.setup();
    renderPage();
    fetchResolver(MOCK_METHODOLOGY);

    await waitFor(() => {
      expect(screen.getByText(/ODS 3 — Saúde e Bem-Estar/)).toBeInTheDocument();
    });

    const odsButton = screen.getByText(/ODS 3 — Saúde e Bem-Estar/).closest("button")!;
    await user.click(odsButton);

    await waitFor(() => {
      expect(screen.getByText("Maior = melhor")).toBeInTheDocument();
    });
  });

  it("exibe a tabela de pesos por ODS", async () => {
    renderPage();
    fetchResolver(MOCK_METHODOLOGY);

    await waitFor(() => {
      expect(screen.getByText("Pesos por ODS")).toBeInTheDocument();
    });

    expect(screen.getByText("1.0×")).toBeInTheDocument();
    expect(screen.getByText("1.2×")).toBeInTheDocument();
  });

  it("mostra método de score global preferido", async () => {
    renderPage();
    fetchResolver(MOCK_METHODOLOGY);

    await waitFor(() => {
      expect(screen.getByText("Em uso")).toBeInTheDocument();
    });
  });

  it("exibe mensagem de erro quando API falha", async () => {
    renderPage();
    fetchRejecter(new Error("Servidor indisponível"));

    await waitFor(() => {
      expect(screen.getByText("Erro ao carregar metodologia")).toBeInTheDocument();
    });

    expect(screen.getByText("Servidor indisponível")).toBeInTheDocument();
  });
});
