import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, ApiError } from "./api";
import type { Me } from "./types";

interface AuthState { me: Me | null; loading: boolean; setMe: (me: Me | null) => void; refresh: () => Promise<void>; signOut: () => Promise<void> }
const AuthContext = createContext<AuthState>(null!);
const KEY = "peti.me";

function remembered(): Me | null {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "null"); } catch { return null; }
}

function remember(me: Me | null) {
  try { if (me) localStorage.setItem(KEY, JSON.stringify(me)); else localStorage.removeItem(KEY); } catch { /* storage blocked */ }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMeState] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const setMe = useCallback((value: Me | null) => { remember(value); setMeState(value); }, []);
  const refresh = useCallback(async () => {
    try {
      setMe(await api.get<Me>("/api/me"));
    } catch (e) {
      // No signal: keep the last signed-in user so a salesman can keep taking orders. Any other error signs out.
      if (e instanceof ApiError && e.status === 0) setMeState(remembered());
      else setMe(null);
    } finally {
      setLoading(false);
    }
  }, [setMe]);
  useEffect(() => { refresh(); }, [refresh]);
  const signOut = async () => {
    await api.post("/api/auth/logout").catch(() => {});
    setMe(null);
  };
  return <AuthContext.Provider value={{ me, loading, setMe, refresh, signOut }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
