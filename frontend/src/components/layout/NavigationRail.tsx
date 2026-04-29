import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Calculator,
  FileText,
  BarChart3,
  Scale,
  BookOpen,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RailItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const RAIL_ITEMS: RailItem[] = [
  { to: "/dashboard", label: "Painel ODS", icon: LayoutDashboard },
  { to: "/simulator", label: "Simulador", icon: Calculator },
  { to: "/reports", label: "Relatórios", icon: FileText },
  { to: "/monitoring", label: "Monitoramento", icon: BarChart3 },
  { to: "/benchmark", label: "Comparativo", icon: Scale },
  { to: "/methodology", label: "Metodologia", icon: BookOpen },
];

interface NavigationRailProps {
  onLogout: () => void;
}

export function NavigationRail({ onLogout }: NavigationRailProps) {
  const location = useLocation();

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col items-center",
        "fixed left-0 top-14 bottom-0 z-20",
        "w-16 py-4",
        "bg-card/50 backdrop-blur-sm border-r border-border",
      )}
      aria-label="Navegação principal"
    >
      <nav className="flex flex-col items-center gap-1 flex-1">
        {RAIL_ITEMS.map((item) => {
          const isActive = location.pathname.startsWith(item.to);
          const Icon = item.icon;

          return (
            <NavLink
              key={item.to}
              to={item.to}
              title={item.label}
              className={cn(
                "group relative flex items-center justify-center",
                "w-10 h-10 rounded-xl transition-all",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="size-5" />
              {/* Tooltip */}
              <span
                className={cn(
                  "absolute left-full ml-2 px-2 py-1 rounded-md text-xs font-medium whitespace-nowrap",
                  "bg-popover text-popover-foreground border border-border shadow-md",
                  "opacity-0 scale-95 pointer-events-none",
                  "group-hover:opacity-100 group-hover:scale-100",
                  "transition-all duration-150",
                )}
              >
                {item.label}
              </span>
            </NavLink>
          );
        })}
      </nav>

      {/* Logout at bottom */}
      <button
        type="button"
        onClick={onLogout}
        title="Sair"
        className={cn(
          "group relative flex items-center justify-center",
          "w-10 h-10 rounded-xl transition-colors",
          "text-muted-foreground hover:bg-destructive/10 hover:text-destructive",
        )}
      >
        <LogOut className="size-5" />
        <span
          className={cn(
            "absolute left-full ml-2 px-2 py-1 rounded-md text-xs font-medium whitespace-nowrap",
            "bg-popover text-popover-foreground border border-border shadow-md",
            "opacity-0 scale-95 pointer-events-none",
            "group-hover:opacity-100 group-hover:scale-100",
            "transition-all duration-150",
          )}
        >
          Sair
        </span>
      </button>
    </aside>
  );
}
