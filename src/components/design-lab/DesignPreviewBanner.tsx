import { ExternalLink, FlaskConical, X } from 'lucide-react';
import { useState } from 'react';
import { useDesignVariant } from '../../contexts/DesignVariantContext';
import { DEFAULT_DESIGN_VARIANT } from '../../lib/designVariants';

export default function DesignPreviewBanner() {
  const { variant, variantMeta, designLabEnabled, isPreviewDeployment } = useDesignVariant();
  const [dismissed, setDismissed] = useState(false);

  if (!designLabEnabled || dismissed) return null;
  if (!isPreviewDeployment && variant === DEFAULT_DESIGN_VARIANT) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[70] mx-auto max-w-xl">
      <div className="flex items-start gap-3 rounded-2xl border border-orange-200/80 bg-white/95 p-4 shadow-2xl shadow-orange-500/10 backdrop-blur-xl">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-rose-500 text-white">
          <FlaskConical className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-900">Design preview</p>
          <p className="mt-1 text-sm text-slate-600">
            Viewing <span className="font-semibold text-orange-700">{variantMeta.name}</span>
            {isPreviewDeployment ? ' on an unlisted Vercel preview URL.' : ' in local preview mode.'}
          </p>
          <a
            href="/design-lab"
            className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-orange-600 transition hover:text-orange-700"
          >
            Open Design Lab
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          aria-label="Dismiss preview banner"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
