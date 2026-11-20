import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { PropsWithChildren } from "react";
import axios from "axios";
import { api } from "../lib/api";
import type { User } from "../types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<User>;
  register: (input: {
    username: string;
    email: string;
    password: string;
    confirmPassword: string;
  }) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get<{ data: { user: User | null } }>("/auth/me");
      setUser(response.data.data.user ?? null);
      setError(null);
    } catch (requestError) {
      if (axios.isAxiosError(requestError) && requestError.response?.status === 401) {
        setUser(null);
        setError(null);
      } else {
        setError("Could not verify your session. Check the API connection.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const response = await api.post<{ data: { user: User } }>("/auth/login", { email, password });
    setUser(response.data.data.user);
    setError(null);
    return response.data.data.user;
  }, []);

  const register = useCallback(async (input: {
    username: string;
    email: string;
    password: string;
    confirmPassword: string;
  }) => {
    const response = await api.post<{ data: { user: User } }>("/auth/register", input);
    setUser(response.data.data.user);
    setError(null);
    return response.data.data.user;
  }, []);

  const logout = useCallback(async () => {
    await api.post("/auth/logout");
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, error, refresh, login, register, logout }),
    [user, loading, error, refresh, login, register, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}
