import React, { createContext, useContext, useEffect, useState } from "react";
import { THEMES, DEFAULT_THEME, type ThemeName } from "@/lib/themes";

type ColorMode = "light" | "dark";

interface ThemeContextType {
  theme: ColorMode;
  themeName: ThemeName;
  toggleTheme: () => void;
  setThemeName: (name: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeName, setThemeNameState] = useState<ThemeName>(() => {
    const stored = localStorage.getItem("themeName");
    return (stored as ThemeName) || DEFAULT_THEME;
  });

  const [colorMode, setColorMode] = useState<ColorMode>(() => {
    const config = THEMES[themeName];
    if (config?.alwaysDark) return "dark";
    const stored = localStorage.getItem("theme");
    return (stored as ColorMode) || "light";
  });

  // Apply theme class + dark mode to <html>
  useEffect(() => {
    const root = document.documentElement;

    // Remove all theme classes
    root.classList.remove("theme-hearthstone", "theme-zurich", "theme-nebula");
    root.classList.add(`theme-${themeName}`);

    const config = THEMES[themeName];
    const effectiveMode = config?.alwaysDark ? "dark" : colorMode;
    if (effectiveMode === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    localStorage.setItem("themeName", themeName);
    localStorage.setItem("theme", colorMode);
  }, [themeName, colorMode]);

  const toggleTheme = () => {
    const config = THEMES[themeName];
    if (config?.alwaysDark) return; // no toggle for always-dark themes
    setColorMode(prev => (prev === "light" ? "dark" : "light"));
  };

  const setThemeName = (name: ThemeName) => {
    setThemeNameState(name);
    const config = THEMES[name];
    if (config?.alwaysDark) {
      setColorMode("dark");
    }
  };

  const effectiveTheme: ColorMode = THEMES[themeName]?.alwaysDark ? "dark" : colorMode;

  return (
    <ThemeContext.Provider value={{ theme: effectiveTheme, themeName, toggleTheme, setThemeName }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
