import { useCallback, useEffect, useState } from 'react';

export type ThemeChoice = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'oar-theme';
const CHOICES: ThemeChoice[] = ['system', 'light', 'dark'];

export function getThemeChoice(): ThemeChoice {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {
    /* storage can be unavailable in private modes */
  }
  return 'dark';
}

export function resolveTheme(choice: ThemeChoice): ResolvedTheme {
  if (choice === 'light' || choice === 'dark') return choice;
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches) {
    return 'light';
  }
  return 'dark';
}

export function applyTheme(choice: ThemeChoice): ResolvedTheme {
  const resolved = resolveTheme(choice);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themeChoice = choice;
  return resolved;
}

export function useTheme() {
  const [choice, setChoice] = useState<ThemeChoice>(getThemeChoice);
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolveTheme(getThemeChoice()));

  const choose = useCallback((next: ThemeChoice) => {
    setChoice(next);
    setResolved(applyTheme(next));
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* the theme still applies for this session */
    }
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => {
      if (choice !== 'system') return;
      setResolved(resolveTheme('system'));
      applyTheme('system');
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [choice]);

  return { choice, resolved, choose, choices: CHOICES };
}
