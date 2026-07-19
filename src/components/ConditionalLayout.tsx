'use client';

import { usePathname } from 'next/navigation';
import Header from '@/layout/Header';
import Navigation from '@/layout/Navigation';
import { cn } from '@/lib/utils';

interface ConditionalLayoutProps {
  children: React.ReactNode;
}

export default function ConditionalLayout({ children }: ConditionalLayoutProps) {
  const pathname = usePathname();

  const isAuthPage = pathname === '/auth' || pathname.startsWith('/auth/');
  const isChatThread =
    pathname.startsWith('/messages/') && pathname !== '/messages';
  const isMessages = pathname === '/messages' || isChatThread;
  const isStoryComposer = pathname.startsWith('/stories/');
  const isPostComposer =
    pathname === '/post/new' || /^\/post\/[^/]+\/reply\/?$/.test(pathname);
  const isImmersiveComposer = isStoryComposer || isPostComposer;

  // Mobile: hide chrome on auth, chat thread, stories, post composer
  const showMobileChrome =
    !isAuthPage && !isChatThread && !isImmersiveComposer;
  // Desktop: keep side nav on messages (incl. threads); hide only auth/composers
  const showDesktopNav = !isAuthPage && !isImmersiveComposer;
  // Header on mobile list; hidden on threads/composers
  const showHeader = !isAuthPage && !isChatThread && !isImmersiveComposer;

  return (
    <div
      className={cn(
        'min-h-dvh',
        // Desktop rail is in-flow (not fixed) so chat/list never sit underneath it
        showDesktopNav && 'lg:flex'
      )}
    >
      <Navigation showMobile={showMobileChrome} showDesktop={showDesktopNav} />
      <div className="relative min-w-0 flex-1">
        {showHeader && (
          <div
            className={cn(
              // Fixed so it never scrolls away (CSS sticky breaks in this flex shell)
              'fixed inset-x-0 top-0 z-40',
              showDesktopNav && 'lg:start-[4.5rem]',
              isMessages && 'lg:hidden'
            )}
          >
            <Header />
          </div>
        )}
        <div
          className={cn(
            // Reserve space for fixed header (hidden on lg messages)
            showHeader && 'pt-14',
            showHeader && isMessages && 'lg:pt-0'
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
