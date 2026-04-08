import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, Calculator, FileText, Target, Scale } from "lucide-react";
import { cn } from "@/lib/utils";

interface TabItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TABS: TabItem[] = [
  { to: "/dashboard", label: "Painel", icon: LayoutDashboard },
  { to: "/simulator", label: "Simular", icon: Calculator },
  { to: "/monitoring", label: "Metas", icon: Target },
  { to: "/reports", label: "Relatórios", icon: FileText },
  { to: "/benchmark", label: "Comparar", icon: Scale },
];

export function FloatingBottomTabBar() {
  const location = useLocation();

  return (
    <nav
      className={cn(
        "fixed bottom-4 left-4 right-4 z-40 md:hidden",
        "flex items-center justify-around",
        "h-14 rounded-2xl",
        "bg-card/80 backdrop-blur-xl",
        "border border-border shadow-lg shadow-black/5",
      )}
      aria-label="Navegação principal"
    >
      {TABS.map((tab) => {
        const isActive = location.pathname.startsWith(tab.to);
        const Icon = tab.icon;

        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 flex-1 h-full",
              "text-micro font-medium transition-colors",
              isActive ? "text-primary" : "text-muted-foreground active:text-foreground",
            )}
            aria-current={isActive ? "page" : undefined}
          >
            <div
              className={cn(
                "flex items-center justify-center w-8 h-8 rounded-xl transition-all",
                isActive && "bg-primary/10",
              )}
            >
              <Icon className={cn("size-5 transition-transform", isActive && "scale-110")} />
            </div>
            <span className="text-[10px] leading-none">{tab.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
