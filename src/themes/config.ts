import type { ThemeId, ThemeMeta } from './types';

export const DEFAULT_THEME: ThemeId = 'wander';

export const THEMES: ThemeMeta[] = [
  {
    id: 'wander',
    label: 'Wander',
    description: 'Dark luxury minimal — clean monochrome, image-first',
    swatch: 'linear-gradient(135deg, #0a0a0a 50%, #fafafa 50%)',
  },
  {
    id: 'atlas',
    label: 'Atlas',
    description: 'Editorial warmth — terracotta, cream, and sage accents',
    swatch: 'linear-gradient(135deg, #b85c38 50%, #f5f0e8 50%)',
  },
];

export function isThemeId(value: string | null | undefined): value is ThemeId {
  return value === 'wander' || value === 'atlas';
}
