import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { apiPost, setRefreshToken, getRefreshToken } from "../lib/api";

interface LoginPayload {
  email: string;
  password: string;
}

interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}

interface AuthResponse {
  token: string;
  refreshToken: string;
}

export function useAuth() {
  const navigate = useNavigate();

  const login = useCallback(
    async (email: string, password: string): Promise<void> => {
      const payload: LoginPayload = { email, password };
      const result = await apiPost<AuthResponse>("/api/auth/login", payload);
      setRefreshToken(result.refreshToken);
      navigate("/dashboard");
    },
    [navigate],
  );

  const register = useCallback(
    async (name: string, email: string, password: string): Promise<void> => {
      const payload: RegisterPayload = { name, email, password };
      const result = await apiPost<AuthResponse>("/api/auth/register", payload);
      setRefreshToken(result.refreshToken);
      navigate("/dashboard");
    },
    [navigate],
  );

  const logout = useCallback(async (): Promise<void> => {
    const currentRefreshToken = getRefreshToken();
    try {
      await apiPost<unknown>("/api/auth/logout", { refreshToken: currentRefreshToken });
    } finally {
      setRefreshToken(null);
      navigate("/login");
    }
  }, [navigate]);

  return { login, register, logout };
}
