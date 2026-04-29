import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { NavigationRail } from "../NavigationRail";

function renderWithRouter(initialPath = "/dashboard", onLogout = vi.fn()) {
  return render(
    <MemoryRouter
      initialEntries={[initialPath]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <NavigationRail onLogout={onLogout} />
    </MemoryRouter>,
  );
}

describe("NavigationRail", () => {
  it("renders the aside landmark with the correct accessible label", () => {
    renderWithRouter();
    expect(screen.getByRole("complementary", { name: "Navegação principal" })).toBeInTheDocument();
  });

  it("renders exactly 5 navigation links", () => {
    renderWithRouter();
    // Navigation links are inside the nav within the aside
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(6);
  });

  it("renders a link to /dashboard with title Painel ODS", () => {
    renderWithRouter();
    expect(screen.getByRole("link", { name: "Painel ODS" })).toHaveAttribute("href", "/dashboard");
  });

  it("renders a link to /simulator with title Simulador", () => {
    renderWithRouter();
    expect(screen.getByRole("link", { name: "Simulador" })).toHaveAttribute("href", "/simulator");
  });

  it("renders a link to /reports with title Relatórios", () => {
    renderWithRouter();
    expect(screen.getByRole("link", { name: "Relatórios" })).toHaveAttribute("href", "/reports");
  });

  it("renders a link to /monitoring with title Monitoramento", () => {
    renderWithRouter();
    expect(screen.getByRole("link", { name: "Monitoramento" })).toHaveAttribute(
      "href",
      "/monitoring",
    );
  });

  it("renders a link to /benchmark with title Comparativo", () => {
    renderWithRouter();
    expect(screen.getByRole("link", { name: "Comparativo" })).toHaveAttribute("href", "/benchmark");
  });

  it("renders a link to /methodology with title Metodologia", () => {
    renderWithRouter();
    expect(screen.getByRole("link", { name: "Metodologia" })).toHaveAttribute(
      "href",
      "/methodology",
    );
  });

  it("marks the active route with aria-current=page when on /dashboard", () => {
    renderWithRouter("/dashboard");
    const activeLink = screen.getByRole("link", { name: "Painel ODS" });
    expect(activeLink).toHaveAttribute("aria-current", "page");
  });

  it("marks the active route with aria-current=page when on /reports", () => {
    renderWithRouter("/reports");
    const activeLink = screen.getByRole("link", { name: "Relatórios" });
    expect(activeLink).toHaveAttribute("aria-current", "page");
  });

  it("does not set aria-current on inactive links when /dashboard is active", () => {
    renderWithRouter("/dashboard");
    const inactiveLinks = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("href") !== "/dashboard");
    inactiveLinks.forEach((link) => {
      expect(link).not.toHaveAttribute("aria-current", "page");
    });
  });

  it("renders the logout button with title Sair", () => {
    renderWithRouter();
    expect(screen.getByRole("button", { name: "Sair" })).toBeInTheDocument();
  });

  it("calls onLogout when the logout button is clicked", async () => {
    const user = userEvent.setup();
    const onLogout = vi.fn();
    renderWithRouter("/dashboard", onLogout);

    await user.click(screen.getByRole("button", { name: "Sair" }));

    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it("does not call onLogout before the button is clicked", () => {
    const onLogout = vi.fn();
    renderWithRouter("/dashboard", onLogout);
    expect(onLogout).not.toHaveBeenCalled();
  });
});
