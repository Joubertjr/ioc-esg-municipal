import { measureApiCall } from "./telemetry";

const BASE_URL = import.meta.env.VITE_API_URL ?? "";

if (import.meta.env.PROD && !import.meta.env.VITE_API_URL) {
  console.warn(
    "[api] VITE_API_URL não definida — usando fallback localhost. Configure a variável em produção.",
  );
}

// In-memory refresh token — not persisted to localStorage (XSS protection).
// Populated on login, cleared on logout or failed refresh.
let refreshToken: string | null = null;

export function setRefreshToken(token: string | null): void {
  refreshToken = token;
}

export function getRefreshToken(): string | null {
  return refreshToken;
}

// Promise lock: prevents multiple concurrent refresh attempts.
let refreshPromise: Promise<boolean> | null = null;

async function attemptRefresh(): Promise<boolean> {
  if (!refreshToken) return false;

  try {
    const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      refreshToken = null;
      return false;
    }

    const data = (await res.json()) as { token: string; refreshToken: string };
    refreshToken = data.refreshToken;
    return true;
  } catch {
    refreshToken = null;
    return false;
  }
}

function triggerRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = attemptRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function fetchWithRefresh(path: string, init: RequestInit): Promise<Response> {
  const url = `${BASE_URL}${path}`;
  const start = Date.now();
  const res = await fetch(url, init);
  measureApiCall(path, Date.now() - start, res.status);

  if (res.status !== 401) return res;

  // 401 — try to refresh once
  const refreshed = await triggerRefresh();
  if (!refreshed) {
    if (window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
    return res;
  }

  // Retry the original request with the new session cookie
  return fetch(url, init);
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    if (res.status === 401) {
      // Reached here only when refresh also failed (redirect already triggered)
      throw new Error("Sessão expirada. Faça login novamente.");
    }
    let message = `Erro HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { message?: string; error?: string };
      message = body.message ?? body.error ?? message;
    } catch {
      // body não é JSON; mantém mensagem padrão
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetchWithRefresh(path, {
    method: "GET",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });
  return handleResponse<T>(res);
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetchWithRefresh(path, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return handleResponse<T>(res);
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetchWithRefresh(path, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return handleResponse<T>(res);
}

export async function checkSession(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/auth/me`, {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    return res.ok;
  } catch {
    return false;
  }
}
