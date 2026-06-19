import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Each theme maps to a [data-theme] block in src/index.css. `swatch` is used to
// render a little preview dot in the theme picker. `dark` flips the picker icon.
export interface ThemeDef {
  id: string;
  label: string;
  swatch: string; // accent colour for the preview dot
  dark?: boolean;
}

export const THEMES: ThemeDef[] = [
  { id: 'indigo', label: 'Indigo', swatch: '#4f46e5' },
  { id: 'claude', label: 'Claude', swatch: '#c96442' },
  { id: 'emerald', label: 'Emerald', swatch: '#059669' },
  { id: 'ocean', label: 'Ocean', swatch: '#0891b2' },
  { id: 'rose', label: 'Rose', swatch: '#e11d48' },
  { id: 'midnight', label: 'Midnight', swatch: '#818cf8', dark: true },
];

const DEFAULT_THEME = 'indigo';

export function applyTheme(id: string) {
  const theme = THEMES.find((t) => t.id === id) ?? THEMES[0];
  document.documentElement.setAttribute('data-theme', theme.id);
}

interface ThemeState {
  theme: string;
  setTheme: (id: string) => void;
}

export const useTheme = create<ThemeState>()(
  persist(
    (set) => ({
      theme: DEFAULT_THEME,
      setTheme: (theme) => {
        applyTheme(theme);
        set({ theme });
      },
    }),
    {
      name: 'reality-crm-theme',
      // Re-apply the persisted theme to the DOM as soon as the store rehydrates.
      onRehydrateStorage: () => (state) => {
        applyTheme(state?.theme ?? DEFAULT_THEME);
      },
    },
  ),
);
