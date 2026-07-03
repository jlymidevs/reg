import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  authError: string;
  signIn: (email: string, password: string) => Promise<{ ok: boolean; message?: string }>;
  signInWithGoogle: () => Promise<{ ok: boolean; message?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAdmin: false,
  loading: true,
  authError: '',
  signIn: async () => ({ ok: false }),
  signInWithGoogle: async () => ({ ok: false }),
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

async function checkIsAdmin(user: User | null): Promise<boolean> {
  if (!user?.email) return false;
  const { data, error } = await supabase
    .from('admin_users')
    .select('id')
    .ilike('email', user.email)
    .maybeSingle();
  if (error) {
    // Temporary query error must not sign the admin out
    console.error('Admin check failed:', error.message);
    return false;
  }
  return data !== null;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  const applySession = useCallback(async (session: Session | null) => {
    const sessionUser = session?.user ?? null;
    setUser(sessionUser);
    if (sessionUser) {
      const admin = await checkIsAdmin(sessionUser);
      setIsAdmin(admin);
      setAuthError(admin ? '' : 'You are signed in, but you are not authorized as an admin.');
    } else {
      setIsAdmin(false);
      setAuthError('');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!cancelled) await applySession(session);
      } catch (err) {
        console.error('Session check failed:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setIsAdmin(false);
        setAuthError('');
        return;
      }
      // SIGNED_IN / TOKEN_REFRESHED / USER_UPDATED: keep dashboard available,
      // re-check admin access in the background.
      void applySession(session);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [applySession]);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, message: error.message };
    const admin = await checkIsAdmin(data.user);
    setUser(data.user);
    setIsAdmin(admin);
    if (!admin) {
      const message = 'You are signed in, but you are not authorized as an admin.';
      setAuthError(message);
      return { ok: false, message };
    }
    setAuthError('');
    return { ok: true };
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/admin` },
    });
    if (error) return { ok: false, message: error.message };
    // Browser redirects to Google; admin check happens on return via onAuthStateChange
    return { ok: true };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsAdmin(false);
    setAuthError('');
  };

  return (
    <AuthContext.Provider value={{ user, isAdmin, loading, authError, signIn, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
