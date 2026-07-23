import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { Appearance } from "react-native";
import * as SecureStore from "expo-secure-store";
import type { Theme } from "./theme";
import { PALETTES, DEFAULT_PALETTE_ID } from "./palettes";

const DEFAULT_DARK_PALETTE_ID = "obsidian";

const STORAGE_KEY = "ripple_palette_id";

type ThemeContextValue = {
  theme: Theme;
  paletteId: string;
  setPalette: (id: string) => void;
  mode: "light" | "dark";   // derived from theme.isDark — backward compat
  toggle: () => void;        // backward compat: cycles light ↔ dark
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [paletteId, setPaletteId] = useState(DEFAULT_PALETTE_ID);

  // Load persisted palette on mount; on first install default to dark if system is dark
  useEffect(() => {
    SecureStore.getItemAsync(STORAGE_KEY)
      .then((stored) => {
        if (stored && PALETTES[stored]) {
          setPaletteId(stored);
        } else {
          const scheme = Appearance.getColorScheme();
          if (scheme === "dark") setPaletteId(DEFAULT_DARK_PALETTE_ID);
        }
      })
      .catch(() => {});
  }, []);

  const setPalette = useCallback((id: string) => {
    if (!PALETTES[id]) return;
    setPaletteId(id);
    SecureStore.setItemAsync(STORAGE_KEY, id).catch(() => {});
  }, []);

  const theme = PALETTES[paletteId] ?? PALETTES[DEFAULT_PALETTE_ID];
  const mode: "light" | "dark" = theme.isDark ? "dark" : "light";

  const toggle = useCallback(() => {
    setPalette(theme.isDark ? "morning-mist" : "obsidian");
  }, [theme.isDark, setPalette]);

  return (
    <ThemeContext.Provider value={{ theme, paletteId, setPalette, mode, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
