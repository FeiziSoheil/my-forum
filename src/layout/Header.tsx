import ProfileMenu from '@/components/profile/ProfileMenu'
import BrandLogo from '@/components/BrandLogo'
import { ThemeSwitcher } from '@/components/theme-switcher'
import { Button } from '@/components/ui/button'
import { Search } from 'lucide-react'
import Link from 'next/link'
import React from 'react'

export default function Header() {
  return (
    <header className="h-14 border-b border-border/60 bg-background">
      <div className="mx-auto flex h-full w-full max-w-xl items-center justify-between px-4 lg:max-w-2xl xl:max-w-3xl">
        <BrandLogo />

        {/* Actions */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            asChild
          >
            <Link href="/search" aria-label="Search">
              <Search className="h-4 w-4" />
            </Link>
          </Button>
          <ThemeSwitcher compact />
          <ProfileMenu />
        </div>
      </div>
    </header>
  )
}
