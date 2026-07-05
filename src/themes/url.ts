import { isThemeId } from './config';
import type { ThemeId } from './types';

export function withThemeParam(path: string, theme?: ThemeId | string | null): string {
  const themeId = theme || document.documentElement.dataset.theme;
  if (!isThemeId(themeId)) return path;

  const [pathname, search = ''] = path.split('?');
  const params = new URLSearchParams(search);
  params.set('theme', themeId);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
