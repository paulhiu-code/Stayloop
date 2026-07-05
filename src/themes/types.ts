export type ThemeId = 'wander' | 'atlas' | 'classic';

export type ThemeMeta = {
  id: ThemeId;
  label: string;
  description: string;
  swatch: string;
};
