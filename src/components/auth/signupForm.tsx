// components/auth/SignUpForm.tsx
"use client"
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { RegisterRequest } from '@/types/user';
import { Button } from '../ui/button';
import { AtSign, User, Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';

const signUpSchema = z.object({
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must be less than 20 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  fullname: z.string()
    .min(2, 'Full name must be at least 2 characters')
    .max(50, 'Full name must be less than 50 characters'),
  email: z.string()
    .email('Invalid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type SignUpFormData = z.infer<typeof signUpSchema>;

const fieldClass =
  "h-12 w-full rounded-xl border border-input bg-muted/40 pl-10 pr-4 text-[15px] outline-none transition-all placeholder:text-muted-foreground/70 focus:border-primary focus:bg-background focus:ring-4 focus:ring-primary/10 aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/10";

export const SignUpForm = ({ callbackUrl }: { callbackUrl?: string }) => {
  const { register: registerUser, loading } = useAuth();
  const [error, setError] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
  });

  const onSubmit = async (data: SignUpFormData) => {
    setError('');
    try {
      await registerUser(data as RegisterRequest, callbackUrl);
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <div className="group relative">
            <AtSign className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
            <input
              {...register('username')}
              type="text"
              id="username"
              autoComplete="username"
              placeholder="Username"
              aria-invalid={!!errors.username}
              className={fieldClass}
            />
          </div>
          {errors.username && (
            <p className="pl-1 text-xs text-destructive">{errors.username.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="group relative">
            <User className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
            <input
              {...register('fullname')}
              type="text"
              id="fullname"
              autoComplete="name"
              placeholder="Full name"
              aria-invalid={!!errors.fullname}
              className={fieldClass}
            />
          </div>
          {errors.fullname && (
            <p className="pl-1 text-xs text-destructive">{errors.fullname.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="group relative">
          <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
          <input
            {...register('email')}
            type="email"
            id="email"
            autoComplete="email"
            placeholder="Email"
            aria-invalid={!!errors.email}
            className={fieldClass}
          />
        </div>
        {errors.email && (
          <p className="pl-1 text-xs text-destructive">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="group relative">
          <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
          <input
            {...register('password')}
            type={showPassword ? 'text' : 'password'}
            id="password"
            autoComplete="new-password"
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

      <div className="space-y-1.5">
        <div className="group relative">
          <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
          <input
            {...register('confirmPassword')}
            type={showPassword ? 'text' : 'password'}
            id="confirmPassword"
            autoComplete="new-password"
            placeholder="Confirm password"
            aria-invalid={!!errors.confirmPassword}
            className={fieldClass}
          />
        </div>
        {errors.confirmPassword && (
          <p className="pl-1 text-xs text-destructive">{errors.confirmPassword.message}</p>
        )}
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
        disabled={loading}
      >
        {loading ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Creating Account...
          </>
        ) : (
          'Create Account'
        )}
      </Button>
    </form>
  );
};
