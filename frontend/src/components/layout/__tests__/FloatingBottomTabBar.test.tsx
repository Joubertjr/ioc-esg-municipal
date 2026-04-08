import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { FloatingBottomTabBar } from "../FloatingBottomTabBar";

function renderWithRouter(initialPath = "/dashboard") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <FloatingBottomTabBar />
    </MemoryRouter>,
  );
}

describe("FloatingBottomTabBar", () => {
  it("renders the navigation landmark with the correct accessible label", () => {
    renderWithRouter();
    expect(screen.getByRole("navigation", { name: "Navegação principal" })).toBeInTheDocument();
  });

  it("renders exactly 5 navigation links", () => {
    renderWithRouter();
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(5);
  });

  it("renders a link to /dashboard", () => {
    renderWithRouter();
    expect(screen.getByRole("link", { name: /painel/i })).toHaveAttribute("href", "/dashboard");
  });

  it("renders a link to /simulator", () => {
    renderWithRouter();
    expect(screen.getByRole("link", { name: /simular/i })).toHaveAttribute("href", "/simulator");
  });

  it("renders a link to /monitoring", () => {
    renderWithRouter();
    expect(screen.getByRole("link", { name: /metas/i })).toHaveAttribute("href", "/monitoring");
  });

  it("renders a link to /reports", () => {
    renderWithRouter();
    expect(screen.getByRole("link", { name: /relatórios/i })).toHaveAttribute("href", "/reports");
  });

  it("renders a link to /benchmark", () => {
    renderWithRouter();
    expect(screen.getByRole("link", { name: /comparar/i })).toHaveAttribute("href", "/benchmark");
  });

  it("marks the active tab with aria-current=page when on /dashboard", () => {
    renderWithRouter("/dashboard");
    const activeLink = screen.getByRole("link", { name: /painel/i });
    expect(activeLink).toHaveAttribute("aria-current", "page");
  });

  it("marks the active tab with aria-current=page when on /simulator", () => {
    renderWithRouter("/simulator");
    const activeLink = screen.getByRole("link", { name: /simular/i });
    expect(activeLink).toHaveAttribute("aria-current", "page");
  });

  it("does not mark inactive tabs with aria-current when /dashboard is active", () => {
    renderWithRouter("/dashboard");
    const inactiveLinks = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("href") !== "/dashboard");
    inactiveLinks.forEach((link) => {
      expect(link).not.toHaveAttribute("aria-current", "page");
    });
  });

  it("marks the active tab based on pathname prefix match for nested routes", () => {
    renderWithRouter("/reports/detail/123");
    const activeLink = screen.getByRole("link", { name: /relatórios/i });
    expect(activeLink).toHaveAttribute("aria-current", "page");
  });
});
