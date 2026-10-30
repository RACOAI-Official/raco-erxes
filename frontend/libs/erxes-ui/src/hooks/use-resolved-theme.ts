import { useAtomValue } from 'jotai';
import { themeState } from '../state/themeState';
import { ThemeValue } from '../types/theme';
import { useMediaQuery } from './use-media-query';

// Editor providers accept concrete themes, while the saved preference also
// supports following the operating system.
export const useResolvedTheme = (): ThemeValue => {
  const selected = useAtomValue(themeState);
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');

  return selected === 'system' ? (prefersDark ? 'dark' : 'light') : selected;
};
