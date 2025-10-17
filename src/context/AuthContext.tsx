"use client";
import { createContext, useContext, useMemo, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api/axios';
import { useMe } from '@/hook/useMe';
import { toast } from 'sonner';
import type { RegisterRequest, loginRequest, User } from '@/types/user';

interface AuthContextType {
  register: (data: RegisterRequest) => Promise<void>;
  login: (data: loginRequest) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean; // فقط برای عملیات mutate (login/register/logout)
  isAuthenticated: boolean;
  user: User | undefined;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const router = useRouter();

  // هوک React-Query که /auth/me رو می‌زنه و کش رو مدیریت می‌کنه
  const { data: user, isLoading, refetch } = useMe();

  const register = async (data: RegisterRequest) => {
    await api.post('/auth/register', data);
    toast.success('registration successful');
    await refetch(); // کش me رو تازه کن
    router.replace('/');
  };

  const login = async (data: loginRequest) => {
    await api.post('/auth/login', data);
    toast.success('login successful');
    await refetch(); // کش me رو تازه کن
    router.replace('/');
  };

  const logout = async () => {
    await api.post('/auth/logout');
    toast.success('logout successful');
    router.replace('/auth');
  };

  const value = useMemo(
    () => ({
      register,
      login,
      logout,
      loading: isLoading, // فقط لودینگ fetch اولیه یا mutate
      isAuthenticated: !!user,
      user,
    }),
    [user, isLoading, refetch]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};