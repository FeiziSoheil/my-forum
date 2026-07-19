// components/auth/SignInForm.tsx
"use client"
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { loginRequest } from '@/types/user';
import { Button } from '../ui/button';
import { AtSign, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';

const signInSchema = z.object({
  loginId: z.string()
    .min(1, 'Username or email is required'),
  password: z.string()
    .min(6, 'Password is required'),
  remember: z.boolean().optional(),
});

type SignInFormData = z.infer<typeof signInSchema>;

export const SignInForm = ({ callbackUrl }: { callbackUrl?: string }) => {
  const { login } = useAuth();
  const [error, setError] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
  });

  const onSubmit = async (data: SignInFormData) => {
    setError('');
    try {
      await login(data as loginRequest, callbackUrl);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-1.5">
        <div className="group relative">
          <AtSign className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
          <input
            {...register('loginId')}
            type="text"
            id="loginId"
            autoComplete="username"
            placeholder="Username or email"
            aria-invalid={!!errors.loginId}
            className="h-12 w-full rounded-xl border border-input bg-muted/40 pl-10 pr-4 text-[15px] outline-none transition-all placeholder:text-muted-foreground/70 focus:border-primary focus:bg-background focus:ring-4 focus:ring-primary/10 aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/10"
          />
        </div>
        {errors.loginId && (
          <p className="pl-1 text-xs text-destructive">{errors.loginId.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="group relative">
          <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
          <input
            {...register('password')}
            type={showPassword ? 'text' : 'password'}
            id="password"
            autoComplete="current-password"
            placeholder="Password"
            aria-invalid={!!errors.password}
            className="h-12 w-full rounded-xl border border-input bg-muted/40 pl-10 pr-11 text-[15px] outline-none transition-all placeholder:text-muted-foreground/70 focus:border-primary focus:bg-background focus:ring-4 focus:ring-primary/10 aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/10"
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute right-2.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        {errors.password && (
          <p className="pl-1 text-xs text-destructive">{errors.password.message}</p>
        )}
      </div>

      <div className="flex items-center justify-between">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground select-none">
          <input
            {...register('remember')}
            type="checkbox"
            className="size-4 cursor-pointer rounded border-input accent-primary"
          />
          Remember me
        </label>
        <Link
          href="/auth/forgot"
          className="text-sm font-medium text-primary transition-colors hover:underline"
        >
          Forgot password?
        </Link>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <Button
        type="submit"
        className="h-12 w-full rounded-xl text-[15px] font-semibold"
        variant="default"
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Signing In...
          </>
        ) : (
          'Sign In'
        )}
      </Button>
    </form>
  );
};
