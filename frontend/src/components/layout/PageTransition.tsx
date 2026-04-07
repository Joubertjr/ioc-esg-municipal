import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// PageTransition — wrapper com fade-in + slide-up sutil via CSS animation.
// Envolva cada página protegida para dar sensação de fluidez entre rotas.
// Sem framer-motion — puro CSS.
// ---------------------------------------------------------------------------

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
}

export function PageTransition({ children, className }: PageTransitionProps) {
  return <div className={cn("animate-page-in", className)}>{children}</div>;
}
