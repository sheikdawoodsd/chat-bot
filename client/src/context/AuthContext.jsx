import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { markIntroAsSeen } from '../services/introStorage';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isJustRegistered, setIsJustRegistered] = useState(false);

  // Check existing session (STAY LOGGED IN via 30-day httpOnly cookie)
  const checkSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.user) {
          setUser(data.user);
          setIsJustRegistered(false);
          return;
        }
      }
      setUser(null);
      setIsJustRegistered(false);
    } catch (err) {
      console.warn('[Nova Auth] Session check error:', err);
      setUser(null);
      setIsJustRegistered(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  // Login
  const login = async ({ email, password }) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Login failed. Please check your credentials.');
    }

    setIsJustRegistered(false);
    setUser(data.user);
    return data.user;
  };

  // Register / Create Account
  const register = async ({ fullName, email, password, confirmPassword }) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName, email, password, confirmPassword }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Sign up failed. Please try again.');
    }

    setIsJustRegistered(true);
    setUser(data.user);
    return data.user;
  };

  // Mark intro as completed
  const markIntroSeen = useCallback(async () => {
    // Reset isJustRegistered SYNCHRONOUSLY first so showIntro immediately
    // becomes false — prevents any re-render window where intro re-triggers
    setIsJustRegistered(false);
    if (user?.id) {
      setUser((prev) => (prev ? { ...prev, hasSeenIntro: true } : prev));
      await markIntroAsSeen(user.id); // localStorage + server persist (async is fine now)
    }
  }, [user?.id]);

  // Logout
  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    setUser(null);
  };

  // Update Profile (Name, Username, Password)
  const updateProfile = async (payload) => {
    const body = typeof payload === 'string' ? { fullName: payload } : payload;
    const res = await fetch('/api/auth/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to update profile.');
    }

    setUser(data.user);
    return data.user;
  };

  // Delete Account
  const deleteAccount = async () => {
    const res = await fetch('/api/auth/account', {
      method: 'DELETE',
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to delete account.');
    }

    setUser(null);
  };

  const value = {
    user,
    isLoading,
    isJustRegistered,
    markIntroSeen,
    login,
    register,
    logout,
    updateProfile,
    deleteAccount,
    checkSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

