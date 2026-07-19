"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Home, MessageCircle, Plus, Heart, User } from "lucide-react";
import { useConversations } from "@/hook/useChat";
import {
  useNotificationStream,
  useUnreadNotificationCount,
} from "@/hook/useNotifications";
import { useAuth } from "@/context/AuthContext";
import BrandLogo from "@/components/BrandLogo";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/messages", label: "Messages", icon: MessageCircle },
  { href: "/likes", label: "Activity", icon: Heart },
  { href: "/profile", label: "Profile", icon: User },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

type NavigationProps = {
  /** Bottom pill — mobile / tablet */
  showMobile?: boolean;
  /** Left rail — desktop */
  showDesktop?: boolean;
};

export default function Navigation({
  showMobile = true,
  showDesktop = true,
}: NavigationProps) {
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();
  const { data: conversations } = useConversations(isAuthenticated);
  const { data: unreadNotifications = 0 } = useUnreadNotificationCount(
    isAuthenticated
  );
  useNotificationStream(isAuthenticated);

  const unreadTotal =
    isAuthenticated && conversations
      ? conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0)
      : 0;

  const badgeFor = (href: string) => {
    if (href === "/messages") return unreadTotal;
    if (href === "/likes") return unreadNotifications;
    return 0;
  };

  return (
    <>
      {/* Mobile / tablet bottom pill */}
      {showMobile && (
        <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-[2%] pb-[calc(env(safe-area-inset-bottom)+1rem)] pointer-events-none lg:hidden">
          <div className="pointer-events-auto flex w-full max-w-xl items-center justify-between gap-1 rounded-full border border-border/60 bg-background/70 px-3 py-1.5 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.4)] backdrop-blur-xl supports-[backdrop-filter]:bg-background/50">
            {navItems.slice(0, 2).map((item) => (
              <NavLink
                key={item.href}
                item={item}
                active={isActive(pathname, item.href)}
                badge={badgeFor(item.href)}
                layoutId="nav-active-pill-mobile"
              />
            ))}

            <CreateButton />

            {navItems.slice(2).map((item) => (
              <NavLink
                key={item.href}
                item={item}
                active={isActive(pathname, item.href)}
                badge={badgeFor(item.href)}
                layoutId="nav-active-pill-mobile"
              />
            ))}
          </div>
        </nav>
      )}

      {/* Desktop left rail — in-flow (sticky), not fixed, so content never overlaps */}
      {showDesktop && (
        <aside className="sticky top-0 z-40 hidden h-dvh w-[4.5rem] shrink-0 flex-col items-center border-e border-border/60 bg-background py-4 lg:flex">
          <BrandLogo
            showWordmark={false}
            size="sm"
            className="mb-6"
          />

          <nav className="flex flex-1 flex-col items-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                active={isActive(pathname, item.href)}
                badge={badgeFor(item.href)}
                layoutId="nav-active-pill-desktop"
                className="size-12"
              />
            ))}
          </nav>

          <div className="mt-auto flex flex-col items-center gap-2">
            <ThemeSwitcher compact menuSide="right" menuAlign="end" />
            <CreateButton className="size-12" />
          </div>
        </aside>
      )}
    </>
  );
}

function CreateButton({ className }: { className?: string }) {
  return (
    <Link
      href="/post/new"
      aria-label="Create"
      className={cn(
        "group relative mx-0.5 grid size-12 place-items-center rounded-full bg-primary text-primary-foreground transition-transform duration-300 hover:scale-105 active:scale-95",
        className
      )}
    >
      <span className="absolute inset-0 rounded-full bg-primary opacity-40 blur-md transition-opacity duration-300 group-hover:opacity-70" />
      <Plus
        size={24}
        className="relative transition-transform duration-300 group-hover:rotate-90"
      />
    </Link>
  );
}

function NavLink({
  item,
  active,
  badge = 0,
  layoutId,
  className,
}: {
  item: {
    href: string;
    label: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
  };
  active: boolean;
  badge?: number;
  layoutId: string;
  className?: string;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-label={item.label}
      aria-current={active ? "page" : undefined}
      title={item.label}
      className={cn(
        "group relative grid size-11 place-items-center rounded-full transition-colors duration-300",
        active
          ? "text-primary"
          : "text-muted-foreground hover:text-foreground",
        className
      )}
    >
      {active && (
        <motion.span
          layoutId={layoutId}
          className="absolute inset-0 rounded-full bg-primary/10"
          transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.9 }}
        />
      )}
      <motion.span
        className="relative"
        animate={{ scale: active ? 1.12 : 1, y: active ? -1 : 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 28 }}
      >
        <Icon size={21} className="shrink-0" />
        {badge > 0 && (
          <span className="absolute -end-1.5 -top-1.5 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[9px] font-bold leading-4 text-primary-foreground">
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </motion.span>
    </Link>
  );
}
