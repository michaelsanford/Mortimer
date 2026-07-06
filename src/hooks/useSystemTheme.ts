import { useState, useEffect } from 'react';

export function useSystemTheme(): 'dark' | 'light' {
  const [isDark, setIsDark] = useState(() =>
    !window.matchMedia || window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  useEffect(() => {
    if (!window.matchMedia) return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = (e: MediaQueryListEvent) => setIsDark(e.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, []);

  return isDark ? 'dark' : 'light';
}
