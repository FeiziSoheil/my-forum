'use client'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreHorizontal } from "lucide-react"
import Link from 'next/link'
import React from 'react'
import { useAuth } from '@/context/AuthContext'

export default function ProfileMenu() {
  const { logout } = useAuth()

  return (
   <DropdownMenu>
  <DropdownMenuTrigger className="grid size-9 place-items-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50">
    <MoreHorizontal className="size-5" />
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuLabel>Edit Profile</DropdownMenuLabel>
    <DropdownMenuSeparator />
    <DropdownMenuItem asChild>
      <Link href="/bookmarks">Bookmarks</Link>
    </DropdownMenuItem>
    <DropdownMenuItem asChild>
      <Link href="/history">History</Link>
    </DropdownMenuItem>
    <DropdownMenuItem asChild>
      <Link href="/settings">Setting</Link>
    </DropdownMenuItem>
    <DropdownMenuItem
      onClick={() => logout()}
      className="text-red-500 bg-red-200 hover:bg-red-300"
    >
      Logout
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
  )
}
