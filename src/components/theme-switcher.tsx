"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "./ui/dropdown-menu"
import { useTheme } from "@/hook/useTheme"
import { Check, Palette, Sun, Moon, Monitor } from "lucide-react"

type ThemeSwitcherProps = {
  compact?: boolean
  /** Where the menu opens relative to the trigger (e.g. side nav → "right") */
  menuSide?: "top" | "right" | "bottom" | "left"
  menuAlign?: "start" | "center" | "end"
}

export function ThemeSwitcher({
  compact = false,
  menuSide = "bottom",
  menuAlign = "end",
}: ThemeSwitcherProps) {
  const { setTheme, theme, mounted, currentTheme, getAvailableThemes } = useTheme()

  if (!mounted) {
    return compact ? (
      <Button variant="ghost" size="icon" className="rounded-full" disabled>
        <Palette className="h-4 w-4" />
      </Button>
    ) : (
      <Button variant="outline" disabled>
        <Palette className="h-4 w-4 mr-2" />
        Loading...
      </Button>
    )
  }

  const currentThemeName = currentTheme?.name || "Light"

  const getThemeIcon = (themeClass: string) => {
    switch (themeClass) {
      case "light":
        return <Sun className="h-4 w-4" />
      case "dark":
        return <Moon className="h-4 w-4" />
      case "system":
        return <Monitor className="h-4 w-4" />
      default:
        return <Palette className="h-4 w-4" />
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {compact ? (
          <Button variant="ghost" size="icon" className="rounded-full" aria-label="Change theme">
            {getThemeIcon(theme || "light")}
          </Button>
        ) : (
          <Button variant="outline" className="min-w-[140px] justify-start">
            {getThemeIcon(theme || "light")}
            <span className="ml-2">{currentThemeName}</span>
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={menuSide}
        align={menuAlign}
        sideOffset={8}
        collisionPadding={12}
        className="z-[60] w-56"
      >
        <DropdownMenuItem onClick={() => setTheme("light")} className="flex items-center">
          <Sun className="h-4 w-4 mr-2" />
          <span>Light</span>
          {theme === "light" && <Check className="h-4 w-4 ml-auto" />}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")} className="flex items-center">
          <Moon className="h-4 w-4 mr-2" />
          <span>Dark</span>
          {theme === "dark" && <Check className="h-4 w-4 ml-auto" />}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {getAvailableThemes().filter(themeConfig => !["light", "dark"].includes(themeConfig.class)).map((themeConfig) => (
          <DropdownMenuItem 
            key={themeConfig.class} 
            onClick={() => setTheme(themeConfig.class)} 
            className="flex items-center"
          >
            <div 
              className="h-4 w-4 mr-2 rounded-full border" 
              style={{ backgroundColor: themeConfig.colors.primary }}
            />
            <span>{themeConfig.name}</span>
            {theme === themeConfig.class && <Check className="h-4 w-4 ml-auto" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setTheme("system")} className="flex items-center">
          <Monitor className="h-4 w-4 mr-2" />
          <span>System</span>
          {theme === "system" && <Check className="h-4 w-4 ml-auto" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
