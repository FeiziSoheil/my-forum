"use client"

import { useTheme as useNextTheme } from "next-themes"
import { themes, getThemeByClass, type Theme } from "@/lib/themes"
import { useEffect, useState } from "react"

export function useTheme() {
  const { theme, setTheme, systemTheme, resolvedTheme } = useNextTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Prevent hydration mismatch by not returning theme-dependent values until mounted
  if (!mounted) {
    return {
      theme: undefined,
      setTheme: () => {},
      systemTheme: undefined,
      resolvedTheme: undefined,
      mounted: false,
      currentTheme: themes.light,
      isDarkMode: false,
      getAvailableThemes: () => Object.values(themes),
      getSystemTheme: () => "light" as const,
      getThemeColors: () => themes.light.colors,
    }
  }

  const currentTheme = getThemeByClass(theme || "light")
  const currentThemeConfig = currentTheme || themes.light

  const setThemeWithValidation = (newTheme: string) => {
    // Validate that the theme exists in our themes configuration
    const themeExists = Object.values(themes).some(t => t.class === newTheme) || 
                       ["light", "dark", "system"].includes(newTheme)
    
    if (themeExists) {
      setTheme(newTheme)
    } else {
      console.warn(`Theme "${newTheme}" not found. Falling back to light theme.`)
      setTheme("light")
    }
  }

  const getAvailableThemes = (): Theme[] => {
    return Object.values(themes)
  }

  const getSystemTheme = (): "light" | "dark" => {
    return systemTheme || "light"
  }

  const isDarkMode = (): boolean => {
    if (theme === "system") {
      return systemTheme === "dark"
    }
    return theme === "dark"
  }

  const getThemeColors = () => {
    return currentThemeConfig.colors
  }

  return {
    theme,
    setTheme: setThemeWithValidation,
    systemTheme,
    resolvedTheme,
    mounted,
    currentTheme: currentThemeConfig,
    isDarkMode: isDarkMode(),
    getAvailableThemes,
    getSystemTheme,
    getThemeColors,
  }
}
