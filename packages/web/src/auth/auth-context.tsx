import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { AuthResponse, UserPublic } from '@chamados/shared';
import { api, getToken, setToken } from '@/lib/api';

interface AuthContextValue {
  user: UserPublic | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  firstAccess: (email: string, newPassword: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const USER_KEY = 'chamados.user';

function readStoredUser(): UserPublic | null {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? (JSON.parse(raw) as UserPublic) : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserPublic | null>(readStoredUser);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api
      .get<UserPublic>('/users/me')
      .then((res) => {
        setUser(res.data);
        localStorage.setItem(USER_KEY, JSON.stringify(res.data));
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string): Promise<void> {
    const res = await api.post<AuthResponse>('/auth/login', { email, password });
    setToken(res.data.token);
    setUser(res.data.user);
    localStorage.setItem(USER_KEY, JSON.stringify(res.data.user));
  }

  async function firstAccess(email: string, newPassword: string): Promise<void> {
    const res = await api.post<AuthResponse>('/auth/first-access', { email, newPassword });
    setToken(res.data.token);
    setUser(res.data.user);
    localStorage.setItem(USER_KEY, JSON.stringify(res.data.user));
  }

  function logout(): void {
    setToken(null);
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }

  async function refreshUser(): Promise<void> {
    const res = await api.get<UserPublic>('/users/me');
    setUser(res.data);
    localStorage.setItem(USER_KEY, JSON.stringify(res.data));
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, firstAccess, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
