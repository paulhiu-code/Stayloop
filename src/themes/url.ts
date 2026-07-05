import { DEFAULT_THEME, isThemeId } from './config';
import type { ThemeId } from './types';

export function withThemeParam(path: string, theme?: ThemeId | string | null): string {
  const themeId = theme || document.documentElement.dataset.theme;
  if (!isThemeId(themeId)) return path;

  const [pathname, search = ''] = path.split('?');
  const params = new URLSearchParams(search);

  // Only preserve the theme in navigation URLs when it differs from the default
  // (production) look, so normal browsing stays on clean, param-free URLs and the
  // demo switcher stays hidden for regular visitors.
  if (themeId === DEFAULT_THEME) {
    params.delete('theme');
  } else {
    params.set('theme', themeId);
  }

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
