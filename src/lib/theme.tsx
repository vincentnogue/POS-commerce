import { useEffect, useState, useCallback, createContext, useContext } from 'react';
import type { ReactNode } from 'react';

type Theme = 'light' | 'dark';
type ColorTheme = 'ocean' | 'coral' | 'default';

type ThemeContextValue = {
  theme: Theme;
  colorTheme: ColorTheme;
  toggle: () => void;
  setColorTheme: (theme: ColorTheme) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);
const THEME_KEY = 'liafrik_theme';
const COLOR_THEME_KEY = 'liafrik_color_theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'light';
    return (localStorage.getItem(THEME_KEY) as Theme) ?? 'light';
  });
  const [colorTheme, setColorTheme] = useState<ColorTheme>(() => {
    if (typeof window === 'undefined') return 'ocean';
    return (localStorage.getItem(COLOR_THEME_KEY) as ColorTheme) ?? 'ocean';
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('theme-ocean', 'theme-coral', 'theme-default');
    root.classList.add(`theme-${colorTheme}`);
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    localStorage.setItem(THEME_KEY, theme);
    localStorage.setItem(COLOR_THEME_KEY, colorTheme);
  }, [theme, colorTheme]);

  const toggle = useCallback(() => {
    setTheme((t) => (t === 'light' ? 'dark' : 'light'));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, colorTheme, toggle, setColorTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
