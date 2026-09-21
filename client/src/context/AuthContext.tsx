import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { User } from "../types";
import * as api from "../api/client";

type Status = "loading" | "authed" | "guest";

interface AuthContextValue {
  user: User | null;
  status: Status;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    // Try to restore a session from the refresh cookie on first load.
    api
      .refresh()
      .then((res) => {
        if (res) {
          setUser(res.user);
          setStatus("authed");
        } else {
          setStatus("guest");
        }
      })
      .catch(() => setStatus("guest"));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      login: async (email, password) => {
        const res = await api.login({ email, password });
        setUser(res.user);
        setStatus("authed");
      },
      register: async (name, email, password) => {
        const res = await api.register({ name, email, password });
        setUser(res.user);
        setStatus("authed");
      },
      logout: async () => {
        await api.logout();
        setUser(null);
        setStatus("guest");
      },
    }),
    [user, status],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
