export type DesignVariantId = 'control';

export type DesignVariantStatus = 'baseline' | 'review' | 'approved' | 'archived';

export type DesignVariant = {
  id: DesignVariantId;
  name: string;
  description: string;
  branch: string;
  status: DesignVariantStatus;
  surfaces: string[];
};

export const DEFAULT_DESIGN_VARIANT: DesignVariantId = 'control';

export const DESIGN_VARIANTS: Record<DesignVariantId, DesignVariant> = {
  control: {
    id: 'control',
    name: 'Control (Current)',
    description: 'The production design baseline. All new variants are compared against this.',
    branch: 'main',
    status: 'baseline',
    surfaces: ['Global'],
  },
};

const VARIANT_STORAGE_KEY = 'stayloop-design-variant';

export function isValidVariantId(value: string | null | undefined): value is DesignVariantId {
  return Boolean(value && value in DESIGN_VARIANTS);
}

export function isDesignLabEnabled(): boolean {
  if (import.meta.env.DEV) return true;
  if (import.meta.env.VITE_DESIGN_LAB === 'true') return true;
  return isVercelPreviewDeployment();
}

export function isVercelPreviewDeployment(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host.includes('-git-') && host.endsWith('.vercel.app');
}

export function readVariantFromUrl(search = window.location.search): DesignVariantId | null {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const variant = params.get('variant');
  return isValidVariantId(variant) ? variant : null;
}

export function readStoredVariant(): DesignVariantId | null {
  try {
    const stored = sessionStorage.getItem(VARIANT_STORAGE_KEY);
    return isValidVariantId(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function storeVariant(variant: DesignVariantId) {
  try {
    sessionStorage.setItem(VARIANT_STORAGE_KEY, variant);
  } catch {
    // Ignore storage failures in restricted browsers.
  }
}

export function resolveDesignVariant(search = window.location.search): DesignVariantId {
  return readVariantFromUrl(search) ?? readStoredVariant() ?? DEFAULT_DESIGN_VARIANT;
}

export function withVariantParam(path: string, variant: DesignVariantId): string {
  if (variant === DEFAULT_DESIGN_VARIANT) return path;

  const [pathname, existingSearch = ''] = path.split('?');
  const params = new URLSearchParams(existingSearch);
  params.set('variant', variant);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function appendVariantToCurrentUrl(variant: DesignVariantId): string {
  const params = new URLSearchParams(window.location.search);
  if (variant === DEFAULT_DESIGN_VARIANT) {
    params.delete('variant');
  } else {
    params.set('variant', variant);
  }

  const query = params.toString();
  return query ? `${window.location.pathname}?${query}` : window.location.pathname;
}

export function listDesignVariants(): DesignVariant[] {
  return Object.values(DESIGN_VARIANTS);
}
