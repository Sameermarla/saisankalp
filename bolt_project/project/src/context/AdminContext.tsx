import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { db } from '@/lib/db';
import type { AdminSession } from '@/types';

interface AdminContextValue {
  session: AdminSession | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AdminContext = createContext<AdminContextValue | null>(null);

const STORAGE_KEY = 'sai_sankalp_admin_session';

export function AdminProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [loading, setLoading] = useState(true);

  const verifyToken = useCallback(async (token: string): Promise<AdminSession | null> => {
    try {
      const res = db.adminVerifySession(token);
      if (res.valid && res.username) {
        return { token, username: res.username };
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    async function checkSession() {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed: AdminSession = JSON.parse(stored);
          const verified = await verifyToken(parsed.token);
          if (verified) {
            setSession(verified);
          } else {
            localStorage.removeItem(STORAGE_KEY);
          }
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
      setLoading(false);
    }
    checkSession();
  }, [verifyToken]);

  const login = useCallback(
    async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const res = db.adminLogin(username, password);
        if (!res.success || !res.token) {
          return { success: false, error: res.error || 'Invalid credentials' };
        }
        const newSession: AdminSession = { token: res.token, username: res.username || username };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newSession));
        setSession(newSession);
        return { success: true };
      } catch {
        return { success: false, error: 'Login failed. Please try again.' };
      }
    },
    []
  );

  const logout = useCallback(() => {
    if (session) {
      db.adminLogout(session.token);
    }
    localStorage.removeItem(STORAGE_KEY);
    setSession(null);
  }, [session]);

  return (
    <AdminContext.Provider value={{ session, loading, login, logout }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin must be used within AdminProvider');
  return ctx;
}
