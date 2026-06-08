import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  DEFAULT_DESIGN_VARIANT,
  type DesignVariant,
  type DesignVariantId,
  DESIGN_VARIANTS,
  appendVariantToCurrentUrl,
  isDesignLabEnabled,
  resolveDesignVariant,
  storeVariant,
} from '../lib/designVariants';

type DesignVariantContextValue = {
  variant: DesignVariantId;
  variantMeta: DesignVariant;
  setVariant: (next: DesignVariantId) => void;
  designLabEnabled: boolean;
  isPreviewDeployment: boolean;
};

const DesignVariantContext = createContext<DesignVariantContextValue | null>(null);

function applyVariantToDocument(variant: DesignVariantId) {
  document.documentElement.dataset.variant = variant;
}

export function DesignVariantProvider({ children }: { children: ReactNode }) {
  const [variant, setVariantState] = useState<DesignVariantId>(() => resolveDesignVariant());
  const designLabEnabled = isDesignLabEnabled();

  useEffect(() => {
    applyVariantToDocument(variant);
    storeVariant(variant);
  }, [variant]);

  useEffect(() => {
    function syncVariantFromUrl() {
      setVariantState(resolveDesignVariant());
    }

    window.addEventListener('popstate', syncVariantFromUrl);
    return () => window.removeEventListener('popstate', syncVariantFromUrl);
  }, []);

  const setVariant = (next: DesignVariantId) => {
    setVariantState(next);
    const nextUrl = appendVariantToCurrentUrl(next);
    window.history.replaceState({}, '', nextUrl);
  };

  const value = useMemo<DesignVariantContextValue>(
    () => ({
      variant,
      variantMeta: DESIGN_VARIANTS[variant],
      setVariant,
      designLabEnabled,
      isPreviewDeployment: designLabEnabled && !import.meta.env.DEV,
    }),
    [variant, designLabEnabled]
  );

  return <DesignVariantContext.Provider value={value}>{children}</DesignVariantContext.Provider>;
}

export function useDesignVariant() {
  const context = useContext(DesignVariantContext);
  if (!context) {
    throw new Error('useDesignVariant must be used within DesignVariantProvider');
  }
  return context;
}

export function useDesignVariantOptional() {
  return useContext(DesignVariantContext);
}

export { DEFAULT_DESIGN_VARIANT };
