import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiPost, apiPatch, setRefreshToken, getRefreshToken } from "../lib/api";
import { useAuthContext, type AuthUser } from "../contexts/AuthContext";

export type { AuthUser };

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
  user?: AuthUser;
}

interface UpdateMeResponse {
  user: AuthUser;
  token: string;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth() {
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(null);
  const { setAuthenticated, setCurrentUser } = useAuthContext();

  const login = useCallback(
    async (email: string, password: string): Promise<void> => {
      const payload: LoginPayload = { email, password };
      const result = await apiPost<AuthResponse>("/api/auth/login", payload);
      setRefreshToken(result.refreshToken);

      const authenticatedUser = result.user ?? null;
      setUser(authenticatedUser);
      setCurrentUser(authenticatedUser);
      setAuthenticated(true);

      if (!authenticatedUser || authenticatedUser.municipalityId === null) {
        navigate("/onboarding");
      } else {
        navigate("/dashboard");
      }
    },
    [navigate, setAuthenticated, setCurrentUser],
  );

  const register = useCallback(
    async (name: string, email: string, password: string): Promise<void> => {
      const payload: RegisterPayload = { name, email, password };
      const result = await apiPost<AuthResponse>("/api/auth/register", payload);
      setRefreshToken(result.refreshToken);

      const registeredUser = result.user ?? null;
      setUser(registeredUser);
      setCurrentUser(registeredUser);
      setAuthenticated(true);

      // Novo usuário sempre vai para onboarding (município ainda não definido)
      if (!registeredUser || registeredUser.municipalityId === null) {
        navigate("/onboarding");
      } else {
        navigate("/dashboard");
      }
    },
    [navigate, setAuthenticated, setCurrentUser],
  );

  const logout = useCallback(async (): Promise<void> => {
    const currentRefreshToken = getRefreshToken();
    try {
      await apiPost<unknown>("/api/auth/logout", { refreshToken: currentRefreshToken });
    } finally {
      setRefreshToken(null);
      setUser(null);
      setCurrentUser(null);
      setAuthenticated(false);
      navigate("/login");
    }
  }, [navigate, setAuthenticated, setCurrentUser]);

  const updateMunicipality = useCallback(
    async (ibgeCode: string): Promise<void> => {
      const result = await apiPatch<UpdateMeResponse>("/api/auth/me", { ibgeCode });
      setUser(result.user);
      setCurrentUser(result.user);
    },
    [setCurrentUser],
  );

  return { user, login, register, logout, updateMunicipality };
}
