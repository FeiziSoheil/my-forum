'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api/axios';
import BrandLogo from '@/components/BrandLogo';
import { Button } from '@/components/ui/button';
import { AtSign, ArrowLeft, Loader2, MailCheck } from 'lucide-react';

const forgotSchema = z.object({
  loginId: z.string().min(1, 'Username or email is required'),
});

type ForgotFormData = z.infer<typeof forgotSchema>;

const fieldClass =
  'h-12 w-full rounded-xl border border-input bg-muted/40 pl-10 pr-4 text-[15px] outline-none transition-all placeholder:text-muted-foreground/70 focus:border-primary focus:bg-background focus:ring-4 focus:ring-primary/10 aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/10';

export default function ForgotPasswordPage() {
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  // Dev-only: token surfaced by the API when no email service is configured.
  const [devToken, setDevToken] = useState<string | undefined>();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotFormData>({ resolver: zodResolver(forgotSchema) });

  const onSubmit = async (data: ForgotFormData) => {
    setError('');
    try {
      const res = await api.post('/auth/forgot-password', data);
      setDevToken(res.data?.devToken);
      setSubmitted(true);
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || 'Something went wrong');
    }
  };

  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden bg-background px-5 py-10">
      <div className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-primary/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 size-72 rounded-full bg-primary/10 blur-3xl" />

      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <BrandLogo href={null} size="lg" showWordmark={false} className="mb-4" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Forgot password</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Enter your username or email and we&apos;ll help you reset it.
          </p>
        </div>

        {submitted ? (
          <div className="space-y-5">
            <div className="flex flex-col items-center rounded-2xl border border-border/60 bg-muted/30 px-4 py-6 text-center">
              <div className="mb-3 grid size-10 place-items-center rounded-full bg-primary/10 text-primary">
                <MailCheck className="size-5" />
              </div>
              <p className="text-sm text-foreground">
                If an account matches that email or username, a password reset link has been generated.
              </p>
            </div>

            {devToken && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-left">
                <p className="text-xs font-semibold text-amber-500">Dev mode — no email service</p>
                <p className="mt-1 break-all text-xs text-muted-foreground">
                  Use this token to reset your password:
                </p>
                <code className="mt-1 block break-all text-[11px] text-foreground">{devToken}</code>
                <Link
                  href={`/auth/reset?token=${encodeURIComponent(devToken)}`}
                  className="mt-2 inline-block text-xs font-semibold text-primary hover:underline"
                >
                  Continue to reset →
                </Link>
              </div>
            )}

            <Link
              href="/auth"
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-input bg-muted/40 text-[15px] font-semibold text-foreground transition-colors hover:bg-muted"
            >
              <ArrowLeft className="size-4" />
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-1.5">
              <div className="group relative">
                <AtSign className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
                <input
                  {...register('loginId')}
                  type="text"
                  autoComplete="username"
                  placeholder="Username or email"
                  aria-invalid={!!errors.loginId}
                  className={fieldClass}
                />
              </div>
              {errors.loginId && (
                <p className="pl-1 text-xs text-destructive">{errors.loginId.message}</p>
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
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Sending...
                </>
              ) : (
                'Send reset link'
              )}
            </Button>

            <Link
              href="/auth"
              className="flex items-center justify-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              Back to sign in
            </Link>
          </form>
        )}

        <p className="mt-8 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Parakgram
        </p>
      </div>
    </div>
  );
}
