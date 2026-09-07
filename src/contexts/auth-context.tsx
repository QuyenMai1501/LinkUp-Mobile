import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { tokenStorage } from '@/api/token-storage';
import type { AuthResponse, AuthUserResponse } from '@/types/auth';

type AuthContextValue = {
  user: AuthUserResponse | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isRestoring: boolean;
  signIn: (response: AuthResponse) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUserResponse | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const [token, storedUser] = await Promise.all([
          tokenStorage.getAccessToken(),
          tokenStorage.getUser(),
        ]);
        if (active) {
          setAccessToken(token);
          setUser(storedUser);
        }
      } finally {
        if (active) setIsRestoring(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      accessToken,
      isAuthenticated: !!accessToken,
      isRestoring,
      async signIn(response) {
        await tokenStorage.save(
          response.tokens.access_token,
          response.tokens.refresh_token,
          response.user,
        );
        setAccessToken(response.tokens.access_token);
        setUser(response.user);
      },
      async signOut() {
        await tokenStorage.clear();
        setAccessToken(null);
        setUser(null);
      },
    }),
    [accessToken, user, isRestoring],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
