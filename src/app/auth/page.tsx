'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { SignInForm } from '@/components/auth/SignInForm';
import { SignUpForm } from '@/components/auth/signupForm';
import BrandLogo from '@/components/BrandLogo';
import { safeCallbackUrl } from '@/lib/auth/callbackUrl';

function AuthPageContent() {
  const [isSignIn, setIsSignIn] = useState(true);
  const searchParams = useSearchParams();
  const callbackUrl = safeCallbackUrl(searchParams.get('callbackUrl'));

  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden bg-background px-5 py-10">
      {/* Ambient background accents */}
      <div className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-primary/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 size-72 rounded-full bg-primary/10 blur-3xl" />

      <div className="relative z-10 w-full max-w-sm">
        {/* Brand */}
        <div className="mb-8 flex flex-col items-center text-center">
          <BrandLogo href={null} size="lg" showWordmark={false} className="mb-4" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {isSignIn ? 'Welcome back' : 'Create account'}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {isSignIn
              ? 'Sign in to continue to Parakgram'
              : 'Join the community in a few seconds'}
          </p>
        </div>

        {/* Segmented switcher */}
        <div className="mb-6 grid grid-cols-2 gap-1 rounded-2xl border border-border/60 bg-muted/40 p-1">
          {[
            { key: true, label: 'Sign In' },
            { key: false, label: 'Sign Up' },
          ].map((tab) => (
            <button
              key={tab.label}
              onClick={() => setIsSignIn(tab.key)}
              className={`relative h-9 rounded-xl text-sm font-medium transition-colors ${
                isSignIn === tab.key
                  ? 'text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {isSignIn === tab.key && (
                <motion.span
                  layoutId="auth-tab-pill"
                  className="absolute inset-0 rounded-xl bg-primary shadow-sm"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                />
              )}
              <span className="relative">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Forms */}
        <AnimatePresence mode="wait">
          {isSignIn ? (
            <motion.div
              key="signin"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              <SignInForm callbackUrl={callbackUrl} />
            </motion.div>
          ) : (
            <motion.div
              key="signup"
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              <SignUpForm callbackUrl={callbackUrl} />
            </motion.div>
          )}
        </AnimatePresence>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Parakgram
        </p>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={null}>
      <AuthPageContent />
    </Suspense>
  );
}
