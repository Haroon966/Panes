export type ColorSchemePreference = 'dark' | 'light' | 'system';

export type EffectiveTerminalTheme = 'dark' | 'light';

export function resolveEffectiveTerminalTheme(pref: ColorSchemePreference): EffectiveTerminalTheme {
  if (pref === 'system') {
    if (typeof window === 'undefined') return 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return pref;
}

export function applyTerminalaiThemeDataset(effective: EffectiveTerminalTheme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.terminalaiTheme = effective;
}
