import { create } from 'zustand';

interface ThemeState {
  isDark: boolean;
  toggle: () => void;
  setDark: (dark: boolean) => void;
}

const stored = typeof window !== 'undefined' ? localStorage.getItem('kubernal-theme') : null;
const initialDark = stored !== null ? stored === 'dark' : true;

export const useTheme = create<ThemeState>((set) => ({
  isDark: initialDark,
  toggle: () =>
    set((state) => {
      const next = !state.isDark;
      document.documentElement.classList.toggle('dark', next);
      localStorage.setItem('kubernal-theme', next ? 'dark' : 'light');
      return { isDark: next };
    }),
  setDark: (dark) => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('kubernal-theme', dark ? 'dark' : 'light');
    set({ isDark: dark });
  },
}));
