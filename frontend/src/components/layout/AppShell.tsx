import { useState, useRef, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { Grid3X3, Sun, Moon, Monitor } from "lucide-react";
import { SC_MUNICIPALITIES } from "../../../../shared/constants/municipalities-sc";
import { useAuth } from "../../hooks/useAuth";
import { useTheme } from "../../hooks/useTheme";
import { cn } from "@/lib/utils";
import { FloatingBottomTabBar } from "./FloatingBottomTabBar";
import { NavigationRail } from "./NavigationRail";

interface AppShellProps {
  ibgeCode: string;
  onSelect: (ibgeCode: string) => void;
  referenceYear: number | null;
  children: React.ReactNode;
}

function getMunicipalityName(ibgeCode: string): string {
  return SC_MUNICIPALITIES.find((m) => m.ibgeCode === ibgeCode)?.name ?? ibgeCode;
}

// ---- Theme Toggle ----

const THEME_CYCLE = ["light", "dark", "system"] as const;
type Theme = (typeof THEME_CYCLE)[number];

function themeLabel(theme: Theme): string {
  if (theme === "light") return "Modo claro — clique para escuro";
  if (theme === "dark") return "Modo escuro — clique para sistema";
  return "Tema do sistema — clique para claro";
}

function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  function cycleTheme() {
    const idx = THEME_CYCLE.indexOf(theme as Theme);
    const next = THEME_CYCLE[(idx + 1) % THEME_CYCLE.length];
    setTheme(next);
  }

  const icon =
    theme === "system" ? (
      <Monitor className="size-4" />
    ) : resolvedTheme === "dark" ? (
      <Sun className="size-4" />
    ) : (
      <Moon className="size-4" />
    );

  return (
    <button
      type="button"
      onClick={cycleTheme}
      title={themeLabel(theme as Theme)}
      className={cn(
        "shrink-0 p-1.5 rounded-md transition-colors",
        "text-muted-foreground hover:text-foreground hover:bg-accent",
      )}
      aria-label={themeLabel(theme as Theme)}
    >
      {icon}
    </button>
  );
}

// ---- AppShell ----

export function AppShell({ ibgeCode, onSelect, referenceYear, children }: AppShellProps) {
  const { logout } = useAuth();

  const handleLogout = () => {
    void logout();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top header — simplified, no nav links (those are in Rail/BottomTab now) */}
      <header className="sticky top-0 z-30 bg-card/80 backdrop-blur-xl border-b border-border shadow-sm">
        <div className="max-w-screen-2xl mx-auto px-4 h-12 flex items-center gap-3">
          {/* Brand */}
          <NavLink to="/dashboard" className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 bg-primary rounded-md flex items-center justify-center text-primary-foreground">
              <Grid3X3 className="size-4" />
            </div>
            <span className="text-sm font-bold text-foreground hidden sm:block">
              IOC ESG Municipal
            </span>
            <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
              SC
            </span>
          </NavLink>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Municipality combobox */}
          <MunicipalityCombobox ibgeCode={ibgeCode} onSelect={onSelect} />

          {/* Reference year */}
          {referenceYear && (
            <span className="text-xs text-muted-foreground shrink-0 hidden sm:block">
              Dados de {referenceYear}
            </span>
          )}

          {/* Theme toggle */}
          <ThemeToggle />
        </div>
      </header>

      {/* Navigation Rail — desktop only */}
      <NavigationRail onLogout={handleLogout} />

      {/* Main content — offset by rail width on desktop, extra bottom padding on mobile for tab bar */}
      <main className="md:ml-16 max-w-screen-2xl mx-auto px-4 py-6 pb-24 md:pb-6">{children}</main>

      {/* Floating Bottom Tab Bar — mobile only */}
      <FloatingBottomTabBar />
    </div>
  );
}

// ---- Municipality Combobox ----

const POPULAR_CODES = ["4205407", "4209102", "4204202", "4205002", "4218707"];

interface ComboboxProps {
  ibgeCode: string;
  onSelect: (ibgeCode: string) => void;
}

function MunicipalityCombobox({ ibgeCode, onSelect }: ComboboxProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const filtered = query
    ? SC_MUNICIPALITIES.filter((m) => m.name.toLowerCase().includes(query.toLowerCase())).slice(
        0,
        8,
      )
    : SC_MUNICIPALITIES.filter((m) => POPULAR_CODES.includes(m.ibgeCode));

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
        placeholder="Buscar município..."
        className={cn(
          "w-40 sm:w-52 lg:w-64 px-3 py-1.5 text-sm rounded-md",
          "border border-border bg-background text-foreground",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
        )}
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
        <ul className="absolute top-full left-0 mt-1 w-full bg-card border border-border rounded-md shadow-lg max-h-60 overflow-y-auto z-50">
          {filtered.map((m) => (
            <li key={m.ibgeCode}>
              <button
                className={cn(
                  "w-full text-left px-3 py-2 text-sm transition-colors",
                  "hover:bg-accent hover:text-accent-foreground",
                )}
                onClick={() => {
                  onSelect(m.ibgeCode);
                  setIsOpen(false);
                  setQuery("");
                }}
              >
                <span className="font-medium">{m.name}</span>
                <span className="text-muted-foreground/60 ml-2 text-xs">{m.ibgeCode}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
