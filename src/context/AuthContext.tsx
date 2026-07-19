"use client";
import { createContext, useContext, useMemo, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api/axios';
import { useMe } from '@/hook/useMe';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { RegisterRequest, loginRequest, User } from '@/types/user';
import { safeCallbackUrl } from '@/lib/auth/callbackUrl';

interface AuthContextType {
  register: (data: RegisterRequest, redirectTo?: string) => Promise<void>;
  login: (data: loginRequest, redirectTo?: string) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean; // فقط برای عملیات mutate (login/register/logout)
  isAuthenticated: boolean;
  user: User | undefined;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const router = useRouter();
  const queryClient = useQueryClient();

  // هوک React-Query که /auth/me رو می‌زنه و کش رو مدیریت می‌کنه
  const { data: user, isLoading, refetch, error } = useMe();

  const register = async (data: RegisterRequest, redirectTo?: string) => {
    await api.post('/auth/register', data);
    toast.success('registration successful');
    await refetch(); // کش me رو تازه کن
    router.replace(safeCallbackUrl(redirectTo));
  };

  const login = async (data: loginRequest, redirectTo?: string) => {
    await api.post('/auth/login', data);
    toast.success('login successful');
    await refetch(); // کش me رو تازه کن
    router.push(safeCallbackUrl(redirectTo));
  };

  const logout = async () => {
    await api.post('/auth/logout');
    queryClient.removeQueries({ queryKey: ['me'] });
    queryClient.clear();
    toast.success('logout successful');
    router.replace('/auth');
  };

  const value = useMemo(
    () => ({
      register,
      login,
      logout,
      loading: isLoading, // فقط لودینگ fetch اولیه یا mutate
      isAuthenticated: !!user && !error, // فقط اگر user وجود داشته باشد و خطا نباشد
      user,
    }),
    [user, isLoading, error, refetch]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};