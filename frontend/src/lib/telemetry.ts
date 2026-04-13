import { onLCP, onINP, onCLS, onFCP, onTTFB, type Metric } from "web-vitals";

interface TelemetryEvent {
  type: "web-vital" | "api-timing";
  name: string;
  value: number;
  page?: string;
  timestamp: number;
}

const buffer: TelemetryEvent[] = [];
const FLUSH_INTERVAL_MS = 30_000;
const BASE_URL = import.meta.env.VITE_API_URL ?? "";

function pushVital(metric: Metric): void {
  buffer.push({
    type: "web-vital",
    name: metric.name,
    value: Math.round(metric.value * 100) / 100,
    page: window.location.pathname,
    timestamp: Date.now(),
  });
}

export function measureApiCall(path: string, durationMs: number, status: number): void {
  buffer.push({
    type: "api-timing",
    name: `${status} ${path}`,
    value: Math.round(durationMs),
    page: window.location.pathname,
    timestamp: Date.now(),
  });
}

function flush(): void {
  if (buffer.length === 0) return;

  const events = buffer.splice(0, buffer.length);
  const body = JSON.stringify({ events });

  // sendBeacon is fire-and-forget, works on page unload
  if (navigator.sendBeacon) {
    navigator.sendBeacon(
      `${BASE_URL}/api/telemetry`,
      new Blob([body], { type: "application/json" }),
    );
  } else {
    void fetch(`${BASE_URL}/api/telemetry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    });
  }
}

export function initTelemetry(): void {
  onLCP(pushVital);
  onINP(pushVital);
  onCLS(pushVital);
  onFCP(pushVital);
  onTTFB(pushVital);

  setInterval(flush, FLUSH_INTERVAL_MS);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
}
