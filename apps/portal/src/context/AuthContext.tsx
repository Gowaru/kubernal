import { createContext, useState, useEffect, useCallback, useRef, type ReactNode, type JSX } from 'react';
import type { User, UserRole } from '@kubernal/shared-types';
import { hasRole } from '@kubernal/shared-types';
import apiClient from '@/lib/api-client';

const POLL_INTERVAL_MS = 15 * 60 * 1000;

export interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (role: UserRole) => boolean;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchUser = useCallback(async () => {
    try {
      const { data } = await apiClient.get<{ success: true; data: User }>('/auth/me');
      setUser(data.data);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      fetchUser();
    }, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchUser]);

  const login = async (email: string, password: string, rememberMe?: boolean): Promise<void> => {
    const { data } = await apiClient.post<{ success: true; data: User }>('/auth/login', { email, password, rememberMe });
    setUser(data.data);
  };

  const logout = async (): Promise<void> => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
    } finally {
      setUser(null);
    }
  };

  const checkRole = (role: UserRole): boolean => {
    if (!user) return false;
    return hasRole(user.role, role);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        hasRole: checkRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

