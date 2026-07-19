// lib/themes.ts
export interface Theme {
  name: string;
  class: string;
  description: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    foreground: string;
  };
}

export const themes: Record<string, Theme> = {
  light: {
    name: "Light",
    class: "light",
    description: "Clean and bright interface",
    colors: {
      primary: "#0f172a",
      secondary: "#f1f5f9",
      accent: "#3b82f6",
      background: "#ffffff",
      foreground: "#0f172a",
    },
  },
  dark: {
    name: "Dark",
    class: "dark",
    description: "Easy on the eyes in low light",
    colors: {
      primary: "#f8fafc",
      secondary: "#1e293b",
      accent: "#60a5fa",
      background: "#0f172a",
      foreground: "#f8fafc",
    },
  },
  blue: {
    name: "Ocean Blue",
    class: "theme-blue",
    description: "Calming ocean-inspired colors",
    colors: {
      primary: "#0ea5e9",
      secondary: "#e0f2fe",
      accent: "#0284c7",
      background: "#f0f9ff",
      foreground: "#0c4a6e",
    },
  },
  green: {
    name: "Forest Green",
    class: "theme-green",
    description: "Nature-inspired green palette",
    colors: {
      primary: "#059669",
      secondary: "#d1fae5",
      accent: "#10b981",
      background: "#f0fdf4",
      foreground: "#064e3b",
    },
  },
  purple: {
    name: "Purple Haze",
    class: "theme-purple",
    description: "Creative purple and violet tones",
    colors: {
      primary: "#7c3aed",
      secondary: "#ede9fe",
      accent: "#a855f7",
      background: "#faf5ff",
      foreground: "#581c87",
    },
  },
  orange: {
    name: "Sunset Orange",
    class: "theme-orange",
    description: "Warm and energetic orange theme",
    colors: {
      primary: "#ea580c",
      secondary: "#fed7aa",
      accent: "#f97316",
      background: "#fff7ed",
      foreground: "#9a3412",
    },
  },
  rose: {
    name: "Rose Gold",
    class: "theme-rose",
    description: "Elegant rose and gold accents",
    colors: {
      primary: "#e11d48",
      secondary: "#ffe4e6",
      accent: "#f43f5e",
      background: "#fff1f2",
      foreground: "#881337",
    },
  },
};

export const getThemeByClass = (className: string): Theme | undefined => {
  return Object.values(themes).find(theme => theme.class === className);
};

export const getThemeNames = (): string[] => {
  return Object.keys(themes);
};