import { useState, useRef, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { SC_MUNICIPALITIES } from "../../../../shared/constants/municipalities-sc";
import { removeToken } from "../../lib/api";

interface AppShellProps {
  ibgeCode: string;
  onSelect: (ibgeCode: string) => void;
  referenceYear: number | null;
  children: React.ReactNode;
}

function getMunicipalityName(ibgeCode: string): string {
  return (
    SC_MUNICIPALITIES.find((m) => m.ibgeCode === ibgeCode)?.name ?? ibgeCode
  );
}

// ---- Icons ----

function IconGrid() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
    </svg>
  );
}

function IconDashboard() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <rect x="3" y="3" width="7" height="7" rx="1" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="14" y="3" width="7" height="7" rx="1" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="3" y="14" width="7" height="7" rx="1" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="14" y="14" width="7" height="7" rx="1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconSimulator() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 7H6a2 2 0 00-2 2v9a2 2 0 002 2h12a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
    </svg>
  );
}

function IconReports() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function IconMonitoring() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

function IconLogout() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  );
}

function IconHamburger() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

// ---- Nav config ----

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Painel ODS", icon: <IconDashboard /> },
  { to: "/simulator", label: "Simulador", icon: <IconSimulator /> },
  { to: "/reports", label: "Relatórios", icon: <IconReports /> },
  { to: "/monitoring", label: "Monitoramento", icon: <IconMonitoring /> },
];

function navLinkClass({ isActive }: { isActive: boolean }): string {
  const base = "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors";
  return isActive
    ? `${base} bg-blue-600 text-white shadow-sm`
    : `${base} text-gray-600 hover:bg-gray-100 hover:text-gray-900`;
}

function mobileNavLinkClass({ isActive }: { isActive: boolean }): string {
  const base = "flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors rounded-lg";
  return isActive
    ? `${base} bg-blue-600 text-white`
    : `${base} text-gray-700 hover:bg-gray-100`;
}

export function AppShell({
  ibgeCode,
  onSelect,
  referenceYear,
  children,
}: AppShellProps) {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    removeToken();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top header */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-4">
          {/* Brand */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 bg-blue-600 rounded-md flex items-center justify-center">
              <IconGrid />
            </div>
            <span className="text-sm font-bold text-gray-900 hidden sm:block">
              IOC ESG Municipal
            </span>
            <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
              SC
            </span>
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1 ml-2">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.to} to={item.to} className={navLinkClass}>
                {item.icon}
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Municipality combobox */}
          <MunicipalityCombobox ibgeCode={ibgeCode} onSelect={onSelect} />

          {/* Reference year */}
          {referenceYear && (
            <span className="text-xs text-gray-500 shrink-0 hidden sm:block">
              Ref. {referenceYear}
            </span>
          )}

          {/* Desktop logout */}
          <button
            type="button"
            onClick={handleLogout}
            title="Sair"
            className="hidden md:flex items-center gap-1.5 shrink-0 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            <IconLogout />
            <span className="hidden lg:block">Sair</span>
          </button>

          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="md:hidden shrink-0 p-1 rounded-md text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
            aria-label="Abrir menu"
          >
            {mobileMenuOpen ? <IconClose /> : <IconHamburger />}
          </button>
        </div>

        {/* Mobile dropdown menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 bg-white px-4 py-3 space-y-1 shadow-lg">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={mobileNavLinkClass}
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.icon}
                {item.label}
              </NavLink>
            ))}
            <div className="pt-2 border-t border-gray-100 mt-2">
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <IconLogout />
                Sair
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}

// ---- Municipality Combobox ----

interface ComboboxProps {
  ibgeCode: string;
  onSelect: (ibgeCode: string) => void;
}

function MunicipalityCombobox({ ibgeCode, onSelect }: ComboboxProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const filtered = query
    ? SC_MUNICIPALITIES.filter((m) =>
        m.name.toLowerCase().includes(query.toLowerCase()),
      ).slice(0, 8)
    : [];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={wrapperRef}>
      <input
        type="text"
        value={isOpen ? query : getMunicipalityName(ibgeCode)}
        placeholder="Buscar municipio..."
        className="w-44 sm:w-56 lg:w-64 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        onFocus={() => {
          setIsOpen(true);
          setQuery("");
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
        }}
      />
      {isOpen && filtered.length > 0 && (
        <ul className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto z-50">
          {filtered.map((m) => (
            <li key={m.ibgeCode}>
              <button
                className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors"
                onClick={() => {
                  onSelect(m.ibgeCode);
                  setIsOpen(false);
                  setQuery("");
                }}
              >
                <span className="font-medium">{m.name}</span>
                <span className="text-gray-400 ml-2 text-xs">
                  {m.ibgeCode}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
