import { useMediaQuery } from "../../hooks/useMediaQuery";
import { OdsDetailDrawer } from "./OdsDetailDrawer";
import { OdsBottomSheet } from "./OdsBottomSheet";
import type { OdsSummary } from "../../types/api";

// ---------------------------------------------------------------------------
// Responsive ODS detail panel:
//   - Mobile (<768px): OdsBottomSheet (slides from bottom, swipe-to-dismiss)
//   - Desktop (≥768px): OdsDetailDrawer (slides from right)
// ---------------------------------------------------------------------------

interface OdsDetailPanelProps {
  ods: OdsSummary | null;
  onClose: () => void;
}

export function OdsDetailPanel({ ods, onClose }: OdsDetailPanelProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  if (isDesktop) {
    return <OdsDetailDrawer ods={ods} onClose={onClose} />;
  }

  return <OdsBottomSheet ods={ods} onClose={onClose} />;
}
