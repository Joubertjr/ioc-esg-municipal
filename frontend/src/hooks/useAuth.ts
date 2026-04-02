import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { apiPost, getToken, setToken, removeToken, isAuthenticated } from "../lib/api";

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
}

export function useAuth() {
  const navigate = useNavigate();

  const login = useCallback(
    async (email: string, password: string): Promise<void> => {
      const payload: LoginPayload = { email, password };
      const data = await apiPost<AuthResponse>("/api/auth/login", payload);
      setToken(data.token);
      navigate("/dashboard");
    },
    [navigate],
  );

  const register = useCallback(
    async (name: string, email: string, password: string): Promise<void> => {
      const payload: RegisterPayload = { name, email, password };
      const data = await apiPost<AuthResponse>("/api/auth/register", payload);
      setToken(data.token);
      navigate("/dashboard");
    },
    [navigate],
  );

  const logout = useCallback((): void => {
    removeToken();
    navigate("/login");
  }, [navigate]);

  return {
    login,
    register,
    logout,
    isAuthenticated: isAuthenticated(),
    getToken,
  };
}
