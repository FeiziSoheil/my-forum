'use client';

import { useEffect } from 'react';
import { useTheme } from 'next-themes';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { setTheme, theme } = useTheme();

  useEffect(() => {
    // Force dark theme for auth page
    if (theme !== 'dark') {
      setTheme('dark');
    }
  }, [setTheme, theme]);

  return (
    <div className="dark">
      {children}
    </div>
  );
}

