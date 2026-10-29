import { act, renderHook } from '@testing-library/react';
import { createStore, Provider } from 'jotai';
import { ReactNode } from 'react';
import { themeState } from '../../state/themeState';
import { ThemeOption } from '../../types/theme';
import { useResolvedTheme } from '../use-resolved-theme';

describe('useResolvedTheme', () => {
  let dark: boolean;
  let listeners: Set<() => void>;

  beforeEach(() => {
    localStorage.clear();
    dark = false;
    listeners = new Set();
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: jest.fn(() => ({
        get matches() { return dark; },
        addEventListener: (_event: string, listener: () => void) => listeners.add(listener),
        removeEventListener: (_event: string, listener: () => void) => listeners.delete(listener),
      })),
    });
  });

  const mount = (selected: ThemeOption) => {
    localStorage.setItem('erxes-theme', JSON.stringify(selected));
    const store = createStore();
    store.set(themeState, selected);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    );
    return { store, ...renderHook(useResolvedTheme, { wrapper }) };
  };

  it.each(['light', 'dark'] as const)('keeps explicit %s when the OS differs', (selected) => {
    dark = selected === 'light';
    expect(mount(selected).result.current).toBe(selected);
  });

  it.each([false, true])('resolves system preference on first render (dark=%s)', (prefersDark) => {
    dark = prefersDark;
    expect(mount('system').result.current).toBe(prefersDark ? 'dark' : 'light');
  });

  it('follows OS changes only while system is selected and cleans up its listener', () => {
    const { result, store, unmount } = mount('system');
    expect(result.current).toBe('light');
    act(() => { dark = true; listeners.forEach((listener) => listener()); });
    expect(result.current).toBe('dark');
    act(() => store.set(themeState, 'light'));
    expect(result.current).toBe('light');
    act(() => { dark = false; listeners.forEach((listener) => listener()); });
    act(() => store.set(themeState, 'system'));
    expect(result.current).toBe('light');
    unmount();
    expect(listeners.size).toBe(0);
  });
});
