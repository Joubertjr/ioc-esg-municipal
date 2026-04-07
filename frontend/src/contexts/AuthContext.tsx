import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { checkSession } from "../lib/api";

interface AuthContextValue {
  isAuthenticated: boolean | null; // null = loading
  setAuthenticated: (v: boolean) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    checkSession().then((ok) => setAuthenticated(ok));
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, setAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext must be used within AuthProvider");
  return ctx;
}
