import React, { createContext, useContext, useEffect, useState } from 'react';
import { API_URL } from '@/lib/api-config';

type AppRole = 'admin' | 'general_doctor' | 'specialist_doctor' | 'laboratory_technician';

interface User {
  id: string;
  email: string;
  full_name: string;
  role: AppRole;
}

interface AuthContextType {
  user: User | null;
  role: AppRole | null;
  profile: { full_name: string; email: string; department_id: string | null } | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ user: User | null; error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [profile, setProfile] = useState<AuthContextType['profile']>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async (token: string) => {
    try {
      const res = await fetch(`${API_URL}/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setRole(data.role);
        setProfile(data.profile);
      } else {
        signOut();
      }
    } catch (err) {
      console.error('Failed to fetch user data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      fetchUserData(token);
    } else {
      setLoading(false);
    }
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      if (!res.ok) return { error: new Error(data.message || 'Login failed') };

      localStorage.setItem('auth_token', data.token);
      setUser(data.user);
      setRole(data.user.role);
      // Profile will be fetched if needed, but for now we set user data
      return { user: data.user, error: null };
    } catch (err) {
      return { user: null, error: err as Error };
    }
  };

  const signOut = async () => {
    localStorage.removeItem('auth_token');
    setUser(null);
    setRole(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, role, profile, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

