import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { apiGet } from "../lib/api";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  municipalityId: string | null;
  ibgeCode: string | null;
  createdAt: string;
}

interface AuthContextValue {
  isAuthenticated: boolean | null; // null = loading
  setAuthenticated: (v: boolean) => void;
  currentUser: AuthUser | null;
  setCurrentUser: (u: AuthUser | null) => void;
  refreshCurrentUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setAuthenticated] = useState<boolean | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  const refreshCurrentUser = useCallback(async () => {
    try {
      const data = await apiGet<{ user: AuthUser }>("/api/auth/me");
      setCurrentUser(data.user);
      setAuthenticated(true);
    } catch {
      setCurrentUser(null);
      setAuthenticated(false);
    }
  }, []);

  useEffect(() => {
    refreshCurrentUser();
  }, [refreshCurrentUser]);

  return (
    <AuthContext.Provider
      value={{ isAuthenticated, setAuthenticated, currentUser, setCurrentUser, refreshCurrentUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext must be used within AuthProvider");
  return ctx;
}
