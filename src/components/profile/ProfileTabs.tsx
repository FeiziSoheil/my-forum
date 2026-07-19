'use client';

import Link from 'next/link';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/** Matches Header `h-14` */
const HEADER_OFFSET_PX = 56;

type Tab = { href: string; label: string };

/**
 * Profile tab bar that pins below the global header while scrolling.
 * Uses fixed positioning + IntersectionObserver because CSS sticky is unreliable
 * inside the app's flex shell.
 */
export default function ProfileTabs({
  tabs,
  activeHref,
}: {
  tabs: Tab[];
  activeHref: string;
}) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  const [barHeight, setBarHeight] = useState(49);
  const [fixedBox, setFixedBox] = useState({ left: 0, width: 0 });

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setStuck(!entry.isIntersecting);
      },
      {
        root: null,
        rootMargin: `-${HEADER_OFFSET_PX}px 0px 0px 0px`,
        threshold: 0,
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const measure = () => {
      const shell = document.querySelector<HTMLElement>('[data-profile-shell]');
      if (shell) {
        const rect = shell.getBoundingClientRect();
        setFixedBox({ left: rect.left, width: rect.width });
      }
      if (barRef.current) {
        setBarHeight(barRef.current.offsetHeight);
      }
    };

    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, { passive: true });
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure);
    };
  }, [stuck, tabs]);

  return (
    <>
      {/* Sentinel sits where the bar naturally begins; when it crosses under the header, pin the bar */}
      <div ref={sentinelRef} className="mt-5 h-0" aria-hidden />
      {stuck ? <div style={{ height: barHeight }} aria-hidden /> : null}

      <div
        ref={barRef}
        className={cn(
          'z-40 border-b border-border bg-background',
          stuck ? 'fixed' : 'relative -mx-4'
        )}
        style={
          stuck
            ? {
                top: HEADER_OFFSET_PX,
                left: fixedBox.left,
                width: fixedBox.width,
              }
            : undefined
        }
      >
        <div className="flex px-4">
          {tabs.map((tab) => {
            const active = activeHref === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  'relative flex-1 py-3 text-center text-sm font-medium transition-colors',
                  active
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {tab.label}
                {active ? (
                  <span className="absolute inset-x-6 -bottom-px h-0.5 rounded-full bg-primary" />
                ) : null}
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
