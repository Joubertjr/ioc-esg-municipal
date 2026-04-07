import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// AnimatedNumber — count-up puro com requestAnimationFrame (sem libs)
// Anima de 0 até `value` em ~600ms com easing ease-out.
// ---------------------------------------------------------------------------

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  className?: string;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function AnimatedNumber({ value, duration = 600, className }: AnimatedNumberProps) {
  const [display, setDisplay] = useState(0);
  const prevValue = useRef(0);
  const rafId = useRef<number>(0);

  useEffect(() => {
    const from = prevValue.current;
    const to = value;
    const startTime = performance.now();

    function animate(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutCubic(progress);
      const current = Math.round(from + (to - from) * eased);
      setDisplay(current);

      if (progress < 1) {
        rafId.current = requestAnimationFrame(animate);
      } else {
        prevValue.current = to;
      }
    }

    rafId.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId.current);
  }, [value, duration]);

  return <span className={className}>{display}</span>;
}
