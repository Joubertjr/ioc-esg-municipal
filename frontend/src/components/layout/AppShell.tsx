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

const NAV_LINK_BASE =
  "text-sm font-medium px-3 py-1.5 rounded-md transition-colors";
const NAV_LINK_ACTIVE = "bg-blue-100 text-blue-700";
const NAV_LINK_INACTIVE = "text-gray-600 hover:bg-gray-100 hover:text-gray-900";

function navLinkClass({ isActive }: { isActive: boolean }): string {
  return `${NAV_LINK_BASE} ${isActive ? NAV_LINK_ACTIVE : NAV_LINK_INACTIVE}`;
}

export function AppShell({
  ibgeCode,
  onSelect,
  referenceYear,
  children,
}: AppShellProps) {
  const navigate = useNavigate();

  const handleLogout = () => {
    removeToken();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-4">
          {/* Brand */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-base font-bold text-gray-900">
              IOC ESG Municipal
            </span>
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
              SC
            </span>
          </div>

          {/* Nav links */}
          <nav className="flex items-center gap-1 ml-2">
            <NavLink to="/dashboard" className={navLinkClass}>
              Painel ODS
            </NavLink>
            <NavLink to="/simulator" className={navLinkClass}>
              Simulador
            </NavLink>
          </nav>

          {/* Spacer */}
          <div className="flex-1" />

          <MunicipalityCombobox ibgeCode={ibgeCode} onSelect={onSelect} />

          {referenceYear && (
            <span className="text-xs text-gray-500 shrink-0">
              Ref. {referenceYear}
            </span>
          )}

          <button
            type="button"
            onClick={handleLogout}
            className="shrink-0 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            Sair
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}

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
        className="w-64 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
